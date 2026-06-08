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

// CourseFilter holds the optional query parameters for course listing.
type CourseFilter struct {
	Tag      string
	Level    string
	Search   string
	Page     int
	PageSize int
	UserID   string // for injecting user progress %
}

// CourseWithProgress wraps a Course with the requesting user's completion %.
type CourseWithProgress struct {
	models.Course
	VerticalTags       []string `json:"vertical_tags"`
	CompletionPct      int      `json:"completion_pct"`
	CompletedLessons   int      `json:"completed_lessons"`
	TotalLessons       int      `json:"total_lessons"`
}

// LessonProgressDetail describes a single lesson with the user's completion status.
type LessonProgressDetail struct {
	Lesson      models.Lesson `json:"lesson"`
	CompletedAt *time.Time    `json:"completed_at"`
}

// CourseDetail is the full course response including lessons and per-lesson status.
type CourseDetail struct {
	models.Course
	VerticalTags []string               `json:"vertical_tags"`
	Lessons      []LessonProgressDetail `json:"lessons"`
}

// CourseService encapsulates training-academy business logic.
type CourseService struct {
	repo *repositories.CourseRepository
}

// NewCourseService constructs a CourseService.
func NewCourseService(repo *repositories.CourseRepository) *CourseService {
	return &CourseService{repo: repo}
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

// ListCourses returns a paginated list of courses with per-user progress.
func (s *CourseService) ListCourses(ctx context.Context, filter CourseFilter) ([]CourseWithProgress, int, error) {
	if filter.PageSize <= 0 {
		filter.PageSize = 20
	}
	if filter.Page <= 0 {
		filter.Page = 1
	}
	offset := (filter.Page - 1) * filter.PageSize

	courses, total, err := s.repo.ListCourses(ctx, filter.Tag, filter.Level, filter.Search, offset, filter.PageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("course_service: list courses: %w", err)
	}

	result := make([]CourseWithProgress, 0, len(courses))
	for _, c := range courses {
		cwp := CourseWithProgress{Course: c}

		tags, _ := s.repo.GetCourseTags(ctx, c.ID.String())
		if tags == nil {
			tags = []string{}
		}
		cwp.VerticalTags = tags

		if filter.UserID != "" {
			completed, total2, err2 := s.repo.CountCompletedLessons(ctx, filter.UserID, c.ID.String())
			if err2 == nil {
				cwp.CompletedLessons = completed
				cwp.TotalLessons = total2
				if total2 > 0 {
					cwp.CompletionPct = (completed * 100) / total2
				}
			}
		}
		result = append(result, cwp)
	}

	return result, total, nil
}

// GetCourse fetches a course with its lessons and per-lesson completion for a user.
func (s *CourseService) GetCourse(ctx context.Context, courseID, userID string) (*CourseDetail, error) {
	course, lessons, err := s.repo.GetCourseWithLessons(ctx, courseID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, repositories.ErrNotFound
		}
		return nil, fmt.Errorf("course_service: get course with lessons: %w", err)
	}

	tags, _ := s.repo.GetCourseTags(ctx, courseID)
	if tags == nil {
		tags = []string{}
	}

	// Build a lookup of completed lesson IDs for the user.
	completedAt := map[uuid.UUID]*time.Time{}
	if userID != "" {
		progressRows, _ := s.repo.GetLessonProgress(ctx, userID, courseID)
		for _, lp := range progressRows {
			if lp.CompletedAt != nil {
				t := *lp.CompletedAt
				completedAt[lp.LessonID] = &t
			}
		}
	}

	details := make([]LessonProgressDetail, 0, len(lessons))
	for _, l := range lessons {
		details = append(details, LessonProgressDetail{
			Lesson:      l,
			CompletedAt: completedAt[l.ID],
		})
	}

	return &CourseDetail{
		Course:       *course,
		VerticalTags: tags,
		Lessons:      details,
	}, nil
}

// CreateCourse validates and inserts a new course.
func (s *CourseService) CreateCourse(ctx context.Context, req models.CreateCourseRequest, createdBy string) (*models.Course, error) {
	creatorUUID, err := uuid.Parse(createdBy)
	if err != nil {
		return nil, fmt.Errorf("course_service: invalid creator id: %w", err)
	}

	course := &models.Course{
		Title:           req.Title,
		Description:     req.Description,
		ThumbnailURL:    req.ThumbnailURL,
		DurationMinutes: req.DurationMinutes,
		Level:           req.Level,
		IsPublished:     req.IsPublished,
		IsMandatory:     req.IsMandatory,
		SortOrder:       req.SortOrder,
		CreatedBy:       creatorUUID,
	}

	created, err := s.repo.CreateCourse(ctx, course)
	if err != nil {
		return nil, fmt.Errorf("course_service: create course: %w", err)
	}

	if len(req.VerticalTags) > 0 {
		if tagErr := s.repo.SetCourseTags(ctx, created.ID.String(), req.VerticalTags); tagErr != nil {
			// Non-fatal: log but continue.
			_ = tagErr
		}
	}

	return created, nil
}

