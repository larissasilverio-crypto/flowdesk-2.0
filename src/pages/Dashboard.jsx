import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText,
  TrendingUp,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, parseISO } from 'date-fns';

import StatsCard from '@/components/dashboard/StatsCard';
import TasksChart from '@/components/dashboard/TasksChart';
import RecentTasksTable from '@/components/dashboard/RecentTasksTable';
import RecentAtendimentos from '@/components/dashboard/RecentAtendimentos';
import AlertsList from '@/components/dashboard/AlertsList';
import TVDashboard from '@/components/dashboard/TVDashboard';
import PerformanceMetrics from '@/components/dashboard/PerformanceMetrics';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import TarefasKanban from '@/components/dashboard/TarefasKanban';
import DashboardCustomizer, { useWidgetConfig } from '@/components/dashboard/DashboardCustomizer';

function buildEventDateTime(ev) {
  // ev.data_evento = "YYYY-MM-DD"
  // ev.hora_inicio = "HH:mm"
  if (!ev?.data_evento) return null;
  try {
    const d = parseISO(ev.data_evento);
    const [hh, mm] = String(ev?.hora_inicio || "00:00").split(":").map((x) => parseInt(x, 10));
    d.setHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
    return d;
  } catch {
    return null;
  }
}

function inferTipoAudienciaPericia(ev) {
  const obs = String(ev?.observacoes || "");
  if (obs.includes("[AGENDAMENTO_PUBLICACAO:PERICIA]")) return "Perícia";
  if (obs.includes("[AGENDAMENTO_PUBLICACAO:AUDIENCIA]")) return "Audiência";

  const tipo = String(ev?.tipo_evento || "").toLowerCase().trim();
  if (tipo === "perícia" || tipo === "pericia") return "Perícia";
  if (tipo === "audiência" || tipo === "audiencia") return "Audiência";

  // fallback by title keyword
  const t = String(ev?.titulo || "").toLowerCase();
  if (t.includes("perícia") || t.includes("pericia")) return "Perícia";
  if (t.includes("audiência") || t.includes("audiencia")) return "Audiência";

  return "";
}

function parseParteAndProcessoFromTitulo(tituloRaw) {
  const titulo = String(tituloRaw || "").trim();

  // remove prefix "Audiência — " / "Perícia — " if present
  const cleaned = titulo
    .replace(/^audiência\s*—\s*/i, "")
    .replace(/^audiencia\s*—\s*/i, "")
    .replace(/^perícia\s*—\s*/i, "")
    .replace(/^pericia\s*—\s*/i, "")
    .trim();

  // Expected patterns (from your Agenda conversion):
  // "PARTE — Proc 1000664-12.2022.8.26.0691 ..."
  // or "Proc 1000..."
  let parte = "";
  let processo = "";

  // Try " — Proc "
  const parts = cleaned.split(" — ").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // If first part looks like a name and second starts with Proc
    const maybeProcPart = parts.find((p) => /^proc\s+/i.test(p));
    if (maybeProcPart) {
      const beforeProc = parts[0];
      if (!/^proc\s+/i.test(beforeProc)) parte = beforeProc;
      const m = maybeProcPart.match(/^proc\s+(.+)$/i);
      processo = (m?.[1] || "").trim();
    }
  }

  // Fallback: regex "Proc <something>"
  if (!processo) {
    const m = cleaned.match(/proc\s+([0-9.\-\/]+[0-9])/i);
    if (m?.[1]) processo = m[1].trim();
  }

  // If still no parte, try grabbing text before "Proc"
  if (!parte) {
    const idx = cleaned.toLowerCase().indexOf("proc ");
    if (idx > 0) {
      const candidate = cleaned.slice(0, idx).trim().replace(/[—-]+$/g, "").trim();
      // avoid nonsense
      if (candidate && candidate.length <= 120) parte = candidate;
    }
  }

  return { parte: parte || "-", processo: processo || "-" };
}

