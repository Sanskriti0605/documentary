import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { DocStatus } from '../../types';

interface DocStatusBadgeProps {
  status?: DocStatus | string;
  className?: string;
  showIcon?: boolean;
}

export const DocStatusBadge: React.FC<DocStatusBadgeProps> = ({
  status = 'draft',
  className = '',
  showIcon = true
}) => {
  const normalized = status.toLowerCase().replace(/[_\s-]+/g, ' ').trim();

  let label = 'Draft';
  let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-300';
  let IconComponent = Clock;

  if (normalized === 'in force' || normalized === 'inforce' || normalized === 'active') {
    label = 'In Force';
    badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-300';
    IconComponent = CheckCircle2;
  } else if (normalized === 'superseded') {
    label = 'Superseded';
    badgeStyle = 'bg-amber-50 text-amber-800 border-amber-300';
    IconComponent = AlertTriangle;
  } else if (normalized === 'withdrawn' || normalized === 'repealed' || normalized === 'cancelled') {
    label = 'Withdrawn';
    badgeStyle = 'bg-rose-50 text-rose-700 border-rose-300';
    IconComponent = XCircle;
  } else if (normalized === 'draft' || normalized === 'pending') {
    label = 'Draft';
    badgeStyle = 'bg-slate-100 text-slate-700 border-slate-300';
    IconComponent = Clock;
  }

  return (
    <span
      className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle} ${className}`}
    >
      {showIcon && <IconComponent className="w-3.5 h-3.5 shrink-0" />}
      <span>{label}</span>
    </span>
  );
};
