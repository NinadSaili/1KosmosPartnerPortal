// Package services contains business logic for the partner portal.
package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/1kosmos/partner-portal/pkg/email"
)

// DealDetail enriches a Deal with its documents and status history.
type DealDetail struct {
	models.Deal
	Documents     []models.DealDocument      `json:"documents"`
	StatusHistory []models.DealStatusHistory `json:"status_history"`
	DocumentCount int                        `json:"document_count"`
}

// CreateDealRequest is the payload for creating a new deal.
type CreateDealRequest struct {
	CompanyName       string              `json:"company_name"`
	ContactName       string              `json:"contact_name"`
	ContactEmail      string              `json:"contact_email"`
	ContactPhone      *string             `json:"contact_phone,omitempty"`
	EstimatedValue    *float64            `json:"estimated_value,omitempty"`
	Currency          string              `json:"currency"`
	ExpectedCloseDate *string             `json:"expected_close_date,omitempty"`
	Stage             string              `json:"stage"`
	Notes             *string             `json:"notes,omitempty"`
	Documents         []DealDocumentInput `json:"documents,omitempty"`
}

// DealDocumentInput is a file reference to attach to a deal on create/update.
type DealDocumentInput struct {
	FileName    string  `json:"file_name"`
	StoragePath string  `json:"storage_path"`
	FileSize    *int64  `json:"file_size,omitempty"`
	MimeType    *string `json:"mime_type,omitempty"`
}

// UpdateDealRequest is the payload for updating an existing deal.
type UpdateDealRequest struct {
	CompanyName       *string             `json:"company_name,omitempty"`
	ContactName       *string             `json:"contact_name,omitempty"`
	ContactEmail      *string             `json:"contact_email,omitempty"`
	ContactPhone      *string             `json:"contact_phone,omitempty"`
	EstimatedValue    *float64            `json:"estimated_value,omitempty"`
	Currency          *string             `json:"currency,omitempty"`
	ExpectedCloseDate *string             `json:"expected_close_date,omitempty"`
	Stage             *string             `json:"stage,omitempty"`
	Notes             *string             `json:"notes,omitempty"`
	Documents         []DealDocumentInput `json:"documents,omitempty"`
}

// allowedTransitions defines the valid (currentStatus → newStatus, actorRole)
// combinations for deal status changes.
var allowedTransitions = map[string]map[string][]string{
	"draft": {
		"submitted": {"partner_user", "partner_admin", "submitter"},
	},
	"submitted": {
		"under_review": {"vendor_admin"},
	},
	"under_review": {
		"approved": {"vendor_admin"},
		"rejected": {"vendor_admin"},
	},
	"rejected": {
		"submitted": {"partner_user", "partner_admin", "submitter"},
	},
}

// DealService encapsulates all business logic for deals.
type DealService struct {
	repo        *repositories.DealRepository
	emailClient *email.EmailClient
	log         zerolog.Logger
}

// NewDealService creates a new DealService.
func NewDealService(db *pgxpool.Pool, emailClient *email.EmailClient, log zerolog.Logger) *DealService {
	return &DealService{
		repo:        repositories.NewDealRepository(db),
		emailClient: emailClient,
		log:         log,
	}
}

// ValidateStatusTransition returns an error if the transition is not permitted.
// actorRole of "submitter" is a synthetic role meaning the actor is the deal owner.
func (s *DealService) ValidateStatusTransition(currentStatus, newStatus, actorRole string) error {
	targets, ok := allowedTransitions[currentStatus]
	if !ok {
		return fmt.Errorf("unknown current status: %s", currentStatus)
	}
	allowedRoles, ok := targets[newStatus]
	if !ok {
		return fmt.Errorf("transition %s → %s is not allowed", currentStatus, newStatus)
	}
	for _, r := range allowedRoles {
		if r == actorRole {
			return nil
		}
	}
	return fmt.Errorf("role %q cannot transition deal from %s to %s", actorRole, currentStatus, newStatus)
}

