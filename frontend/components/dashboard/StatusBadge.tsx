import React from 'react';

type Status = 'Healthy' | 'Warning' | 'Critical';

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  Healthy:
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  Warning:
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  Critical:
    'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const style = statusStyles[status] || statusStyles['Warning'];

  return (
    <span
      className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full ${style} ${className}`}
    >
      {status}
    </span>
  );
};
