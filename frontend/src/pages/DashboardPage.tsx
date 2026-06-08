import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  TrendingUp,
  CheckCircle,
  Award,
  GraduationCap,
  BookOpen,
  PlusCircle,
  Download,
  ChevronRight,
  X,
  Megaphone,
  AlertTriangle,
  Info,
  Newspaper,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardApi, announcementApi } from '@/lib/api';
import type { Announcement, AnnouncementType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import type { TeamProgressEntry } from '@/lib/api';

// ─── Animation helpers ────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  change?: string;
  changePositive?: boolean;
  isLoading?: boolean;
}

function KpiCard({ label, value, icon, change, changePositive, isLoading }: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            {isLoading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
            ) : (
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
            {change && !isLoading && (
              <p
                className={`text-xs font-medium mt-1 ${
                  changePositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                }`}
              >
                {changePositive ? '+' : ''}{change}
              </p>
            )}
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Announcement type icon/variant ──────────────────────────────────────────

const ANNOUNCEMENT_CONFIG: Record<
  AnnouncementType,
  { icon: React.ReactNode; variant: 'default' | 'warning' | 'blue' | 'secondary' }
> = {
  vendor_news: { icon: <Newspaper className="h-3.5 w-3.5" />, variant: 'default' },
  product_update: { icon: <Info className="h-3.5 w-3.5" />, variant: 'blue' },
  security_advisory: { icon: <AlertTriangle className="h-3.5 w-3.5" />, variant: 'warning' },
  general: { icon: <Megaphone className="h-3.5 w-3.5" />, variant: 'secondary' },
};

function AnnouncementCard({ item }: { item: Announcement }) {
  const cfg = ANNOUNCEMENT_CONFIG[item.type];
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge variant={cfg.variant} className="flex items-center gap-1 text-xs">
            {cfg.icon}
            {item.type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </Badge>
          {item.isPinned && (
            <Badge variant="gold" className="text-xs">Pinned</Badge>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
          {item.title}
        </p>
        {item.publishedAt && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {format(new Date(item.publishedAt), 'MMM d, yyyy')}
          </p>
        )}
      </div>
      <Link
        to={`/announcements/${item.id}`}
        className="flex-shrink-0 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
        aria-label={`Read: ${item.title}`}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-3 animate-pulse">
      <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-8 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-2/3 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  );
}

// ─── Training section ─────────────────────────────────────────────────────────

function TrainingSection({
  isAdmin,
  isLoading,
  teamProgress,
  personalPct,
}: {
  isAdmin: boolean;
  isLoading: boolean;
  teamProgress?: TeamProgressEntry[];
  personalPct: number;
}) {
  const columns: DataTableColumn<TeamProgressEntry>[] = [
    {
      key: 'name',
      header: 'Member',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            {r.fullName.charAt(0)}
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{r.fullName}</span>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Completion',
      cell: (r) => (
        <div className="flex items-center gap-3 min-w-[160px]">
          <ProgressBar value={r.completionPct} size="sm" className="flex-1" />
          <span className="text-xs text-gray-500 w-10 text-right">{r.completionPct}%</span>
        </div>
      ),
    },
    {
      key: 'certs',
      header: 'Certs',
      cell: (r) => (
        <Badge variant="default" className="text-xs">{r.certsEarned}</Badge>
      ),
    },
  ];

  if (isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            Team Training Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={teamProgress ?? []}
            isLoading={isLoading}
            emptyMessage="No team members found"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="h-5 w-5 text-indigo-600" />
          My Training Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">Overall completion</span>
                <span className="text-gray-500 dark:text-gray-400">{personalPct}%</span>
              </div>
              <ProgressBar value={personalPct} size="lg" color={personalPct === 100 ? 'green' : 'indigo'} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Keep going! Visit the{' '}
              <Link to="/academy" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                Training Academy
              </Link>{' '}
              to continue your courses.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Onboarding banner ────────────────────────────────────────────────────────

function OnboardingBanner({
  completedCount,
  total,
  onDismiss,
}: {
  completedCount: number;
  total: number;
  onDismiss: () => void;
}) {
  if (completedCount === total) return null;

  return (
    <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 px-5 py-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
          Complete your partner onboarding
        </p>
        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
          {completedCount} of {total} steps complete
        </p>
        <ProgressBar
          value={completedCount}
          max={total}
          className="mt-2 max-w-xs"
          size="sm"
          color="indigo"
        />
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link to="/onboarding">
          <Button size="sm" className="whitespace-nowrap">
            Complete onboarding
          </Button>
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isPartnerAdmin, isVendorAdmin } = useAuth();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.getStats,
    staleTime: 60_000,
  });

  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['dashboard', 'team-progress'],
    queryFn: () => dashboardApi.getTeamProgress({ pageSize: 10 }),
    enabled: isPartnerAdmin || isVendorAdmin,
    staleTime: 60_000,
  });

  const { data: announcementsData, isLoading: annLoading } = useQuery({
    queryKey: ['announcements', { pageSize: 3, isPublished: true }],
    queryFn: () => announcementApi.list({ pageSize: 3, isPublished: true }),
    staleTime: 60_000,
  });

  const onboardingCompletedCount = 3; // Placeholder; would come from onboarding API
  const onboardingTotal = 5;

  const showOnboardingBanner =
    !bannerDismissed && onboardingCompletedCount < onboardingTotal;

  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-7xl space-y-6"
      >
        {/* Welcome header */}
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.fullName?.split(' ')[0] ?? 'Partner'}!
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{today}</p>
        </motion.div>

        {/* Onboarding banner */}
        {showOnboardingBanner && (
          <motion.div variants={itemVariants}>
            <OnboardingBanner
              completedCount={onboardingCompletedCount}
              total={onboardingTotal}
              onDismiss={() => setBannerDismissed(true)}
            />
          </motion.div>
        )}

        {/* KPI cards */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <KpiCard
                label="Deals Registered"
                value={stats?.dealsRegistered ?? 0}
                icon={<TrendingUp className="h-6 w-6" />}
                change="vs last month"
                changePositive
              />
              <KpiCard
                label="Deals Approved"
                value={stats?.dealsApproved ?? 0}
                icon={<CheckCircle className="h-6 w-6" />}
              />
              <KpiCard
                label="Certifications Earned"
                value={stats?.certsEarned ?? 0}
                icon={<Award className="h-6 w-6" />}
              />
              <KpiCard
                label="Training Completion"
                value={`${stats?.trainingCompletionPct ?? 0}%`}
                icon={<GraduationCap className="h-6 w-6" />}
              />
            </>
          )}
        </motion.div>

        {/* Training + Announcements row */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 lg:grid-cols-5 gap-6"
        >
          {/* Training (wider column) */}
          <div className="lg:col-span-3">
            <TrainingSection
              isAdmin={isPartnerAdmin || isVendorAdmin}
              isLoading={teamLoading || statsLoading}
              teamProgress={teamData?.data}
              personalPct={stats?.trainingCompletionPct ?? 0}
            />
          </div>

          {/* Recent Announcements */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Megaphone className="h-5 w-5 text-indigo-600" />
                    Announcements
                  </CardTitle>
                  <Link
                    to="/announcements"
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    View all
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {annLoading ? (
                  <div className="space-y-3 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                    ))}
                  </div>
                ) : !announcementsData?.data.length ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No announcements yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {announcementsData.data.map((item) => (
                      <AnnouncementCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Quick actions */}
        <motion.div variants={itemVariants}>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link to="/academy">
              <Card className="hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-pointer">
                <CardContent className="pt-6 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      Start Training
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Browse courses in the academy
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/deals/new">
              <Card className="hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-pointer">
                <CardContent className="pt-6 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-green-600 dark:text-green-400 flex-shrink-0">
                    <PlusCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      Register a Deal
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Submit a new opportunity
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/resources">
              <Card className="hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-pointer">
                <CardContent className="pt-6 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                    <Download className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      Download Resources
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Datasheets, decks &amp; more
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
