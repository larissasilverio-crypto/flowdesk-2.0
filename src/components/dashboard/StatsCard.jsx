import React from 'react';
import { motion } from 'framer-motion';

const colorConfig = {
  blue:   { bg: 'bg-card',    border: 'border-border',   text: 'text-blue-400',   sub: 'text-blue-400',   icon: 'bg-gradient-to-br from-blue-500 to-blue-600',   dot: 'bg-blue-400' },
  green:  { bg: 'bg-card',    border: 'border-border',   text: 'text-emerald-400',sub: 'text-emerald-400',icon: 'bg-gradient-to-br from-emerald-500 to-green-600', dot: 'bg-emerald-400' },
  amber:  { bg: 'bg-card',    border: 'border-border',   text: 'text-amber-400',  sub: 'text-amber-400',  icon: 'bg-gradient-to-br from-amber-400 to-orange-500',  dot: 'bg-amber-400' },
  red:    { bg: 'bg-card',    border: 'border-border',   text: 'text-red-400',    sub: 'text-red-400',    icon: 'bg-gradient-to-br from-red-500 to-rose-600',      dot: 'bg-red-400' },
  purple: { bg: 'bg-card',    border: 'border-border',   text: 'text-violet-400', sub: 'text-violet-400', icon: 'bg-gradient-to-br from-violet-500 to-purple-600',  dot: 'bg-violet-400' },
  slate:  { bg: 'bg-card',    border: 'border-border',   text: 'text-foreground', sub: 'text-muted-foreground',  icon: 'bg-gradient-to-br from-slate-500 to-slate-600',   dot: 'bg-slate-400' },
};

export default function StatsCard({ title, value, icon: Icon, color = 'blue', trend, trendLabel }) {
  const c = colorConfig[color] || colorConfig.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={`relative overflow-hidden rounded-2xl border ${c.border} ${c.bg} p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-default dark:shadow-none`}
    >
      {/* Decorative circle */}
      <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10 ${c.icon}`} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2`}>{title}</p>
          <p className={`text-4xl font-bold tracking-tight ${c.text} leading-none`}>{value}</p>
          {trend !== undefined && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              <span className={trend >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </span>
              <span className={`${c.sub} opacity-80`}>{trendLabel}</span>
            </div>
          )}
        </div>
        <div className={`rounded-xl p-2.5 ${c.icon} shadow-md flex-shrink-0`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </motion.div>
  );
}