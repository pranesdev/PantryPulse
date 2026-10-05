import type { ReactNode } from 'react';

export const Card = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 shadow-[0_12px_40px_rgba(15,23,42,0.45)] ${className}`}>
    {children}
  </div>
);
