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
	mnda_signed, mnda_signed_at,
	reseller_agreement_signed, reseller_agreement_signed_at,
	account_mapping_done, account_mapping_done_at,
	sales_enablement_complete, sales_enablement_complete_at,
	technical_enablement_complete, technical_enablement_complete_at,
	updated_by, created_at, updated_at`

func scanChecklist(row interface{ Scan(...any) error }) (*models.OnboardingChecklist, error) {
	var c models.OnboardingChecklist
	err := row.Scan(
		&c.ID, &c.OrganizationID,
		&c.MndaSigned, &c.MndaSignedAt,
		&c.ResellerAgreementSigned, &c.ResellerAgreementSignedAt,
		&c.AccountMappingDone, &c.AccountMappingDoneAt,
		&c.SalesEnablementComplete, &c.SalesEnablementCompleteAt,
		&c.TechnicalEnablementComplete, &c.TechnicalEnablementCompleteAt,
		&c.UpdatedBy, &c.CreatedAt, &c.UpdatedAt,
	)
	return &c, err
}

// GetByOrgID fetches the onboarding checklist for the given organization.
func (r *OnboardingRepository) GetByOrgID(ctx context.Context, orgID string) (*models.OnboardingChecklist, error) {
	q := `SELECT ` + onboardingSelectCols + ` FROM onboarding_checklist WHERE organization_id = $1`

	c, err := scanChecklist(r.db.QueryRow(ctx, q, orgID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get onboarding by org id: %w", err)
	}
	return c, nil
}

// Upsert inserts or updates an onboarding checklist record.
func (r *OnboardingRepository) Upsert(ctx context.Context, c *models.OnboardingChecklist) (*models.OnboardingChecklist, error) {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	now := time.Now().UTC()
	c.UpdatedAt = now

	const q = `
		INSERT INTO onboarding_checklist (
			id, organization_id,
			mnda_signed, mnda_signed_at,
			reseller_agreement_signed, reseller_agreement_signed_at,
			account_mapping_done, account_mapping_done_at,
			sales_enablement_complete, sales_enablement_complete_at,
			technical_enablement_complete, technical_enablement_complete_at,
			updated_by, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),$14)
		ON CONFLICT (organization_id) DO UPDATE SET
			mnda_signed                    = EXCLUDED.mnda_signed,
			mnda_signed_at                 = EXCLUDED.mnda_signed_at,
			reseller_agreement_signed      = EXCLUDED.reseller_agreement_signed,
			reseller_agreement_signed_at   = EXCLUDED.reseller_agreement_signed_at,
			account_mapping_done           = EXCLUDED.account_mapping_done,
			account_mapping_done_at        = EXCLUDED.account_mapping_done_at,
			sales_enablement_complete      = EXCLUDED.sales_enablement_complete,
			sales_enablement_complete_at   = EXCLUDED.sales_enablement_complete_at,
			technical_enablement_complete  = EXCLUDED.technical_enablement_complete,
			technical_enablement_complete_at = EXCLUDED.technical_enablement_complete_at,
			updated_by                     = EXCLUDED.updated_by,
			updated_at                     = EXCLUDED.updated_at
		RETURNING ` + onboardingSelectCols

	out, err := scanChecklist(r.db.QueryRow(ctx, q,
		c.ID, c.OrganizationID,
		c.MndaSigned, c.MndaSignedAt,
		c.ResellerAgreementSigned, c.ResellerAgreementSignedAt,
		c.AccountMappingDone, c.AccountMappingDoneAt,
		c.SalesEnablementComplete, c.SalesEnablementCompleteAt,
		c.TechnicalEnablementComplete, c.TechnicalEnablementCompleteAt,
		c.UpdatedBy, c.UpdatedAt,
	))
	if err != nil {
		return nil, fmt.Errorf("upsert onboarding checklist: %w", err)
	}
	return out, nil
}
