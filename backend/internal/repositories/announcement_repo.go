// Package repositories contains all database access logic for the partner portal.
package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/1kosmos/partner-portal/internal/models"
)

// AnnouncementWithRead extends Announcement with a per-user read flag.
type AnnouncementWithRead struct {
	models.Announcement
	IsRead bool `json:"is_read"`
}

// AnnouncementRepository handles all database operations for announcements and reads.
type AnnouncementRepository struct {
	db *pgxpool.Pool
}

// NewAnnouncementRepository creates a new AnnouncementRepository.
func NewAnnouncementRepository(db *pgxpool.Pool) *AnnouncementRepository {
	return &AnnouncementRepository{db: db}
}

// announcementColumns is the canonical column list for announcements.
const announcementColumns = `
	a.id, a.title, a.body, a.category, a.priority,
	a.target_tiers, a.target_verticals,
	a.published_at, a.expires_at,
	a.created_by, a.created_at, a.updated_at, a.deleted_at`

// scanAnnouncement populates a models.Announcement from a pgx.Row.
func scanAnnouncement(row pgx.Row) (*models.Announcement, error) {
	var a models.Announcement
	err := row.Scan(
		&a.ID, &a.Title, &a.Body, &a.Category, &a.Priority,
		&a.TargetTiers, &a.TargetVerticals,
		&a.PublishedAt, &a.ExpiresAt,
		&a.CreatedBy, &a.CreatedAt, &a.UpdatedAt, &a.DeletedAt,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ListPublished returns published (non-expired, non-deleted) announcements
// with a LEFT JOIN to announcement_reads so each row carries the is_read flag
// for the given userID.  Pinned (priority="urgent") rows come first, then
// ordered by published_at DESC.
func (r *AnnouncementRepository) ListPublished(
	ctx context.Context,
	userID string,
	offset, limit int,
) ([]AnnouncementWithRead, int, error) {
	const countQ = `
		SELECT COUNT(*)
		FROM announcements a
		WHERE a.deleted_at IS NULL
		  AND a.published_at IS NOT NULL
		  AND a.published_at <= now()
		  AND (a.expires_at IS NULL OR a.expires_at > now())`

	var total int
	if err := r.db.QueryRow(ctx, countQ).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count announcements: %w", err)
	}

	const listQ = `
		SELECT
			a.id, a.title, a.body, a.category, a.priority,
			a.target_tiers, a.target_verticals,
			a.published_at, a.expires_at,
			a.created_by, a.created_at, a.updated_at, a.deleted_at,
			CASE WHEN ar.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_read
		FROM announcements a
		LEFT JOIN announcement_reads ar
			ON ar.announcement_id = a.id AND ar.user_id = $1
		WHERE a.deleted_at IS NULL
		  AND a.published_at IS NOT NULL
		  AND a.published_at <= now()
		  AND (a.expires_at IS NULL OR a.expires_at > now())
		ORDER BY
			CASE WHEN a.priority = 'urgent' THEN 0 ELSE 1 END ASC,
			a.published_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.db.Query(ctx, listQ, userID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list announcements: %w", err)
	}
	defer rows.Close()

	var items []AnnouncementWithRead
	for rows.Next() {
		var a models.Announcement
		var isRead bool
		if err := rows.Scan(
			&a.ID, &a.Title, &a.Body, &a.Category, &a.Priority,
			&a.TargetTiers, &a.TargetVerticals,
			&a.PublishedAt, &a.ExpiresAt,
			&a.CreatedBy, &a.CreatedAt, &a.UpdatedAt, &a.DeletedAt,
			&isRead,
		); err != nil {
			return nil, 0, fmt.Errorf("scan announcement row: %w", err)
		}
		items = append(items, AnnouncementWithRead{Announcement: a, IsRead: isRead})
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate announcements: %w", err)
	}
	return items, total, nil
}

// GetByID fetches a single announcement by UUID (including unpublished, for admin).
func (r *AnnouncementRepository) GetByID(ctx context.Context, id string) (*models.Announcement, error) {
	q := fmt.Sprintf(`SELECT %s FROM announcements a WHERE a.id = $1 AND a.deleted_at IS NULL`, announcementColumns)
	a, err := scanAnnouncement(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get announcement: %w", err)
	}
	return a, nil
}

// Create inserts a new announcement record.
func (r *AnnouncementRepository) Create(ctx context.Context, a *models.Announcement) (*models.Announcement, error) {
	const q = `
		INSERT INTO announcements
			(id, title, body, category, priority,
			 target_tiers, target_verticals,
			 published_at, expires_at,
			 created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id, title, body, category, priority,
			target_tiers, target_verticals,
			published_at, expires_at,
			created_by, created_at, updated_at, deleted_at`

	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	now := time.Now().UTC()
	a.CreatedAt = now
	a.UpdatedAt = now

	created, err := scanAnnouncement(r.db.QueryRow(ctx, q,
		a.ID, a.Title, a.Body, a.Category, a.Priority,
		a.TargetTiers, a.TargetVerticals,
		a.PublishedAt, a.ExpiresAt,
		a.CreatedBy, a.CreatedAt, a.UpdatedAt,
	))
	if err != nil {
		return nil, fmt.Errorf("create announcement: %w", err)
	}
	return created, nil
}

// Update performs a dynamic UPDATE on an announcement.
func (r *AnnouncementRepository) Update(ctx context.Context, id string, updates map[string]any) (*models.Announcement, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, id)
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
		UPDATE announcements SET %s WHERE id = $%d AND deleted_at IS NULL
		RETURNING id, title, body, category, priority,
			target_tiers, target_verticals,
			published_at, expires_at,
			created_by, created_at, updated_at, deleted_at`,
		strings.Join(setClauses, ", "), i)

	updated, err := scanAnnouncement(r.db.QueryRow(ctx, q, args...))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update announcement: %w", err)
	}
	return updated, nil
}

// MarkRead upserts an announcement_read record for the given user.
// Uses INSERT … ON CONFLICT DO NOTHING so duplicate reads are silently ignored.
func (r *AnnouncementRepository) MarkRead(ctx context.Context, userID, announcementID string) error {
	const q = `
		INSERT INTO announcement_reads (announcement_id, user_id, read_at)
		VALUES ($1, $2, now())
		ON CONFLICT (announcement_id, user_id) DO NOTHING`

	if _, err := r.db.Exec(ctx, q, announcementID, userID); err != nil {
		return fmt.Errorf("mark read: %w", err)
	}
	return nil
}

// GetUnreadCount returns the number of published announcements that the user
// has not yet read.
func (r *AnnouncementRepository) GetUnreadCount(ctx context.Context, userID string) (int, error) {
	const q = `
		SELECT COUNT(*)
		FROM announcements a
		WHERE a.deleted_at IS NULL
		  AND a.published_at IS NOT NULL
		  AND a.published_at <= now()
		  AND (a.expires_at IS NULL OR a.expires_at > now())
		  AND NOT EXISTS (
			  SELECT 1 FROM announcement_reads ar
			  WHERE ar.announcement_id = a.id AND ar.user_id = $1
		  )`

	var count int
	if err := r.db.QueryRow(ctx, q, userID).Scan(&count); err != nil {
		return 0, fmt.Errorf("get unread count: %w", err)
	}
	return count, nil
}
