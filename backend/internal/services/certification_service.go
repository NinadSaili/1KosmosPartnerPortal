package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/1kosmos/partner-portal/pkg/email"
	"github.com/1kosmos/partner-portal/pkg/pdf"
	"github.com/google/uuid"
)

// CreateCertificationRequest holds the fields to create a new certification path.
type CreateCertificationRequest struct {
	Title               string   `json:"title"`
	Description         string   `json:"description"`
	BadgeImageURL       *string  `json:"badge_image_url,omitempty"`
	ValidityMonths      int      `json:"validity_months"`
	PassingScorePercent int      `json:"passing_score_percent"`
	IsActive            bool     `json:"is_active"`
	RequiredCourseIDs   []string `json:"required_course_ids,omitempty"`
}

// UpdateAssessmentRequest holds the fields for updating an assessment's state.
type UpdateAssessmentRequest struct {
	Status        string     `json:"status"`
	ScheduledFor  *time.Time `json:"scheduled_for,omitempty"`
	LocationOrURL *string    `json:"location_or_url,omitempty"`
	Notes         *string    `json:"notes,omitempty"`
	Score         *int       `json:"score,omitempty"`
}

// CertificationWithEligibility wraps a certification with the user's eligibility flag.
type CertificationWithEligibility struct {
	models.Certification
	RequiredCourses []models.Course `json:"required_courses"`
	IsEligible      bool            `json:"is_eligible"`
}

// CertificationDetail is the full certification response including requirements and eligibility.
type CertificationDetail struct {
	models.Certification
	RequiredCourses []models.Course `json:"required_courses"`
	IsEligible      bool            `json:"is_eligible"`
}

// CertificationService encapsulates certification-related business logic.
type CertificationService struct {
	certRepo    *repositories.CertificationRepository
	emailClient *email.EmailClient
}

// NewCertificationService constructs a CertificationService.
func NewCertificationService(
	certRepo *repositories.CertificationRepository,
	emailClient *email.EmailClient,
) *CertificationService {
	return &CertificationService{
		certRepo:    certRepo,
		emailClient: emailClient,
	}
}

// ---------------------------------------------------------------------------
// Certifications
// ---------------------------------------------------------------------------

// ListCertifications returns all certifications with the user's eligibility status.
func (s *CertificationService) ListCertifications(ctx context.Context, userID string) ([]CertificationWithEligibility, error) {
	certs, err := s.certRepo.ListCertifications(ctx)
	if err != nil {
		return nil, fmt.Errorf("cert_service: list certifications: %w", err)
	}

	result := make([]CertificationWithEligibility, 0, len(certs))
	for _, c := range certs {
		cwe := CertificationWithEligibility{Certification: c}

		reqs, _ := s.certRepo.GetCertificationRequirements(ctx, c.ID.String())
		if reqs == nil {
			reqs = []models.Course{}
		}
		cwe.RequiredCourses = reqs

		if userID != "" {
			eligible, _ := s.certRepo.HasCompletedAllRequirements(ctx, userID, c.ID.String())
			cwe.IsEligible = eligible
		}

		result = append(result, cwe)
	}
	return result, nil
}

// GetCertification fetches a single certification with requirements and user eligibility.
func (s *CertificationService) GetCertification(ctx context.Context, certID, userID string) (*CertificationDetail, error) {
	cert, err := s.certRepo.GetCertificationByID(ctx, certID)
	if err != nil {
		return nil, fmt.Errorf("cert_service: get certification: %w", err)
	}

	reqs, err := s.certRepo.GetCertificationRequirements(ctx, certID)
	if err != nil {
		return nil, fmt.Errorf("cert_service: get requirements: %w", err)
	}
	if reqs == nil {
		reqs = []models.Course{}
	}

	eligible := false
	if userID != "" {
		eligible, _ = s.certRepo.HasCompletedAllRequirements(ctx, userID, certID)
	}

	return &CertificationDetail{
		Certification:   *cert,
		RequiredCourses: reqs,
		IsEligible:      eligible,
	}, nil
}

