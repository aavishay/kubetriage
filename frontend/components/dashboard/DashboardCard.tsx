import React from 'react';

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const paddingMap = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const DashboardCard: React.FC<DashboardCardProps> = ({
  children,
  className = '',
  padding = 'md',
  hover = true,
}) => {
  const hoverClasses = hover
    ? 'hover:border-primary-500/10 hover:shadow-md'
    : '';

  return (
    <div
      className={`bg-bg-card border border-transparent rounded-2xl transition-all duration-300 ${paddingMap[padding]} ${hoverClasses} ${className}`}
    >
      {children}
    </div>
  );
};
