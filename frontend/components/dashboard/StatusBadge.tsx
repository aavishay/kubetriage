import React, { memo } from 'react';

type Status = 'Healthy' | 'Warning' | 'Critical';

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  Healthy: 'kt-badge-success',
  Warning: 'kt-badge-warning',
  Critical: 'kt-badge-danger',
};

const StatusBadgeComponent: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const style = statusStyles[status] || statusStyles['Warning'];

  return (
    <span className={`kt-badge ${style} ${className}`}>
      {status}
    </span>
  );
};

export const StatusBadge = memo(StatusBadgeComponent);
