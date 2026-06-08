import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DealStatusHistory, DealStatus } from '@/types';

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  DealStatus | 'unknown',
  { color: string; bg: string; border: string; label: string }
> = {
  draft: {
    color: 'text-gray-600',
    bg: 'bg-gray-400',
    border: 'border-gray-300',
    label: 'Draft',
  },
  submitted: {
    color: 'text-blue-700',
    bg: 'bg-blue-500',
    border: 'border-blue-300',
    label: 'Submitted',
  },
  under_review: {
    color: 'text-yellow-700',
    bg: 'bg-yellow-500',
    border: 'border-yellow-300',
    label: 'Under Review',
  },
  approved: {
    color: 'text-green-700',
    bg: 'bg-green-500',
    border: 'border-green-300',
    label: 'Approved',
  },
  rejected: {
    color: 'text-red-700',
    bg: 'bg-red-500',
    border: 'border-red-300',
    label: 'Rejected',
  },
  unknown: {
    color: 'text-gray-600',
    bg: 'bg-gray-400',
    border: 'border-gray-300',
    label: 'Unknown',
  },
};

function getConfig(status: string) {
  return STATUS_CONFIG[status as DealStatus] ?? STATUS_CONFIG.unknown;
}

// ─── Actor Name resolver ───────────────────────────────────────────────────────

function resolveActorName(actorId: string, actorNames?: Record<string, string>): string {
  if (actorNames && actorNames[actorId]) return actorNames[actorId];
  return `User ${actorId.slice(0, 6)}…`;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface StatusTimelineProps {
  history: DealStatusHistory[];
  /** Optional map of actorId -> displayName */
  actorNames?: Record<string, string>;
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function StatusTimeline({ history, actorNames, className }: StatusTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
        No status history yet.
      </p>
    );
  }

  // Sort ascending by date so oldest first; latest is last
  const sorted = [...history].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const latestId = sorted[sorted.length - 1].id;

  return (
    <ol className={cn('relative', className)}>
      {sorted.map((entry, idx) => {
        const config = getConfig(entry.toStatus);
        const isLatest = entry.id === latestId;
        const isLast = idx === sorted.length - 1;

        return (
          <li key={entry.id} className="relative flex gap-4">
            {/* Vertical line */}
            {!isLast && (
              <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
            )}

            {/* Circle */}
            <div className="relative z-10 mt-1 flex-shrink-0">
              <span
                className={cn(
                  'block h-8 w-8 rounded-full border-2 flex items-center justify-center',
                  config.bg,
                  config.border,
                  isLatest && 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900',
                  isLatest && config.border.replace('border', 'ring'),
                )}
              >
                <span className="block h-2.5 w-2.5 rounded-full bg-white opacity-90" />
              </span>
            </div>

            {/* Content */}
            <div
              className={cn(
                'flex-1 pb-6 min-w-0',
                isLatest &&
                  'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span
                    className={cn('text-sm font-semibold', config.color, 'dark:opacity-90')}
                  >
                    {config.label}
                  </span>
                  {isLatest && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                      Latest
                    </span>
                  )}
                </div>
                <time className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}
                </time>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                by{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {resolveActorName(entry.actorId, actorNames)}
                </span>
                {entry.fromStatus && (
                  <>
                    {' '}&mdash; from{' '}
                    <span className="font-medium">
                      {STATUS_CONFIG[entry.fromStatus as DealStatus]?.label ?? entry.fromStatus}
                    </span>
                  </>
                )}
              </p>

              {entry.comment && (
                <blockquote className="mt-2 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                    "{entry.comment}"
                  </p>
                </blockquote>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
