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

// CertificationRepository handles all database operations for certifications,
// assessments, and issued certificates.
type CertificationRepository struct {
	db *pgxpool.Pool
}

// NewCertificationRepository creates a new CertificationRepository.
func NewCertificationRepository(db *pgxpool.Pool) *CertificationRepository {
	return &CertificationRepository{db: db}
}

// ---------------------------------------------------------------------------
// Certifications
// ---------------------------------------------------------------------------

const certSelectCols = `
	id, title, slug, description, badge_image_url, validity_months,
	passing_score_percent, is_active, created_by, created_at, updated_at`

func scanCertification(row pgx.Row) (*models.Certification, error) {
	var c models.Certification
	err := row.Scan(
		&c.ID, &c.Title, &c.Slug, &c.Description, &c.BadgeImageURL,
		&c.ValidityMonths, &c.PassingScorePercent, &c.IsActive,
		&c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// ListCertifications returns all active certifications.
func (r *CertificationRepository) ListCertifications(ctx context.Context) ([]models.Certification, error) {
	const q = `
		SELECT ` + certSelectCols + `
		FROM certifications
		WHERE deleted_at IS NULL
		ORDER BY created_at ASC`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list certifications: %w", err)
	}
	defer rows.Close()

	var result []models.Certification
	for rows.Next() {
		c, err := scanCertification(rows)
		if err != nil {
			return nil, fmt.Errorf("scan certification: %w", err)
		}
		result = append(result, *c)
	}
	return result, rows.Err()
}

// GetCertificationByID fetches a single certification by UUID.
func (r *CertificationRepository) GetCertificationByID(ctx context.Context, id string) (*models.Certification, error) {
	q := `SELECT ` + certSelectCols + ` FROM certifications WHERE id = $1 AND deleted_at IS NULL`
	c, err := scanCertification(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get certification: %w", err)
	}
	return c, nil
}

// GetCertificationRequirements returns the courses required by a certification.
func (r *CertificationRepository) GetCertificationRequirements(ctx context.Context, certID string) ([]models.Course, error) {
	const q = `
		SELECT c.id, c.title, c.slug, c.description, c.thumbnail_url, c.duration_minutes,
		       c.level, c.is_published, c.sort_order, c.created_by, c.created_at, c.updated_at
		FROM courses c
		JOIN certification_course_requirements ccr ON ccr.course_id = c.id
		WHERE ccr.certification_id = $1
		  AND c.deleted_at IS NULL
		ORDER BY ccr.sort_order ASC`

	rows, err := r.db.Query(ctx, q, certID)
	if err != nil {
		return nil, fmt.Errorf("get certification requirements: %w", err)
	}
	defer rows.Close()

	var courses []models.Course
	for rows.Next() {
		var c models.Course
		if err := rows.Scan(
			&c.ID, &c.Title, &c.Slug, &c.Description, &c.ThumbnailURL,
			&c.DurationMinutes, &c.Level, &c.IsPublished,
			&c.SortOrder, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan requirement course: %w", err)
		}
		courses = append(courses, c)
	}
	return courses, rows.Err()
}

// CreateCertification inserts a new certification record.
func (r *CertificationRepository) CreateCertification(ctx context.Context, c *models.Certification) (*models.Certification, error) {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	now := time.Now().UTC()
	c.CreatedAt = now
	c.UpdatedAt = now

	if c.Slug == "" {
		c.Slug = slugify(c.Title) + "-" + c.ID.String()[:8]
	}

	const q = `
		INSERT INTO certifications (id, title, slug, description, badge_image_url, validity_months,
		                            passing_score_percent, is_active, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		RETURNING ` + certSelectCols

	created, err := scanCertification(r.db.QueryRow(ctx, q,
		c.ID, c.Title, c.Slug, c.Description, c.BadgeImageURL,
		c.ValidityMonths, c.PassingScorePercent, c.IsActive,
		c.CreatedBy, c.CreatedAt, c.UpdatedAt,
	))
	if err != nil {
		return nil, fmt.Errorf("create certification: %w", err)
	}
	return created, nil
}

// UpdateCertification performs a dynamic UPDATE on the certifications table.
func (r *CertificationRepository) UpdateCertification(ctx context.Context, id string, updates map[string]any) (*models.Certification, error) {
	if len(updates) == 0 {
		return r.GetCertificationByID(ctx, id)
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
		UPDATE certifications SET %s WHERE id = $%d AND deleted_at IS NULL
		RETURNING `+certSelectCols,
		strings.Join(setClauses, ", "), i)

	c, err := scanCertification(r.db.QueryRow(ctx, q, args...))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update certification: %w", err)
	}
	return c, nil
}

// SetCertificationRequirements replaces the required courses for a certification.
func (r *CertificationRepository) SetCertificationRequirements(ctx context.Context, certID string, courseIDs []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("set cert requirements: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx,
		"DELETE FROM certification_course_requirements WHERE certification_id = $1", certID,
	); err != nil {
		return fmt.Errorf("set cert requirements: delete old: %w", err)
	}

	for i, cid := range courseIDs {
		if _, err := tx.Exec(ctx,
			`INSERT INTO certification_course_requirements (certification_id, course_id, is_required, sort_order)
			 VALUES ($1, $2, true, $3) ON CONFLICT DO NOTHING`,
			certID, cid, i,
		); err != nil {
			return fmt.Errorf("set cert requirements: insert %s: %w", cid, err)
		}
	}

	return tx.Commit(ctx)
}

// ---------------------------------------------------------------------------
// Assessment Schedules
// ---------------------------------------------------------------------------

const assessmentSelectCols = `
	id, certification_id, scheduled_for, location_or_url, max_participants,
	instructor_id, notes, status, created_at, updated_at`

func scanAssessment(row pgx.Row) (*models.AssessmentSchedule, error) {
	var a models.AssessmentSchedule
	err := row.Scan(
		&a.ID, &a.CertificationID, &a.ScheduledFor, &a.LocationOrURL,
		&a.MaxParticipants, &a.InstructorID, &a.Notes, &a.Status,
		&a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// CreateAssessmentSchedule inserts a new assessment schedule.
func (r *CertificationRepository) CreateAssessmentSchedule(ctx context.Context, a *models.AssessmentSchedule) (*models.AssessmentSchedule, error) {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	now := time.Now().UTC()
	a.CreatedAt = now
	a.UpdatedAt = now
	if a.Status == "" {
		a.Status = "pending"
	}

	const q = `
		INSERT INTO assessment_schedules
			(id, certification_id, scheduled_for, location_or_url, max_participants,
			 instructor_id, notes, status, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING ` + assessmentSelectCols

	created, err := scanAssessment(r.db.QueryRow(ctx, q,
		a.ID, a.CertificationID, a.ScheduledFor, a.LocationOrURL,
		a.MaxParticipants, a.InstructorID, a.Notes, a.Status,
		a.CreatedAt, a.UpdatedAt,
	))
	if err != nil {
		return nil, fmt.Errorf("create assessment schedule: %w", err)
	}
	return created, nil
}

// UpdateAssessmentSchedule performs a dynamic UPDATE on assessment_schedules.
func (r *CertificationRepository) UpdateAssessmentSchedule(ctx context.Context, id string, updates map[string]any) (*models.AssessmentSchedule, error) {
	if len(updates) == 0 {
		return r.getAssessmentByID(ctx, id)
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
		UPDATE assessment_schedules SET %s WHERE id = $%d
		RETURNING `+assessmentSelectCols,
		strings.Join(setClauses, ", "), i)

	a, err := scanAssessment(r.db.QueryRow(ctx, q, args...))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update assessment schedule: %w", err)
	}
	return a, nil
}

func (r *CertificationRepository) getAssessmentByID(ctx context.Context, id string) (*models.AssessmentSchedule, error) {
	q := `SELECT ` + assessmentSelectCols + ` FROM assessment_schedules WHERE id = $1`
	a, err := scanAssessment(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get assessment by id: %w", err)
	}
	return a, nil
}

// GetAssessmentsByUser returns all assessment schedules for a specific user.
func (r *CertificationRepository) GetAssessmentsByUser(ctx context.Context, userID string) ([]models.AssessmentSchedule, error) {
	// The schema stores user_id on assessment_schedules.
	// If it's not directly on the table, join through assessment_results.
	// Based on the migration, user_id is on assessment_schedules.
	q := `SELECT ` + assessmentSelectCols + `
		  FROM assessment_schedules
		  WHERE instructor_id = $1 OR id IN (
		      SELECT assessment_id FROM assessment_results WHERE user_id = $1
		  )
		  ORDER BY scheduled_for DESC`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("get assessments by user: %w", err)
	}
	defer rows.Close()

	var result []models.AssessmentSchedule
	for rows.Next() {
		a, err := scanAssessment(rows)
		if err != nil {
			return nil, fmt.Errorf("scan assessment: %w", err)
		}
		result = append(result, *a)
	}
	return result, rows.Err()
}

