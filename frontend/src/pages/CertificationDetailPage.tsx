import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ChevronLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Circle,
  BadgeCheck,
  Calendar,
  Clock,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { certApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScheduleModal } from '@/components/certifications/ScheduleModal';
import { CertificateCard } from '@/components/certifications/CertificateCard';

// ─── Assessment history row ───────────────────────────────────────────────────

import type { AssessmentSchedule } from '@/types';

function AssessmentRow({ assessment }: { assessment: AssessmentSchedule }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
      <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          Requested: {format(new Date(assessment.requestedDate), 'MMM d, yyyy')}
        </p>
        {assessment.confirmedDate && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Confirmed: {format(new Date(assessment.confirmedDate), 'MMM d, yyyy')}
          </p>
        )}
        {assessment.notes && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">
            "{assessment.notes}"
          </p>
        )}
      </div>
      <StatusBadge status={assessment.status} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CertificationDetailPage() {
  const { certId } = useParams<{ certId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const { data: cert, isLoading } = useQuery({
    queryKey: ['certification', certId],
    queryFn: () => certApi.getCertification(certId!),
    enabled: Boolean(certId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: certificatesData } = useQuery({
    queryKey: ['certificates', user?.id, certId],
    queryFn: () => certApi.listCertificates({ userId: user?.id }),
    enabled: Boolean(user && certId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        Certification not found.
      </div>
    );
  }

  const requiredCourses = cert.requiredCourses ?? [];
  const completedRequired = requiredCourses.filter((c) => c.progressPct === 100).length;
  const issuedCert = certificatesData?.data.find((c) => c.certificationId === cert.id);

  // Placeholder assessments — in production these would come from a dedicated endpoint
  const assessmentHistory: AssessmentSchedule[] = [];

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate('/certifications')}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 group"
      >
        <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Certifications
      </button>

      {/* Hero */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="h-14 w-14 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
            <Award className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{cert.title}</h1>
              <Badge variant="blue" className="capitalize">{cert.type}</Badge>
              {cert.isEligible && <Badge variant="success">Eligible</Badge>}
            </div>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{cert.description}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Valid {cert.validityMonths} months
              </span>
              <span className="flex items-center gap-1.5">
                <FileCheck className="h-4 w-4" />
                Passing score: {cert.passingScore}%
              </span>
            </div>
          </div>
          {cert.isEligible && !issuedCert && (
            <Button
              onClick={() => setScheduleOpen(true)}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Calendar className="h-4 w-4" />
              Schedule Assessment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Required courses checklist */}
          {requiredCourses.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-indigo-600" />
                    Required Courses
                  </CardTitle>
                  <Badge
                    variant={completedRequired === requiredCourses.length ? 'success' : 'warning'}
                  >
                    {completedRequired}/{requiredCourses.length}
                  </Badge>
                </div>
                <ProgressBar
                  value={completedRequired}
                  max={requiredCourses.length}
                  className="mt-3"
                  size="sm"
                  color={completedRequired === requiredCourses.length ? 'green' : 'indigo'}
                />
              </CardHeader>
              <CardContent className="space-y-2">
                {requiredCourses.map((course) => {
                  const done = course.progressPct === 100;
                  return (
                    <Link
                      key={course.id}
                      to={`/academy/${course.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            done
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {course.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-0.5">
                          {course.level} · {course.durationMinutes}m
                        </p>
                      </div>
                      {done ? (
                        <Badge variant="success" className="text-xs flex-shrink-0">
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {course.progressPct ?? 0}%
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Assessment history */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Assessment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assessmentHistory.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                  No assessments scheduled yet.
                  {cert.isEligible && (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={() => setScheduleOpen(true)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                      >
                        Schedule one now.
                      </button>
                    </>
                  )}
                </p>
              ) : (
                <div className="space-y-2">
                  {assessmentHistory.map((a) => (
                    <AssessmentRow key={a.id} assessment={a} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inline schedule form (if eligible and no pending schedule) */}
          {cert.isEligible && assessmentHistory.every((a) => a.status === 'cancelled' || a.status === 'completed') && !issuedCert && (
            <Card className="border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3 mb-3">
                  <BadgeCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  <p className="font-semibold text-indigo-800 dark:text-indigo-200">
                    You're eligible for this certification!
                  </p>
                </div>
                <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-4">
                  Schedule your assessment to earn the {cert.title} certification.
                </p>
                <Button
                  onClick={() => setScheduleOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Schedule Assessment
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Cert info card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Certification Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Type</span>
                <Badge variant="blue" className="capitalize">{cert.type}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Validity</span>
                <span className="font-medium text-gray-900 dark:text-white">{cert.validityMonths} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Passing Score</span>
                <span className="font-medium text-gray-900 dark:text-white">{cert.passingScore}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Eligibility</span>
                <Badge variant={cert.isEligible ? 'success' : 'secondary'}>
                  {cert.isEligible ? 'Eligible' : 'Not yet eligible'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Issued certificate card */}
          {issuedCert && (
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Your Certificate
              </p>
              <CertificateCard
                certificate={issuedCert}
                certificationTitle={cert.title}
                recipientName={user?.fullName ?? ''}
              />
            </div>
          )}
        </div>
      </div>

      <ScheduleModal
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        certificationId={cert.id}
        certificationTitle={cert.title}
      />
    </div>
  );
}
