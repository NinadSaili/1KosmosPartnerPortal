import React, { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import {
  Plus,
  Search,
  Upload,
  Pencil,
  Trash2,
  X,
  FileText,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  Download,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useToast } from '@/components/ui/Toast';
import {
  useResources,
  useCreateResource,
  useUpdateResource,
  useDeleteResource,
} from '@/hooks/useResources';
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
];

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

// ─── Resource Form Schema ─────────────────────────────────────────────────────

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

// ─── Resource Form Modal ──────────────────────────────────────────────────────

interface ResourceFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource?: Resource | null;
}

function ResourceFormModal({ open, onOpenChange, resource }: ResourceFormModalProps) {
  const { success, error: showError } = useToast();
  const createMutation = useCreateResource();
  const updateMutation = useUpdateResource();

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } =
    useForm<ResourceFormData>({
      resolver: zodResolver(resourceSchema),
      defaultValues: {
        title: '', description: '', type: '', language: 'en',
        version: '', fileUrl: '', tags: [], isPublished: false,
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
      reset({ title: '', description: '', type: '', language: 'en', version: '', fileUrl: '', tags: [], isPublished: false });
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
        success('Resource updated');
      } else {
        const fd = new FormData();
        fd.append('title', data.title);
        fd.append('description', data.description);
        fd.append('type', data.type);
        fd.append('language', data.language);
        if (data.version) fd.append('version', data.version);
        fd.append('fileUrl', data.fileUrl);
        fd.append('isPublished', String(data.isPublished));
        data.tags.forEach((t) => fd.append('tags[]', t));
        await createMutation.mutateAsync(fd);
        success('Resource created');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      showError('Failed to save', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-indigo-600" />
              {resource ? 'Edit Resource' : 'Upload Resource'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon"><X className="h-5 w-5" /></Button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
              <Input {...register('title')} placeholder="Resource title" />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Resource description"
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
              <Select {...register('type')} placeholder="Select type">
                {RESOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
              {errors.type && <p className="mt-1 text-xs text-red-600">{errors.type.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Vertical Tags</label>
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
                          onChange={(e) =>
                            field.onChange(
                              e.target.checked
                                ? [...field.value, v]
                                : field.value.filter((t: string) => t !== v),
                            )
                          }
                          className="rounded border-gray-300 text-indigo-600"
                        />
                        {v}
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Language</label>
                <Input {...register('language')} placeholder="en" maxLength={10} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version</label>
                <Input {...register('version')} placeholder="1.0" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File URL (Supabase Storage) *</label>
              <Input {...register('fileUrl')} type="url" placeholder="https://…" />
              {errors.fileUrl && <p className="mt-1 text-xs text-red-600">{errors.fileUrl.message}</p>}
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Published</p>
                <p className="text-xs text-gray-500">Visible to partners</p>
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

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : resource ? 'Save Changes' : 'Upload Resource'}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function AdminResourcesPage() {
  const { success, error: showError } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(e.target.value);
      setPage(1);
    }, 300);
  };

  const { data, isLoading } = useResources({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    type: typeFilter || undefined,
    // Admin sees all — including unpublished
  });

  const updateMutation = useUpdateResource();
  const deleteMutation = useDeleteResource();

  const resources = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleTogglePublish = async (resource: Resource) => {
    try {
      await updateMutation.mutateAsync({
        id: resource.id,
        data: { isPublished: !resource.isPublished },
      });
      success(resource.isPublished ? 'Unpublished' : 'Published', `"${resource.title}" updated.`);
    } catch {
      showError('Failed to update');
    }
  };

  const handleDelete = async (resource: Resource) => {
    if (!confirm(`Delete "${resource.title}"?`)) return;
    try {
      await deleteMutation.mutateAsync(resource.id);
      success('Deleted', 'Resource removed.');
    } catch {
      showError('Failed to delete');
    }
  };

  const handleBulkPublish = async (publish: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          updateMutation.mutateAsync({ id, data: { isPublished: publish } }),
        ),
      );
      success(
        publish ? 'Bulk published' : 'Bulk unpublished',
        `${selectedIds.size} resource(s) updated.`,
      );
      setSelectedIds(new Set());
    } catch {
      showError('Bulk update failed');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === resources.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(resources.map((r) => r.id)));
    }
  };

  const columns: DataTableColumn<Resource>[] = [
    {
      key: 'select',
      header: '',
      className: 'w-8',
      cell: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleSelect(row.id); }}
          className="text-indigo-600 dark:text-indigo-400"
        >
          {selectedIds.has(row.id) ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4 text-gray-400" />
          )}
        </button>
      ),
    },
    {
      key: 'title',
      header: 'Resource',
      cell: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
            <p className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-xs">
              {row.title}
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5 pl-6">
            {row.description.slice(0, 60)}…
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => (
        <Badge variant="outline" className="text-xs capitalize">
          {row.type.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      cell: (row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {row.version ? `v${row.version}` : '—'}
        </span>
      ),
    },
    {
      key: 'published',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.isPublished ? 'published' : 'unpublished'} />,
    },
    {
      key: 'downloads',
      header: 'Downloads',
      cell: () => (
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Download className="h-3 w-3" />
          <span>—</span>
        </div>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      cell: (row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {format(parseISO(row.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-28',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${row.isPublished ? 'text-yellow-600' : 'text-green-600'}`}
            onClick={(e) => { e.stopPropagation(); handleTogglePublish(row); }}
            title={row.isPublished ? 'Unpublish' : 'Publish'}
          >
            {row.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); setEditingResource(row); setFormOpen(true); }}
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:text-red-600"
            onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
            aria-label="Delete"
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
      <PageHeader
        title="Manage Resources"
        subtitle={`${total} resource${total !== 1 ? 's' : ''} — includes unpublished`}
        actions={
          <Button onClick={() => { setEditingResource(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Upload Resource
          </Button>
        }
      />

      {/* Filters + bulk actions */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
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
          {RESOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              variant="success"
              onClick={() => handleBulkPublish(true)}
              disabled={updateMutation.isPending}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Publish All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkPublish(false)}
              disabled={updateMutation.isPending}
            >
              <EyeOff className="h-3.5 w-3.5 mr-1" />
              Unpublish All
            </Button>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSelectAll}
          className="text-xs"
        >
          {selectedIds.size === resources.length && resources.length > 0 ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      <DataTable<Resource>
        columns={columns}
        data={resources}
        isLoading={isLoading}
        emptyMessage="No resources found"
        emptyDescription="Upload the first resource."
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
      />

      <ResourceFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        resource={editingResource}
      />
    </div>
  );
}
