package repositories

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UserProgress holds per-user training progress data for the dashboard.
type UserProgress struct {
	UserID          uuid.UUID  `json:"user_id"`
	FullName        string     `json:"full_name"`
	Email           string     `json:"email"`
	CompletedLessons int       `json:"completed_lessons"`
	TotalLessons    int        `json:"total_lessons"`
	LastActivityAt  *time.Time `json:"last_activity_at,omitempty"`
}

// AnnouncementSummary is a lightweight announcement for dashboard display.
type AnnouncementSummary struct {
	ID          uuid.UUID  `json:"id"`
	Title       string     `json:"title"`
	Category    string     `json:"category"`
	Priority    string     `json:"priority"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
}

// DashboardRepository handles all dashboard-specific queries.
type DashboardRepository struct {
	db *pgxpool.Pool
}

// NewDashboardRepository creates a new DashboardRepository.
func NewDashboardRepository(db *pgxpool.Pool) *DashboardRepository {
	return &DashboardRepository{db: db}
}

// CountDealsByStatus returns a map of deal status -> count, optionally scoped to an org.
func (r *DashboardRepository) CountDealsByStatus(ctx context.Context, orgID *string) (map[string]int, error) {
	q := `SELECT status, COUNT(*) FROM deals WHERE TRUE`
	args := []any{}
	if orgID != nil {
		q += " AND organization_id = $1"
		args = append(args, *orgID)
	}
	q += " GROUP BY status"

	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("count deals by status: %w", err)
	}
	defer rows.Close()

	result := make(map[string]int)
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, fmt.Errorf("scan deal status count: %w", err)
		}
		result[status] = count
	}
	return result, rows.Err()
}

// CountCertsByOrg counts issued (non-revoked) certificates, optionally by org.
func (r *DashboardRepository) CountCertsByOrg(ctx context.Context, orgID *string) (int, error) {
	q := `SELECT COUNT(*) FROM issued_certificates WHERE revoked_at IS NULL`
	args := []any{}
	if orgID != nil {
		q += " AND organization_id = $1"
		args = append(args, *orgID)
	}

	var count int
	if err := r.db.QueryRow(ctx, q, args...).Scan(&count); err != nil {
		return 0, fmt.Errorf("count certs by org: %w", err)
	}
	return count, nil
}

// GetTrainingCompletion returns the ratio of completed lessons to total published lessons.
// Pass userID to scope to a single user, orgID to scope to an org, or neither for global.
func (r *DashboardRepository) GetTrainingCompletion(ctx context.Context, userID *string, orgID *string) (float64, error) {
	// Total published lessons
	totalQ := `SELECT COUNT(*) FROM lessons`
	var total int
	if err := r.db.QueryRow(ctx, totalQ).Scan(&total); err != nil {
		return 0, fmt.Errorf("count total lessons: %w", err)
	}
	if total == 0 {
		return 0, nil
	}

	// Completed lessons with optional filters
	completedQ := `SELECT COUNT(DISTINCT lp.lesson_id) FROM lesson_progress lp`
	args := []any{}
	conditions := []string{"lp.completed_at IS NOT NULL"}
	argIdx := 1

	if userID != nil {
		conditions = append(conditions, fmt.Sprintf("lp.user_id = $%d", argIdx))
		args = append(args, *userID)
		argIdx++
	}
	if orgID != nil {
		completedQ += " JOIN users u ON u.id = lp.user_id"
		conditions = append(conditions, fmt.Sprintf("u.organization_id = $%d", argIdx))
		args = append(args, *orgID)
		argIdx++
	}
	if len(conditions) > 0 {
		completedQ += " WHERE " + joinConditions(conditions)
	}

	var completed int
	if err := r.db.QueryRow(ctx, completedQ, args...).Scan(&completed); err != nil {
		return 0, fmt.Errorf("count completed lessons: %w", err)
	}

	return float64(completed) / float64(total), nil
}

// GetTeamProgress returns per-user lesson completion stats for an org.
func (r *DashboardRepository) GetTeamProgress(ctx context.Context, orgID string) ([]UserProgress, error) {
	const q = `
		SELECT
			u.id,
			u.full_name,
			u.email,
			COUNT(lp.id) FILTER (WHERE lp.completed_at IS NOT NULL) AS completed,
			(SELECT COUNT(*) FROM lessons) AS total,
			MAX(lp.last_accessed_at) AS last_activity
		FROM users u
		LEFT JOIN lesson_progress lp ON lp.user_id = u.id
		WHERE u.organization_id = $1
		GROUP BY u.id, u.full_name, u.email
		ORDER BY u.full_name`

	rows, err := r.db.Query(ctx, q, orgID)
	if err != nil {
		return nil, fmt.Errorf("get team progress: %w", err)
	}
	defer rows.Close()

	var result []UserProgress
	for rows.Next() {
		var p UserProgress
		if err := rows.Scan(&p.UserID, &p.FullName, &p.Email, &p.CompletedLessons, &p.TotalLessons, &p.LastActivityAt); err != nil {
			return nil, fmt.Errorf("scan team progress: %w", err)
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

// GetRecentAnnouncements returns the most recent published announcements.
func (r *DashboardRepository) GetRecentAnnouncements(ctx context.Context, limit int) ([]AnnouncementSummary, error) {
	const q = `
		SELECT id, title, category, priority, published_at
		FROM announcements
		WHERE deleted_at IS NULL
		  AND published_at IS NOT NULL
		  AND published_at <= NOW()
		  AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY published_at DESC
		LIMIT $1`

	rows, err := r.db.Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("get recent announcements: %w", err)
	}
	defer rows.Close()

	var result []AnnouncementSummary
	for rows.Next() {
		var a AnnouncementSummary
		if err := rows.Scan(&a.ID, &a.Title, &a.Category, &a.Priority, &a.PublishedAt); err != nil {
			return nil, fmt.Errorf("scan announcement: %w", err)
		}
		result = append(result, a)
	}
	return result, rows.Err()
}

// joinConditions joins SQL condition strings with " AND ".
func joinConditions(conds []string) string {
	if len(conds) == 0 {
		return "1=1"
	}
	out := conds[0]
	for _, c := range conds[1:] {
		out += " AND " + c
	}
	return out
}
