package repositories

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OnboardingRepository handles database operations for onboarding checklists.
type OnboardingRepository struct {
	db *pgxpool.Pool
}

// NewOnboardingRepository creates a new OnboardingRepository.
func NewOnboardingRepository(db *pgxpool.Pool) *OnboardingRepository {
	return &OnboardingRepository{db: db}
}

const onboardingSelectCols = `
	id, organization_id,
	profile_completed, profile_completed_at,
	contract_signed, contract_signed_at,
	training_completed, training_completed_at,
	certification_earned, certification_earned_at,
	portal_access_granted, portal_access_granted_at,
	first_deal_registered, first_deal_registered_at,
	completion_percentage, updated_at`

// GetByOrgID fetches the onboarding checklist for the given organization.
func (r *OnboardingRepository) GetByOrgID(ctx context.Context, orgID string) (*models.OnboardingChecklist, error) {
	q := fmt.Sprintf(`SELECT %s FROM onboarding_checklists WHERE organization_id = $1`, onboardingSelectCols)

	var c models.OnboardingChecklist
	err := r.db.QueryRow(ctx, q, orgID).Scan(
		&c.ID, &c.OrganizationID,
		&c.ProfileCompleted, &c.ProfileCompletedAt,
		&c.ContractSigned, &c.ContractSignedAt,
		&c.TrainingCompleted, &c.TrainingCompletedAt,
		&c.CertificationEarned, &c.CertificationEarnedAt,
		&c.PortalAccessGranted, &c.PortalAccessGrantedAt,
		&c.FirstDealRegistered, &c.FirstDealRegisteredAt,
		&c.CompletionPercentage, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get onboarding by org id: %w", err)
	}
	return &c, nil
}

// Upsert inserts or updates an onboarding checklist record.
func (r *OnboardingRepository) Upsert(ctx context.Context, c *models.OnboardingChecklist) (*models.OnboardingChecklist, error) {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	c.UpdatedAt = time.Now().UTC()

	const q = `
		INSERT INTO onboarding_checklists (
			id, organization_id,
			profile_completed, profile_completed_at,
			contract_signed, contract_signed_at,
			training_completed, training_completed_at,
			certification_earned, certification_earned_at,
			portal_access_granted, portal_access_granted_at,
			first_deal_registered, first_deal_registered_at,
			completion_percentage, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		ON CONFLICT (organization_id) DO UPDATE SET
			profile_completed       = EXCLUDED.profile_completed,
			profile_completed_at    = EXCLUDED.profile_completed_at,
			contract_signed         = EXCLUDED.contract_signed,
			contract_signed_at      = EXCLUDED.contract_signed_at,
			training_completed      = EXCLUDED.training_completed,
			training_completed_at   = EXCLUDED.training_completed_at,
			certification_earned    = EXCLUDED.certification_earned,
			certification_earned_at = EXCLUDED.certification_earned_at,
			portal_access_granted   = EXCLUDED.portal_access_granted,
			portal_access_granted_at= EXCLUDED.portal_access_granted_at,
			first_deal_registered   = EXCLUDED.first_deal_registered,
			first_deal_registered_at= EXCLUDED.first_deal_registered_at,
			completion_percentage   = EXCLUDED.completion_percentage,
			updated_at              = EXCLUDED.updated_at
		RETURNING id, organization_id,
			profile_completed, profile_completed_at,
			contract_signed, contract_signed_at,
			training_completed, training_completed_at,
			certification_earned, certification_earned_at,
			portal_access_granted, portal_access_granted_at,
			first_deal_registered, first_deal_registered_at,
			completion_percentage, updated_at`

	var out models.OnboardingChecklist
	err := r.db.QueryRow(ctx, q,
		c.ID, c.OrganizationID,
		c.ProfileCompleted, c.ProfileCompletedAt,
		c.ContractSigned, c.ContractSignedAt,
		c.TrainingCompleted, c.TrainingCompletedAt,
		c.CertificationEarned, c.CertificationEarnedAt,
		c.PortalAccessGranted, c.PortalAccessGrantedAt,
		c.FirstDealRegistered, c.FirstDealRegisteredAt,
		c.CompletionPercentage, c.UpdatedAt,
	).Scan(
		&out.ID, &out.OrganizationID,
		&out.ProfileCompleted, &out.ProfileCompletedAt,
		&out.ContractSigned, &out.ContractSignedAt,
		&out.TrainingCompleted, &out.TrainingCompletedAt,
		&out.CertificationEarned, &out.CertificationEarnedAt,
		&out.PortalAccessGranted, &out.PortalAccessGrantedAt,
		&out.FirstDealRegistered, &out.FirstDealRegisteredAt,
		&out.CompletionPercentage, &out.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("upsert onboarding checklist: %w", err)
	}
	return &out, nil
}