// CreateCertification inserts a new certification and its course requirements.
func (s *CertificationService) CreateCertification(ctx context.Context, req CreateCertificationRequest, createdBy string) (*models.Certification, error) {
	creatorUUID, err := uuid.Parse(createdBy)
	if err != nil {
		return nil, fmt.Errorf("cert_service: invalid creator id: %w", err)
	}

	cert := &models.Certification{
		Title:               req.Title,
		Description:         req.Description,
		BadgeImageURL:       req.BadgeImageURL,
		ValidityMonths:      req.ValidityMonths,
		PassingScorePercent: req.PassingScorePercent,
		IsActive:            req.IsActive,
		CreatedBy:           creatorUUID,
	}

	created, err := s.certRepo.CreateCertification(ctx, cert)
	if err != nil {
		return nil, fmt.Errorf("cert_service: create certification: %w", err)
	}

	if len(req.RequiredCourseIDs) > 0 {
		_ = s.certRepo.SetCertificationRequirements(ctx, created.ID.String(), req.RequiredCourseIDs)
	}

	return created, nil
}

// UpdateCertification applies partial updates to a certification.
func (s *CertificationService) UpdateCertification(ctx context.Context, certID string, req CreateCertificationRequest) (*models.Certification, error) {
	updates := make(map[string]any)
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.BadgeImageURL != nil {
		updates["badge_image_url"] = *req.BadgeImageURL
	}
	if req.ValidityMonths > 0 {
		updates["validity_months"] = req.ValidityMonths
	}
	if req.PassingScorePercent > 0 {
		updates["passing_score_percent"] = req.PassingScorePercent
	}
	updates["is_active"] = req.IsActive

	updated, err := s.certRepo.UpdateCertification(ctx, certID, updates)
	if err != nil {
		return nil, fmt.Errorf("cert_service: update certification: %w", err)
	}

	if req.RequiredCourseIDs != nil {
		_ = s.certRepo.SetCertificationRequirements(ctx, certID, req.RequiredCourseIDs)
	}

	return updated, nil
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

// ScheduleAssessment validates eligibility and creates an assessment schedule entry.
func (s *CertificationService) ScheduleAssessment(ctx context.Context, userID, certID string, requestedDate time.Time) (*models.AssessmentSchedule, error) {
	eligible, err := s.certRepo.HasCompletedAllRequirements(ctx, userID, certID)
	if err != nil {
		return nil, fmt.Errorf("cert_service: check eligibility: %w", err)
	}
	if !eligible {
		return nil, fmt.Errorf("cert_service: user has not completed all required courses")
	}

	certUUID, err := uuid.Parse(certID)
	if err != nil {
		return nil, fmt.Errorf("cert_service: invalid cert id: %w", err)
	}

	schedule := &models.AssessmentSchedule{
		CertificationID: certUUID,
		ScheduledFor:    requestedDate,
		Status:          "pending",
		LocationOrURL:   "TBD",
		MaxParticipants: 1,
	}

	return s.certRepo.CreateAssessmentSchedule(ctx, schedule)
}

// UpdateAssessmentStatus updates the status and metadata of an assessment schedule.
func (s *CertificationService) UpdateAssessmentStatus(ctx context.Context, assessmentID string, req UpdateAssessmentRequest, actorID string) (*models.AssessmentSchedule, error) {
	updates := map[string]any{"status": req.Status}
	if req.ScheduledFor != nil {
		updates["scheduled_for"] = *req.ScheduledFor
	}
	if req.LocationOrURL != nil {
		updates["location_or_url"] = *req.LocationOrURL
	}
	if req.Notes != nil {
		updates["notes"] = *req.Notes
	}

	return s.certRepo.UpdateAssessmentSchedule(ctx, assessmentID, updates)
}

// RecordAssessmentResult records the outcome of an assessment and issues a
// certificate if the score meets the passing threshold.
func (s *CertificationService) RecordAssessmentResult(ctx context.Context, scheduleID, userID string, score int, evaluatorID string) (*models.IssuedCertificate, error) {
	// Locate the assessment to get the certification ID.
	assessments, err := s.certRepo.GetAssessmentsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("cert_service: record result: fetch assessments: %w", err)
	}

	var targetCertID string
	for _, a := range assessments {
		if a.ID.String() == scheduleID {
			targetCertID = a.CertificationID.String()
			break
		}
	}
	if targetCertID == "" {
		return nil, fmt.Errorf("cert_service: assessment schedule not found for user")
	}

	cert, err := s.certRepo.GetCertificationByID(ctx, targetCertID)
	if err != nil {
		return nil, fmt.Errorf("cert_service: record result: get cert: %w", err)
	}

	_, _ = s.certRepo.UpdateAssessmentSchedule(ctx, scheduleID, map[string]any{"status": "completed"})

	if score < cert.PassingScorePercent {
		return nil, nil
	}

	return s.IssueCertificate(ctx, userID, targetCertID)
}

