import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import {
  Upload,
  Download,
  FileText,
  Sword,
  Play,
  BarChart2,
  BookOpen,
  CheckSquare,
  Pencil,
  Trash2,
  X,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import {
  useResources,
  useCreateResource,
  useUpdateResource,
  useDeleteResource,
} from '@/hooks/useResources';
import { resourceApi } from '@/lib/api';
import type { Resource } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const RESOURCE_TYPES = [
  { value: 'datasheet', label: 'Datasheet' },
  { value: 'battlecard', label: 'Battlecard' },
  { value: 'demo_script', label: 'Demo Script' },
  { value: 'competitive_comparison', label: 'Competitive Comparison' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'poc_success_criteria', label: 'POC Criteria' },
  { value: 'whitepaper', label: 'Whitepaper' },
  { value: 'template', label: 'Template' },
  { value: 'other', label: 'Other' },
] as const;

const VERTICALS = [
  'Financial Services',
  'Healthcare',
  'Government',
  'Retail',
  'Manufacturing',
  'Technology',
  'Education',
  'Energy',
];

const TYPE_COLORS: Record<string, string> = {
  datasheet: 'blue',
  battlecard: 'destructive',
  demo_script: 'purple',
  competitive_comparison: 'warning',
  case_study: 'success',
  poc_success_criteria: 'default',
  whitepaper: 'secondary',
  template: 'gold',
  other: 'outline',
};

function getTypeIcon(type: string): React.ReactElement {
  const cls = 'h-5 w-5';
  switch (type) {
    case 'datasheet': return <FileText className={cls} />;
    case 'battlecard': return <Sword className={cls} />;
    case 'demo_script': return <Play className={cls} />;
    case 'competitive_comparison': return <BarChart2 className={cls} />;
    case 'case_study': return <BookOpen className={cls} />;
    case 'poc_success_criteria': return <CheckSquare className={cls} />;
    default: return <FileText className={cls} />;
  }
}

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const resourceSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required'),
  type: z.string().min(1, 'Type is required'),
  language: z.string().min(2).max(10).default('en'),
  version: z.string().optional(),
  fileUrl: z.string().url('Must be a valid URL'),
  tags: z.array(z.string()).default([]),
  isPublished: z.boolean().default(false),
});

type ResourceFormData = z.infer<typeof resourceSchema>;

// ─── Resource Card ────────────────────────────────────────────────────────────

interface ResourceCardProps {
  resource: Resource;
  isAdmin: boolean;
  onEdit: (resource: Resource) => void;
  onDelete: (resource: Resource) => void;
}

