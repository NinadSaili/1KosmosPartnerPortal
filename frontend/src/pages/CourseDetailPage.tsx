import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  FileText,
  CheckCircle2,
  Circle,
  Clock,
  Lock,
  ChevronDown,
  Users,
  BookOpen,
  Award,
  Send,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { useCourse, useCourseLessons, useCourseProgress, useCompleteLesson } from '@/hooks/useCourses';
import type { LessonType } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const LEVEL_BADGE: Record<string, { label: string; variant: 'success' | 'blue' | 'purple' }> = {
  beginner: { label: 'Foundation', variant: 'success' },
  intermediate: { label: 'Practitioner', variant: 'blue' },
  advanced: { label: 'Expert', variant: 'purple' },
};

const LESSON_TYPE_ICON: Record<LessonType, React.ReactNode> = {
  video: <Play className="h-4 w-4 text-blue-500" />,
  document: <FileText className="h-4 w-4 text-orange-400" />,
  quiz: <HelpCircle className="h-4 w-4 text-purple-500" />,
  interactive: <Users className="h-4 w-4 text-green-500" />,
};

// ─── Lesson row ───────────────────────────────────────────────────────────────

interface LessonRowProps {
  lessonId: string;
  courseId: string;
  index: number;
  type: LessonType;
  title: string;
  durationMinutes: number;
  contentUrl: string;
  isRequired: boolean;
  isCompleted: boolean;
  isLocked: boolean;
}

