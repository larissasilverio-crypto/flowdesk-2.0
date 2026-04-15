import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';

const COLORS = {
  'Pendente':     { fill: '#f59e0b', light: '#fef3c7' },
  'Em andamento': { fill: '#3b82f6', light: '#dbeafe' },
  'Atrasada':     { fill: '#ef4444', light: '#fee2e2' },
  'Concluída':    { fill: '#10b981', light: '#d1fae5' },
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const item = payload[0];
    const cfg = COLORS[item.name] || { fill: '#94a3b8', light: '#f1f5f9' };
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: cfg.fill }} />
          <p className="font-semibold text-foreground text-sm">{item.name}</p>
        </div>
        <p className="text-muted-foreground text-sm">{item.value} tarefa{item.value !== 1 ? 's' : ''}</p>
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ payload }) => (
  <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
    {(payload || []).map((entry) => {
      const cfg = COLORS[entry.value] || { fill: '#94a3b8' };
      return (
        <div key={entry.value} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.fill }} />
          <span className="text-xs text-muted-foreground">{entry.value}</span>
        </div>
      );
    })}
  </div>
);

export default function TasksChart({ tarefas }) {
  const hoje = new Date();
  const atrasadas = tarefas.filter(t =>
    t.status !== 'Concluída' && t.data_vencimento && new Date(t.data_vencimento) < hoje
  );

  const data = [
    { name: 'Pendente',     value: tarefas.filter(t => t.status === 'Pendente').length },
    { name: 'Em andamento', value: tarefas.filter(t => t.status === 'Em andamento').length },
    { name: 'Atrasada',     value: atrasadas.length },
    { name: 'Concluída',    value: tarefas.filter(t => t.status === 'Concluída').length },
  ].filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Distribuição de Tarefas</h3>
            <p className="text-xs text-muted-foreground">{total} tarefa{total !== 1 ? 's' : ''} no total</p>
          </div>
        </div>
        {/* Mini legend pills */}
        <div className="hidden sm:flex items-center gap-2">
          {data.slice(0, 2).map(d => (
            <span key={d.name} className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: (COLORS[d.name]?.light || '#f1f5f9'), color: (COLORS[d.name]?.fill || '#94a3b8') }}>
              {d.value} {d.name}
            </span>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={65}
                outerRadius={105}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={2}
                stroke="#fff"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.name]?.fill || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[260px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <BarChart3 className="h-10 w-10 opacity-30" />
            <p className="text-sm">Nenhuma tarefa cadastrada</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}