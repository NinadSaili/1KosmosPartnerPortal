import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import {
  Plus,
  Search,
  X,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useToast } from '@/components/ui/Toast';
import { authApi, axiosInstance } from '@/lib/api';
import type { User, UserRole } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'vendor_admin', label: 'Vendor Admin' },
  { value: 'partner_admin', label: 'Partner Admin' },
  { value: 'partner_user', label: 'Partner User' },
];

const ROLE_BADGE_VARIANTS: Record<UserRole, 'destructive' | 'warning' | 'blue'> = {
  vendor_admin: 'destructive',
  partner_admin: 'warning',
  partner_user: 'blue',
};

// ─── Provision User Schema ────────────────────────────────────────────────────

const provisionSchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email'),
  role: z.enum(['vendor_admin', 'partner_admin', 'partner_user']),
  organizationId: z.string().optional(),
});

type ProvisionFormData = z.infer<typeof provisionSchema>;

// ─── Provision Modal ──────────────────────────────────────────────────────────

interface ProvisionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function ProvisionUserModal({ open, onOpenChange, onSuccess }: ProvisionModalProps) {
  const { success, error: showError } = useToast();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProvisionFormData>({
    resolver: zodResolver(provisionSchema),
    defaultValues: { role: 'partner_user' },
  });

  const onSubmit = async (data: ProvisionFormData) => {
    try {
      await axiosInstance.post('/users/provision', data);
      success('User provisioned', `An invitation has been sent to ${data.email}.`);
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      showError(
        'Provisioning failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-600" />
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                Provision User
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon">
                <X className="h-5 w-5" />
              </Button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input {...register('fullName')} placeholder="Jane Smith" />
              {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <Input {...register('email')} type="email" placeholder="jane@partner.com" />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <Select {...register('role')}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Organization ID (optional)
              </label>
              <Input {...register('organizationId')} placeholder="org_…" />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Provisioning…' : 'Provision User'}
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

export default function AdminUsersPage() {
  const { success, error: showError } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [provisionOpen, setProvisionOpen] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(e.target.value);
      setPage(1);
    }, 300);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, debouncedSearch],
    queryFn: () => authApi.listUsers({ page, pageSize: 20 }),
    staleTime: 2 * 60 * 1000,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      axiosInstance.patch<User>(`/users/${id}`, { isActive }).then((r) => r.data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      success(
        updated.isActive ? 'User reactivated' : 'User deactivated',
        `${updated.fullName} has been ${updated.isActive ? 'reactivated' : 'deactivated'}.`,
      );
    },
    onError: () => showError('Failed to update user status'),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      axiosInstance.patch<User>(`/users/${id}`, { role }).then((r) => r.data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      success('Role updated', `${updated.fullName} is now a ${updated.role}.`);
    },
    onError: () => showError('Failed to update role'),
  });

  const filteredData = debouncedSearch
    ? (data?.data ?? []).filter(
        (u) =>
          u.fullName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          u.email.toLowerCase().includes(debouncedSearch.toLowerCase()),
      )
    : (data?.data ?? []);

  const columns: DataTableColumn<User>[] = [
    {
      key: 'user',
      header: 'User',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0 overflow-hidden">
            {row.avatarUrl ? (
              <img src={row.avatarUrl} alt={row.fullName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                {row.fullName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white text-sm">{row.fullName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (row) => (
        <Select
          value={row.role}
          onChange={(e) => changeRoleMutation.mutate({ id: row.id, role: e.target.value as UserRole })}
          className="h-8 text-xs w-36"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
      ),
    },
    {
      key: 'organization',
      header: 'Org ID',
      cell: (row) => (
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
          {row.organizationId.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      cell: (row) =>
        row.lastLoginAt ? (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {format(parseISO(row.lastLoginAt), 'MMM d, yyyy')}
          </span>
        ) : (
          <span className="text-xs text-gray-400">Never</span>
        ),
    },
    {
      key: 'status',
      header: 'Active',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Switch.Root
            checked={row.isActive}
            onCheckedChange={(checked) =>
              toggleActiveMutation.mutate({ id: row.id, isActive: checked })
            }
            disabled={toggleActiveMutation.isPending}
            className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-200 dark:bg-gray-700 data-[state=checked]:bg-green-500 transition-colors disabled:opacity-50"
          >
            <Switch.Thumb className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform translate-x-0.5 data-[state=checked]:translate-x-5 transition-transform" />
          </Switch.Root>
          <StatusBadge status={row.isActive ? 'active' : 'suspended'} />
        </div>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      cell: (row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {format(parseISO(row.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
      <PageHeader
        title="User Management"
        subtitle="Provision and manage portal users"
        actions={
          <Button onClick={() => setProvisionOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Provision User
          </Button>
        }
      />

      {/* Search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          <ShieldCheck className="h-4 w-4 text-indigo-500" />
          <span>{data?.total ?? 0} total users</span>
        </div>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {ROLE_OPTIONS.map((r) => (
          <Badge key={r.value} variant={ROLE_BADGE_VARIANTS[r.value]} className="text-xs">
            {r.label}
          </Badge>
        ))}
      </div>

      <DataTable<User>
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
        emptyMessage="No users found"
        emptyDescription="Provision the first user to get started."
        pagination={
          data
            ? {
                page,
                pageSize: 20,
                total: data.total,
                onPageChange: setPage,
              }
            : undefined
        }
      />

      <ProvisionUserModal
        open={provisionOpen}
        onOpenChange={setProvisionOpen}
        onSuccess={() => {}}
      />
    </div>
  );
}
