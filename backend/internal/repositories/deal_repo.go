// Package repositories contains all database access logic for the partner portal.
package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DealRepository handles all database operations for deals, documents, and
// status history.
type DealRepository struct {
	db *pgxpool.Pool
}

// NewDealRepository creates a new DealRepository.
func NewDealRepository(db *pgxpool.Pool) *DealRepository {
	return &DealRepository{db: db}
}

// dealColumns is the canonical SELECT column list for the deals table.
const dealColumns = `
	id, organization_id, owner_id, company_name, contact_name, contact_email,
	contact_phone, estimated_value, currency, expected_close_date, stage,
	status, notes, salesforce_id, created_at, updated_at, deleted_at`

// scanDeal scans a row into a Deal.
func scanDeal(row pgx.Row) (*models.Deal, error) {
	var d models.Deal
	err := row.Scan(
		&d.ID, &d.OrganizationID, &d.OwnerID, &d.CompanyName,
		&d.ContactName, &d.ContactEmail, &d.ContactPhone,
		&d.EstimatedValue, &d.Currency, &d.ExpectedCloseDate,
		&d.Stage, &d.Status, &d.Notes, &d.SalesforceID,
		&d.CreatedAt, &d.UpdatedAt, &d.DeletedAt,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// ListDeals returns a filtered, paginated list of deals plus a total count.
// submitterID restricts to a specific user's deals; orgID restricts to an org.
// Pass nil pointers to omit those filters.
func (r *DealRepository) ListDeals(
	ctx context.Context,
	submitterID, orgID *string,
	status, search string,
	offset, limit int,
) ([]models.Deal, int, error) {
	conditions := []string{"d.deleted_at IS NULL"}
	args := []any{}
	i := 1

	if submitterID != nil {
		conditions = append(conditions, fmt.Sprintf("d.owner_id = $%d", i))
		args = append(args, *submitterID)
		i++
	}
	if orgID != nil {
		conditions = append(conditions, fmt.Sprintf("d.organization_id = $%d", i))
		args = append(args, *orgID)
		i++
	}
	if status != "" {
		conditions = append(conditions, fmt.Sprintf("d.status = $%d", i))
		args = append(args, status)
		i++
	}
	if search != "" {
		conditions = append(conditions, fmt.Sprintf("d.company_name ILIKE $%d", i))
		args = append(args, "%"+search+"%")
		i++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")

	var total int
	countQ := fmt.Sprintf("SELECT COUNT(*) FROM deals d %s", where)
	if err := r.db.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count deals: %w", err)
	}

	listArgs := append(args, limit, offset)
	listQ := fmt.Sprintf(`
		SELECT %s
		FROM deals d
		%s
		ORDER BY d.created_at DESC
		LIMIT $%d OFFSET $%d`, dealColumns, where, i, i+1)

	rows, err := r.db.Query(ctx, listQ, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list deals: %w", err)
	}
	defer rows.Close()

	var deals []models.Deal
	for rows.Next() {
		d, err := scanDeal(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan deal: %w", err)
		}
		deals = append(deals, *d)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate deals: %w", err)
	}
	return deals, total, nil
}

// GetDealByID fetches a single deal by UUID.
func (r *DealRepository) GetDealByID(ctx context.Context, id string) (*models.Deal, error) {
	q := fmt.Sprintf(`SELECT %s FROM deals d WHERE d.id = $1 AND d.deleted_at IS NULL`, dealColumns)
	d, err := scanDeal(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get deal: %w", err)
	}
	return d, nil
}

// GetDealWithHistory returns the deal, its status history, and its documents.
func (r *DealRepository) GetDealWithHistory(
	ctx context.Context,
	id string,
) (*models.Deal, []models.DealStatusHistory, []models.DealDocument, error) {
	deal, err := r.GetDealByID(ctx, id)
	if err != nil {
		return nil, nil, nil, err
	}

	history, err := r.GetStatusHistory(ctx, id)
	if err != nil {
		return nil, nil, nil, err
	}

	docs, err := r.GetDocuments(ctx, id)
	if err != nil {
		return nil, nil, nil, err
	}

	return deal, history, docs, nil
}

// CreateDeal inserts a new deal record.
func (r *DealRepository) CreateDeal(ctx context.Context, d *models.Deal) (*models.Deal, error) {
	const q = `
		INSERT INTO deals
			(id, organization_id, owner_id, company_name, contact_name, contact_email,
			 contact_phone, estimated_value, currency, expected_close_date, stage,
			 status, notes, salesforce_id, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		RETURNING ` + dealColumns

	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	now := time.Now().UTC()
	d.CreatedAt = now
	d.UpdatedAt = now

	created, err := scanDeal(r.db.QueryRow(ctx, q,
		d.ID, d.OrganizationID, d.OwnerID, d.CompanyName, d.ContactName, d.ContactEmail,
		d.ContactPhone, d.EstimatedValue, d.Currency, d.ExpectedCloseDate, d.Stage,
		d.Status, d.Notes, d.SalesforceID, d.CreatedAt, d.UpdatedAt,
	))
	if err != nil {
		return nil, fmt.Errorf("create deal: %w", err)
	}
	return created, nil
}

// UpdateDeal performs a dynamic UPDATE on the deals table.
func (r *DealRepository) UpdateDeal(ctx context.Context, id string, updates map[string]any) (*models.Deal, error) {
	if len(updates) == 0 {
		return r.GetDealByID(ctx, id)
	}

	setClauses := make([]string, 0, len(updates)+1)
	args := make([]any, 0, len(updates)+2)
	idx := 1
	for col, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, idx))
		args = append(args, val)
		idx++
	}
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", idx))
	args = append(args, time.Now().UTC())
	idx++
	args = append(args, id)

	q := fmt.Sprintf(`
		UPDATE deals SET %s WHERE id = $%d AND deleted_at IS NULL
		RETURNING %s`,
		strings.Join(setClauses, ", "), idx, dealColumns)

	updated, err := scanDeal(r.db.QueryRow(ctx, q, args...))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update deal: %w", err)
	}
	return updated, nil
}

