import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Download,
  FileText,
  Sword,
  Play,
  BarChart2,
  BookOpen,
  CheckSquare,
  Calendar,
  User,
  Globe,
  Tag,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useResource, useResources } from '@/hooks/useResources';
import { resourceApi } from '@/lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const RESOURCE_TYPES: Record<string, string> = {
  datasheet: 'Datasheet',
  battlecard: 'Battlecard',
  demo_script: 'Demo Script',
  competitive_comparison: 'Competitive Comparison',
  case_study: 'Case Study',
  poc_success_criteria: 'POC Criteria',
  whitepaper: 'Whitepaper',
  template: 'Template',
  other: 'Other',
};

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
  const cls = 'h-8 w-8';
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

// ─── Related Resources ────────────────────────────────────────────────────────

interface RelatedResourcesProps {
  currentId: string;
  type: string;
  tags: string[];
}

function RelatedResources({ currentId, type, tags }: RelatedResourcesProps) {
  const navigate = useNavigate();
  const { data: sameTypeData } = useResources({ type, isPublished: true, pageSize: 5 });

  const related = (sameTypeData?.data ?? [])
    .filter((r) => r.id !== currentId)
    .slice(0, 4);

  if (related.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Related Resources</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {related.map((r) => {
          const colorVariant = (TYPE_COLORS[r.type] ?? 'outline') as Parameters<typeof Badge>[0]['variant'];
          return (
            <button
              key={r.id}
              onClick={() => navigate(`/resources/${r.id}`)}
              className="w-full text-left flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
            >
              <div className="text-indigo-500 mt-0.5 shrink-0">{getTypeIcon(r.type)}</div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2">
                  {r.title}
                </p>
                <Badge variant={colorVariant} className="mt-1 text-xs">
                  {RESOURCE_TYPES[r.type] ?? r.type}
                </Badge>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: resource, isLoading, isError } = useResource(id!);

  const handleDownload = async () => {
    if (!resource) return;
    try {
      await resourceApi.download(resource.id);
      window.open(`${resource.fileUrl}?download=true`, '_blank');
    } catch {
      window.open(`${resource.fileUrl}?download=true`, '_blank');
    }
  };

  if (isLoading) {
    return <LoadingSpinner className="py-40" />;
  }

  if (isError || !resource) {
    return (
      <EmptyState
        title="Resource not found"
        description="This resource may have been removed or you don't have access."
        action={<Button onClick={() => navigate('/resources')}>Back to Resources</Button>}
      />
    );
  }

  const typeLabel = RESOURCE_TYPES[resource.type] ?? resource.type;
  const colorVariant = (TYPE_COLORS[resource.type] ?? 'outline') as Parameters<typeof Badge>[0]['variant'];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
      {/* Back link */}
      <Link
        to="/resources"
        className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Resources
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="lg:col-span-2 space-y-6"
        >
          {/* Hero card */}
          <Card>
            <CardContent className="p-8">
              <div className="flex items-start gap-5">
                <div className="flex-shrink-0 h-16 w-16 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  {getTypeIcon(resource.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant={colorVariant}>{typeLabel}</Badge>
                    {resource.version && (
                      <Badge variant="secondary">v{resource.version}</Badge>
                    )}
                    {resource.language && resource.language !== 'en' && (
                      <Badge variant="outline" className="uppercase">{resource.language}</Badge>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                    {resource.title}
                  </h1>
                </div>
              </div>

              <p className="mt-6 text-gray-600 dark:text-gray-300 leading-relaxed text-base">
                {resource.description}
              </p>

              <div className="mt-8">
                <Button size="lg" className="gap-2" onClick={handleDownload}>
                  <Download className="h-5 w-5" />
                  Download Resource
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* File metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">File Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Type</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{typeLabel}</dd>
                  </div>
                </div>

                {resource.version && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Tag className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Version</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white">{resource.version}</dd>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Language</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white uppercase">{resource.language}</dd>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Uploaded By</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{resource.uploadedBy}</dd>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Uploaded Date</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {format(new Date(resource.createdAt), 'MMM d, yyyy')}
                    </dd>
                  </div>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Tags */}
          {resource.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tags</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {resource.tags.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-6"
        >
          {/* Quick download */}
          <Card>
            <CardContent className="p-5">
              <Button className="w-full gap-2" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Download
              </Button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                Supabase Storage — opens in new tab
              </p>
            </CardContent>
          </Card>

          {/* Related resources */}
          <RelatedResources
            currentId={resource.id}
            type={resource.type}
            tags={resource.tags}
          />
        </motion.div>
      </div>
    </div>
  );
}
