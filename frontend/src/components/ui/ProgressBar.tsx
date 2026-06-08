import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'indigo' | 'green' | 'blue' | 'yellow' | 'red';
}

const sizeMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const colorMap = {
  indigo: 'bg-indigo-600',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

export function ProgressBar({
  value,
  max = 100,
  className,
  barClassName,
  showLabel = false,
  size = 'md',
  color = 'indigo',
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-600 dark:text-gray-400">{Math.round(pct)}%</span>
        </div>
      )}
      <div
        className={cn(
          'w-full rounded-full bg-gray-200 dark:bg-gray-700',
          sizeMap[size],
        )}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'rounded-full transition-all duration-500',
            sizeMap[size],
            colorMap[color],
            barClassName,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
