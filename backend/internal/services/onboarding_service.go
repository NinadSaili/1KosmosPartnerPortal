package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/google/uuid"
)

// UpdateChecklistRequest carries the boolean flags that may be flipped during
// an onboarding update.  A nil pointer means "leave unchanged".
type UpdateChecklistRequest struct {
	ProfileCompleted       *bool
	ContractSigned         *bool
	TrainingCompleted      *bool
	CertificationEarned    *bool
	PortalAccessGranted    *bool
	FirstDealRegistered    *bool
}

// OnboardingService encapsulates onboarding business logic.
type OnboardingService struct {
	repo *repositories.OnboardingRepository
}

// NewOnboardingService constructs an OnboardingService.
func NewOnboardingService(repo *repositories.OnboardingRepository) *OnboardingService {
	return &OnboardingService{repo: repo}
}

// GetOrCreateChecklist fetches the onboarding checklist for an org; if none
// exists yet, it creates and persists a blank default record.
func (s *OnboardingService) GetOrCreateChecklist(ctx context.Context, orgID string) (*models.OnboardingChecklist, error) {
	checklist, err := s.repo.GetByOrgID(ctx, orgID)
	if err == nil {
		return checklist, nil
	}
	if !errors.Is(err, repositories.ErrNotFound) {
		return nil, fmt.Errorf("onboarding_service: get checklist: %w", err)
	}

	// Create default blank checklist.
	orgUUID, parseErr := uuid.Parse(orgID)
	if parseErr != nil {
		return nil, fmt.Errorf("onboarding_service: invalid org id: %w", parseErr)
	}

	blank := &models.OnboardingChecklist{
		ID:             uuid.New(),
		OrganizationID: orgUUID,
	}
	created, upsertErr := s.repo.Upsert(ctx, blank)
	if upsertErr != nil {
		return nil, fmt.Errorf("onboarding_service: create default checklist: %w", upsertErr)
	}
	return created, nil
}

// UpdateChecklist applies the provided field changes to the org's checklist.
// When a boolean field transitions from false to true, its corresponding _at
// timestamp is set to now.
func (s *OnboardingService) UpdateChecklist(ctx context.Context, orgID string, req UpdateChecklistRequest) (*models.OnboardingChecklist, error) {
	checklist, err := s.GetOrCreateChecklist(ctx, orgID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()

	if req.ProfileCompleted != nil && *req.ProfileCompleted && !checklist.ProfileCompleted {
		checklist.ProfileCompleted = true
		checklist.ProfileCompletedAt = &now
	} else if req.ProfileCompleted != nil {
		checklist.ProfileCompleted = *req.ProfileCompleted
		if !*req.ProfileCompleted {
			checklist.ProfileCompletedAt = nil
		}
	}

	if req.ContractSigned != nil && *req.ContractSigned && !checklist.ContractSigned {
		checklist.ContractSigned = true
		checklist.ContractSignedAt = &now
	} else if req.ContractSigned != nil {
		checklist.ContractSigned = *req.ContractSigned
		if !*req.ContractSigned {
			checklist.ContractSignedAt = nil
		}
	}

	if req.TrainingCompleted != nil && *req.TrainingCompleted && !checklist.TrainingCompleted {
		checklist.TrainingCompleted = true
		checklist.TrainingCompletedAt = &now
	} else if req.TrainingCompleted != nil {
		checklist.TrainingCompleted = *req.TrainingCompleted
		if !*req.TrainingCompleted {
			checklist.TrainingCompletedAt = nil
		}
	}

	if req.CertificationEarned != nil && *req.CertificationEarned && !checklist.CertificationEarned {
		checklist.CertificationEarned = true
		checklist.CertificationEarnedAt = &now
	} else if req.CertificationEarned != nil {
		checklist.CertificationEarned = *req.CertificationEarned
		if !*req.CertificationEarned {
			checklist.CertificationEarnedAt = nil
		}
	}

	if req.PortalAccessGranted != nil && *req.PortalAccessGranted && !checklist.PortalAccessGranted {
		checklist.PortalAccessGranted = true
		checklist.PortalAccessGrantedAt = &now
	} else if req.PortalAccessGranted != nil {
		checklist.PortalAccessGranted = *req.PortalAccessGranted
		if !*req.PortalAccessGranted {
			checklist.PortalAccessGrantedAt = nil
		}
	}

	// Recalculate completion percentage (5 fields).
	completed := 0
	for _, v := range []bool{
		checklist.ProfileCompleted,
		checklist.ContractSigned,
		checklist.TrainingCompleted,
		checklist.CertificationEarned,
		checklist.PortalAccessGranted,
	} {
		if v {
			completed++
		}
	}
	checklist.CompletionPercentage = (completed * 100) / 5

	return s.repo.Upsert(ctx, checklist)
}

// IsReadyToDealRegister returns true when all 5 core onboarding steps are
// complete (profile, contract, training, certification, portal access).
func (s *OnboardingService) IsReadyToDealRegister(checklist *models.OnboardingChecklist) bool {
	return checklist.ProfileCompleted &&
		checklist.ContractSigned &&
		checklist.TrainingCompleted &&
		checklist.CertificationEarned &&
		checklist.PortalAccessGranted
}
