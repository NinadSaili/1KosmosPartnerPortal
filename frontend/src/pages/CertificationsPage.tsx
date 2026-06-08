import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Award,
  CheckCircle2,
  Circle,
  Lock,
  Download,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { certApi } from '@/lib/api';
import type { Certification, AssessmentSchedule, IssuedCertificate, CertType } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScheduleModal } from '@/components/certifications/ScheduleModal';
import { CertificateCard } from '@/components/certifications/CertificateCard';

// ─── Type badge ───────────────────────────────────────────────────────────────

const TYPE_BADGE_VARIANT: Record<CertType, 'blue' | 'purple' | 'default'> = {
  sales: 'blue',
  technical: 'purple',
  professional: 'default',
};

// ─── Certification path card ──────────────────────────────────────────────────

interface CertCardProps {
  cert: Certification;
  userCertificate?: IssuedCertificate;
}

function CertCard({ cert, userCertificate }: CertCardProps) {
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const requiredCourses = cert.requiredCourses ?? [];
  const completedRequired = requiredCourses.filter((c) => c.progressPct === 100).length;
  const allCompleted = completedRequired === requiredCourses.length && requiredCourses.length > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="h-full flex flex-col">
          <CardContent className="pt-5 flex flex-col flex-1 gap-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-100 dark:bg-indigo-900/40">
                <Award className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <Badge variant={TYPE_BADGE_VARIANT[cert.type]} className="capitalize text-xs flex-shrink-0">
                {cert.type}
              </Badge>
            </div>

            {/* Title + description */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{cert.title}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                {cert.description}
              </p>
            </div>

            {/* Required courses */}
            {requiredCourses.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Required Courses
                </p>
                <div className="space-y-1.5">
                  {requiredCourses.slice(0, 3).map((course) => {
                    const done = course.progressPct === 100;
                    return (
                      <div key={course.id} className="flex items-center gap-2 text-sm">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                        )}
                        <span
                          className={`truncate ${
                            done ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {course.title}
                        </span>
                      </div>
                    );
                  })}
                  {requiredCourses.length > 3 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 pl-6">
                      +{requiredCourses.length - 3} more courses
                    </p>
                  )}
                </div>

                {requiredCourses.length > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{completedRequired}/{requiredCourses.length} courses</span>
                    </div>
                    <ProgressBar
                      value={completedRequired}
                      max={requiredCourses.length}
                      size="sm"
                      color={allCompleted ? 'green' : 'indigo'}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Eligibility status */}
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
              cert.isEligible
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
            }`}>
              {cert.isEligible ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              ) : (
                <Lock className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="text-xs font-medium">
                {cert.isEligible
                  ? 'Eligible to Schedule'
                  : 'Complete required courses first'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-auto">
              {userCertificate ? (
                <Link to={`/certifications/${cert.id}`} className="flex-1">
                  <Button variant="success" size="sm" className="w-full flex items-center gap-1.5">
                    <BadgeCheck className="h-4 w-4" />
                    View Certificate
                  </Button>
                </Link>
              ) : cert.isEligible ? (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => setScheduleOpen(true)}
                >
                  <Award className="h-4 w-4 mr-1.5" />
                  Schedule Assessment
                </Button>
              ) : (
                <Link to={`/certifications/${cert.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    View Requirements
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <ScheduleModal
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        certificationId={cert.id}
        certificationTitle={cert.title}
      />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CertificationsPage() {
  const { user } = useAuth();

  const { data: certsData, isLoading: certsLoading } = useQuery({
    queryKey: ['certifications'],
    queryFn: () => certApi.listCertifications({ pageSize: 50 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: assessmentsData, isLoading: assessmentsLoading } = useQuery({
    queryKey: ['assessments', user?.id],
    queryFn: () =>
      certApi.listCertificates({ userId: user?.id }).then((r) => {
        // We're using the certificate list to represent assessments in this combined view
        return r;
      }),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: certificatesData, isLoading: certificatesLoading } = useQuery({
    queryKey: ['certificates', user?.id],
    queryFn: () => certApi.listCertificates({ userId: user?.id }),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const certs = certsData?.data ?? [];
  const certificates = certificatesData?.data ?? [];

  // Map cert ID -> issued certificate
  const certMap = new Map<string, IssuedCertificate>(
    certificates.map((c) => [c.certificationId, c]),
  );

  // Assessment table columns
  const assessmentColumns: DataTableColumn<AssessmentSchedule>[] = [
    {
      key: 'cert',
      header: 'Certification',
      cell: (r) => {
        const cert = certs.find((c) => c.id === r.certificationId);
        return (
          <Link
            to={`/certifications/${r.certificationId}`}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium text-sm"
          >
            {cert?.title ?? r.certificationId}
          </Link>
        );
      },
    },
    {
      key: 'requested',
      header: 'Requested Date',
      cell: (r) => (
        <span className="text-sm">{format(new Date(r.requestedDate), 'MMM d, yyyy')}</span>
      ),
    },
    {
      key: 'confirmed',
      header: 'Confirmed Date',
      cell: (r) =>
        r.confirmedDate ? (
          <span className="text-sm">{format(new Date(r.confirmedDate), 'MMM d, yyyy')}</span>
        ) : (
          <span className="text-xs text-gray-400">Pending confirmation</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Certifications"
        subtitle="Earn certifications to demonstrate your 1Kosmos expertise."
      />

      {/* ── Certification paths ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Certification Paths
        </h2>
        {certsLoading ? (
          <LoadingSpinner className="py-12" />
        ) : certs.length === 0 ? (
          <EmptyState
            icon={<Award className="h-8 w-8" />}
            title="No certifications available"
            description="Check back soon for new certification programs."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {certs.map((cert) => (
              <CertCard
                key={cert.id}
                cert={cert}
                userCertificate={certMap.get(cert.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── My Assessments ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          My Assessments
        </h2>
        <DataTable<AssessmentSchedule>
          columns={assessmentColumns}
          data={[]}
          isLoading={assessmentsLoading}
          emptyMessage="No assessments scheduled"
          emptyDescription="Schedule an assessment from one of the certification paths above."
        />
      </section>

      {/* ── Issued Certificates ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Issued Certificates
        </h2>
        {certificatesLoading ? (
          <LoadingSpinner className="py-8" />
        ) : certificates.length === 0 ? (
          <EmptyState
            icon={<BadgeCheck className="h-8 w-8" />}
            title="No certificates yet"
            description="Complete required courses and pass an assessment to earn certificates."
          />
        ) : (
          <div className="space-y-4">
            {/* Summary table */}
            <DataTable<IssuedCertificate>
              columns={[
                {
                  key: 'certNumber',
                  header: 'Certificate #',
                  cell: (r) => (
                    <span className="font-mono text-sm text-gray-900 dark:text-white">
                      {r.certNumber}
                    </span>
                  ),
                },
                {
                  key: 'cert',
                  header: 'Certification',
                  cell: (r) => {
                    const cert = certs.find((c) => c.id === r.certificationId);
                    return (
                      <Link
                        to={`/certifications/${r.certificationId}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
                      >
                        {cert?.title ?? r.certificationId}
                      </Link>
                    );
                  },
                },
                {
                  key: 'issued',
                  header: 'Issued',
                  cell: (r) => (
                    <span className="text-sm">{format(new Date(r.issuedAt), 'MMM d, yyyy')}</span>
                  ),
                },
                {
                  key: 'expires',
                  header: 'Expires',
                  cell: (r) =>
                    r.expiresAt ? (
                      <span className="text-sm">{format(new Date(r.expiresAt), 'MMM d, yyyy')}</span>
                    ) : (
                      <span className="text-xs text-gray-400">Never</span>
                    ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (r) => {
                    if (r.isRevoked) return <StatusBadge status="revoked" />;
                    if (r.expiresAt && new Date(r.expiresAt) < new Date())
                      return <StatusBadge status="expired" />;
                    if (
                      r.expiresAt &&
                      new Date(r.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    )
                      return <StatusBadge status="expiring_soon" />;
                    return <StatusBadge status="active" />;
                  },
                },
                {
                  key: 'download',
                  header: '',
                  cell: (r) =>
                    r.pdfUrl && !r.isRevoked ? (
                      <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="flex items-center gap-1.5">
                          <Download className="h-4 w-4" />
                          PDF
                        </Button>
                      </a>
                    ) : null,
                },
              ]}
              data={certificates}
            />

            {/* Visual certificate cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
              {certificates.slice(0, 4).map((cert) => {
                const certification = certs.find((c) => c.id === cert.certificationId);
                return (
                  <CertificateCard
                    key={cert.id}
                    certificate={cert}
                    certificationTitle={certification?.title ?? 'Certification'}
                    recipientName={user?.fullName ?? ''}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