// ListDeals returns a paginated list of deals filtered by the caller's role.
func (s *DealService) ListDeals(
	ctx context.Context,
	userID, userRole, orgID, status, search string,
	page, pageSize int,
) ([]models.Deal, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var submitterIDPtr, orgIDPtr *string
	switch userRole {
	case "vendor_admin":
		// sees everything — no filters
	case "partner_admin":
		// sees all deals in their org
		if orgID != "" {
			orgIDPtr = &orgID
		}
	default:
		// partner_user sees only their own deals
		if userID != "" {
			submitterIDPtr = &userID
		}
	}

	deals, total, err := s.repo.ListDeals(ctx, submitterIDPtr, orgIDPtr, status, search, offset, pageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("deal service list: %w", err)
	}
	return deals, total, nil
}

// GetDeal returns a DealDetail after enforcing visibility rules.
func (s *DealService) GetDeal(ctx context.Context, id, userID, userRole, orgID string) (*DealDetail, error) {
	deal, history, docs, err := s.repo.GetDealWithHistory(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("deal service get: %w", err)
	}

	// Ownership enforcement
	switch userRole {
	case "vendor_admin":
		// full access
	case "partner_admin":
		if orgID != "" && deal.OrganizationID.String() != orgID {
			return nil, repositories.ErrNotFound
		}
	default:
		if deal.OwnerID.String() != userID {
			return nil, repositories.ErrNotFound
		}
	}

	if docs == nil {
		docs = []models.DealDocument{}
	}
	if history == nil {
		history = []models.DealStatusHistory{}
	}

	return &DealDetail{
		Deal:          *deal,
		Documents:     docs,
		StatusHistory: history,
		DocumentCount: len(docs),
	}, nil
}

// CreateDeal creates a new deal in draft status and adds an initial status history entry.
func (s *DealService) CreateDeal(ctx context.Context, req CreateDealRequest, submitterID, orgID string) (*models.Deal, error) {
	submitterUUID, err := uuid.Parse(submitterID)
	if err != nil {
		return nil, fmt.Errorf("invalid submitter id: %w", err)
	}
	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		return nil, fmt.Errorf("invalid org id: %w", err)
	}

	d := &models.Deal{
		ID:             uuid.New(),
		OrganizationID: orgUUID,
		OwnerID:        submitterUUID,
		CompanyName:    req.CompanyName,
		ContactName:    req.ContactName,
		ContactEmail:   req.ContactEmail,
		ContactPhone:   req.ContactPhone,
		EstimatedValue: req.EstimatedValue,
		Currency:       req.Currency,
		Stage:          req.Stage,
		Status:         "draft",
		Notes:          req.Notes,
	}

	if req.ExpectedCloseDate != nil && *req.ExpectedCloseDate != "" {
		t, parseErr := time.Parse("2006-01-02", *req.ExpectedCloseDate)
		if parseErr != nil {
			return nil, fmt.Errorf("invalid expected_close_date format (use YYYY-MM-DD): %w", parseErr)
		}
		d.ExpectedCloseDate = &t
	}

	created, err := s.repo.CreateDeal(ctx, d)
	if err != nil {
		return nil, fmt.Errorf("deal service create: %w", err)
	}

	// Record initial status history
	h := &models.DealStatusHistory{
		DealID:    created.ID,
		ChangedBy: submitterUUID,
		ToStatus:  "draft",
		ChangedAt: created.CreatedAt,
	}
	if err := s.repo.AddStatusHistory(ctx, h); err != nil {
		s.log.Warn().Err(err).Str("deal_id", created.ID.String()).Msg("failed to write initial status history")
	}

	// Attach documents if provided
	for _, docInput := range req.Documents {
		doc := &models.DealDocument{
			DealID:      created.ID,
			UploadedBy:  submitterUUID,
			FileName:    docInput.FileName,
			StoragePath: docInput.StoragePath,
			FileSize:    docInput.FileSize,
			MimeType:    docInput.MimeType,
		}
		if err := s.repo.AddDocument(ctx, doc); err != nil {
			s.log.Warn().Err(err).Str("deal_id", created.ID.String()).Msg("failed to attach document")
		}
	}

	return created, nil
}

