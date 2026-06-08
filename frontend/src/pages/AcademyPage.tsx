import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Clock, Tag, Filter, Search, BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCourses } from '@/hooks/useCourses';
import type { Course, CourseLevel } from '@/types';

const LEVEL_COLORS: Record<CourseLevel, 'success' | 'warning' | 'destructive'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'destructive',
};

function CourseCard({ course }: { course: Course }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Link to={`/academy/${course.id}`}>
        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
          {course.thumbnailUrl && (
            <div className="h-40 overflow-hidden rounded-t-xl">
              <img
                src={course.thumbnailUrl}
                alt={course.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}
          {!course.thumbnailUrl && (
            <div className="h-40 rounded-t-xl bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-900 dark:to-brand-800 flex items-center justify-center">
              <BookOpen className="h-12 w-12 text-brand-400 dark:text-brand-500" />
            </div>
          )}
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <Badge variant={LEVEL_COLORS[course.level]} className="capitalize text-xs">
                {course.level}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                <Clock className="h-3 w-3" />
                {course.durationMinutes}m
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">
              {course.title}
            </h3>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {course.description}
            </p>
            {course.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {course.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-0.5 text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded px-1.5 py-0.5"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {course.progressPct != null && (
              <div className="mt-3">
                <ProgressBar value={course.progressPct} size="sm" showLabel color="indigo" />
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

const LEVELS: Array<CourseLevel | 'all'> = ['all', 'beginner', 'intermediate', 'advanced'];

export default function AcademyPage() {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<CourseLevel | 'all'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useCourses({
    search: search || undefined,
    level: level !== 'all' ? level : undefined,
    page,
    pageSize: 12,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training Academy"
        subtitle="Build your skills and advance your partner certification."
        actions={
          <Link to="/certifications">
            <Button variant="outline" size="sm">
              <GraduationCap className="h-4 w-4 mr-1.5" /> View Certifications
            </Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search courses..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <div className="flex gap-1">
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => { setLevel(l); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                  level === l
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : !data?.data?.length ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="No courses found"
          description={search ? 'Try adjusting your search or filters.' : 'No courses are available yet.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data.data.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 12 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {Math.ceil(data.total / 12)}
          </span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / 12)} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
