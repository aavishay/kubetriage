import React from 'react';

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const paddingMap = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export const DashboardCard: React.FC<DashboardCardProps> = ({
  children,
  className = '',
  padding = 'md',
  hover = true,
}) => {
  const hoverClasses = hover
    ? 'hover:border-primary-500/30 hover:shadow-lg dark:hover:shadow-black/20'
    : '';

  return (
    <div
      className={`bg-bg-card border border-border-main rounded-2xl transition-all duration-200 ${paddingMap[padding]} ${hoverClasses} ${className}`}
    >
      {children}
    </div>
  );
};
