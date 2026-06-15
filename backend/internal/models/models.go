package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/pgvector/pgvector-go"
)

// ---------------------------------------------------------------------------
// Core domain models
// ---------------------------------------------------------------------------

// Organization represents a partner company registered in the portal.
type Organization struct {
	ID              uuid.UUID  `json:"id"`
	Name            string     `json:"name"`
	Slug            string     `json:"slug"`
	Tier            string     `json:"tier"`
	VerticalTags    []string   `json:"vertical_tags"`
	LogoURL         *string    `json:"logo_url"`
	Website         *string    `json:"website"`
	Region          *string    `json:"region"`
	SalesforceID    *string    `json:"salesforce_id"`
	OnboardingState string     `json:"onboarding_state"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt       *time.Time `json:"deleted_at,omitempty"`
}

// User represents a portal user (partner rep, partner admin, or vendor admin).
type User struct {
	ID               uuid.UUID  `json:"id"`
	OrganizationID   *uuid.UUID `json:"organization_id,omitempty"`
	Email            string     `json:"email"`
	FullName         string     `json:"full_name"`
	Role             string     `json:"role"`
	AvatarURL        *string    `json:"avatar_url,omitempty"`
	Title            *string    `json:"title,omitempty"`
	Phone            *string    `json:"phone,omitempty"`
	IsActive         bool       `json:"is_active"`
	ProfileCompleted bool       `json:"profile_completed"`
	LastLoginAt      *time.Time `json:"last_login_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// OnboardingChecklist tracks the onboarding progress for an organization.
// Field names match the database column names exactly.
type OnboardingChecklist struct {
	ID                            uuid.UUID  `json:"id"`
	OrganizationID                uuid.UUID  `json:"organization_id"`
	MndaSigned                    bool       `json:"mnda_signed"`
	MndaSignedAt                  *time.Time `json:"mnda_signed_at,omitempty"`
	ResellerAgreementSigned       bool       `json:"reseller_agreement_signed"`
	ResellerAgreementSignedAt     *time.Time `json:"reseller_agreement_signed_at,omitempty"`
	AccountMappingDone            bool       `json:"account_mapping_done"`
	AccountMappingDoneAt          *time.Time `json:"account_mapping_done_at,omitempty"`
	SalesEnablementComplete       bool       `json:"sales_enablement_complete"`
	SalesEnablementCompleteAt     *time.Time `json:"sales_enablement_complete_at,omitempty"`
	TechnicalEnablementComplete   bool       `json:"technical_enablement_complete"`
	TechnicalEnablementCompleteAt *time.Time `json:"technical_enablement_complete_at,omitempty"`
	UpdatedBy                     *uuid.UUID `json:"updated_by,omitempty"`
	CreatedAt                     time.Time  `json:"created_at"`
	UpdatedAt                     time.Time  `json:"updated_at"`
	// ReadyToDealRegister is computed, not stored.
	ReadyToDealRegister bool `json:"ready_to_deal_register"`
}

// Course is a training course available in the portal.
type Course struct {
	ID               uuid.UUID  `json:"id"`
	Title            string     `json:"title"`
	Slug             string     `json:"slug"`
	Description      string     `json:"description"`
	ThumbnailURL     *string    `json:"thumbnail_url,omitempty"`
	DurationMinutes  int        `json:"duration_minutes"`
	Level            string     `json:"level"`
	IsPublished      bool       `json:"is_published"`
	IsMandatory      bool       `json:"is_mandatory"`
	SortOrder        int        `json:"sort_order"`
	CreatedBy        uuid.UUID  `json:"created_by"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty"`
}

// CourseVerticalTag associates a course with industry vertical tags.
type CourseVerticalTag struct {
	CourseID uuid.UUID `json:"course_id"`
	Tag      string    `json:"tag"`
}

// Lesson is a single unit of learning within a course.
type Lesson struct {
	ID              uuid.UUID  `json:"id"`
	CourseID        uuid.UUID  `json:"course_id"`
	Title           string     `json:"title"`
	Slug            string     `json:"slug"`
	ContentType     string     `json:"content_type"`
	ContentURL      *string    `json:"content_url,omitempty"`
	ContentBody     *string    `json:"content_body,omitempty"`
	DurationMinutes int        `json:"duration_minutes"`
	SortOrder       int        `json:"sort_order"`
	IsPublished     bool       `json:"is_published"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt       *time.Time `json:"deleted_at,omitempty"`
}

// PreworkAssignment is a pre-course assignment linked to a lesson.
type PreworkAssignment struct {
	ID           uuid.UUID  `json:"id"`
	LessonID     uuid.UUID  `json:"lesson_id"`
	Title        string     `json:"title"`
	Instructions string     `json:"instructions"`
	DueOffsetDays int       `json:"due_offset_days"`
	IsRequired   bool       `json:"is_required"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// PreworkSubmission is a user's response to a pre-work assignment.
type PreworkSubmission struct {
	ID           uuid.UUID  `json:"id"`
	AssignmentID uuid.UUID  `json:"assignment_id"`
	UserID       uuid.UUID  `json:"user_id"`
	SubmittedAt  time.Time  `json:"submitted_at"`
	ContentURL   *string    `json:"content_url,omitempty"`
	ContentText  *string    `json:"content_text,omitempty"`
	GradedBy     *uuid.UUID `json:"graded_by,omitempty"`
	GradedAt     *time.Time `json:"graded_at,omitempty"`
	Score        *int       `json:"score,omitempty"`
	Feedback     *string    `json:"feedback,omitempty"`
}

// LessonProgress tracks a user's completion of individual lessons.
type LessonProgress struct {
	ID             uuid.UUID  `json:"id"`
	UserID         uuid.UUID  `json:"user_id"`
	LessonID       uuid.UUID  `json:"lesson_id"`
	CourseID       uuid.UUID  `json:"course_id"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	TimeSpentSecs  int        `json:"time_spent_secs"`
	LastAccessedAt time.Time  `json:"last_accessed_at"`
}

// Certification is a certification program that requires completing certain courses.
type Certification struct {
	ID                  uuid.UUID  `json:"id"`
	Title               string     `json:"title"`
	Slug                string     `json:"slug"`
	Description         string     `json:"description"`
	BadgeImageURL       *string    `json:"badge_image_url,omitempty"`
	ValidityMonths      int        `json:"validity_months"`
	PassingScorePercent int        `json:"passing_score_percent"`
	IsActive            bool       `json:"is_active"`
	CreatedBy           uuid.UUID  `json:"created_by"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
	DeletedAt           *time.Time `json:"deleted_at,omitempty"`
}

// CertificationCourseRequirement links required courses to a certification.
type CertificationCourseRequirement struct {
	ID              uuid.UUID `json:"id"`
	CertificationID uuid.UUID `json:"certification_id"`
	CourseID        uuid.UUID `json:"course_id"`
	IsRequired      bool      `json:"is_required"`
	SortOrder       int       `json:"sort_order"`
}

// AssessmentSchedule defines a scheduled assessment session for a certification.
type AssessmentSchedule struct {
	ID              uuid.UUID  `json:"id"`
	CertificationID uuid.UUID  `json:"certification_id"`
	ScheduledFor    time.Time  `json:"scheduled_for"`
	LocationOrURL   string     `json:"location_or_url"`
	MaxParticipants int        `json:"max_participants"`
	InstructorID    *uuid.UUID `json:"instructor_id,omitempty"`
	Notes           *string    `json:"notes,omitempty"`
	Status          string     `json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// AssessmentResult is the outcome of a user's certification assessment attempt.
type AssessmentResult struct {
	ID                 uuid.UUID  `json:"id"`
	AssessmentID       uuid.UUID  `json:"assessment_id"`
	UserID             uuid.UUID  `json:"user_id"`
	CertificationID    uuid.UUID  `json:"certification_id"`
	Score              int        `json:"score"`
	MaxScore           int        `json:"max_score"`
	Passed             bool       `json:"passed"`
	AttemptNumber      int        `json:"attempt_number"`
	AssessedAt         time.Time  `json:"assessed_at"`
	GradedBy           *uuid.UUID `json:"graded_by,omitempty"`
	Notes              *string    `json:"notes,omitempty"`
}

// IssuedCertificate is a certificate awarded to a user upon passing an assessment.
type IssuedCertificate struct {
	ID                uuid.UUID  `json:"id"`
	CertificationID   uuid.UUID  `json:"certification_id"`
	UserID            uuid.UUID  `json:"user_id"`
	OrganizationID    uuid.UUID  `json:"organization_id"`
	CertificateNumber string     `json:"certificate_number"`
	IssuedAt          time.Time  `json:"issued_at"`
	ExpiresAt         *time.Time `json:"expires_at,omitempty"`
	RevokedAt         *time.Time `json:"revoked_at,omitempty"`
	RevokedBy         *uuid.UUID `json:"revoked_by,omitempty"`
	RevocationReason  *string    `json:"revocation_reason,omitempty"`
	PDFStoragePath    *string    `json:"pdf_storage_path,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

// Resource is a document or asset available to partners.
type Resource struct {
	ID           uuid.UUID  `json:"id"`
	Title        string     `json:"title"`
	Description  *string    `json:"description,omitempty"`
	ResourceType string     `json:"resource_type"`
	StoragePath  string     `json:"storage_path"`
	FileSize     *int64     `json:"file_size,omitempty"`
	MimeType     *string    `json:"mime_type,omitempty"`
	IsPublic     bool       `json:"is_public"`
	DownloadCount int       `json:"download_count"`
	CreatedBy    uuid.UUID  `json:"created_by"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	DeletedAt    *time.Time `json:"deleted_at,omitempty"`
}

// ResourceVerticalTag associates a resource with industry vertical tags.
type ResourceVerticalTag struct {
	ResourceID uuid.UUID `json:"resource_id"`
	Tag        string    `json:"tag"`
}

// Deal is a partner deal registration record.
type Deal struct {
	ID                uuid.UUID  `json:"id"`
	OrganizationID    uuid.UUID  `json:"organization_id"`
	OwnerID           uuid.UUID  `json:"owner_id"`
	CompanyName       string     `json:"company_name"`
	ContactName       string     `json:"contact_name"`
	ContactEmail      string     `json:"contact_email"`
	ContactPhone      *string    `json:"contact_phone,omitempty"`
	EstimatedValue    *float64   `json:"estimated_value,omitempty"`
	Currency          string     `json:"currency"`
	ExpectedCloseDate *time.Time `json:"expected_close_date,omitempty"`
	Stage             string     `json:"stage"`
	Status            string     `json:"status"`
	Notes             *string    `json:"notes,omitempty"`
	SalesforceID      *string    `json:"salesforce_id,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	DeletedAt         *time.Time `json:"deleted_at,omitempty"`
}

// DealDocument is a file attached to a deal.
type DealDocument struct {
	ID          uuid.UUID `json:"id"`
	DealID      uuid.UUID `json:"deal_id"`
	UploadedBy  uuid.UUID `json:"uploaded_by"`
	FileName    string    `json:"file_name"`
	StoragePath string    `json:"storage_path"`
	FileSize    *int64    `json:"file_size,omitempty"`
	MimeType    *string   `json:"mime_type,omitempty"`
	UploadedAt  time.Time `json:"uploaded_at"`
}

// DealStatusHistory records every status transition for a deal.
type DealStatusHistory struct {
	ID         uuid.UUID  `json:"id"`
	DealID     uuid.UUID  `json:"deal_id"`
	ChangedBy  uuid.UUID  `json:"changed_by"`
	FromStatus *string    `json:"from_status,omitempty"`
	ToStatus   string     `json:"to_status"`
	Comment    *string    `json:"comment,omitempty"`
	ChangedAt  time.Time  `json:"changed_at"`
}

// Announcement is a portal-wide or targeted notice posted by vendor admins.
type Announcement struct {
	ID               uuid.UUID  `json:"id"`
	Title            string     `json:"title"`
	Body             string     `json:"body"`
	Category         string     `json:"category"`
	Priority         string     `json:"priority"`
	TargetTiers      []string   `json:"target_tiers"`
	TargetVerticals  []string   `json:"target_verticals"`
	PublishedAt      *time.Time `json:"published_at,omitempty"`
	ExpiresAt        *time.Time `json:"expires_at,omitempty"`
	CreatedBy        uuid.UUID  `json:"created_by"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty"`
}

// AnnouncementRead records that a user has read a specific announcement.
type AnnouncementRead struct {
	AnnouncementID uuid.UUID `json:"announcement_id"`
	UserID         uuid.UUID `json:"user_id"`
	ReadAt         time.Time `json:"read_at"`
}

// AIEmbedding stores vector embeddings for AI-powered semantic search.
type AIEmbedding struct {
	ID           uuid.UUID       `json:"id"`
	ResourceType string          `json:"resource_type"`
	ResourceID   uuid.UUID       `json:"resource_id"`
	ContentChunk string          `json:"content_chunk"`
	Embedding    pgvector.Vector `json:"embedding"`
	TokenCount   int             `json:"token_count"`
	CreatedAt    time.Time       `json:"created_at"`
}

// AuditLog records actor actions against portal resources.
type AuditLog struct {
	ID           uuid.UUID              `json:"id"`
	ActorID      *uuid.UUID             `json:"actor_id,omitempty"`
	Action       string                 `json:"action"`
	ResourceType string                 `json:"resource_type"`
	ResourceID   *string                `json:"resource_id,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	IPAddress    *string                `json:"ip_address,omitempty"`
	UserAgent    *string                `json:"user_agent,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
}

// ---------------------------------------------------------------------------
// Request / Response DTOs
// ---------------------------------------------------------------------------

// LoginRequest is the payload for POST /api/v1/auth/login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse is returned on successful authentication.
type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	User         User   `json:"user"`
}

// RegisterRequest is the payload for POST /api/v1/auth/register.
type RegisterRequest struct {
	Email          string  `json:"email"`
	Password       string  `json:"password"`
	FullName       string  `json:"full_name"`
	OrganizationID *string `json:"organization_id,omitempty"`
}

// CreateCourseRequest is the payload for POST /api/v1/courses.
type CreateCourseRequest struct {
	Title           string   `json:"title"`
	Description     string   `json:"description"`
	ThumbnailURL    *string  `json:"thumbnail_url,omitempty"`
	DurationMinutes int      `json:"duration_minutes"`
	Level           string   `json:"level"`
	IsPublished     bool     `json:"is_published"`
	IsMandatory     bool     `json:"is_mandatory"`
	SortOrder       int      `json:"sort_order"`
	VerticalTags    []string `json:"vertical_tags,omitempty"`
}

// UpdateCourseRequest is the payload for PUT /api/v1/courses/{id}.
type UpdateCourseRequest struct {
	Title           *string  `json:"title,omitempty"`
	Description     *string  `json:"description,omitempty"`
	ThumbnailURL    *string  `json:"thumbnail_url,omitempty"`
	DurationMinutes *int     `json:"duration_minutes,omitempty"`
	Level           *string  `json:"level,omitempty"`
	IsPublished     *bool    `json:"is_published,omitempty"`
	IsMandatory     *bool    `json:"is_mandatory,omitempty"`
	SortOrder       *int     `json:"sort_order,omitempty"`
	VerticalTags    []string `json:"vertical_tags,omitempty"`
}

// CreateLessonRequest is the payload for POST /api/v1/courses/{courseId}/lessons.
type CreateLessonRequest struct {
	Title           string  `json:"title"`
	ContentType     string  `json:"content_type"`
	ContentURL      *string `json:"content_url,omitempty"`
	ContentBody     *string `json:"content_body,omitempty"`
	DurationMinutes int     `json:"duration_minutes"`
	SortOrder       int     `json:"sort_order"`
	IsPublished     bool    `json:"is_published"`
}

// CompleteLessonRequest is the payload for POST /api/v1/courses/{courseId}/progress/complete-lesson.
type CompleteLessonRequest struct {
	LessonID      string `json:"lesson_id"`
	TimeSpentSecs int    `json:"time_spent_secs"`
}

// CreateResourceRequest is the payload for POST /api/v1/resources.
type CreateResourceRequest struct {
	Title        string   `json:"title"`
	Description  *string  `json:"description,omitempty"`
	ResourceType string   `json:"resource_type"`
	StoragePath  string   `json:"storage_path"`
	FileSize     *int64   `json:"file_size,omitempty"`
	MimeType     *string  `json:"mime_type,omitempty"`
	IsPublic     bool     `json:"is_public"`
	VerticalTags []string `json:"vertical_tags,omitempty"`
}

// CreateDealRequest is the payload for POST /api/v1/deals.
type CreateDealRequest struct {
	CompanyName       string   `json:"company_name"`
	ContactName       string   `json:"contact_name"`
	ContactEmail      string   `json:"contact_email"`
	ContactPhone      *string  `json:"contact_phone,omitempty"`
	EstimatedValue    *float64 `json:"estimated_value,omitempty"`
	Currency          string   `json:"currency"`
	ExpectedCloseDate *string  `json:"expected_close_date,omitempty"`
	Stage             string   `json:"stage"`
	Notes             *string  `json:"notes,omitempty"`
}

// UpdateDealStatusRequest is the payload for PATCH /api/v1/deals/{id}/status.
type UpdateDealStatusRequest struct {
	Status  string  `json:"status"`
	Comment *string `json:"comment,omitempty"`
}

// CreateAnnouncementRequest is the payload for POST /api/v1/announcements.
type CreateAnnouncementRequest struct {
	Title           string   `json:"title"`
	Body            string   `json:"body"`
	Category        string   `json:"category"`
	Priority        string   `json:"priority"`
	TargetTiers     []string `json:"target_tiers,omitempty"`
	TargetVerticals []string `json:"target_verticals,omitempty"`
	PublishedAt     *string  `json:"published_at,omitempty"`
	ExpiresAt       *string  `json:"expires_at,omitempty"`
}

// AIQueryRequest is the payload for POST /api/v1/ai/query.
type AIQueryRequest struct {
	Query   string `json:"query"`
	Context string `json:"context,omitempty"`
}

// AIQueryResponse is returned from POST /api/v1/ai/query.
type AIQueryResponse struct {
	Answer  string   `json:"answer"`
	Sources []string `json:"sources,omitempty"`
}

// DashboardStats is returned from GET /api/v1/dashboard/stats.
type DashboardStats struct {
	TotalPartners       int     `json:"total_partners"`
	ActiveDeals         int     `json:"active_deals"`
	TotalDealValue      float64 `json:"total_deal_value"`
	CertifiedUsers      int     `json:"certified_users"`
	CoursesCompleted    int     `json:"courses_completed"`
	PendingOnboarding   int     `json:"pending_onboarding"`
	AnnouncementsUnread int     `json:"announcements_unread"`
}

// TeamProgress is a single entry returned from GET /api/v1/dashboard/team-progress.
type TeamProgress struct {
	UserID              uuid.UUID  `json:"user_id"`
	FullName            string     `json:"full_name"`
	Email               string     `json:"email"`
	CoursesCompleted    int        `json:"courses_completed"`
	TotalCourses        int        `json:"total_courses"`
	CertificationsEarned int       `json:"certifications_earned"`
	LastActivityAt      *time.Time `json:"last_activity_at,omitempty"`
}

// ErrorResponse is the standard error envelope returned by all handlers.
type ErrorResponse struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"details,omitempty"`
}

// PaginatedResponse is a generic wrapper for paginated list endpoints.
type PaginatedResponse[T any] struct {
	Data     []T `json:"data"`
	Total    int `json:"total"`
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}
