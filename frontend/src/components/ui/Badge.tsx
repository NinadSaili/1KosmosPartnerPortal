import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
        secondary: 'border-transparent bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        destructive: 'border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
        success: 'border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
        warning: 'border-transparent bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
        outline: 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300',
        blue: 'border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        purple: 'border-transparent bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
        gold: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
