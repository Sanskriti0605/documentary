import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getBadgeStyle = (val: string) => {
    switch (val) {
      case 'VERIFIED':
      case 'PROCESSED':
      case 'FULL_SUPPORT':
      case 'RESOLVED_AMENDMENT':
      case 'RESOLVED_SCOPE':
      case 'NO_CONFLICT':
      case 'healthy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';

      case 'PARTIALLY_VERIFIED':
      case 'PROCESSING':
      case 'QUEUED':
      case 'PARTIAL_SUPPORT':
      case 'POSSIBLE_CONFLICT':
      case 'PENDING_REVIEW':
      case 'TEMPORAL_DIFFERENCE':
      case 'CONDITIONAL_DIFFERENCE':
      case 'degraded':
        return 'bg-amber-50 text-amber-700 border-amber-200';

      case 'CONFLICTED':
      case 'CONFIRMED_CONFLICT':
      case 'UNSUPPORTED':
      case 'FAILED':
      case 'CRITICAL':
      case 'HIGH':
        return 'bg-rose-50 text-rose-700 border-rose-200';

      case 'INSUFFICIENT_EVIDENCE':
      case 'DISMISSED':
      case 'UPLOADED':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getBadgeStyle(
        status
      )} ${className}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
};