function AudienciasCard({ eventos = [] }) {
  const now = new Date();

  const upcoming = (Array.isArray(eventos) ? eventos : [])
    .map((ev) => {
      const dt = buildEventDateTime(ev);
      const tipo = inferTipoAudienciaPericia(ev);
      return { ev, dt, tipo };
    })
    .filter(({ ev, dt, tipo }) => {
      if (!dt) return false;
      if (dt < now) return false;
      if (String(ev?.status || "").toLowerCase() !== "agendado") return false;
      if (tipo === "Audiência" || tipo === "Perícia") return true;
      const obs = String(ev?.observacoes || "");
      if (obs.includes("[AGENDAMENTO_PUBLICACAO:AUDIENCIA]")) return true;
      if (obs.includes("[AGENDAMENTO_PUBLICACAO:PERICIA]")) return true;
      return false;
    })
    .sort((a, b) => a.dt - b.dt)
    .slice(0, 7);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-sm">
            <CalendarIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm">Audiências & Perícias</div>
            <div className="text-xs text-muted-foreground">Próximos agendamentos</div>
          </div>
        </div>
        {upcoming.length > 0 && (
          <span className="text-xs font-semibold bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
            {upcoming.length} próximo{upcoming.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2.5">
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <CalendarIcon className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma audiência ou perícia futura</p>
          </div>
        ) : (
          upcoming.map(({ ev, dt, tipo }) => {
            const { parte, processo } = parseParteAndProcessoFromTitulo(ev?.titulo);
            const isAudiencia = tipo === "Audiência";
            const dtStr = dt ? dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "-";
            const anoStr = dt ? dt.getFullYear() : "";
            const hora = String(ev?.hora_inicio || "-");
            const daysUntil = dt ? Math.ceil((dt - now) / (1000 * 60 * 60 * 24)) : null;

            return (
              <div
                key={ev?.id || `${ev?.data_evento}-${ev?.hora_inicio}-${ev?.titulo}`}
                className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-3 hover:bg-muted/40 hover:border-border transition-all duration-150"
              >
                {/* Date block */}
                <div className={`flex-shrink-0 rounded-xl w-12 h-12 flex flex-col items-center justify-center text-center ${isAudiencia ? 'bg-pink-50 border border-pink-100' : 'bg-orange-50 border border-orange-100'}`}>
                  <span className={`text-base font-bold leading-none ${isAudiencia ? 'text-pink-700' : 'text-orange-700'}`}>{dtStr}</span>
                  <span className={`text-[10px] leading-none mt-0.5 ${isAudiencia ? 'text-pink-400' : 'text-orange-400'}`}>{anoStr}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${isAudiencia ? 'bg-pink-100 text-pink-700' : 'bg-orange-100 text-orange-700'}`}>
                      {tipo}
                    </span>
                    <span className="text-xs text-slate-500">{hora}</span>
                    {daysUntil !== null && daysUntil <= 7 && (
                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                        {daysUntil === 0 ? 'Hoje!' : daysUntil === 1 ? 'Amanhã' : `${daysUntil}d`}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate mt-1">{parte}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">Proc {processo}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { widgets, isEnabled, save: saveWidgets } = useWidgetConfig();

  const [currentView, setCurrentView] = useState("dashboard"); 
  const [ldtProcessNumber, setLdtProcessNumber] = useState("");
  const [ldtCpf, setLdtCpf] = useState("");
  const [ldtLoading, setLdtLoading] = useState(false);
  const [ldtError, setLdtError] = useState("");
  const [ldtResult, setLdtResult] = useState(null);

  const { data: atendimentos = [], isLoading: loadingAtendimentos } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list('-created_date'),
  });

  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ['tarefas'],
    queryFn: () => base44.entities.Tarefa.list('-created_date'),
  });

  const { data: alertas = [], isLoading: loadingAlertas } = useQuery({
    queryKey: ['alertas'],
    queryFn: () => base44.entities.Alerta.list('-created_date'),
  });

  const { data: pessoas = [], isLoading: loadingPessoas } = useQuery({
    queryKey: ['pessoas'],
    queryFn: () => base44.entities.Pessoa.list(),
  });

  const { data: agendaEventos = [], isLoading: loadingAgenda } = useQuery({
    queryKey: ['agenda'],
    queryFn: () => base44.entities.Agenda.list('-data_evento'),
  });

  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes-feed'],
    queryFn: () => base44.entities.Notificacao.list('-created_date', 50),
  });

  const createNotification = useMutation({
    mutationFn: (data) => base44.entities.Notificacao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes-nao-lidas'] });
    },
  });

  const isLoading = loadingAtendimentos || loadingTarefas || loadingAlertas || loadingPessoas || loadingAgenda;

  // Calcular métricas
  const tarefasAtrasadas = tarefas.filter(t => {
    if (t.status === 'Concluída') return false;
    if (!t.data_vencimento) return false;
    return differenceInDays(parseISO(t.data_vencimento), new Date()) < 0;
  });

  const tarefasPendentes = tarefas.filter(t => t.status === 'Pendente');
  const tarefasEmAndamento = tarefas.filter(t => t.status === 'Em andamento');
  const tarefasConcluidas = tarefas.filter(t => t.status === 'Concluída');

  const atendimentosAbertos = atendimentos.filter(a => a.status === 'Aberto');
  const atendimentosEmAndamento = atendimentos.filter(a => a.status === 'Em andamento');
  const alertasAtivos = alertas.filter(a => a.status === 'Ativo');

  // ===== Linha do Tempo view (clientMessage-only) =====
  function LinhaDoTempoView() {
    const N8N_WF00_WEBHOOK_URL = "https://marciaribeiro.app.n8n.cloud/webhook/flowdesk-linha-do-tempo";

    const canSubmit =
      ldtProcessNumber.trim().length > 0 &&
      ldtCpf.trim().length > 0 &&
      !ldtLoading;

    async function handleConsultar() {
      const processNumber = ldtProcessNumber.trim();
      const cpfDigits = ldtCpf.replace(/\D/g, "");

      setLdtError("");
      setLdtResult(null);

      if (!processNumber) {
        setLdtError("Digite o número do processo.");
        return;
      }
      if (!cpfDigits || cpfDigits.length !== 11) {
        setLdtError("Digite um CPF válido (11 dígitos).");
        return;
      }
      if (!N8N_WF00_WEBHOOK_URL || N8N_WF00_WEBHOOK_URL.includes("PASTE_YOUR_N8N")) {
        setLdtError("Você ainda não configurou a URL do webhook do n8n (WF00).");
        return;
      }

      setLdtLoading(true);
      try {
        let resp;
        try {
          resp = await fetch(N8N_WF00_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              processNumber,
              cpf: cpfDigits,
              preferredSystem: "auto",
              forceRefresh: true
            })
          });
        } catch (err) {
          throw new Error(
            "Failed to fetch (browser blocked the request). " +
            "This is almost always CORS/OPTIONS or a blocked URL. " +
            "Fix: Webhook node → Allowed Origins = https://flow-desk-juridico-57377cf5.base44.app"
          );
        }

        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          throw new Error(`n8n respondeu ${resp.status}: ${txt.slice(0, 250)}`);
        }

        const data = await resp.json();

        const success = data?.success ?? data?.data?.success ?? true;
        if (success === false) {
          throw new Error(data?.error || data?.data?.error || "WF00 retornou success=false");
        }

        const clientMessage =
          data?.clientMessage ??
          data?.data?.clientMessage ??
          "";

        if (!clientMessage) {
          throw new Error("WF00 respondeu sem clientMessage. Verifique o node Final Result no n8n.");
        }

        const currentPhase =
          data?.currentPhase ??
          data?.data?.currentPhase ??
          "";

        const waitingNow =
          data?.waitingNow ??
          data?.data?.waitingNow ??
          "";

        setLdtResult({
          clientMessage,
          currentPhase,
          waitingNow
        });
      } catch (e) {
        setLdtError(e?.message || "Erro ao consultar a linha do tempo.");
      } finally {
        setLdtLoading(false);
      }
    }

    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-[1920px] space-y-6">

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Linha do tempo</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Informe <b>número do processo</b> e <b>CPF</b>. O retorno exibido será a <b>mensagem final ao cliente</b>.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_260px_auto] gap-3 items-end">
              <div>
                <label className="text-sm font-medium">Número do processo</label>
                <input
                  value={ldtProcessNumber}
                  onChange={(e) => setLdtProcessNumber(e.target.value)}
                  placeholder="ex: 1000664-12.2022.8.26.0691"
                  className="mt-1 w-full border rounded-xl px-3 py-2"
                  disabled={ldtLoading}
                />
              </div>

              <div>
                <label className="text-sm font-medium">CPF</label>
                <input
                  value={ldtCpf}
                  onChange={(e) => setLdtCpf(e.target.value)}
                  placeholder="somente números"
                  className="mt-1 w-full border rounded-xl px-3 py-2"
                  disabled={ldtLoading}
                />
              </div>

              <button
                onClick={handleConsultar}
                disabled={!canSubmit}
                className="h-[42px] px-4 rounded-xl border bg-black text-white font-medium disabled:opacity-60"
              >
                {ldtLoading ? "Consultando..." : "Consultar"}
              </button>
            </div>

            {ldtError ? (
              <div className="mt-3 text-sm text-red-600 whitespace-pre-wrap">
                {ldtError}
              </div>
            ) : null}
          </div>

          {ldtResult ? (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-semibold">Mensagem final para o cliente</h2>
                {(ldtResult.currentPhase || ldtResult.waitingNow) ? (
                  <div className="text-xs text-muted-foreground">
                    {ldtResult.currentPhase ? `Fase: ${ldtResult.currentPhase}` : ""}
                    {ldtResult.waitingNow ? ` • Aguardando: ${ldtResult.waitingNow}` : ""}
                  </div>
                ) : null}
              </div>

              <div className="whitespace-pre-wrap text-sm text-foreground">
                {ldtResult.clientMessage}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Após consultar, a mensagem final aparecerá aqui.
            </div>
          )}

        </div>
      </div>
    );
  }

  // ===== Loading =====
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // ===== Main render =====
  return (
    <div>
      {/* Top switcher bar */}
      <div className="px-4 md:px-8 pt-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="inline-flex gap-1 rounded-xl border border-border bg-card p-1.5 shadow-sm">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "linhaDoTempo", label: "Linha do Tempo" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentView(tab.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                currentView === tab.id
                  ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {currentView === 'dashboard' && (
          <DashboardCustomizer widgets={widgets} onSave={saveWidgets} />
        )}
      </div>

      {currentView === "linhaDoTempo" ? (
        <LinhaDoTempoView />
      ) : (
        <div className="min-h-screen bg-background p-4 md:p-8">
          <div className="mx-auto max-w-[1920px] space-y-8">

            {isEnabled('tv') && <TVDashboard
              tarefas={tarefas}
              atendimentos={atendimentos}
              alertas={alertas}
              pessoas={pessoas}
            />}

            {/* ── Indicadores ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-1 rounded-full bg-rose-400" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Indicadores</h2>
              </div>
              {isEnabled('indicadores') && <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatsCard title="Total de Tarefas"   value={tarefas.length}              icon={FileText}      color="purple" />
                <StatsCard title="Tarefas Atrasadas"  value={tarefasAtrasadas.length}     icon={AlertTriangle} color="red" />
                <StatsCard title="Pendentes"          value={tarefasPendentes.length}     icon={Clock}         color="amber" />
                <StatsCard title="Em Andamento"       value={tarefasEmAndamento.length}   icon={TrendingUp}    color="blue" />
                <StatsCard title="Concluídas"         value={tarefasConcluidas.length}    icon={CheckCircle2}  color="green" />
              </div>}
            </section>

            {/* ── Gráfico + Agenda ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-1 rounded-full bg-violet-400" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Visão Geral</h2>
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {isEnabled('grafico') && <TasksChart tarefas={tarefas} />}
                {isEnabled('audiencias') && <AudienciasCard eventos={agendaEventos} />}
              </div>
            </section>

            {/* ── Kanban de Tarefas + Feed ── */}
            {(isEnabled('kanban') || isEnabled('feed')) && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 rounded-full bg-rose-400" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tarefas & Atividades</h2>
                </div>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                  {isEnabled('kanban') && (
                    <div className="xl:col-span-2">
                      <TarefasKanban tarefas={tarefas} pessoas={pessoas} />
                    </div>
                  )}
                  {isEnabled('feed') && (
                    <ActivityFeed notificacoes={notificacoes} tarefas={tarefas} alertas={alertas} />
                  )}
                </div>
              </section>
            )}

            {/* ── Atendimentos ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-1 rounded-full bg-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Atendimentos Recentes</h2>
              </div>
              {isEnabled('atendimentos') && <RecentAtendimentos atendimentos={atendimentos} pessoas={pessoas} />}
            </section>

            {/* ── Tarefas & Alertas ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-1 rounded-full bg-amber-400" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tarefas & Alertas</h2>
              </div>
              {isEnabled('tarefas_alertas') && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <RecentTasksTable tarefas={tarefas} pessoas={pessoas} />
                  <AlertsList alertas={alertas} />
                </div>
              )}
            </section>

            {/* ── Performance ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-1 rounded-full bg-blue-400" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Performance</h2>
              </div>
              {isEnabled('performance') && <PerformanceMetrics 
                tarefas={tarefas}
                atendimentos={atendimentos}
                pessoas={pessoas}
              />}
            </section>

          </div>
        </div>
      )}
    </div>
  );
}