// GetAssessmentsByOrg returns all assessment schedules for users in an org.
func (r *CertificationRepository) GetAssessmentsByOrg(ctx context.Context, orgID string) ([]models.AssessmentSchedule, error) {
	const q = `
		SELECT DISTINCT ` + assessmentSelectCols + `
		FROM assessment_schedules asched
		WHERE asched.id IN (
			SELECT ar.assessment_id FROM assessment_results ar
			JOIN users u ON u.id = ar.user_id
			WHERE u.organization_id = $1
		)
		ORDER BY asched.scheduled_for DESC`

	rows, err := r.db.Query(ctx, q, orgID)
	if err != nil {
		return nil, fmt.Errorf("get assessments by org: %w", err)
	}
	defer rows.Close()

	var result []models.AssessmentSchedule
	for rows.Next() {
		a, err := scanAssessment(rows)
		if err != nil {
			return nil, fmt.Errorf("scan assessment: %w", err)
		}
		result = append(result, *a)
	}
	return result, rows.Err()
}

// ---------------------------------------------------------------------------
// Issued Certificates
// ---------------------------------------------------------------------------

const issuedCertSelectCols = `
	id, certification_id, user_id, organization_id, certificate_number,
	issued_at, expires_at, revoked_at, revoked_by, revocation_reason,
	pdf_storage_path, created_at`

