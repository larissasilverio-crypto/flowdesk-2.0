export const CONQUISTAS = [
  { id: 'primeiro_sangue', icon: '⚡', label: 'Primeiro Sangue', desc: '1ª tarefa concluída', req: (s) => s.tarefasConcluidas >= 1 },
  { id: 'produtivo', icon: '🔥', label: 'Em Chamas', desc: '5+ tarefas concluídas', req: (s) => s.tarefasConcluidas >= 5 },
  { id: 'maquina', icon: '🤖', label: 'Máquina', desc: '10+ tarefas concluídas', req: (s) => s.tarefasConcluidas >= 10 },
  { id: 'atendedor', icon: '🎯', label: 'Atendedor Pro', desc: '5+ atendimentos', req: (s) => s.atendimentosCriados >= 5 },
  { id: 'taxa_alta', icon: '📈', label: 'Alta Performance', desc: '80%+ taxa de conclusão', req: (s) => s.taxaConclusao >= 80 },
  { id: 'perfeito', icon: '💯', label: 'Perfeição', desc: '100% de conclusão', req: (s) => s.taxaConclusao === 100 },
  { id: 'multitarefa', icon: '🌟', label: 'Multitarefa', desc: '3+ tipos de atividade', req: (s) => (s.tarefasConcluidas > 0 ? 1 : 0) + (s.atendimentosConcluidos > 0 ? 1 : 0) + (s.eventosRealizados > 0 ? 1 : 0) >= 3 },
];

export default function ConquistaBadge({ conquista, desbloqueada }) {
  return (
    <div className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
      desbloqueada
        ? 'bg-yellow-50 border-yellow-300'
        : 'bg-slate-50 border-slate-200 opacity-40 grayscale'
    }`}>
      <span className="text-xl">{conquista.icon}</span>
      <p className="text-xs font-semibold text-center leading-tight text-slate-700">{conquista.label}</p>
      <p className="text-[10px] text-slate-500 text-center leading-tight">{conquista.desc}</p>
    </div>
  );
}