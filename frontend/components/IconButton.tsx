import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';

interface IconButtonProps {
  icon: LucideIcon;
  onClick: () => void;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

const IconButtonComponent: React.FC<IconButtonProps> = ({
  icon: Icon,
  onClick,
  label,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  className = '',
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-lg transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary-500/50 outline-none';

  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-500',
    secondary: 'bg-bg-card border border-border-main text-text-secondary hover:text-text-primary hover:border-primary-500/30',
    ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
    danger: 'text-danger hover:bg-danger-light',
  };

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      aria-label={label}
    >
      <Icon className={iconSizes[size]} aria-hidden="true" />
    </button>
  );
};

export const IconButton = memo(IconButtonComponent);