function ResourceCard({ resource, isAdmin, onEdit, onDelete }: ResourceCardProps) {
  const navigate = useNavigate();
  const [downloadCount, setDownloadCount] = useState(0);
  const [showDownloadAnim, setShowDownloadAnim] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await resourceApi.download(resource.id);
      setDownloadCount((c) => c + 1);
      setShowDownloadAnim(true);
      window.open(`${resource.fileUrl}?download=true`, '_blank');
      setTimeout(() => setShowDownloadAnim(false), 1500);
    } catch {
      window.open(`${resource.fileUrl}?download=true`, '_blank');
    }
  };

  const typeLabel =
    RESOURCE_TYPES.find((t) => t.value === resource.type)?.label ?? resource.type;
  const colorVariant = (TYPE_COLORS[resource.type] ?? 'outline') as Parameters<typeof Badge>[0]['variant'];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="flex flex-col h-full cursor-pointer hover:shadow-md transition-shadow group"
        onClick={() => navigate(`/resources/${resource.id}`)}
      >
        <div className="p-5 flex-1 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              {getTypeIcon(resource.type)}
            </div>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); onEdit(resource); }}
                    aria-label="Edit resource"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600"
                    onClick={(e) => { e.stopPropagation(); onDelete(resource); }}
                    aria-label="Delete resource"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Type badge */}
          <div>
            <Badge variant={colorVariant}>{typeLabel}</Badge>
          </div>

          {/* Title & description */}
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug line-clamp-2">
            {resource.title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 flex-1">
            {resource.description}
          </p>

          {/* Meta */}
          <div className="flex flex-wrap gap-1.5 mt-auto">
            {resource.version && (
              <Badge variant="secondary" className="text-xs">v{resource.version}</Badge>
            )}
            {resource.language && resource.language !== 'en' && (
              <Badge variant="outline" className="text-xs uppercase">{resource.language}</Badge>
            )}
            {resource.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
          <Button
            size="sm"
            className="w-full relative overflow-hidden"
            onClick={handleDownload}
          >
            <AnimatePresence mode="wait">
              {showDownloadAnim ? (
                <motion.span
                  key="downloading"
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -16, opacity: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Downloaded! {downloadCount > 0 && `(+${downloadCount})`}
                </motion.span>
              ) : (
                <motion.span
                  key="download"
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -16, opacity: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Resource Form Modal ──────────────────────────────────────────────────────

interface ResourceFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource?: Resource | null;
  onSuccess: () => void;
}

function ResourceFormModal({ open, onOpenChange, resource, onSuccess }: ResourceFormModalProps) {
  const createMutation = useCreateResource();
  const updateMutation = useUpdateResource();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResourceFormData>({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      title: '',
      description: '',
      type: '',
      language: 'en',
      version: '',
      fileUrl: '',
      tags: [],
      isPublished: false,
    },
  });

  useEffect(() => {
    if (resource) {
      reset({
        title: resource.title,
        description: resource.description,
        type: resource.type,
        language: resource.language,
        version: resource.version ?? '',
        fileUrl: resource.fileUrl,
        tags: resource.tags,
        isPublished: resource.isPublished,
      });
    } else {
      reset({
        title: '',
        description: '',
        type: '',
        language: 'en',
        version: '',
        fileUrl: '',
        tags: [],
        isPublished: false,
      });
    }
  }, [resource, reset, open]);

  const onSubmit = async (data: ResourceFormData) => {
    try {
      if (resource) {
        await updateMutation.mutateAsync({
          id: resource.id,
          data: {
            title: data.title,
            description: data.description,
            type: data.type as Resource['type'],
            language: data.language,
            version: data.version || null,
            fileUrl: data.fileUrl,
            tags: data.tags,
            isPublished: data.isPublished,
          },
        });
      } else {
        const formData = new FormData();
        formData.append('title', data.title);
        formData.append('description', data.description);
        formData.append('type', data.type);
        formData.append('language', data.language);
        if (data.version) formData.append('version', data.version);
        formData.append('fileUrl', data.fileUrl);
        formData.append('isPublished', String(data.isPublished));
        data.tags.forEach((tag) => formData.append('tags[]', tag));
        await createMutation.mutateAsync(formData);
      }
      onSuccess();
      onOpenChange(false);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
              {resource ? 'Edit Resource' : 'Upload Resource'}
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
              <Input {...register('title')} placeholder="Resource title" />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Resource description"
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <Select {...register('type')} placeholder="Select type">
                {RESOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
              {errors.type && <p className="mt-1 text-xs text-red-600">{errors.type.message}</p>}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Vertical Tags
              </label>
              <Controller
                name="tags"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2">
                    {VERTICALS.map((v) => (
                      <label key={v} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.value.includes(v)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              field.onChange([...field.value, v]);
                            } else {
                              field.onChange(field.value.filter((t: string) => t !== v));
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600"
                        />
                        {v}
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Language
              </label>
              <Input {...register('language')} placeholder="e.g. en, fr, de" maxLength={10} />
            </div>

            {/* Version */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Version
              </label>
              <Input {...register('version')} placeholder="e.g. 1.0" />
            </div>

            {/* File URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                File URL (Supabase Storage) <span className="text-red-500">*</span>
              </label>
              <Input {...register('fileUrl')} placeholder="https://..." type="url" />
              {errors.fileUrl && <p className="mt-1 text-xs text-red-600">{errors.fileUrl.message}</p>}
            </div>

            {/* Published toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Published
              </label>
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

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving…
                  </span>
                ) : resource ? 'Save Changes' : 'Upload Resource'}
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

// ─── Delete Confirmation ──────────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  resource: Resource | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ resource, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  const deleteMutation = useDeleteResource();

  const handleConfirm = async () => {
    if (!resource) return;
    await deleteMutation.mutateAsync(resource.id);
    onConfirm();
  };

  return (
    <Dialog.Root open={!!resource} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-white dark:bg-gray-900 p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Delete Resource
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Are you sure you want to delete <strong className="text-gray-700 dark:text-gray-300">{resource?.title}</strong>? This action cannot be undone.
          </Dialog.Description>
          <div className="flex gap-3">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const { isVendorAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [verticalFilter, setVerticalFilter] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(e.target.value);
      setPage(1);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    setTypeFilter('');
    setVerticalFilter('');
    setPage(1);
  }, []);

  const hasFilters = debouncedSearch || typeFilter || verticalFilter;

  // Data
  const { data, isLoading } = useResources({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    type: typeFilter || undefined,
    tag: verticalFilter || undefined,
    isPublished: isVendorAdmin ? undefined : true,
  });

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [deletingResource, setDeletingResource] = useState<Resource | null>(null);

  const handleEdit = (resource: Resource) => {
    setEditingResource(resource);
    setFormOpen(true);
  };

  const handleUploadClick = () => {
    setEditingResource(null);
    setFormOpen(true);
  };

  const resources = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
      <PageHeader
        title="Resource Center"
        subtitle={`${total} resource${total !== 1 ? 's' : ''} available`}
        actions={
          isVendorAdmin ? (
            <Button onClick={handleUploadClick}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Resource
            </Button>
          ) : undefined
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search resources…"
            className="pl-9"
          />
        </div>

        <Select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="w-48"
        >
          <option value="">All Types</option>
          {RESOURCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>

        <Select
          value={verticalFilter}
          onChange={(e) => { setVerticalFilter(e.target.value); setPage(1); }}
          className="w-48"
        >
          <option value="">All Verticals</option>
          {VERTICALS.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </Select>

        {hasFilters && (
          <Button variant="outline" onClick={clearFilters} size="sm" className="self-center">
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <LoadingSpinner className="py-20" />
      ) : resources.length === 0 ? (
        <EmptyState
          icon={<Filter className="h-8 w-8" />}
          title="No resources found"
          description={hasFilters ? 'Try adjusting your filters.' : 'No resources have been published yet.'}
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            <AnimatePresence>
              {resources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  isAdmin={isVendorAdmin}
                  onEdit={handleEdit}
                  onDelete={setDeletingResource}
                />
              ))}
            </AnimatePresence>
          </motion.div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <ResourceFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        resource={editingResource}
        onSuccess={() => setEditingResource(null)}
      />

      <DeleteConfirmDialog
        resource={deletingResource}
        onConfirm={() => setDeletingResource(null)}
        onCancel={() => setDeletingResource(null)}
      />
    </div>
  );
}
