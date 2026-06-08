import React from 'react';
import { Badge } from '@/components/ui/Badge';

type StatusVariant = 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'blue' | 'purple' | 'gold' | 'outline';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_MAP: Record<string, StatusVariant> = {
  // Deal statuses
  draft: 'secondary',
  submitted: 'blue',
  under_review: 'warning',
  approved: 'success',
  rejected: 'destructive',
  // Assessment statuses
  pending: 'warning',
  confirmed: 'blue',
  completed: 'success',
  cancelled: 'secondary',
  no_show: 'destructive',
  // Org statuses
  active: 'success',
  suspended: 'destructive',
  // General
  published: 'success',
  unpublished: 'secondary',
  true: 'success',
  false: 'secondary',
  // Cert statuses
  valid: 'success',
  expired: 'destructive',
  expiring_soon: 'warning',
  revoked: 'destructive',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = STATUS_MAP[status] ?? 'outline';
  const label = status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