func scanIssuedCert(row pgx.Row) (*models.IssuedCertificate, error) {
	var ic models.IssuedCertificate
	err := row.Scan(
		&ic.ID, &ic.CertificationID, &ic.UserID, &ic.OrganizationID,
		&ic.CertificateNumber, &ic.IssuedAt, &ic.ExpiresAt,
		&ic.RevokedAt, &ic.RevokedBy, &ic.RevocationReason,
		&ic.PDFStoragePath, &ic.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &ic, nil
}

// InsertIssuedCertificate persists a newly awarded certificate.
func (r *CertificationRepository) InsertIssuedCertificate(ctx context.Context, ic *models.IssuedCertificate) (*models.IssuedCertificate, error) {
	if ic.ID == uuid.Nil {
		ic.ID = uuid.New()
	}
	now := time.Now().UTC()
	ic.CreatedAt = now
	ic.IssuedAt = now

	const q = `
		INSERT INTO issued_certificates
			(id, certification_id, user_id, organization_id, certificate_number,
			 issued_at, expires_at, revoked_at, revoked_by, revocation_reason,
			 pdf_storage_path, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING ` + issuedCertSelectCols

	created, err := scanIssuedCert(r.db.QueryRow(ctx, q,
		ic.ID, ic.CertificationID, ic.UserID, ic.OrganizationID,
		ic.CertificateNumber, ic.IssuedAt, ic.ExpiresAt,
		ic.RevokedAt, ic.RevokedBy, ic.RevocationReason,
		ic.PDFStoragePath, ic.CreatedAt,
	))
	if err != nil {
		return nil, fmt.Errorf("insert issued certificate: %w", err)
	}
	return created, nil
}

// GetIssuedCertificate fetches a single issued certificate by its UUID.
func (r *CertificationRepository) GetIssuedCertificate(ctx context.Context, id string) (*models.IssuedCertificate, error) {
	q := `SELECT ` + issuedCertSelectCols + ` FROM issued_certificates WHERE id = $1`
	ic, err := scanIssuedCert(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get issued certificate: %w", err)
	}
	return ic, nil
}

// GetIssuedCertificatesByUser returns all certificates held by a specific user.
func (r *CertificationRepository) GetIssuedCertificatesByUser(ctx context.Context, userID string) ([]models.IssuedCertificate, error) {
	q := `SELECT ` + issuedCertSelectCols + `
		  FROM issued_certificates
		  WHERE user_id = $1
		  ORDER BY issued_at DESC`

	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("get certificates by user: %w", err)
	}
	defer rows.Close()

	var result []models.IssuedCertificate
	for rows.Next() {
		ic, err := scanIssuedCert(rows)
		if err != nil {
			return nil, fmt.Errorf("scan issued certificate: %w", err)
		}
		result = append(result, *ic)
	}
	return result, rows.Err()
}

