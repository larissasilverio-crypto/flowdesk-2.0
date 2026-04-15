import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  User, Phone, Mail, MapPin, Briefcase, FileText, Calendar,
  DollarSign, ClipboardList, Info, Heart, Shield, MessageSquare,
  CheckCircle2, XCircle, HelpCircle, Stethoscope, Pencil
} from 'lucide-react';

// ─── Utilitários de parsing ──────────────────────────────────────────────────

function tryParseJSON(str) {
  if (!str || typeof str !== 'string') return null;
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
  } catch (_) {}
  return null;
}

/**
 * Extrai o bloco HIDDEN_FICHA do texto de observações.
 * Suporta:
 *   - HIDDEN_FICHA: {...}
 *   - JSON puro
 *   - Texto misturado com JSON embutido
 */
function extrairFichaEstruturada(observacoes) {
  if (!observacoes) return { ficha: null, textoLivre: null };

  let ficha = null;
  let textoLivre = observacoes;

  // Tenta encontrar HIDDEN_FICHA: { ... }
  const hiddenMatch = observacoes.match(/HIDDEN_FICHA\s*:\s*(\{[\s\S]*\})/i);
  if (hiddenMatch) {
    ficha = tryParseJSON(hiddenMatch[1]);
    textoLivre = observacoes.replace(/HIDDEN_FICHA\s*:\s*\{[\s\S]*\}/i, '').trim();
  }

  // Se não achou HIDDEN_FICHA, tenta JSON puro
  if (!ficha) {
    ficha = tryParseJSON(observacoes);
    if (ficha) textoLivre = null;
  }

  // Se não é JSON, tenta extrair JSON embutido dentro do texto
  if (!ficha) {
    const jsonMatch = observacoes.match(/\{[\s\S]{50,}\}/);
    if (jsonMatch) {
      ficha = tryParseJSON(jsonMatch[0]);
      if (ficha) textoLivre = observacoes.replace(jsonMatch[0], '').trim();
    }
  }

  return { ficha, textoLivre: textoLivre && textoLivre.length > 2 ? textoLivre : null };
}

// ─── Componentes visuais ─────────────────────────────────────────────────────

function Field({ label, value, wide }) {
  if (value === null || value === undefined || value === '' || value === false) return null;
  const display = value === true ? 'Sim' : String(value);
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 leading-none mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 break-words leading-snug">{display}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children, cols = 2, action }) {
  const kids = React.Children.toArray(children).filter(c => c);
  if (!kids.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {Icon && <div className="rounded-lg bg-rose-50 p-1.5"><Icon className="h-3.5 w-3.5 text-rose-500" /></div>}
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h3>
        </div>
        {action}
      </div>
      <div className={`grid grid-cols-${cols} gap-x-6 gap-y-3`}>
        {children}
      </div>
    </div>
  );
}

function LongField({ label, value, icon: Icon }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <div className="rounded-lg bg-rose-50 p-1.5"><Icon className="h-3.5 w-3.5 text-rose-500" /></div>}
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</h3>
      </div>
      <div className="rounded-lg bg-white border border-slate-100 p-3">
        <DiagnosticText text={value} />
      </div>
    </div>
  );
}

function DiagnosticText({ text }) {
  if (!text) return null;
  // Divide em parágrafos por \n\n ou \n simples
  const paragraphs = text.split(/\n\n+/).flatMap(p => p.split('\n')).filter(p => p.trim());
  if (paragraphs.length <= 1) {
    return <p className="text-sm text-slate-700 leading-7">{text}</p>;
  }
  return (
    <div className="space-y-2">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-sm text-slate-700 leading-7">{p}</p>
      ))}
    </div>
  );
}

function QAItem({ pergunta, resposta }) {
  if (!resposta && resposta !== false && resposta !== 0) return null;
  const display = resposta === true ? 'Sim' : resposta === false ? 'Não' : String(resposta);
  return (
    <div className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <p className="text-xs text-slate-500 leading-snug mb-0.5">{pergunta}</p>
      <p className="text-sm font-medium text-slate-800">{display}</p>
    </div>
  );
}