// AddStatusHistory inserts a deal status history record.
func (r *DealRepository) AddStatusHistory(ctx context.Context, h *models.DealStatusHistory) error {
	const q = `
		INSERT INTO deal_status_history (id, deal_id, changed_by, from_status, to_status, comment, changed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	if h.ID == uuid.Nil {
		h.ID = uuid.New()
	}
	if h.ChangedAt.IsZero() {
		h.ChangedAt = time.Now().UTC()
	}

	if _, err := r.db.Exec(ctx, q,
		h.ID, h.DealID, h.ChangedBy, h.FromStatus, h.ToStatus, h.Comment, h.ChangedAt,
	); err != nil {
		return fmt.Errorf("add status history: %w", err)
	}
	return nil
}

// AddDocument inserts a deal document record.
func (r *DealRepository) AddDocument(ctx context.Context, doc *models.DealDocument) error {
	const q = `
		INSERT INTO deal_documents (id, deal_id, uploaded_by, file_name, storage_path, file_size, mime_type, uploaded_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`

	if doc.ID == uuid.Nil {
		doc.ID = uuid.New()
	}
	if doc.UploadedAt.IsZero() {
		doc.UploadedAt = time.Now().UTC()
	}

	if _, err := r.db.Exec(ctx, q,
		doc.ID, doc.DealID, doc.UploadedBy, doc.FileName, doc.StoragePath, doc.FileSize, doc.MimeType, doc.UploadedAt,
	); err != nil {
		return fmt.Errorf("add document: %w", err)
	}
	return nil
}

// GetDocuments returns all documents attached to a deal.
func (r *DealRepository) GetDocuments(ctx context.Context, dealID string) ([]models.DealDocument, error) {
	const q = `
		SELECT id, deal_id, uploaded_by, file_name, storage_path, file_size, mime_type, uploaded_at
		FROM deal_documents
		WHERE deal_id = $1
		ORDER BY uploaded_at ASC`

	rows, err := r.db.Query(ctx, q, dealID)
	if err != nil {
		return nil, fmt.Errorf("get documents: %w", err)
	}
	defer rows.Close()

	var docs []models.DealDocument
	for rows.Next() {
		var doc models.DealDocument
		if err := rows.Scan(
			&doc.ID, &doc.DealID, &doc.UploadedBy, &doc.FileName,
			&doc.StoragePath, &doc.FileSize, &doc.MimeType, &doc.UploadedAt,
		); err != nil {
			return nil, fmt.Errorf("scan document: %w", err)
		}
		docs = append(docs, doc)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate documents: %w", err)
	}
	return docs, nil
}

// GetStatusHistory returns the status change history for a deal, oldest first.
func (r *DealRepository) GetStatusHistory(ctx context.Context, dealID string) ([]models.DealStatusHistory, error) {
	const q = `
		SELECT id, deal_id, changed_by, from_status, to_status, comment, changed_at
		FROM deal_status_history
		WHERE deal_id = $1
		ORDER BY changed_at ASC`

	rows, err := r.db.Query(ctx, q, dealID)
	if err != nil {
		return nil, fmt.Errorf("get status history: %w", err)
	}
	defer rows.Close()

	var history []models.DealStatusHistory
	for rows.Next() {
		var h models.DealStatusHistory
		if err := rows.Scan(
			&h.ID, &h.DealID, &h.ChangedBy, &h.FromStatus, &h.ToStatus, &h.Comment, &h.ChangedAt,
		); err != nil {
			return nil, fmt.Errorf("scan history row: %w", err)
		}
		history = append(history, h)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate history: %w", err)
	}
	return history, nil
}
