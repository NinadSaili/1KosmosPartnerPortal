import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingSpinner({ size = 'md', className, label = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center', className)} role="status" aria-label={label}>
      <span
        className={cn(
          'animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-400',
          sizeMap[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" />
    </div>
  );
}