// Renderiza um objeto genérico de forma recursiva/legível
function RenderObject({ data, depth = 0 }) {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data)) {
    return (
      <ul className="space-y-1 list-disc list-inside">
        {data.map((item, i) => (
          <li key={i} className="text-sm text-slate-700">
            {typeof item === 'object' ? <RenderObject data={item} depth={depth + 1} /> : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className={`space-y-2 ${depth > 0 ? 'pl-3 border-l-2 border-slate-100' : ''}`}>
      {Object.entries(data).map(([key, val]) => {
        if (val === null || val === undefined || val === '') return null;
        const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
        if (typeof val === 'object') {
          return (
            <div key={key}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
              <RenderObject data={val} depth={depth + 1} />
            </div>
          );
        }
        return <QAItem key={key} pergunta={label} resposta={val} />;
      })}
    </div>
  );
}

// ─── Seção que renderiza a HIDDEN_FICHA estruturada ─────────────────────────

function FichaEstruturada({ ficha, clienteId, observacoes, onUpdated }) {
  const [editOpen, setEditOpen] = useState(false);
  const [editValues, setEditValues] = useState({});
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Cliente.update(clienteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente', clienteId] });
      setEditOpen(false);
      if (onUpdated) onUpdated();
    },
  });

  const handleOpenEdit = (diagObj) => {
    setEditValues({ ...diagObj });
    setEditOpen(true);
  };

  const handleSave = () => {
    // Re-embed updated diagnostico back into the original ficha and observacoes
    const updatedFicha = { ...ficha };
    Object.keys(editValues).forEach(k => { updatedFicha[k] = editValues[k]; });

    let newObs;
    const hiddenMatch = observacoes && observacoes.match(/HIDDEN_FICHA\s*:\s*(\{[\s\S]*\})/i);
    if (hiddenMatch) {
      newObs = observacoes.replace(/HIDDEN_FICHA\s*:\s*\{[\s\S]*\}/i, 'HIDDEN_FICHA: ' + JSON.stringify(updatedFicha));
    } else {
      // Was pure JSON or embedded JSON
      newObs = JSON.stringify(updatedFicha);
    }
    updateMutation.mutate({ observacoes: newObs });
  };

  if (!ficha) return null;
  if (!ficha) return null;

  // Grupos de campos conhecidos
  const pessoais = {};
  const previdenciario = {};
  const medico = {};
  const atendimento = {};
  const diagnostico = {};
  const extra = {};

  const pessoaisKeys = ['nome', 'cpf', 'rg', 'data_nascimento', 'nascimento', 'idade', 'sexo', 'genero',
    'estado_civil', 'naturalidade', 'nacionalidade', 'profissao', 'ocupacao', 'renda', 'renda_mensal',
    'escolaridade', 'nome_mae', 'nome_pai'];

  const previdenciarioKeys = ['beneficio', 'tipo_beneficio', 'numero_beneficio', 'nb', 'especie',
    'data_requerimento', 'data_indeferimento', 'data_deferimento', 'competencia', 'dib', 'der',
    'nit', 'pis', 'vinculo', 'tempo_contribuicao', 'periodo', 'modalidade', 'aposentadoria',
    'ja_fez_pedido', 'fez_pedido_inss', 'motivo_indeferimento', 'recurso', 'exigencia'];

  const medicoKeys = ['doenca', 'diagnostico_medico', 'cid', 'laudo', 'medico', 'incapacidade',
    'limitacao', 'tratamento', 'medicamento', 'cirurgia', 'internacao', 'hospital', 'psiquiatrico',
    'psicologico', 'saude'];

  const atendimentoKeys = ['atendimento', 'resumo', 'descricao', 'caso', 'relato', 'historico',
    'situacao', 'contexto', 'observacao', 'nota', 'urgencia', 'prioridade', 'encaminhamento'];

  const diagnosticoKeys = ['diagnostico', 'analise', 'conclusao', 'parecer', 'resultado',
    'avaliacao', 'orientacao', 'recomendacao', 'estrategia', 'possibilidade', 'chance', 'direito'];

  Object.entries(ficha).forEach(([key, val]) => {
    if (val === null || val === undefined || val === '') return;
    const k = key.toLowerCase();
    if (pessoaisKeys.some(pk => k.includes(pk))) pessoais[key] = val;
    else if (diagnosticoKeys.some(dk => k.includes(dk))) diagnostico[key] = val;
    else if (previdenciarioKeys.some(pk => k.includes(pk))) previdenciario[key] = val;
    else if (medicoKeys.some(mk => k.includes(mk))) medico[key] = val;
    else if (atendimentoKeys.some(ak => k.includes(ak))) atendimento[key] = val;
    else extra[key] = val;
  });

  const formatKey = (key) => key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase()).trim();

  const renderFields = (obj) =>
    Object.entries(obj).map(([key, val]) => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'object') {
        return (
          <div key={key} className="col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{formatKey(key)}</p>
            <RenderObject data={val} />
          </div>
        );
      }
      const str = val === true ? 'Sim' : val === false ? 'Não' : String(val);
      const isLong = str.length > 60;
      return <Field key={key} label={formatKey(key)} value={str} wide={isLong} />;
    });

  const diagKeys = Object.keys(diagnostico);

  return (
    <>
      {Object.keys(pessoais).length > 0 && (
        <Section title="Dados Pessoais (Ficha)" icon={User}>
          {renderFields(pessoais)}
        </Section>
      )}
      {diagKeys.length > 0 && (
        <Section
          title="Diagnóstico / Análise"
          icon={CheckCircle2}
          action={
            <button
              onClick={() => handleOpenEdit(diagnostico)}
              className="opacity-60 hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-rose-50"
              title="Editar diagnóstico"
            >
              <Pencil className="h-3.5 w-3.5 text-rose-500" />
            </button>
          }
        >
          {diagKeys.map(key => {
            const val = diagnostico[key];
            if (val === null || val === undefined || val === '') return null;
            if (typeof val === 'object') {
              return (
                <div key={key} className="col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{formatKey(key)}</p>
                  <RenderObject data={val} />
                </div>
              );
            }
            const str = val === true ? 'Sim' : val === false ? 'Não' : String(val);
            const isLong = str.length > 60;
            if (isLong) {
              return (
                <div key={key} className="col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{formatKey(key)}</p>
                  <div className="rounded-lg bg-white border border-slate-100 p-3">
                    <DiagnosticText text={str} />
                  </div>
                </div>
              );
            }
            return <Field key={key} label={formatKey(key)} value={str} />;
          })}
        </Section>
      )}
      {Object.keys(previdenciario).length > 0 && (
        <Section title="Informações Previdenciárias" icon={Shield}>
          {renderFields(previdenciario)}
        </Section>
      )}
      {Object.keys(medico).length > 0 && (
        <Section title="Informações Médicas" icon={Stethoscope}>
          {renderFields(medico)}
        </Section>
      )}
      {Object.keys(atendimento).length > 0 && (
        <Section title="Dados do Atendimento" icon={ClipboardList}>
          {renderFields(atendimento)}
        </Section>
      )}
      {Object.keys(extra).length > 0 && (
        <Section title="Outras Informações" icon={HelpCircle}>
          {renderFields(extra)}
        </Section>
      )}

      {/* Modal de edição do diagnóstico */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Diagnóstico / Análise</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {Object.keys(editValues).map(key => {
              const val = editValues[key];
              if (typeof val === 'object') return null;
              const str = val === true ? 'Sim' : val === false ? 'Não' : String(val ?? '');
              const isLong = str.length > 60;
              return (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">{formatKey(key)}</label>
                  {isLong ? (
                    <Textarea
                      rows={4}
                      value={str}
                      onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                      className="text-sm leading-relaxed"
                    />
                  ) : (
                    <input
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={str}
                      onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function FichaCliente({ cliente }) {
  const nascimento = cliente.data_nascimento
    ? new Date(cliente.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')
    : null;

  const renda = cliente.renda_mensal
    ? `R$ ${Number(cliente.renda_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : null;

  const endereco = [cliente.endereco_completo, cliente.cep ? `CEP ${cliente.cep}` : null].filter(Boolean).join(' — ') || null;
  const localidade = [cliente.cidade, cliente.estado].filter(Boolean).join(' / ') || null;

  const { ficha, textoLivre } = useMemo(
    () => extrairFichaEstruturada(cliente.observacoes),
    [cliente.observacoes]
  );

  const queryClient = useQueryClient();

  return (
    <div className="space-y-3">

      {/* Dados Cadastrais do Sistema */}
      <Section title="Dados Pessoais" icon={User}>
        <Field label="RG" value={cliente.rg} />
        <Field label="Data de Nascimento" value={nascimento} />
        <Field label="Profissão" value={cliente.profissao} />
        <Field label="Renda Mensal" value={renda} />
      </Section>

      <Section title="Contato" icon={Phone}>
        <Field label="Telefone" value={cliente.telefone} />
        <Field label="E-mail" value={cliente.email} />
      </Section>

      <Section title="Endereço" icon={MapPin}>
        <Field label="Endereço" value={endereco} wide />
        <Field label="Cidade / Estado" value={localidade} />
      </Section>

      {/* Ficha Estruturada (parseia HIDDEN_FICHA / JSON) */}
      {ficha && (
        <FichaEstruturada
          ficha={ficha}
          clienteId={cliente.id}
          observacoes={cliente.observacoes}
        />
      )}

      {/* Texto livre restante (parte das observações que não é JSON) */}
      {textoLivre && (
        <LongField label="Observações" value={textoLivre} icon={Info} />
      )}

      {/* Se não há ficha estruturada e não há texto livre, observacoes pode ser texto normal */}
      {!ficha && !textoLivre && cliente.observacoes && (
        <LongField label="Observações" value={cliente.observacoes} icon={Info} />
      )}

      {/* Metadados */}
      {(cliente.criado_por || cliente.atualizado_por || cliente.id_externo) && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 flex flex-wrap gap-4 text-[11px] text-slate-400">
          {cliente.id_externo && <span>ID Externo: <strong>{cliente.id_externo}</strong></span>}
          {cliente.criado_por && <span>Criado por: <strong>{cliente.criado_por.split('@')[0]}</strong></span>}
          {cliente.atualizado_por && <span>Atualizado por: <strong>{cliente.atualizado_por.split('@')[0]}</strong></span>}
        </div>
      )}
    </div>
  );
}