// IssueCertificate generates a unique cert number, sets expiry, and persists
// an IssuedCertificate record.
func (s *CertificationService) IssueCertificate(ctx context.Context, userID, certID string) (*models.IssuedCertificate, error) {
	cert, err := s.certRepo.GetCertificationByID(ctx, certID)
	if err != nil {
		return nil, fmt.Errorf("cert_service: issue certificate: get cert: %w", err)
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("cert_service: issue certificate: invalid user id: %w", err)
	}

	certNumber := fmt.Sprintf("1K-%d-%s",
		time.Now().UTC().Year(),
		strings.ToUpper(uuid.New().String()[:8]),
	)

	now := time.Now().UTC()
	var expiresAt *time.Time
	if cert.ValidityMonths > 0 {
		exp := now.AddDate(0, cert.ValidityMonths, 0)
		expiresAt = &exp
	}

	ic := &models.IssuedCertificate{
		CertificationID:   cert.ID,
		UserID:            userUUID,
		OrganizationID:    uuid.Nil,
		CertificateNumber: certNumber,
		IssuedAt:          now,
		ExpiresAt:         expiresAt,
	}

	return s.certRepo.InsertIssuedCertificate(ctx, ic)
}

// GetCertificatePDF fetches the issued certificate and generates its PDF.
func (s *CertificationService) GetCertificatePDF(ctx context.Context, certID string) ([]byte, error) {
	ic, err := s.certRepo.GetIssuedCertificate(ctx, certID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, repositories.ErrNotFound
		}
		return nil, fmt.Errorf("cert_service: get pdf: fetch cert: %w", err)
	}

	cert, err := s.certRepo.GetCertificationByID(ctx, ic.CertificationID.String())
	if err != nil {
		return nil, fmt.Errorf("cert_service: get pdf: fetch certification: %w", err)
	}

	data := pdf.CertificateData{
		RecipientName:      ic.UserID.String(),
		CertificationTitle: cert.Title,
		CertNumber:         ic.CertificateNumber,
		IssuedDate:         ic.IssuedAt.Format("January 2, 2006"),
	}
	if ic.ExpiresAt != nil {
		data.ExpiryDate = ic.ExpiresAt.Format("January 2, 2006")
	}

	pdfBytes, err := pdf.GenerateCertificatePDF(ctx, data)
	if err != nil {
		return nil, fmt.Errorf("cert_service: generate pdf: %w", err)
	}
	return pdfBytes, nil
}

// ListIssuedCertificates returns certificates filtered by role.
func (s *CertificationService) ListIssuedCertificates(ctx context.Context, userID, orgID, actorRole string) ([]models.IssuedCertificate, error) {
	switch actorRole {
	case "vendor_admin":
		return s.certRepo.GetAllIssuedCertificates(ctx)
	case "partner_admin":
		if orgID == "" {
			return nil, fmt.Errorf("cert_service: org_id required for partner_admin")
		}
		return s.certRepo.GetIssuedCertificatesByOrg(ctx, orgID)
	default:
		return s.certRepo.GetIssuedCertificatesByUser(ctx, userID)
	}
}

// CheckExpiries is a background task that finds certificates expiring in
// 60 or 14 days, sends reminder emails, and marks the reminders as sent.
func (s *CertificationService) CheckExpiries(ctx context.Context) error {
	for _, days := range []int{60, 14} {
		expiring, err := s.certRepo.GetExpiringCertificates(ctx, days)
		if err != nil {
			return fmt.Errorf("cert_service: check expiries (%d days): %w", days, err)
		}

		for _, ic := range expiring {
			expiryStr := ""
			if ic.ExpiresAt != nil {
				expiryStr = ic.ExpiresAt.Format("2006-01-02")
			}

			certTitle := "Your certification"
			if cert, cerr := s.certRepo.GetCertificationByID(ctx, ic.CertificationID.String()); cerr == nil {
				certTitle = cert.Title
			}

			// In production, look up the user's real email via the user repository.
			toEmail := "user-" + ic.UserID.String() + "@portal.local"
			if s.emailClient != nil {
				if emailErr := s.emailClient.SendCertExpiryReminder(toEmail, certTitle, expiryStr, days); emailErr != nil {
					continue
				}
			}

			_ = s.certRepo.UpdateCertificateReminderSent(ctx, ic.ID.String(), days)
		}
	}
	return nil
}