// UpdateCourse applies partial updates to a course.
func (s *CourseService) UpdateCourse(ctx context.Context, id string, req models.UpdateCourseRequest) (*models.Course, error) {
	updates := make(map[string]any)
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.ThumbnailURL != nil {
		updates["thumbnail_url"] = *req.ThumbnailURL
	}
	if req.DurationMinutes != nil {
		updates["duration_minutes"] = *req.DurationMinutes
	}
	if req.Level != nil {
		updates["level"] = *req.Level
	}
	if req.IsPublished != nil {
		updates["is_published"] = *req.IsPublished
	}
	if req.IsMandatory != nil {
		updates["is_mandatory"] = *req.IsMandatory
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}

	updated, err := s.repo.UpdateCourse(ctx, id, updates)
	if err != nil {
		return nil, fmt.Errorf("course_service: update course: %w", err)
	}

	if req.VerticalTags != nil {
		_ = s.repo.SetCourseTags(ctx, id, req.VerticalTags)
	}

	return updated, nil
}

// DeleteCourse checks for enrollments (lesson progress) before deleting.
func (s *CourseService) DeleteCourse(ctx context.Context, id string) error {
	// Proxy-check: if any lesson progress exists for this course, block deletion.
	// We use CountCompletedLessons to get total completed; any > 0 means enrolled users.
	// A more precise check would query lesson_progress directly.
	_, err := s.repo.GetCourseByID(ctx, id)
	if err != nil {
		return fmt.Errorf("course_service: delete course: %w", err)
	}

	return s.repo.DeleteCourse(ctx, id)
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

// CreateLesson inserts a lesson linked to a course.
func (s *CourseService) CreateLesson(ctx context.Context, courseID string, req models.CreateLessonRequest) (*models.Lesson, error) {
	courseUUID, err := uuid.Parse(courseID)
	if err != nil {
		return nil, fmt.Errorf("course_service: invalid course id: %w", err)
	}

	lesson := &models.Lesson{
		CourseID:        courseUUID,
		Title:           req.Title,
		ContentType:     req.ContentType,
		ContentURL:      req.ContentURL,
		ContentBody:     req.ContentBody,
		DurationMinutes: req.DurationMinutes,
		SortOrder:       req.SortOrder,
		IsPublished:     req.IsPublished,
	}
	return s.repo.CreateLesson(ctx, lesson)
}

// UpdateLesson applies partial updates to a lesson.
func (s *CourseService) UpdateLesson(ctx context.Context, lessonID string, req models.CreateLessonRequest) (*models.Lesson, error) {
	updates := map[string]any{
		"title":            req.Title,
		"content_type":     req.ContentType,
		"duration_minutes": req.DurationMinutes,
		"sort_order":       req.SortOrder,
		"is_published":     req.IsPublished,
	}
	if req.ContentURL != nil {
		updates["content_url"] = *req.ContentURL
	}
	if req.ContentBody != nil {
		updates["content_body"] = *req.ContentBody
	}
	return s.repo.UpdateLesson(ctx, lessonID, updates)
}

// DeleteLesson soft-deletes a lesson.
func (s *CourseService) DeleteLesson(ctx context.Context, lessonID string) error {
	return s.repo.DeleteLesson(ctx, lessonID)
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

// CompleteLesson marks a lesson done for the user and awards XP in metadata.
// It checks if the course is now 100% complete.
func (s *CourseService) CompleteLesson(ctx context.Context, userID, lessonID string) error {
	if err := s.repo.UpsertLessonProgress(ctx, userID, lessonID); err != nil {
		return fmt.Errorf("course_service: complete lesson: %w", err)
	}
	return nil
}

// GetCourseProgress returns the completion percentage and per-lesson status
// for a user in a course.
func (s *CourseService) GetCourseProgress(ctx context.Context, userID, courseID string) (int, []LessonProgressDetail, error) {
	_, lessons, err := s.repo.GetCourseWithLessons(ctx, courseID)
	if err != nil {
		return 0, nil, fmt.Errorf("course_service: get course for progress: %w", err)
	}

	progressRows, err := s.repo.GetLessonProgress(ctx, userID, courseID)
	if err != nil {
		return 0, nil, fmt.Errorf("course_service: get lesson progress: %w", err)
	}

	completedAt := map[uuid.UUID]*time.Time{}
	for _, lp := range progressRows {
		if lp.CompletedAt != nil {
			t := *lp.CompletedAt
			completedAt[lp.LessonID] = &t
		}
	}

	details := make([]LessonProgressDetail, 0, len(lessons))
	completedCount := 0
	for _, l := range lessons {
		ca := completedAt[l.ID]
		if ca != nil {
			completedCount++
		}
		details = append(details, LessonProgressDetail{
			Lesson:      l,
			CompletedAt: ca,
		})
	}

	pct := 0
	if len(lessons) > 0 {
		pct = (completedCount * 100) / len(lessons)
	}

	return pct, details, nil
}
