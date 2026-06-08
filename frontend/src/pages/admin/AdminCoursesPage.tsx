import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import { useCourses, useCreateCourse, useUpdateCourse, useDeleteCourse } from '@/hooks/useCourses';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import type { Course, CourseLevel, LessonType } from '@/types';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const lessonSchema = z.object({
  type: z.enum(['video', 'document', 'quiz', 'interactive']),
  title: z.string().min(1, 'Title is required').max(200),
  contentUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  durationMinutes: z.coerce.number().min(1, 'Duration must be at least 1 minute'),
  sortOrder: z.coerce.number().min(0),
  isRequired: z.boolean(),
});

const courseSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  durationMinutes: z.coerce.number().min(1, 'Must be at least 1 minute'),
  prerequisiteCourseId: z.string().optional(),
  tags: z.string(), // comma-separated
  isPublished: z.boolean(),
  lessons: z.array(lessonSchema),
});

type CourseFormData = z.infer<typeof courseSchema>;

// ─── Slug generator ───────────────────────────────────────────────────────────

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

// ─── CourseForm (inside sheet) ────────────────────────────────────────────────

interface CourseFormProps {
  existing?: Course;
  allCourses: Course[];
  onClose: () => void;
}

function CourseForm({ existing, allCourses, onClose }: CourseFormProps) {
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const { success: toastSuccess, error: toastError } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: existing?.title ?? '',
      slug: existing?.slug ?? '',
      description: existing?.description ?? '',
      level: (existing?.level as CourseLevel) ?? 'beginner',
      durationMinutes: existing?.durationMinutes ?? 60,
      prerequisiteCourseId: existing?.prerequisiteCourseId ?? '',
      tags: existing?.tags.join(', ') ?? '',
      isPublished: existing?.isPublished ?? false,
      lessons: [],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'lessons',
  });

  const titleValue = watch('title');

  // Auto-generate slug from title (only if creating new)
  useEffect(() => {
    if (!existing) {
      setValue('slug', toSlug(titleValue));
    }
  }, [titleValue, existing, setValue]);

  const onSubmit = async (data: CourseFormData) => {
    try {
      const payload: Partial<Course> = {
        title: data.title,
        slug: data.slug,
        description: data.description,
        level: data.level,
        durationMinutes: data.durationMinutes,
        prerequisiteCourseId: data.prerequisiteCourseId || null,
        tags: data.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        isPublished: data.isPublished,
      };

      if (existing) {
        await updateCourse.mutateAsync({ id: existing.id, data: payload });
        toastSuccess('Course updated', `"${data.title}" has been saved.`);
      } else {
        await createCourse.mutateAsync(payload);
        toastSuccess('Course created', `"${data.title}" has been created.`);
      }
      onClose();
    } catch (err: unknown) {
      toastError('Failed to save', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const isPublished = watch('isPublished');

  const LESSON_TYPE_OPTIONS: Array<{ value: LessonType; label: string }> = [
    { value: 'video', label: 'Video' },
    { value: 'document', label: 'PDF / Document' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'interactive', label: 'Interactive' },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <Input placeholder="Introduction to 1Kosmos" aria-invalid={!!errors.title} {...register('title')} />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Slug <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="intro-to-1kosmos"
            className="font-mono text-sm"
            aria-invalid={!!errors.slug}
            {...register('slug')}
          />
          {errors.slug && <p className="mt-1 text-xs text-red-500">{errors.slug.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            placeholder="Describe the course content and what learners will achieve..."
            rows={3}
            className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-invalid={!!errors.description}
            {...register('description')}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
          )}
        </div>

        {/* Level + Duration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Level
            </label>
            <Select aria-invalid={!!errors.level} {...register('level')}>
              <option value="beginner">Foundation</option>
              <option value="intermediate">Practitioner</option>
              <option value="advanced">Expert</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Duration (minutes)
            </label>
            <Input
              type="number"
              min={1}
              aria-invalid={!!errors.durationMinutes}
              {...register('durationMinutes')}
            />
          </div>
        </div>

        {/* Prerequisite */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Prerequisite Course
          </label>
          <Select {...register('prerequisiteCourseId')}>
            <option value="">None</option>
            {allCourses
              .filter((c) => c.id !== existing?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </Select>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tags{' '}
            <span className="text-gray-400 font-normal text-xs">(comma-separated)</span>
          </label>
          <Input
            placeholder="financial_services, healthcare, general"
            {...register('tags')}
          />
        </div>

        {/* Published toggle */}
        <div className="flex items-center justify-between py-2 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Published</p>
            <p className="text-xs text-gray-400">Make this course visible to partners.</p>
          </div>
          <Switch.Root
            checked={isPublished}
            onCheckedChange={(v) => setValue('isPublished', v)}
            className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 dark:bg-gray-600 data-[state=checked]:bg-indigo-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Switch.Thumb className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5" />
          </Switch.Root>
        </div>

        {/* Lessons */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Lessons</h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                append({
                  type: 'video',
                  title: '',
                  contentUrl: '',
                  durationMinutes: 15,
                  sortOrder: fields.length,
                  isRequired: true,
                })
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Lesson
            </Button>
          </div>

          {fields.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              No lessons yet. Click "Add Lesson" to get started.
            </p>
          )}

          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div
                key={field.id}
                className="flex gap-2 items-start p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40"
              >
                <GripVertical className="h-4 w-4 text-gray-400 mt-2.5 flex-shrink-0 cursor-grab" />
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Input
                      placeholder="Lesson title"
                      className="text-sm"
                      aria-invalid={!!errors.lessons?.[idx]?.title}
                      {...register(`lessons.${idx}.title`)}
                    />
                    {errors.lessons?.[idx]?.title && (
                      <p className="text-xs text-red-500 mt-0.5">
                        {errors.lessons[idx]?.title?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Select className="text-sm" {...register(`lessons.${idx}.type`)}>
                      {LESSON_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Min"
                      className="text-sm"
                      {...register(`lessons.${idx}.durationMinutes`)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="Content URL"
                      className="text-sm font-mono"
                      aria-invalid={!!errors.lessons?.[idx]?.contentUrl}
                      {...register(`lessons.${idx}.contentUrl`)}
                    />
                    {errors.lessons?.[idx]?.contentUrl && (
                      <p className="text-xs text-red-500 mt-0.5">
                        {errors.lessons[idx]?.contentUrl?.message}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`required-${idx}`}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
                      {...register(`lessons.${idx}.isRequired`)}
                    />
                    <label
                      htmlFor={`required-${idx}`}
                      className="text-xs text-gray-600 dark:text-gray-400"
                    >
                      Required (gates next lesson)
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors mt-1"
                  aria-label="Remove lesson"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || createCourse.isPending || updateCourse.isPending}>
          {isSubmitting || createCourse.isPending || updateCourse.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </span>
          ) : existing ? (
            'Save Changes'
          ) : (
            'Create Course'
          )}
        </Button>
      </div>
    </form>
  );
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────

interface DeleteDialogProps {
  course: Course | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteDialog({ course, onConfirm, onCancel, isDeleting }: DeleteDialogProps) {
  return (
    <Modal
      open={!!course}
      onOpenChange={(open) => { if (!open) onCancel(); }}
      title="Delete Course"
      description="This action cannot be undone."
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">
            Are you sure you want to delete{' '}
            <strong>"{course?.title}"</strong>? All lessons and progress data will be permanently removed.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Deleting...
              </span>
            ) : (
              'Delete Course'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Sheet (side panel) ───────────────────────────────────────────────────────

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

function Sheet({ open, onOpenChange, title, children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300">
          {/* Sheet header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          {/* Sheet body */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCoursesPage() {
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);

  const { data, isLoading } = useCourses({ page, pageSize: 20 });
  const deleteCourse = useDeleteCourse();
  const updateCourse = useUpdateCourse();
  const { success: toastSuccess, error: toastError } = useToast();

  const allCourses = data?.data ?? [];

  const openNew = () => {
    setEditingCourse(null);
    setSheetOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    setSheetOpen(true);
  };

  const handleTogglePublish = async (course: Course) => {
    try {
      await updateCourse.mutateAsync({
        id: course.id,
        data: { isPublished: !course.isPublished },
      });
      toastSuccess(
        course.isPublished ? 'Course unpublished' : 'Course published',
        `"${course.title}" is now ${course.isPublished ? 'hidden from' : 'visible to'} partners.`,
      );
    } catch {
      toastError('Failed to update', 'Could not toggle publish status.');
    }
  };

  const handleDelete = async () => {
    if (!deletingCourse) return;
    try {
      await deleteCourse.mutateAsync(deletingCourse.id);
      toastSuccess('Course deleted', `"${deletingCourse.title}" has been removed.`);
      setDeletingCourse(null);
    } catch {
      toastError('Delete failed', 'Unable to delete this course.');
    }
  };

  const columns: DataTableColumn<Course>[] = [
    {
      key: 'title',
      header: 'Course',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
            <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[240px]">
              {row.title}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {row.level} · {row.durationMinutes}m
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'tags',
      header: 'Tags',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="secondary" className="text-xs capitalize">
              {t.replace(/_/g, ' ')}
            </Badge>
          ))}
          {row.tags.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{row.tags.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.isPublished ? 'published' : 'unpublished'} />,
    },
    {
      key: 'order',
      header: 'Order',
      cell: (row) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">{row.sortOrder}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openEdit(row)}
            title="Edit course"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleTogglePublish(row)}
            title={row.isPublished ? 'Unpublish' : 'Publish'}
            disabled={updateCourse.isPending}
          >
            {row.isPublished ? (
              <EyeOff className="h-4 w-4 text-orange-500" />
            ) : (
              <Eye className="h-4 w-4 text-green-500" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDeletingCourse(row)}
            title="Delete course"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Courses"
        subtitle="Create and manage training courses for partner organizations."
        actions={
          <Button onClick={openNew} className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            New Course
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={allCourses}
        isLoading={isLoading}
        emptyMessage="No courses found"
        emptyDescription="Create your first course to get started."
        pagination={
          data
            ? { page, pageSize: 20, total: data.total, onPageChange: setPage }
            : undefined
        }
      />

      {/* Course Sheet */}
      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editingCourse ? 'Edit Course' : 'New Course'}
      >
        {sheetOpen && (
          <CourseForm
            existing={editingCourse ?? undefined}
            allCourses={allCourses}
            onClose={() => setSheetOpen(false)}
          />
        )}
      </Sheet>

      {/* Delete confirm */}
      <DeleteDialog
        course={deletingCourse}
        onConfirm={handleDelete}
        onCancel={() => setDeletingCourse(null)}
        isDeleting={deleteCourse.isPending}
      />
    </div>
  );
}
