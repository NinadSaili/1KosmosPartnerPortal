// ─── Organization ────────────────────────────────────────────────────────────

export type OrgTier = 'registered' | 'silver' | 'gold' | 'platinum';
export type OrgStatus = 'pending' | 'active' | 'suspended';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  tier: OrgTier;
  status: OrgStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export type UserRole = 'vendor_admin' | 'partner_admin' | 'partner_user';

export interface User {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: UserRole;
  title: string | null;
  phone: string | null;
  isActive: boolean;
  profileCompleted: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser extends User {
  organization?: Organization;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export interface OnboardingChecklist {
  id: string;
  organizationId: string;
  mndaSigned: boolean;
  mndaSignedAt: string | null;
  resellerAgreementSigned: boolean;
  resellerAgreementSignedAt: string | null;
  accountMappingDone: boolean;
  accountMappingDoneAt: string | null;
  salesEnablementComplete: boolean;
  salesEnablementCompleteAt: string | null;
  technicalEnablementComplete: boolean;
  technicalEnablementCompleteAt: string | null;
}

// ─── Courses ──────────────────────────────────────────────────────────────────

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  level: CourseLevel;
  durationMinutes: number;
  thumbnailUrl: string | null;
  isPublished: boolean;
  prerequisiteCourseId: string | null;
  sortOrder: number;
  tags: string[];
  progressPct?: number;
}

export type LessonType = 'video' | 'document' | 'quiz' | 'interactive';

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  type: LessonType;
  contentUrl: string;
  durationMinutes: number;
  sortOrder: number;
  isRequired: boolean;
  isCompleted?: boolean;
}

// ─── Certifications ───────────────────────────────────────────────────────────

export type CertType = 'sales' | 'technical' | 'professional';

export interface Certification {
  id: string;
  title: string;
  slug: string;
  description: string;
  type: CertType;
  validityMonths: number;
  passingScore: number;
  requiredCourses?: Course[];
  isEligible?: boolean;
}

export type AssessmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface AssessmentSchedule {
  id: string;
  certificationId: string;
  userId: string;
  requestedDate: string;
  confirmedDate: string | null;
  status: AssessmentStatus;
  notes: string | null;
}

export interface IssuedCertificate {
  id: string;
  certNumber: string;
  userId: string;
  certificationId: string;
  issuedAt: string;
  expiresAt: string | null;
  pdfUrl: string | null;
  isRevoked: boolean;
}

// ─── Resources ────────────────────────────────────────────────────────────────

export type ResourceType =
  | 'datasheet'
  | 'whitepaper'
  | 'case_study'
  | 'presentation'
  | 'video'
  | 'template'
  | 'other';

export interface Resource {
  id: string;
  title: string;
  description: string;
  type: ResourceType;
  language: string;
  fileUrl: string;
  version: string | null;
  isPublished: boolean;
  uploadedBy: string;
  tags: string[];
  createdAt: string;
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export type DealStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected';

export interface Deal {
  id: string;
  submitterId: string;
  organizationId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  vertical: string;
  opportunityValueUsd: number;
  expectedCloseDate: string;
  competingVendors: string[];
  notes: string | null;
  status: DealStatus;
  reviewerId: string | null;
  reviewerComment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealDocument {
  id: string;
  dealId: string;
  fileName: string;
  fileUrl: string;
}

export interface DealStatusHistory {
  id: string;
  dealId: string;
  fromStatus: DealStatus | null;
  toStatus: DealStatus;
  actorId: string;
  comment: string | null;
  createdAt: string;
}

// ─── Announcements ────────────────────────────────────────────────────────────

export type AnnouncementType =
  | 'vendor_news'
  | 'product_update'
  | 'security_advisory'
  | 'general';

export interface Announcement {
  id: string;
  title: string;
  bodyHtml: string;
  type: AnnouncementType;
  isPinned: boolean;
  isPublished: boolean;
  createdBy: string;
  publishedAt: string | null;
  isRead?: boolean;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  dealsRegistered: number;
  dealsApproved: number;
  certsEarned: number;
  trainingCompletionPct: number;
  recentAnnouncements: Announcement[];
  upcomingSessions: AssessmentSchedule[];
}

// ─── AI ───────────────────────────────────────────────────────────────────────

export type AIQueryIntent =
  | 'search_training'
  | 'search_resources'
  | 'generate_proposal'
  | 'recommend_course';

export interface AIQueryRequest {
  intent: AIQueryIntent;
  query: string;
  context?: Record<string, string>;
}

export interface AIQueryResponse {
  text: string;
  sources: Array<{
    sourceType: string;
    sourceId: string;
    snippet: string;
  }>;
}

// ─── Pagination & Errors ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
}
