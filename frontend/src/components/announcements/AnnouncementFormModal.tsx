import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useCreateAnnouncement, useUpdateAnnouncement } from '@/hooks/useAnnouncements';
import type { Announcement } from '@/types';

// ─── Schema ───────────────────────────────────────────────────────────────────

const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  type: z.enum(['vendor_news', 'product_update', 'security_advisory', 'general'], {
    required_error: 'Type is required',
  }),
  bodyHtml: z.string().min(1, 'Body is required'),
  isPinned: z.boolean().default(false),
  isPublished: z.boolean().default(false),
});

type AnnouncementFormData = z.infer<typeof announcementSchema>;

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface AnnouncementFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement?: Announcement | null;
  onSuccess?: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function AnnouncementFormModal({
  open,
  onOpenChange,
  announcement,
  onSuccess,
}: AnnouncementFormModalProps) {
  const { success, error: showError } = useToast();
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: '',
      type: 'vendor_news',
      bodyHtml: '',
      isPinned: false,
      isPublished: false,
    },
  });

  useEffect(() => {
    if (announcement) {
      reset({
        title: announcement.title,
        type: announcement.type,
        bodyHtml: announcement.bodyHtml,
        isPinned: announcement.isPinned,
        isPublished: announcement.isPublished,
      });
    } else {
      reset({
        title: '',
        type: 'vendor_news',
        bodyHtml: '',
        isPinned: false,
        isPublished: false,
      });
    }
  }, [announcement, reset, open]);

  const onSubmit = async (data: AnnouncementFormData) => {
    try {
      if (announcement) {
        await updateMutation.mutateAsync({ id: announcement.id, data });
        success('Announcement updated', 'The announcement has been saved.');
      } else {
        await createMutation.mutateAsync(data);
        success('Announcement created', 'The announcement has been published.');
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      showError(
        'Failed to save announcement',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  };

  const TYPE_OPTIONS = [
    { value: 'vendor_news', label: 'Vendor News' },
    { value: 'product_update', label: 'Product Update' },
    { value: 'security_advisory', label: 'Security Advisory' },
    { value: 'general', label: 'General' },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
              {announcement ? 'Edit Announcement' : 'New Announcement'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon">
                <X className="h-5 w-5" />
              </Button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                {...register('title')}
                placeholder="Announcement title"
              />
              {errors.title && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.title.message}</p>
              )}
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <Select {...register('type')}>
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
              {errors.type && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.type.message}</p>
              )}
            </div>

            {/* Body HTML */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Body (HTML) <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register('bodyHtml')}
                rows={10}
                placeholder="<p>Your announcement body here. HTML is supported.</p>"
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white resize-y"
              />
              {errors.bodyHtml && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.bodyHtml.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                HTML tags are allowed. Be careful with scripts — they will be sanitized on display.
              </p>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Pin Announcement</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pinned announcements appear at the top of the list</p>
                </div>
                <Controller
                  name="isPinned"
                  control={control}
                  render={({ field }) => (
                    <Switch.Root
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-gray-700 data-[state=checked]:bg-indigo-600 transition-colors"
                    >
                      <Switch.Thumb className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transform translate-x-1 data-[state=checked]:translate-x-6 transition-transform" />
                    </Switch.Root>
                  )}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Publish</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Make visible to all partners</p>
                </div>
                <Controller
                  name="isPublished"
                  control={control}
                  render={({ field }) => (
                    <Switch.Root
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-gray-700 data-[state=checked]:bg-indigo-600 transition-colors"
                    >
                      <Switch.Thumb className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transform translate-x-1 data-[state=checked]:translate-x-6 transition-transform" />
                    </Switch.Root>
                  )}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving…
                  </span>
                ) : announcement ? 'Save Changes' : 'Create Announcement'}
              </Button>
              <Dialog.Close asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
