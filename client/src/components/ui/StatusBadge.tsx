import type { ReactNode } from 'react';

type BadgeTone = 'healthy' | 'warning' | 'critical' | 'info' | 'neutral' | 'online';

const tones: Record<BadgeTone, string> = {
  healthy: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  critical: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  neutral: 'border-slate-600 bg-slate-800 text-slate-200',
  online: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
};

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
