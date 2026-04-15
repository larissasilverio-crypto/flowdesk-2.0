import React, { useMemo } from 'react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Clock, CheckCircle2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const COLS = [
  { id: 'Pendente', label: 'Pendente', color: 'bg-slate-100 border-slate-200', header: 'bg-slate-600', dot: 'bg-slate-400' },
  { id: 'Em andamento', label: 'Em Andamento', color: 'bg-blue-50 border-blue-200', header: 'bg-blue-600', dot: 'bg-blue-500' },
  { id: 'Atrasada', label: 'Atrasadas', color: 'bg-red-50 border-red-200', header: 'bg-red-600', dot: 'bg-red-500' },
  { id: 'Concluída', label: 'Concluídas', color: 'bg-green-50 border-green-200', header: 'bg-green-600', dot: 'bg-green-500' },
];

const PRIORIDADE_COLORS = {
  Alta: 'bg-red-100 text-red-700',
  Urgente: 'bg-rose-200 text-rose-800',
  Média: 'bg-amber-100 text-amber-700',
  Baixa: 'bg-slate-100 text-slate-600',
};

function getStatusEffetivo(t) {
  if (t.status === 'Concluída') return 'Concluída';
  if (t.data_vencimento) {
    const diff = differenceInDays(parseISO(t.data_vencimento), new Date());
    if (diff < 0) return 'Atrasada';
  }
  return t.status_detalhado || t.status || 'Pendente';
}

function TarefaCard({ tarefa, pessoas }) {
  const responsavel = pessoas.find(p => p.id === tarefa.responsavel_id);
  const diff = tarefa.data_vencimento ? differenceInDays(parseISO(tarefa.data_vencimento), new Date()) : null;
  const status = getStatusEffetivo(tarefa);
  const isAtrasada = status === 'Atrasada';
  const venceHoje = diff === 0;

  return (
    <div className={`bg-card rounded-xl border p-3 hover:shadow-sm transition-all ${isAtrasada ? 'border-red-200 bg-red-50/30' : 'border-border'}`}>
      <p className="text-sm font-semibold text-foreground line-clamp-2 mb-2">{tarefa.titulo}</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {tarefa.prioridade && tarefa.prioridade !== 'Média' && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PRIORIDADE_COLORS[tarefa.prioridade] || ''}`}>
            {tarefa.prioridade}
          </span>
        )}
        {isAtrasada && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" />Atrasada
          </span>
        )}
        {venceHoje && !isAtrasada && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Vence hoje</span>
        )}
      </div>
      <div className="flex items-center justify-between">
        {responsavel ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[80px]">{responsavel.nome.split(' ')[0]}</span>
          </div>
        ) : <span />}
        {tarefa.data_vencimento && (
          <span className={`text-[10px] flex items-center gap-1 ${isAtrasada ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
            <Clock className="h-2.5 w-2.5" />
            {format(parseISO(tarefa.data_vencimento), 'dd/MM', { locale: ptBR })}
          </span>
        )}
      </div>
    </div>
  );
}

export default function TarefasKanban({ tarefas, pessoas = [] }) {
  const grouped = useMemo(() => {
    const map = {};
    COLS.forEach(c => { map[c.id] = []; });
    tarefas.forEach(t => {
      const s = getStatusEffetivo(t);
      if (map[s]) map[s].push(t);
      else if (map['Pendente']) map['Pendente'].push(t);
    });
    return map;
  }, [tarefas]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Kanban de Tarefas</h3>
          <p className="text-xs text-muted-foreground">{tarefas.length} tarefas no total</p>
        </div>
        <Link to="/Tarefas" className="text-xs text-rose-600 hover:underline font-medium">Ver todas →</Link>
      </div>

      <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {COLS.map(col => {
          const cards = grouped[col.id] || [];
          return (
            <div key={col.id} className={`rounded-xl border-2 ${col.color} flex flex-col`}>
              <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${col.dot}`} />
                  <span className="text-xs font-semibold text-foreground">{col.label}</span>
                </div>
                <span className="text-xs font-bold text-muted-foreground bg-white/60 rounded-full px-2 py-0.5">{cards.length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[260px] overflow-y-auto">
                {cards.slice(0, 5).map(t => <TarefaCard key={t.id} tarefa={t} pessoas={pessoas} />)}
                {cards.length > 5 && (
                  <p className="text-xs text-center text-muted-foreground py-1">+{cards.length - 5} mais</p>
                )}
                {cards.length === 0 && (
                  <div className="flex items-center justify-center py-6 text-muted-foreground/40">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}