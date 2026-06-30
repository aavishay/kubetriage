import React, { memo } from 'react';
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

const MetricCardComponent: React.FC<MetricCardProps> = ({
  icon: Icon,
  iconColor = 'text-primary-500',
  label,
  value,
  trend,
  trendLabel,
  delay = 0,
}) => {
  const animationDelay = typeof delay === 'number' ? `${delay}ms` : delay;

  return (
    <div
      className="kt-panel p-4 hover:border-primary-500/30 transition-all duration-300 animate-slide-up"
      style={{ animationDelay }}
    >
      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className={`p-2 bg-bg-main border border-border-main ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        {(trend || trendLabel) && (
          <span className="text-[10px] font-sans font-bold text-primary-500 bg-primary-500/10 border border-primary-500/20 px-1.5 py-0.5 rounded-sm">
            {trend || trendLabel}
          </span>
        )}
      </div>
      <p className="text-[11px] font-sans font-semibold text-text-tertiary mb-1 relative z-10">{label}</p>
      <h3 className="text-2xl font-bold text-text-primary tracking-tight relative z-10">{value}</h3>
    </div>
  );
};

export const MetricCard = memo(MetricCardComponent);