function LessonRow({
  lessonId,
  courseId,
  index,
  type,
  title,
  durationMinutes,
  contentUrl,
  isCompleted,
  isLocked,
}: LessonRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [preworkText, setPreworkText] = useState('');
  const [preworkSubmitted, setPreworkSubmitted] = useState(false);
  const completeLesson = useCompleteLesson();
  const { success: toastSuccess, error: toastError } = useToast();

  const handleExpand = () => {
    if (isLocked) return;
    const willExpand = !expanded;
    setExpanded(willExpand);
    // Auto-complete video lessons when opened
    if (willExpand && type === 'video' && !isCompleted) {
      completeLesson.mutate(
        { courseId, lessonId },
        {
          onError: () => toastError('Could not save progress', 'Please try again.'),
        },
      );
    }
  };

  const handleManualComplete = () => {
    if (isCompleted) return;
    completeLesson.mutate(
      { courseId, lessonId },
      {
        onSuccess: () => toastSuccess('Lesson complete!', 'Progress saved.'),
        onError: () => toastError('Could not save progress', 'Please try again.'),
      },
    );
  };

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isCompleted
          ? 'border-green-200 dark:border-green-800'
          : isLocked
          ? 'border-gray-200 dark:border-gray-700 opacity-60'
          : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
      }`}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={handleExpand}
        disabled={isLocked}
        className="w-full flex items-center gap-3 p-4 text-left"
        aria-expanded={expanded}
      >
        <div className="flex-shrink-0">
          {isLocked ? (
            <Lock className="h-4 w-4 text-gray-400" />
          ) : isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <Circle className="h-4 w-4 text-gray-300 dark:text-gray-600" />
          )}
        </div>
        <span className="flex-shrink-0 text-xs font-mono text-gray-400 w-5 text-center">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex-shrink-0">{LESSON_TYPE_ICON[type]}</div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium truncate ${
              isCompleted ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-white'
            }`}
          >
            {title}
          </p>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {formatDuration(durationMinutes)}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {expanded && !isLocked && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-b-lg space-y-4">
              {type === 'video' && contentUrl && (
                <div className="aspect-video rounded-lg overflow-hidden bg-black">
                  <iframe
                    src={contentUrl}
                    title={title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              )}

              {type === 'document' && (
                <div className="flex flex-wrap items-center gap-3">
                  <FileText className="h-8 w-8 text-orange-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{title}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <a href={contentUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">Download PDF</Button>
                    </a>
                    {!isCompleted && (
                      <Button
                        size="sm"
                        onClick={handleManualComplete}
                        disabled={completeLesson.isPending}
                      >
                        {completeLesson.isPending ? 'Marking...' : 'Mark Complete'}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {type === 'quiz' && (
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-3">
                  <p>Complete this quiz to earn credit for the lesson.</p>
                  {!isCompleted && (
                    <Button
                      size="sm"
                      onClick={handleManualComplete}
                      disabled={completeLesson.isPending}
                    >
                      {completeLesson.isPending ? 'Starting...' : 'Start Quiz'}
                    </Button>
                  )}
                </div>
              )}

              {type === 'interactive' && (
                <div className="flex flex-wrap gap-2">
                  <a href={contentUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline">Open Interactive Content</Button>
                  </a>
                  {!isCompleted && (
                    <Button
                      size="sm"
                      onClick={handleManualComplete}
                      disabled={completeLesson.isPending}
                    >
                      {completeLesson.isPending ? 'Marking...' : 'Mark Complete'}
                    </Button>
                  )}
                </div>
              )}

              {/* Pre-work section for first lesson */}
              {index === 0 && (
                <div className="border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                    Pre-work Assignment
                  </p>
                  {preworkSubmitted ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      Pre-work submitted successfully!
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={preworkText}
                        onChange={(e) => setPreworkText(e.target.value)}
                        placeholder="Describe your prior experience or answer the pre-work prompt..."
                        rows={3}
                        className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!preworkText.trim()}
                        onClick={() => setPreworkSubmitted(true)}
                        className="flex items-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Submit Pre-work
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const { data: course, isLoading: courseLoading } = useCourse(courseId ?? '');
  const { data: lessons = [], isLoading: lessonsLoading } = useCourseLessons(courseId ?? '');
  const { data: progress } = useCourseProgress(courseId ?? '');

  if (courseLoading || lessonsLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Course not found.
      </div>
    );
  }

  const levelConfig = LEVEL_BADGE[course.level];
  const progressPct = progress?.progressPct ?? course.progressPct ?? 0;
  const completedLessonIds = new Set(progress?.completedLessons ?? []);
  const completedCount = completedLessonIds.size;

  const isLessonLocked = (idx: number): boolean => {
    if (idx === 0) return false;
    const prev = lessons[idx - 1];
    return prev.isRequired && !completedLessonIds.has(prev.id);
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/academy')}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Academy
      </button>

      {/* Hero */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-wrap items-start gap-2 mb-4">
          {levelConfig && (
            <Badge variant={levelConfig.variant}>{levelConfig.label}</Badge>
          )}
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(course.durationMinutes)}
          </Badge>
          {course.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="capitalize text-xs">
              {tag.replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{course.title}</h1>
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{course.description}</p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: lessons */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Course Content ({lessons.length} lesson{lessons.length !== 1 ? 's' : ''})
          </h2>
          {lessons.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No lessons available yet.</p>
          ) : (
            lessons.map((lesson, idx) => (
              <LessonRow
                key={lesson.id}
                lessonId={lesson.id}
                courseId={courseId ?? ''}
                index={idx}
                type={lesson.type}
                title={lesson.title}
                durationMinutes={lesson.durationMinutes}
                contentUrl={lesson.contentUrl}
                isRequired={lesson.isRequired}
                isCompleted={completedLessonIds.has(lesson.id) || !!lesson.isCompleted}
                isLocked={isLessonLocked(idx)}
              />
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Your Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <p className="text-4xl font-bold text-gray-900 dark:text-white">{progressPct}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {completedCount} of {lessons.length} lessons complete
                </p>
              </div>
              <ProgressBar
                value={progressPct}
                size="lg"
                color={progressPct === 100 ? 'green' : 'indigo'}
              />
              {progressPct === 100 && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Course completed!
                </div>
              )}
            </CardContent>
          </Card>

          {/* Course info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Course Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <BookOpen className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Level</p>
                  <p className="text-gray-700 dark:text-gray-300">{levelConfig?.label ?? course.level}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Audience</p>
                  <p className="text-gray-700 dark:text-gray-300">Partner Sales &amp; Technical</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Award className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Exam Format</p>
                  <p className="text-gray-700 dark:text-gray-300">Online proctored assessment</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prerequisite */}
          {course.prerequisiteCourseId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Prerequisite Course</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  to={`/academy/${course.prerequisiteCourseId}`}
                  className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
                >
                  <BookOpen className="h-4 w-4 flex-shrink-0" />
                  View prerequisite course
                  <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Certificate preview */}
          {progressPct === 100 && (
            <Card className="border-yellow-200 dark:border-yellow-700 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
              <CardContent className="pt-5 text-center space-y-2">
                <Award className="h-10 w-10 text-yellow-500 mx-auto" />
                <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">
                  Certificate Eligible
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  Schedule your assessment to earn a certificate for this course path.
                </p>
                <Link to="/certifications">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2 border-yellow-400 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-400 dark:border-yellow-600"
                  >
                    View Certifications
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
