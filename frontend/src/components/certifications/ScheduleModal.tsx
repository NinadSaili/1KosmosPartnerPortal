import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { certApi } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import type { AssessmentSchedule } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificationId: string;
  certificationTitle: string;
  existingSchedule?: AssessmentSchedule | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScheduleModal({
  open,
  onOpenChange,
  certificationId,
  certificationTitle,
  existingSchedule,
}: ScheduleModalProps) {
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();

  // Tomorrow's date as the minimum selectable date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [dateError, setDateError] = useState('');

  const scheduleMutation = useMutation({
    mutationFn: (data: Partial<AssessmentSchedule>) =>
      certApi.scheduleAssessment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      toastSuccess('Assessment scheduled!', 'We will confirm your date within 2 business days.');
      onOpenChange(false);
      setDate('');
      setNotes('');
    },
    onError: (err: unknown) => {
      toastError(
        'Scheduling failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDateError('');

    if (!date) {
      setDateError('Please select a date.');
      return;
    }
    if (new Date(date) <= new Date()) {
      setDateError('Date must be in the future.');
      return;
    }

    scheduleMutation.mutate({
      certificationId,
      requestedDate: new Date(date).toISOString(),
      notes: notes.trim() || null,
      status: 'pending',
    });
  };

  // Show read-only state if already scheduled and not cancellable
  const isPending = existingSchedule?.status === 'pending';
  const isConfirmed = existingSchedule?.status === 'confirmed';
  const isActive = isPending || isConfirmed;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Schedule Assessment"
      description={`Request an assessment date for ${certificationTitle}`}
      size="md"
    >
      {isActive && existingSchedule ? (
        /* Already scheduled — show status */
        <div className="space-y-4">
          <div
            className={`flex items-start gap-3 rounded-lg px-4 py-3 border ${
              isConfirmed
                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
            }`}
          >
            {isConfirmed ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium text-sm text-gray-900 dark:text-white">
                {isConfirmed ? 'Assessment Confirmed' : 'Awaiting Confirmation'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Requested: {format(new Date(existingSchedule.requestedDate), 'MMMM d, yyyy')}
              </p>
              {existingSchedule.confirmedDate && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Confirmed: {format(new Date(existingSchedule.confirmedDate), 'MMMM d, yyyy')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <StatusBadge status={existingSchedule.status} />
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        /* Schedule form */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select your preferred assessment date. Our team will confirm availability within 2 business days.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Preferred Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                type="date"
                value={date}
                min={tomorrowStr}
                onChange={(e) => {
                  setDate(e.target.value);
                  setDateError('');
                }}
                className="pl-9"
                aria-invalid={!!dateError}
              />
            </div>
            {dateError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {dateError}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Available Monday–Friday, minimum 3 business days in advance.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requirements or preferred time zones..."
              rows={3}
              className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={scheduleMutation.isPending}
              className="flex items-center gap-2"
            >
              {scheduleMutation.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
