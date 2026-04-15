import React from 'react';
import { motion } from 'framer-motion';
import { Users, Target, TrendingUp, Award } from 'lucide-react';

export default function PerformanceMetrics({ tarefas, atendimentos, pessoas }) {
  const tarefasConcluidas = tarefas.filter(t => t.status === 'Concluída').length;
  const totalTarefas = tarefas.length;
  const taxaConclusao = totalTarefas > 0 ? Math.round((tarefasConcluidas / totalTarefas) * 100) : 0;

  const atendimentosConcluidos = atendimentos.filter(a => a.status === 'Concluído').length;
  const totalAtendimentos = atendimentos.length;
  const taxaSucesso = totalAtendimentos > 0 ? Math.round((atendimentosConcluidos / totalAtendimentos) * 100) : 0;

  const metrics = [
    {
      title: 'Taxa de Conclusão',
      value: `${taxaConclusao}%`,
      subtitle: `${tarefasConcluidas} de ${totalTarefas} tarefas`,
      icon: Target,
      color: 'emerald',
      gradient: 'from-emerald-500 to-green-600'
    },
    {
      title: 'Casos Resolvidos',
      value: `${taxaSucesso}%`,
      subtitle: `${atendimentosConcluidos} atendimentos`,
      icon: Award,
      color: 'blue',
      gradient: 'from-blue-500 to-indigo-600'
    },
    {
      title: 'Equipe Ativa',
      value: pessoas.length,
      subtitle: 'Profissionais',
      icon: Users,
      color: 'purple',
      gradient: 'from-purple-500 to-pink-600'
    },
    {
      title: 'Produtividade',
      value: totalTarefas > 0 ? Math.round((tarefasConcluidas / pessoas.length)) : 0,
      subtitle: 'Tarefas por pessoa',
      icon: TrendingUp,
      color: 'amber',
      gradient: 'from-amber-500 to-orange-600'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.title}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          className="relative overflow-hidden rounded-2xl bg-card p-6 shadow-sm border border-border"
        >
          <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${metric.gradient} opacity-10 rounded-full -mr-12 -mt-12`} />
          <div className="relative">
            <div className={`inline-flex rounded-xl bg-gradient-to-br ${metric.gradient} p-3 mb-3 shadow-lg`}>
              <metric.icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-4xl font-bold text-foreground mb-1">{metric.value}</p>
              <p className="text-sm font-medium text-foreground">{metric.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{metric.subtitle}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}