// UpdateDeal updates a deal's mutable fields. Only the submitter may update a
// draft deal; vendor_admin can update any deal.
func (s *DealService) UpdateDeal(ctx context.Context, id string, req UpdateDealRequest, actorID, actorRole string) (*models.Deal, error) {
	existing, err := s.repo.GetDealByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("deal service update fetch: %w", err)
	}

	// Access control
	if actorRole != "vendor_admin" {
		if existing.OwnerID.String() != actorID {
			return nil, repositories.ErrNotFound
		}
		if existing.Status != "draft" {
			return nil, fmt.Errorf("only draft deals can be updated by the submitter")
		}
	}

	updates := make(map[string]any)
	if req.CompanyName != nil {
		updates["company_name"] = *req.CompanyName
	}
	if req.ContactName != nil {
		updates["contact_name"] = *req.ContactName
	}
	if req.ContactEmail != nil {
		updates["contact_email"] = *req.ContactEmail
	}
	if req.ContactPhone != nil {
		updates["contact_phone"] = *req.ContactPhone
	}
	if req.EstimatedValue != nil {
		updates["estimated_value"] = *req.EstimatedValue
	}
	if req.Currency != nil {
		updates["currency"] = *req.Currency
	}
	if req.Stage != nil {
		updates["stage"] = *req.Stage
	}
	if req.Notes != nil {
		updates["notes"] = *req.Notes
	}
	if req.ExpectedCloseDate != nil {
		t, parseErr := time.Parse("2006-01-02", *req.ExpectedCloseDate)
		if parseErr != nil {
			return nil, fmt.Errorf("invalid expected_close_date format (use YYYY-MM-DD): %w", parseErr)
		}
		updates["expected_close_date"] = t
	}

	updated, err := s.repo.UpdateDeal(ctx, id, updates)
	if err != nil {
		return nil, fmt.Errorf("deal service update: %w", err)
	}

	// Attach additional documents if provided
	if len(req.Documents) > 0 {
		actorUUID, parseErr := uuid.Parse(actorID)
		if parseErr == nil {
			for _, docInput := range req.Documents {
				doc := &models.DealDocument{
					DealID:      existing.ID,
					UploadedBy:  actorUUID,
					FileName:    docInput.FileName,
					StoragePath: docInput.StoragePath,
					FileSize:    docInput.FileSize,
					MimeType:    docInput.MimeType,
				}
				if docErr := s.repo.AddDocument(ctx, doc); docErr != nil {
					s.log.Warn().Err(docErr).Str("deal_id", id).Msg("failed to attach document on update")
				}
			}
		}
	}

	return updated, nil
}

// UpdateStatus transitions a deal to a new status, records history, and sends
// an email notification to the deal contact.
func (s *DealService) UpdateStatus(ctx context.Context, id, newStatus, actorID, actorRole, comment string) (*models.Deal, error) {
	existing, err := s.repo.GetDealByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("deal service status fetch: %w", err)
	}

	// Determine effective role: if actorRole is not vendor_admin and the actor
	// owns the deal, treat them as "submitter" for transition validation.
	effectiveRole := actorRole
	if actorRole != "vendor_admin" && existing.OwnerID.String() == actorID {
		effectiveRole = "submitter"
	}

	if err := s.ValidateStatusTransition(existing.Status, newStatus, effectiveRole); err != nil {
		return nil, fmt.Errorf("invalid status transition: %w", err)
	}

	actorUUID, err := uuid.Parse(actorID)
	if err != nil {
		return nil, fmt.Errorf("invalid actor id: %w", err)
	}

	updated, err := s.repo.UpdateDeal(ctx, id, map[string]any{"status": newStatus})
	if err != nil {
		return nil, fmt.Errorf("deal service status update: %w", err)
	}

	fromStatus := existing.Status
	histEntry := &models.DealStatusHistory{
		DealID:     existing.ID,
		ChangedBy:  actorUUID,
		FromStatus: &fromStatus,
		ToStatus:   newStatus,
	}
	if comment != "" {
		histEntry.Comment = &comment
	}
	if err := s.repo.AddStatusHistory(ctx, histEntry); err != nil {
		s.log.Warn().Err(err).Str("deal_id", id).Msg("failed to write status history")
	}

	// Email notification (best effort)
	if s.emailClient != nil {
		go func() {
			if emailErr := s.emailClient.SendDealStatusNotification(
				existing.ContactEmail,
				existing.CompanyName,
				newStatus,
				comment,
			); emailErr != nil {
				s.log.Warn().Err(emailErr).Str("deal_id", id).Msg("failed to send deal status email")
			}
		}()
	}

	return updated, nil
}
