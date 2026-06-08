import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
