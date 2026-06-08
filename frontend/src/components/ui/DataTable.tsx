import React from 'react';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  pagination?: PaginationProps;
  className?: string;
  rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage = 'No data found',
  emptyDescription,
  pagination,
  className,
  rowClassName,
  onRowClick,
}: DataTableProps<T>) {
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  if (isLoading) {
    return (
      <div className={cn('rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden', className)}>
        <LoadingSpinner className="py-20" />
      </div>
    );
  }

  if (!isLoading && data.length === 0) {
    return (
      <div className={cn('rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden', className)}>
        <EmptyState title={emptyMessage} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider',
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((row, idx) => (
              <tr
                key={idx}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60',
                  rowClassName?.(row),
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap',
                      col.className,
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {(pagination.page - 1) * pagination.pageSize + 1}–
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
              {pagination.page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
