import React, { memo } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

const LoadingSpinnerComponent: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  label = 'Loading...',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary-500`} aria-hidden="true" />
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
};

export const LoadingSpinner = memo(LoadingSpinnerComponent);
