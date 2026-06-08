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

// ResourceRepository handles all database operations for resources and their tags.
type ResourceRepository struct {
	db *pgxpool.Pool
}

// NewResourceRepository creates a new ResourceRepository.
func NewResourceRepository(db *pgxpool.Pool) *ResourceRepository {
	return &ResourceRepository{db: db}
}

// ResourceWithTags combines a Resource with its associated vertical tags.
type ResourceWithTags struct {
	models.Resource
	Tags []string `json:"tags"`
}

// ListResources returns a paginated, optionally filtered list of resources.
// Full-text search is performed using search_vector @@ plainto_tsquery when
// a search string is provided.
func (r *ResourceRepository) ListResources(
	ctx context.Context,
	resourceType, tag, search string,
	offset, limit int,
) ([]models.Resource, int, error) {
	conditions := []string{"r.deleted_at IS NULL"}
	args := []any{}
	argIdx := 1

	if resourceType != "" {
		conditions = append(conditions, fmt.Sprintf("r.resource_type = $%d", argIdx))
		args = append(args, resourceType)
		argIdx++
	}
	if search != "" {
		conditions = append(conditions, fmt.Sprintf(
			"(r.search_vector @@ plainto_tsquery('english', $%d) OR r.title ILIKE $%d)",
			argIdx, argIdx+1,
		))
		args = append(args, search, "%"+search+"%")
		argIdx += 2
	}
	if tag != "" {
		conditions = append(conditions, fmt.Sprintf(
			"EXISTS (SELECT 1 FROM resource_vertical_tags t WHERE t.resource_id = r.id AND t.tag = $%d)",
			argIdx,
		))
		args = append(args, tag)
		argIdx++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")

	countQ := fmt.Sprintf("SELECT COUNT(*) FROM resources r %s", where)
	var total int
	if err := r.db.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count resources: %w", err)
	}

	listArgs := append(args, limit, offset)
	listQ := fmt.Sprintf(`
		SELECT r.id, r.title, r.description, r.resource_type, r.storage_path,
		       r.file_size, r.mime_type, r.is_public, r.download_count,
		       r.created_by, r.created_at, r.updated_at, r.deleted_at
		FROM resources r
		%s
		ORDER BY r.created_at DESC
		LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)

	rows, err := r.db.Query(ctx, listQ, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list resources: %w", err)
	}
	defer rows.Close()

	var resources []models.Resource
	for rows.Next() {
		var res models.Resource
		if err := rows.Scan(
			&res.ID, &res.Title, &res.Description, &res.ResourceType, &res.StoragePath,
			&res.FileSize, &res.MimeType, &res.IsPublic, &res.DownloadCount,
			&res.CreatedBy, &res.CreatedAt, &res.UpdatedAt, &res.DeletedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan resource row: %w", err)
		}
		resources = append(resources, res)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate resources: %w", err)
	}
	return resources, total, nil
}

// GetResourceByID fetches a single resource by its UUID.
func (r *ResourceRepository) GetResourceByID(ctx context.Context, id string) (*models.Resource, error) {
	const q = `
		SELECT id, title, description, resource_type, storage_path,
		       file_size, mime_type, is_public, download_count,
		       created_by, created_at, updated_at, deleted_at
		FROM resources
		WHERE id = $1 AND deleted_at IS NULL`

	var res models.Resource
	err := r.db.QueryRow(ctx, q, id).Scan(
		&res.ID, &res.Title, &res.Description, &res.ResourceType, &res.StoragePath,
		&res.FileSize, &res.MimeType, &res.IsPublic, &res.DownloadCount,
		&res.CreatedBy, &res.CreatedAt, &res.UpdatedAt, &res.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get resource by id: %w", err)
	}
	return &res, nil
}

// CreateResource inserts a new resource record.
func (r *ResourceRepository) CreateResource(ctx context.Context, res *models.Resource) (*models.Resource, error) {
	const q = `
		INSERT INTO resources
			(id, title, description, resource_type, storage_path, file_size, mime_type, is_public, download_count, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11)
		RETURNING id, title, description, resource_type, storage_path, file_size, mime_type, is_public, download_count, created_by, created_at, updated_at, deleted_at`

	if res.ID == uuid.Nil {
		res.ID = uuid.New()
	}
	now := time.Now().UTC()
	res.CreatedAt = now
	res.UpdatedAt = now

	row := r.db.QueryRow(ctx, q,
		res.ID, res.Title, res.Description, res.ResourceType, res.StoragePath,
		res.FileSize, res.MimeType, res.IsPublic, res.CreatedBy, res.CreatedAt, res.UpdatedAt,
	)

	var created models.Resource
	err := row.Scan(
		&created.ID, &created.Title, &created.Description, &created.ResourceType, &created.StoragePath,
		&created.FileSize, &created.MimeType, &created.IsPublic, &created.DownloadCount,
		&created.CreatedBy, &created.CreatedAt, &created.UpdatedAt, &created.DeletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create resource: %w", err)
	}
	return &created, nil
}

// UpdateResource performs a dynamic UPDATE on the resources table.
func (r *ResourceRepository) UpdateResource(ctx context.Context, id string, updates map[string]any) (*models.Resource, error) {
	if len(updates) == 0 {
		return r.GetResourceByID(ctx, id)
	}

	setClauses := make([]string, 0, len(updates)+1)
	args := make([]any, 0, len(updates)+2)
	i := 1
	for col, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", i))
	args = append(args, time.Now().UTC())
	i++
	args = append(args, id)

	q := fmt.Sprintf(`
		UPDATE resources SET %s WHERE id = $%d AND deleted_at IS NULL
		RETURNING id, title, description, resource_type, storage_path, file_size, mime_type, is_public, download_count, created_by, created_at, updated_at, deleted_at`,
		strings.Join(setClauses, ", "), i)

	var res models.Resource
	err := r.db.QueryRow(ctx, q, args...).Scan(
		&res.ID, &res.Title, &res.Description, &res.ResourceType, &res.StoragePath,
		&res.FileSize, &res.MimeType, &res.IsPublic, &res.DownloadCount,
		&res.CreatedBy, &res.CreatedAt, &res.UpdatedAt, &res.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update resource: %w", err)
	}
	return &res, nil
}

// DeleteResource soft-deletes a resource by setting deleted_at.
func (r *ResourceRepository) DeleteResource(ctx context.Context, id string) error {
	const q = `UPDATE resources SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND deleted_at IS NULL`
	ct, err := r.db.Exec(ctx, q, time.Now().UTC(), id)
	if err != nil {
		return fmt.Errorf("delete resource: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetResourceTags returns all vertical tags associated with a resource.
func (r *ResourceRepository) GetResourceTags(ctx context.Context, resourceID string) ([]string, error) {
	const q = `SELECT tag FROM resource_vertical_tags WHERE resource_id = $1 ORDER BY tag`
	rows, err := r.db.Query(ctx, q, resourceID)
	if err != nil {
		return nil, fmt.Errorf("get resource tags: %w", err)
	}
	defer rows.Close()

	var tags []string
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, fmt.Errorf("scan tag: %w", err)
		}
		tags = append(tags, tag)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tags: %w", err)
	}
	return tags, nil
}

// SetResourceTags replaces all tags for a resource atomically.
func (r *ResourceRepository) SetResourceTags(ctx context.Context, resourceID string, tags []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `DELETE FROM resource_vertical_tags WHERE resource_id = $1`, resourceID); err != nil {
		return fmt.Errorf("delete old tags: %w", err)
	}

	for _, tag := range tags {
		if _, err := tx.Exec(ctx,
			`INSERT INTO resource_vertical_tags (resource_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			resourceID, tag,
		); err != nil {
			return fmt.Errorf("insert tag %q: %w", tag, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit set tags: %w", err)
	}
	return nil
}

// GetResourcesByIDs returns multiple resources by their UUIDs.
func (r *ResourceRepository) GetResourcesByIDs(ctx context.Context, ids []string) ([]models.Resource, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}

	q := fmt.Sprintf(`
		SELECT id, title, description, resource_type, storage_path,
		       file_size, mime_type, is_public, download_count,
		       created_by, created_at, updated_at, deleted_at
		FROM resources
		WHERE id IN (%s) AND deleted_at IS NULL`, strings.Join(placeholders, ", "))

	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("get resources by ids: %w", err)
	}
	defer rows.Close()

	var resources []models.Resource
	for rows.Next() {
		var res models.Resource
		if err := rows.Scan(
			&res.ID, &res.Title, &res.Description, &res.ResourceType, &res.StoragePath,
			&res.FileSize, &res.MimeType, &res.IsPublic, &res.DownloadCount,
			&res.CreatedBy, &res.CreatedAt, &res.UpdatedAt, &res.DeletedAt,
		); err != nil {
			return nil, fmt.Errorf("scan resource row: %w", err)
		}
		resources = append(resources, res)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate resources: %w", err)
	}
	return resources, nil
}
