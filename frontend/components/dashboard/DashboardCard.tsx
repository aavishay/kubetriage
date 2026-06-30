import React, { memo } from 'react';

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
  title?: string;
}

const paddingMap = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

const DashboardCardComponent: React.FC<DashboardCardProps> = ({
  children,
  className = '',
  padding = 'md',
  hover = true,
  title,
}) => {
  return (
    <div
      className={`kt-panel ${paddingMap[padding]} ${hover ? 'hover:border-primary-500/30 transition-all duration-300' : ''} ${className}`}
    >
      {title && (
        <div className="kt-panel-header mb-4 -mx-4 -mt-4">
          <span>{title}</span>
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export const DashboardCard = memo(DashboardCardComponent);
