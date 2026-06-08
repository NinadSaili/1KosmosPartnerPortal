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

// CourseRepository handles all database operations for courses and lessons.
type CourseRepository struct {
	db *pgxpool.Pool
}

// NewCourseRepository creates a new CourseRepository.
func NewCourseRepository(db *pgxpool.Pool) *CourseRepository {
	return &CourseRepository{db: db}
}

const courseSelectCols = `
	id, title, slug, description, thumbnail_url, duration_minutes, level,
	is_published, sort_order, created_by, created_at, updated_at`

func scanCourse(row pgx.Row) (*models.Course, error) {
	var c models.Course
	err := row.Scan(
		&c.ID, &c.Title, &c.Slug, &c.Description, &c.ThumbnailURL,
		&c.DurationMinutes, &c.Level, &c.IsPublished,
		&c.SortOrder, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// ListCourses returns a paginated list of courses with optional tag, level, and search filters.
// Non-admin callers only see published courses; full-text search uses pg_trgm similarity.
func (r *CourseRepository) ListCourses(ctx context.Context, tag, level, search string, offset, limit int) ([]models.Course, int, error) {
	conditions := []string{"deleted_at IS NULL"}
	args := []any{}
	idx := 1

	if tag != "" {
		conditions = append(conditions, fmt.Sprintf(
			"id IN (SELECT course_id FROM course_vertical_tags WHERE tag = $%d)", idx))
		args = append(args, tag)
		idx++
	}
	if level != "" {
		conditions = append(conditions, fmt.Sprintf("level = $%d", idx))
		args = append(args, level)
		idx++
	}
	if search != "" {
		conditions = append(conditions, fmt.Sprintf(
			"(title ILIKE $%d OR description ILIKE $%d)", idx, idx))
		args = append(args, "%"+search+"%")
		idx++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")

	countQ := fmt.Sprintf("SELECT COUNT(*) FROM courses %s", where)
	var total int
	if err := r.db.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count courses: %w", err)
	}

	listArgs := append(args, limit, offset)
	listQ := fmt.Sprintf(`
		SELECT %s
		FROM courses %s
		ORDER BY sort_order ASC, created_at DESC
		LIMIT $%d OFFSET $%d`, courseSelectCols, where, idx, idx+1)

	rows, err := r.db.Query(ctx, listQ, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list courses: %w", err)
	}
	defer rows.Close()

	var courses []models.Course
	for rows.Next() {
		c, err := scanCourse(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan course: %w", err)
		}
		courses = append(courses, *c)
	}
	return courses, total, rows.Err()
}

// GetCourseByID fetches a single course by its UUID.
func (r *CourseRepository) GetCourseByID(ctx context.Context, id string) (*models.Course, error) {
	q := fmt.Sprintf("SELECT %s FROM courses WHERE id = $1 AND deleted_at IS NULL", courseSelectCols)
	c, err := scanCourse(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get course: %w", err)
	}
	return c, nil
}

// GetCourseWithLessons fetches a course and all its non-deleted lessons.
func (r *CourseRepository) GetCourseWithLessons(ctx context.Context, id string) (*models.Course, []models.Lesson, error) {
	course, err := r.GetCourseByID(ctx, id)
	if err != nil {
		return nil, nil, err
	}

	const lq = `
		SELECT id, course_id, title, slug, content_type, content_url, content_body,
		       duration_minutes, sort_order, is_published, created_at, updated_at
		FROM lessons
		WHERE course_id = $1 AND deleted_at IS NULL
		ORDER BY sort_order ASC, created_at ASC`

	rows, err := r.db.Query(ctx, lq, id)
	if err != nil {
		return nil, nil, fmt.Errorf("get lessons for course: %w", err)
	}
	defer rows.Close()

	var lessons []models.Lesson
	for rows.Next() {
		var l models.Lesson
		if err := rows.Scan(
			&l.ID, &l.CourseID, &l.Title, &l.Slug, &l.ContentType,
			&l.ContentURL, &l.ContentBody, &l.DurationMinutes,
			&l.SortOrder, &l.IsPublished, &l.CreatedAt, &l.UpdatedAt,
		); err != nil {
			return nil, nil, fmt.Errorf("scan lesson: %w", err)
		}
		lessons = append(lessons, l)
	}
	return course, lessons, rows.Err()
}

// CreateCourse inserts a new course record.
func (r *CourseRepository) CreateCourse(ctx context.Context, c *models.Course) (*models.Course, error) {
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
		INSERT INTO courses (id, title, slug, description, thumbnail_url, duration_minutes,
		                     level, is_published, sort_order, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id, title, slug, description, thumbnail_url, duration_minutes, level,
		          is_published, sort_order, created_by, created_at, updated_at`

	created, err := scanCourse(r.db.QueryRow(ctx, q,
		c.ID, c.Title, c.Slug, c.Description, c.ThumbnailURL, c.DurationMinutes,
		c.Level, c.IsPublished, c.SortOrder, c.CreatedBy, c.CreatedAt, c.UpdatedAt,
	))
	if err != nil {
		return nil, fmt.Errorf("create course: %w", err)
	}
	return created, nil
}

// UpdateCourse performs a dynamic UPDATE on the courses table.
func (r *CourseRepository) UpdateCourse(ctx context.Context, id string, updates map[string]any) (*models.Course, error) {
	if len(updates) == 0 {
		return r.GetCourseByID(ctx, id)
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
		UPDATE courses SET %s WHERE id = $%d AND deleted_at IS NULL
		RETURNING id, title, slug, description, thumbnail_url, duration_minutes, level,
		          is_published, sort_order, created_by, created_at, updated_at`,
		strings.Join(setClauses, ", "), i)

	c, err := scanCourse(r.db.QueryRow(ctx, q, args...))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update course: %w", err)
	}
	return c, nil
}

// DeleteCourse soft-deletes a course.
func (r *CourseRepository) DeleteCourse(ctx context.Context, id string) error {
	ct, err := r.db.Exec(ctx,
		"UPDATE courses SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND deleted_at IS NULL",
		time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("delete course: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetCourseTags returns the vertical tags associated with a course.
func (r *CourseRepository) GetCourseTags(ctx context.Context, courseID string) ([]string, error) {
	rows, err := r.db.Query(ctx,
		"SELECT tag FROM course_vertical_tags WHERE course_id = $1 ORDER BY tag", courseID)
	if err != nil {
		return nil, fmt.Errorf("get course tags: %w", err)
	}
	defer rows.Close()

	var tags []string
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, rows.Err()
}

// SetCourseTags replaces the vertical tags for a course atomically.
func (r *CourseRepository) SetCourseTags(ctx context.Context, courseID string, tags []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("set course tags: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, "DELETE FROM course_vertical_tags WHERE course_id = $1", courseID); err != nil {
		return fmt.Errorf("set course tags: delete old: %w", err)
	}

	for _, tag := range tags {
		if _, err := tx.Exec(ctx,
			"INSERT INTO course_vertical_tags (course_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING",
			courseID, tag,
		); err != nil {
			return fmt.Errorf("set course tags: insert %q: %w", tag, err)
		}
	}

	return tx.Commit(ctx)
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

// CreateLesson inserts a new lesson record.
func (r *CourseRepository) CreateLesson(ctx context.Context, l *models.Lesson) (*models.Lesson, error) {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	now := time.Now().UTC()
	l.CreatedAt = now
	l.UpdatedAt = now

	if l.Slug == "" {
		l.Slug = slugify(l.Title) + "-" + l.ID.String()[:8]
	}

	const q = `
		INSERT INTO lessons (id, course_id, title, slug, content_type, content_url, content_body,
		                     duration_minutes, sort_order, is_published, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id, course_id, title, slug, content_type, content_url, content_body,
		          duration_minutes, sort_order, is_published, created_at, updated_at`

	var out models.Lesson
	err := r.db.QueryRow(ctx, q,
		l.ID, l.CourseID, l.Title, l.Slug, l.ContentType, l.ContentURL, l.ContentBody,
		l.DurationMinutes, l.SortOrder, l.IsPublished, l.CreatedAt, l.UpdatedAt,
	).Scan(
		&out.ID, &out.CourseID, &out.Title, &out.Slug, &out.ContentType,
		&out.ContentURL, &out.ContentBody, &out.DurationMinutes,
		&out.SortOrder, &out.IsPublished, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create lesson: %w", err)
	}
	return &out, nil
}

// UpdateLesson performs a dynamic UPDATE on the lessons table.
func (r *CourseRepository) UpdateLesson(ctx context.Context, id string, updates map[string]any) (*models.Lesson, error) {
	if len(updates) == 0 {
		return r.getLessonByID(ctx, id)
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
		UPDATE lessons SET %s WHERE id = $%d AND deleted_at IS NULL
		RETURNING id, course_id, title, slug, content_type, content_url, content_body,
		          duration_minutes, sort_order, is_published, created_at, updated_at`,
		strings.Join(setClauses, ", "), i)

	var out models.Lesson
	err := r.db.QueryRow(ctx, q, args...).Scan(
		&out.ID, &out.CourseID, &out.Title, &out.Slug, &out.ContentType,
		&out.ContentURL, &out.ContentBody, &out.DurationMinutes,
		&out.SortOrder, &out.IsPublished, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update lesson: %w", err)
	}
	return &out, nil
}

func (r *CourseRepository) getLessonByID(ctx context.Context, id string) (*models.Lesson, error) {
	const q = `
		SELECT id, course_id, title, slug, content_type, content_url, content_body,
		       duration_minutes, sort_order, is_published, created_at, updated_at
		FROM lessons WHERE id = $1 AND deleted_at IS NULL`

	var out models.Lesson
	err := r.db.QueryRow(ctx, q, id).Scan(
		&out.ID, &out.CourseID, &out.Title, &out.Slug, &out.ContentType,
		&out.ContentURL, &out.ContentBody, &out.DurationMinutes,
		&out.SortOrder, &out.IsPublished, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get lesson by id: %w", err)
	}
	return &out, nil
}

// DeleteLesson soft-deletes a lesson.
func (r *CourseRepository) DeleteLesson(ctx context.Context, id string) error {
	ct, err := r.db.Exec(ctx,
		"UPDATE lessons SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND deleted_at IS NULL",
		time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("delete lesson: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetLessonsByCount returns the total number of non-deleted lessons in a course.
func (r *CourseRepository) GetLessonsByCount(ctx context.Context, courseID string) (int, error) {
	var count int
	err := r.db.QueryRow(ctx,
		"SELECT COUNT(*) FROM lessons WHERE course_id = $1 AND deleted_at IS NULL",
		courseID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count lessons: %w", err)
	}
	return count, nil
}

// ---------------------------------------------------------------------------
// Lesson Progress
// ---------------------------------------------------------------------------

// UpsertLessonProgress marks a lesson as completed for a user.
func (r *CourseRepository) UpsertLessonProgress(ctx context.Context, userID, lessonID string) error {
	// Fetch course_id for the lesson so we can store it on the progress record.
	var courseID uuid.UUID
	if err := r.db.QueryRow(ctx,
		"SELECT course_id FROM lessons WHERE id = $1 AND deleted_at IS NULL",
		lessonID,
	).Scan(&courseID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("upsert lesson progress: get course id: %w", err)
	}

	now := time.Now().UTC()
	const q = `
		INSERT INTO lesson_progress (id, user_id, lesson_id, course_id, completed_at, last_accessed_at)
		VALUES ($1, $2, $3, $4, $5, $5)
		ON CONFLICT (user_id, lesson_id) DO UPDATE
			SET completed_at     = COALESCE(lesson_progress.completed_at, EXCLUDED.completed_at),
			    last_accessed_at = EXCLUDED.last_accessed_at`

	_, err := r.db.Exec(ctx, q, uuid.New(), userID, lessonID, courseID, now)
	if err != nil {
		return fmt.Errorf("upsert lesson progress: %w", err)
	}
	return nil
}

// GetLessonProgress returns all lesson progress rows for a user in a course.
func (r *CourseRepository) GetLessonProgress(ctx context.Context, userID, courseID string) ([]models.LessonProgress, error) {
	const q = `
		SELECT id, user_id, lesson_id, course_id, completed_at, time_spent_secs, last_accessed_at
		FROM lesson_progress
		WHERE user_id = $1 AND course_id = $2`

	rows, err := r.db.Query(ctx, q, userID, courseID)
	if err != nil {
		return nil, fmt.Errorf("get lesson progress: %w", err)
	}
	defer rows.Close()

	var result []models.LessonProgress
	for rows.Next() {
		var lp models.LessonProgress
		if err := rows.Scan(
			&lp.ID, &lp.UserID, &lp.LessonID, &lp.CourseID,
			&lp.CompletedAt, &lp.TimeSpentSecs, &lp.LastAccessedAt,
		); err != nil {
			return nil, fmt.Errorf("scan lesson progress: %w", err)
		}
		result = append(result, lp)
	}
	return result, rows.Err()
}

// CountCompletedLessons returns the number of completed and total published
// lessons for a user in a course.
func (r *CourseRepository) CountCompletedLessons(ctx context.Context, userID, courseID string) (completed, total int, err error) {
	if err = r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM lessons WHERE course_id = $1 AND is_published = true AND deleted_at IS NULL`,
		courseID,
	).Scan(&total); err != nil {
		return 0, 0, fmt.Errorf("count total lessons: %w", err)
	}

	if err = r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM lesson_progress lp
		 JOIN lessons l ON l.id = lp.lesson_id
		 WHERE lp.user_id = $1 AND lp.course_id = $2
		   AND lp.completed_at IS NOT NULL
		   AND l.is_published = true AND l.deleted_at IS NULL`,
		userID, courseID,
	).Scan(&completed); err != nil {
		return 0, 0, fmt.Errorf("count completed lessons: %w", err)
	}

	return completed, total, nil
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// slugify produces a simple URL-safe slug from a title string.
func slugify(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == ' ' || r == '-' || r == '_':
			b.WriteByte('-')
		}
	}
	return strings.Trim(b.String(), "-")
}
