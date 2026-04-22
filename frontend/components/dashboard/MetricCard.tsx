import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  icon: LucideIcon;
  iconColor?: string;
  label: string;
  value: React.ReactNode;
  trend?: string;
  trendLabel?: string;
  delay?: string | number;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  icon: Icon,
  iconColor = 'text-primary-500 dark:text-primary-400',
  label,
  value,
  trend,
  trendLabel,
  delay = 0,
}) => {
  const animationDelay = typeof delay === 'number' ? `${delay}ms` : delay;

  return (
    <div
      className="bg-bg-card border border-border-main rounded-2xl p-5 transition-all duration-200 hover:border-primary-500/30 hover:shadow-lg dark:hover:shadow-black/20"
      style={{ animationDelay }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 bg-primary-500/10 rounded-xl ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
        {trendLabel && !trend && (
          <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-full">
            {trendLabel}
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-text-primary">{value}</h3>
    </div>
  );
};