// GetIssuedCertificatesByOrg returns all certificates for users in an org.
func (r *CertificationRepository) GetIssuedCertificatesByOrg(ctx context.Context, orgID string) ([]models.IssuedCertificate, error) {
	q := `SELECT ` + issuedCertSelectCols + `
		  FROM issued_certificates
		  WHERE organization_id = $1
		  ORDER BY issued_at DESC`

	rows, err := r.db.Query(ctx, q, orgID)
	if err != nil {
		return nil, fmt.Errorf("get certificates by org: %w", err)
	}
	defer rows.Close()

	var result []models.IssuedCertificate
	for rows.Next() {
		ic, err := scanIssuedCert(rows)
		if err != nil {
			return nil, fmt.Errorf("scan issued certificate: %w", err)
		}
		result = append(result, *ic)
	}
	return result, rows.Err()
}

// GetAllIssuedCertificates returns every non-revoked issued certificate.
func (r *CertificationRepository) GetAllIssuedCertificates(ctx context.Context) ([]models.IssuedCertificate, error) {
	q := `SELECT ` + issuedCertSelectCols + `
		  FROM issued_certificates
		  WHERE revoked_at IS NULL
		  ORDER BY issued_at DESC`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("get all issued certificates: %w", err)
	}
	defer rows.Close()

	var result []models.IssuedCertificate
	for rows.Next() {
		ic, err := scanIssuedCert(rows)
		if err != nil {
			return nil, fmt.Errorf("scan issued certificate: %w", err)
		}
		result = append(result, *ic)
	}
	return result, rows.Err()
}

// UpdateCertificateReminderSent marks the N-day reminder as sent for a certificate.
// days must be 60 or 14.
func (r *CertificationRepository) UpdateCertificateReminderSent(ctx context.Context, certID string, days int) error {
	var col string
	switch days {
	case 60:
		col = "reminder_60_sent"
	case 14:
		col = "reminder_14_sent"
	default:
		return fmt.Errorf("unsupported reminder day value: %d (must be 60 or 14)", days)
	}

	q := fmt.Sprintf("UPDATE issued_certificates SET %s = true WHERE id = $1", col)
	ct, err := r.db.Exec(ctx, q, certID)
	if err != nil {
		return fmt.Errorf("update reminder sent: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetExpiringCertificates returns certificates expiring in exactly N days
// where the corresponding reminder has not yet been sent.
func (r *CertificationRepository) GetExpiringCertificates(ctx context.Context, days int) ([]models.IssuedCertificate, error) {
	var reminderCol string
	switch days {
	case 60:
		reminderCol = "reminder_60_sent"
	case 14:
		reminderCol = "reminder_14_sent"
	default:
		return nil, fmt.Errorf("unsupported reminder day value: %d", days)
	}

	q := fmt.Sprintf(`
		SELECT `+issuedCertSelectCols+`
		FROM issued_certificates
		WHERE revoked_at IS NULL
		  AND %s = false
		  AND expires_at::date = (CURRENT_DATE + $1 * INTERVAL '1 day')::date`,
		reminderCol)

	rows, err := r.db.Query(ctx, q, days)
	if err != nil {
		return nil, fmt.Errorf("get expiring certificates (%d days): %w", days, err)
	}
	defer rows.Close()

	var result []models.IssuedCertificate
	for rows.Next() {
		ic, err := scanIssuedCert(rows)
		if err != nil {
			return nil, fmt.Errorf("scan expiring certificate: %w", err)
		}
		result = append(result, *ic)
	}
	return result, rows.Err()
}

// HasCompletedAllRequirements checks if a user has completed all required
// courses for a certification.
func (r *CertificationRepository) HasCompletedAllRequirements(ctx context.Context, userID, certID string) (bool, error) {
	const q = `
		SELECT COUNT(*) = 0
		FROM certification_course_requirements ccr
		WHERE ccr.certification_id = $1
		  AND NOT EXISTS (
		      SELECT 1 FROM lesson_progress lp
		      JOIN lessons l ON l.id = lp.lesson_id
		      WHERE l.course_id = ccr.course_id
		        AND lp.user_id = $2
		        AND lp.completed_at IS NOT NULL
		  )
		  AND ccr.is_required = true`

	var eligible bool
	if err := r.db.QueryRow(ctx, q, certID, userID).Scan(&eligible); err != nil {
		return false, fmt.Errorf("check requirements: %w", err)
	}
	return eligible, nil
}
