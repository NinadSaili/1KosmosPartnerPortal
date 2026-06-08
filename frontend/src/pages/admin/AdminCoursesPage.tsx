import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useCourses, useDeleteCourse } from '@/hooks/useCourses';
import { useToast } from '@/components/ui/Toast';
import type { Course } from '@/types';

export default function AdminCoursesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCourses({ page, pageSize: 20 });
  const deleteCourse = useDeleteCourse();
  const { success, error: showError } = useToast();

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteCourse.mutateAsync(id);
      success('Course deleted', `"${title}" has been removed.`);
    } catch {
      showError('Delete failed', 'Unable to delete this course.');
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Title',
      cell: (row: Course) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.title}</p>
          <p className="text-xs text-gray-500 capitalize">{row.level} · {row.durationMinutes}m</p>
        </div>
      ),
    },
    {
      key: 'tags',
      header: 'Tags',
      cell: (row: Course) => (
        <div className="flex flex-wrap gap-1">
          {row.tags.slice(0, 3).map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
        </div>
      ),
    },
    {
      key: 'isPublished',
      header: 'Status',
      cell: (row: Course) => <StatusBadge status={row.isPublished ? 'published' : 'unpublished'} />,
    },
    {
      key: 'sortOrder',
      header: 'Order',
      cell: (row: Course) => row.sortOrder,
    },
    {
      key: 'actions',
      header: '',
      cell: (row: Course) => (
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/academy/${row.id}`}>View</Link>
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(row.id, row.title)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Courses"
        subtitle="Create and manage training courses."
        actions={<Button><Plus className="h-4 w-4 mr-1.5" /> New Course</Button>}
      />
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage="No courses found."
        pagination={data ? { page, pageSize: 20, total: data.total, onPageChange: setPage } : undefined}
      />
    </div>
  );
}
