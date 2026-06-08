import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  CheckCircle2,
  Circle,
  User,
  Phone,
  Briefcase,
  ChevronRight,
  FileText,
  Handshake,
  Map,
  BookOpen,
  Cpu,
  PartyPopper,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, onboardingApi } from '@/lib/api';
import type { OnboardingChecklist } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';

// ─── Schema ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').max(100),
  title: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// ─── Checklist item config ────────────────────────────────────────────────────

interface ChecklistItemDef {
  key: keyof OnboardingChecklist;
  timestampKey: keyof OnboardingChecklist;
  label: string;
  icon: React.ReactNode;
}

const CHECKLIST_ITEMS: ChecklistItemDef[] = [
  {
    key: 'mndaSigned',
    timestampKey: 'mndaSignedAt',
    label: 'MNDA Signed',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    key: 'resellerAgreementSigned',
    timestampKey: 'resellerAgreementSignedAt',
    label: 'Reseller Agreement Signed',
    icon: <Handshake className="h-5 w-5" />,
  },
  {
    key: 'accountMappingDone',
    timestampKey: 'accountMappingDoneAt',
    label: 'Account Mapping Done',
    icon: <Map className="h-5 w-5" />,
  },
  {
    key: 'salesEnablementComplete',
    timestampKey: 'salesEnablementCompleteAt',
    label: 'Sales Enablement Complete',
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    key: 'technicalEnablementComplete',
    timestampKey: 'technicalEnablementCompleteAt',
    label: 'Technical Enablement Complete',
    icon: <Cpu className="h-5 w-5" />,
  },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

interface StepIndicatorProps {
  steps: string[];
  current: number;
}

function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center">
            <div
              className={`flex items-center justify-center h-9 w-9 rounded-full border-2 text-sm font-semibold transition-colors ${
                idx < current
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : idx === current
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-gray-300 text-gray-400 dark:border-gray-600'
              }`}
            >
              {idx < current ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
            </div>
            <span
              className={`mt-1 text-xs font-medium hidden sm:block ${
                idx === current
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {step}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 transition-colors ${
                idx < current ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Profile completion section ───────────────────────────────────────────────

interface ProfileSectionProps {
  onComplete: () => void;
}

function ProfileSection({ onComplete }: ProfileSectionProps) {
  const { user, updateUser } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      title: user?.title ?? '',
      phone: user?.phone ?? '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setApiError(null);
    try {
      const updated = await authApi.updateProfile({
        fullName: data.fullName,
        title: data.title ?? null,
        phone: data.phone ?? null,
        profileCompleted: true,
      });
      updateUser(updated);
      setSaved(true);
      setTimeout(onComplete, 800);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to save profile.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-indigo-600" />
          Complete Your Profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Jane Smith"
                className="pl-9"
                aria-invalid={!!errors.fullName}
                {...register('fullName')}
              />
            </div>
            {errors.fullName && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Job Title
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Sales Engineer"
                className="pl-9"
                {...register('title')}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="tel"
                placeholder="+1 (555) 000-0000"
                className="pl-9"
                {...register('phone')}
              />
            </div>
          </div>

          {apiError && (
            <div
              role="alert"
              className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
            >
              {apiError}
            </div>
          )}

          <Button type="submit" disabled={isSubmitting || saved} className="w-full sm:w-auto">
            {saved ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Saved!
              </span>
            ) : isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </span>
            ) : (
              'Save & Continue'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Onboarding checklist section ─────────────────────────────────────────────

interface ChecklistSectionProps {
  organizationId: string;
  canToggle: boolean;
}

function ChecklistSection({ organizationId, canToggle }: ChecklistSectionProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: checklist, isLoading, isError } = useQuery({
    queryKey: ['onboarding', organizationId],
    queryFn: () => onboardingApi.get(organizationId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<OnboardingChecklist>) =>
      onboardingApi.update(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', organizationId] });
    },
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError || !checklist) return (
    <div className="text-center py-12 text-sm text-gray-500">Failed to load checklist.</div>
  );

  const completedCount = CHECKLIST_ITEMS.filter(
    (item) => checklist[item.key] === true,
  ).length;
  const allComplete = completedCount === CHECKLIST_ITEMS.length;

  const handleToggle = (item: ChecklistItemDef) => {
    if (!canToggle) return;
    const currentVal = checklist[item.key] as boolean;
    const nowTs = new Date().toISOString();
    updateMutation.mutate({
      [item.key]: !currentVal,
      [item.timestampKey]: !currentVal ? nowTs : null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-indigo-600" />
            Partner Onboarding Checklist
          </CardTitle>
          <Badge
            variant={allComplete ? 'success' : 'warning'}
            className="text-xs"
          >
            {completedCount}/{CHECKLIST_ITEMS.length} Complete
          </Badge>
        </div>
        <div className="mt-3">
          <ProgressBar
            value={completedCount}
            max={CHECKLIST_ITEMS.length}
            size="md"
            color={allComplete ? 'green' : 'indigo'}
            showLabel
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {CHECKLIST_ITEMS.map((item, idx) => {
          const isDone = checklist[item.key] === true;
          const timestamp = checklist[item.timestampKey] as string | null;

          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                isDone
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40'
              }`}
            >
              <div className={`flex-shrink-0 ${isDone ? 'text-green-600' : 'text-gray-400'}`}>
                {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </div>
              <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">{item.icon}</div>
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium text-sm ${
                    isDone ? 'text-green-800 dark:text-green-300' : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {item.label}
                </p>
                {isDone && timestamp && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Completed {format(new Date(timestamp), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0">
                <StatusBadge status={isDone ? 'completed' : 'pending'} />
              </div>
              {canToggle && (
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  disabled={updateMutation.isPending}
                  className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                    isDone
                      ? 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20'
                      : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/20'
                  }`}
                >
                  {isDone ? 'Unmark' : 'Mark Done'}
                </button>
              )}
            </motion.div>
          );
        })}

        {allComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl bg-green-600 px-6 py-4 text-white"
          >
            <div className="flex items-center gap-3">
              <PartyPopper className="h-6 w-6 flex-shrink-0" />
              <div>
                <p className="font-semibold">You're all set! Ready to Register Deals!</p>
                <p className="text-sm text-green-100 mt-0.5">All onboarding steps are complete.</p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="bg-white text-green-700 hover:bg-green-50 flex-shrink-0"
              onClick={() => navigate('/deals/new')}
            >
              Register a Deal
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Vendor admin: all orgs table ─────────────────────────────────────────────

interface OrgChecklistRow {
  orgName: string;
  orgId: string;
  completedCount: number;
}

function VendorAdminView() {
  // In a real app we'd fetch all org checklists; here we show a placeholder table
  const columns: DataTableColumn<OrgChecklistRow>[] = [
    { key: 'orgName', header: 'Organization', cell: (r) => r.orgName },
    {
      key: 'progress',
      header: 'Progress',
      cell: (r) => (
        <div className="flex items-center gap-3 w-40">
          <ProgressBar value={r.completedCount} max={5} size="sm" />
          <span className="text-xs text-gray-500">{r.completedCount}/5</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusBadge status={r.completedCount === 5 ? 'completed' : 'pending'} />
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <Link
          to={`/admin/onboarding/${r.orgId}`}
          className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline"
        >
          View
        </Link>
      ),
    },
  ];

  const placeholder: OrgChecklistRow[] = [
    { orgId: '1', orgName: 'Acme Corp', completedCount: 5 },
    { orgId: '2', orgName: 'Globex Systems', completedCount: 3 },
    { orgId: '3', orgName: 'Initech Solutions', completedCount: 1 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Partner Onboarding Status</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          columns={columns}
          data={placeholder}
          emptyMessage="No partner organizations found"
        />
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user, isVendorAdmin, isPartnerAdmin } = useAuth();
  const [step, setStep] = useState<0 | 1>(user?.profileCompleted ? 1 : 0);

  const steps = ['Profile', 'Checklist'];

  if (!user) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-2xl"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-600 shadow mb-4">
            <span className="text-white font-extrabold">1K</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Partner Onboarding
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Complete the steps below to get started
          </p>
        </div>

        <StepIndicator steps={steps} current={step} />

        <div className="space-y-6">
          {step === 0 && (
            <ProfileSection onComplete={() => setStep(1)} />
          )}

          {step === 1 && (
            <>
              {isVendorAdmin ? (
                <VendorAdminView />
              ) : (
                <ChecklistSection
                  organizationId={user.organizationId}
                  canToggle={isPartnerAdmin || isVendorAdmin}
                />
              )}
            </>
          )}

          {step === 0 && user.profileCompleted && (
            <div className="text-center">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Skip — profile already complete
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
