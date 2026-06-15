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
// an onboarding update. A nil pointer means "leave unchanged".
type UpdateChecklistRequest struct {
	MndaSigned                  *bool
	ResellerAgreementSigned     *bool
	AccountMappingDone          *bool
	SalesEnablementComplete     *bool
	TechnicalEnablementComplete *bool
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
// When a boolean field transitions from false to true, its _at timestamp is set to now.
func (s *OnboardingService) UpdateChecklist(ctx context.Context, orgID string, req UpdateChecklistRequest) (*models.OnboardingChecklist, error) {
	checklist, err := s.GetOrCreateChecklist(ctx, orgID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()

	if req.MndaSigned != nil {
		if *req.MndaSigned && !checklist.MndaSigned {
			checklist.MndaSigned = true
			checklist.MndaSignedAt = &now
		} else if !*req.MndaSigned {
			checklist.MndaSigned = false
			checklist.MndaSignedAt = nil
		}
	}

	if req.ResellerAgreementSigned != nil {
		if *req.ResellerAgreementSigned && !checklist.ResellerAgreementSigned {
			checklist.ResellerAgreementSigned = true
			checklist.ResellerAgreementSignedAt = &now
		} else if !*req.ResellerAgreementSigned {
			checklist.ResellerAgreementSigned = false
			checklist.ResellerAgreementSignedAt = nil
		}
	}

	if req.AccountMappingDone != nil {
		if *req.AccountMappingDone && !checklist.AccountMappingDone {
			checklist.AccountMappingDone = true
			checklist.AccountMappingDoneAt = &now
		} else if !*req.AccountMappingDone {
			checklist.AccountMappingDone = false
			checklist.AccountMappingDoneAt = nil
		}
	}

	if req.SalesEnablementComplete != nil {
		if *req.SalesEnablementComplete && !checklist.SalesEnablementComplete {
			checklist.SalesEnablementComplete = true
			checklist.SalesEnablementCompleteAt = &now
		} else if !*req.SalesEnablementComplete {
			checklist.SalesEnablementComplete = false
			checklist.SalesEnablementCompleteAt = nil
		}
	}

	if req.TechnicalEnablementComplete != nil {
		if *req.TechnicalEnablementComplete && !checklist.TechnicalEnablementComplete {
			checklist.TechnicalEnablementComplete = true
			checklist.TechnicalEnablementCompleteAt = &now
		} else if !*req.TechnicalEnablementComplete {
			checklist.TechnicalEnablementComplete = false
			checklist.TechnicalEnablementCompleteAt = nil
		}
	}

	return s.repo.Upsert(ctx, checklist)
}

// IsReadyToDealRegister returns true when all 5 onboarding steps are complete.
func (s *OnboardingService) IsReadyToDealRegister(checklist *models.OnboardingChecklist) bool {
	return checklist.MndaSigned &&
		checklist.ResellerAgreementSigned &&
		checklist.AccountMappingDone &&
		checklist.SalesEnablementComplete &&
		checklist.TechnicalEnablementComplete
}
