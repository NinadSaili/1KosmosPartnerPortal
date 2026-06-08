package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/1kosmos/partner-portal/internal/middleware"
	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/1kosmos/partner-portal/internal/services"
)

// courseSvc builds a CourseService wired to the handler's pool.
func (h *Handler) courseSvc() *services.CourseService {
	return services.NewCourseService(repositories.NewCourseRepository(h.pool))
}

// ---------------------------------------------------------------------------
// ListCourses — GET /api/v1/courses
// ---------------------------------------------------------------------------

// ListCourses handles GET /api/v1/courses.
func (h *Handler) ListCourses(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	filter := services.CourseFilter{
		Tag:      r.URL.Query().Get("tag"),
		Level:    r.URL.Query().Get("level"),
		Search:   r.URL.Query().Get("search"),
		Page:     page,
		PageSize: pageSize,
		UserID:   userID,
	}

	svc := h.courseSvc()
	courses, total, err := svc.ListCourses(r.Context(), filter)
	if err != nil {
		h.log.Error().Err(err).Msg("list courses failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to list courses")
		return
	}
	if courses == nil {
		courses = []services.CourseWithProgress{}
	}

	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 20
	}

	writeJSON(w, http.StatusOK, models.PaginatedResponse[services.CourseWithProgress]{
		Data:     courses,
		Total:    total,
		Page:     filter.Page,
		PageSize: filter.PageSize,
	})
}

// ---------------------------------------------------------------------------
// GetCourse — GET /api/v1/courses/{id}
// ---------------------------------------------------------------------------

// GetCourse handles GET /api/v1/courses/{id}.
func (h *Handler) GetCourse(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "id")
	userID := middleware.GetUserID(r)

	svc := h.courseSvc()
	detail, err := svc.GetCourse(r.Context(), courseID, userID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "course not found")
			return
		}
		h.log.Error().Err(err).Str("course_id", courseID).Msg("get course failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to fetch course")
		return
	}

	writeJSON(w, http.StatusOK, detail)
}

// ---------------------------------------------------------------------------
// CreateCourse — POST /api/v1/courses (vendor_admin)
// ---------------------------------------------------------------------------

// CreateCourse handles POST /api/v1/courses.
func (h *Handler) CreateCourse(w http.ResponseWriter, r *http.Request) {
	var req models.CreateCourseRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	// Validate required fields.
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "title is required")
		return
	}
	if req.Level == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "level is required")
		return
	}
	if req.Description == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "description is required")
		return
	}

	callerID := middleware.GetUserID(r)
	svc := h.courseSvc()
	course, err := svc.CreateCourse(r.Context(), req, callerID)
	if err != nil {
		h.log.Error().Err(err).Msg("create course failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to create course")
		return
	}

	h.auditLog.WriteAudit(r.Context(), callerID, "create", "course", course.ID.String(), nil)
	writeJSON(w, http.StatusCreated, course)
}

// ---------------------------------------------------------------------------
// UpdateCourse — PUT /api/v1/courses/{id} (vendor_admin)
// ---------------------------------------------------------------------------

// UpdateCourse handles PUT /api/v1/courses/{id}.
func (h *Handler) UpdateCourse(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "id")

	var req models.UpdateCourseRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	svc := h.courseSvc()
	updated, err := svc.UpdateCourse(r.Context(), courseID, req)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "course not found")
			return
		}
		h.log.Error().Err(err).Str("course_id", courseID).Msg("update course failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to update course")
		return
	}

	h.auditLog.WriteAudit(r.Context(), middleware.GetUserID(r), "update", "course", courseID, nil)
	writeJSON(w, http.StatusOK, updated)
}

// ---------------------------------------------------------------------------
// DeleteCourse — DELETE /api/v1/courses/{id} (vendor_admin)
// ---------------------------------------------------------------------------

// DeleteCourse handles DELETE /api/v1/courses/{id}.
func (h *Handler) DeleteCourse(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "id")

	// Check for existing enrollments (any lesson_progress rows for this course).
	var enrollCount int
	checkErr := h.pool.QueryRow(r.Context(),
		"SELECT COUNT(*) FROM lesson_progress WHERE course_id = $1", courseID,
	).Scan(&enrollCount)
	if checkErr == nil && enrollCount > 0 {
		writeError(w, http.StatusConflict, "has_enrollments",
			"cannot delete a course that has user progress; unpublish it instead")
		return
	}

	svc := h.courseSvc()
	if err := svc.DeleteCourse(r.Context(), courseID); err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "course not found")
			return
		}
		h.log.Error().Err(err).Str("course_id", courseID).Msg("delete course failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to delete course")
		return
	}

	h.auditLog.WriteAudit(r.Context(), middleware.GetUserID(r), "delete", "course", courseID, nil)
	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// ListLessons — GET /api/v1/courses/{courseId}/lessons
// ---------------------------------------------------------------------------

// ListLessons handles GET /api/v1/courses/{courseId}/lessons.
func (h *Handler) ListLessons(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "courseId")
	userID := middleware.GetUserID(r)

	svc := h.courseSvc()
	detail, err := svc.GetCourse(r.Context(), courseID, userID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "course not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to list lessons")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"course_id": courseID,
		"lessons":   detail.Lessons,
	})
}

// ---------------------------------------------------------------------------
// CreateLesson — POST /api/v1/courses/{courseId}/lessons (vendor_admin)
// ---------------------------------------------------------------------------

// CreateLesson handles POST /api/v1/courses/{courseId}/lessons.
func (h *Handler) CreateLesson(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "courseId")

	var req models.CreateLessonRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "title is required")
		return
	}
	if req.ContentType == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "content_type is required")
		return
	}

	svc := h.courseSvc()
	lesson, err := svc.CreateLesson(r.Context(), courseID, req)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "course not found")
			return
		}
		h.log.Error().Err(err).Str("course_id", courseID).Msg("create lesson failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to create lesson")
		return
	}

	h.auditLog.WriteAudit(r.Context(), middleware.GetUserID(r), "create", "lesson", lesson.ID.String(), nil)
	writeJSON(w, http.StatusCreated, lesson)
}

// ---------------------------------------------------------------------------
// UpdateLesson — PUT /api/v1/courses/{courseId}/lessons/{id} (vendor_admin)
// ---------------------------------------------------------------------------

// UpdateLesson handles PUT /api/v1/courses/{courseId}/lessons/{id}.
func (h *Handler) UpdateLesson(w http.ResponseWriter, r *http.Request) {
	lessonID := chi.URLParam(r, "id")

	var req models.CreateLessonRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	svc := h.courseSvc()
	updated, err := svc.UpdateLesson(r.Context(), lessonID, req)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "lesson not found")
			return
		}
		h.log.Error().Err(err).Str("lesson_id", lessonID).Msg("update lesson failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to update lesson")
		return
	}

	h.auditLog.WriteAudit(r.Context(), middleware.GetUserID(r), "update", "lesson", lessonID, nil)
	writeJSON(w, http.StatusOK, updated)
}

// ---------------------------------------------------------------------------
// DeleteLesson — DELETE /api/v1/courses/{courseId}/lessons/{id} (vendor_admin)
// ---------------------------------------------------------------------------

// DeleteLesson handles DELETE /api/v1/courses/{courseId}/lessons/{id}.
func (h *Handler) DeleteLesson(w http.ResponseWriter, r *http.Request) {
	lessonID := chi.URLParam(r, "id")

	svc := h.courseSvc()
	if err := svc.DeleteLesson(r.Context(), lessonID); err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "lesson not found")
			return
		}
		h.log.Error().Err(err).Str("lesson_id", lessonID).Msg("delete lesson failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to delete lesson")
		return
	}

	h.auditLog.WriteAudit(r.Context(), middleware.GetUserID(r), "delete", "lesson", lessonID, nil)
	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// GetCourseProgress — GET /api/v1/courses/{courseId}/progress/{userId}
// ---------------------------------------------------------------------------

// GetCourseProgress handles GET /api/v1/courses/{courseId}/progress/{userId}.
func (h *Handler) GetCourseProgress(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "courseId")
	targetUserID := chi.URLParam(r, "userId")
	callerID := middleware.GetUserID(r)
	callerRole := middleware.GetUserRole(r)

	// Users may only see their own progress unless they are vendor_admin or partner_admin.
	if callerID != targetUserID && callerRole != "vendor_admin" && callerRole != "partner_admin" {
		writeError(w, http.StatusForbidden, "forbidden", "you may only view your own progress")
		return
	}

	svc := h.courseSvc()
	pct, details, err := svc.GetCourseProgress(r.Context(), targetUserID, courseID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "course not found")
			return
		}
		h.log.Error().Err(err).Str("course_id", courseID).Msg("get course progress failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to retrieve progress")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user_id":        targetUserID,
		"course_id":      courseID,
		"completion_pct": pct,
		"lessons":        details,
	})
}

// ---------------------------------------------------------------------------
// CompleteLesson — POST /api/v1/courses/{courseId}/progress/complete-lesson
// ---------------------------------------------------------------------------

// CompleteLesson handles POST /api/v1/courses/{courseId}/progress/complete-lesson.
func (h *Handler) CompleteLesson(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "courseId")
	userID := middleware.GetUserID(r)

	var req models.CompleteLessonRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.LessonID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "lesson_id is required")
		return
	}

	svc := h.courseSvc()
	if err := svc.CompleteLesson(r.Context(), userID, req.LessonID); err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "lesson not found")
			return
		}
		h.log.Error().Err(err).Str("lesson_id", req.LessonID).Msg("complete lesson failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to mark lesson complete")
		return
	}

	// Check overall course completion to include in the response.
	pct, _, _ := svc.GetCourseProgress(r.Context(), userID, courseID)

	h.auditLog.WriteAudit(r.Context(), userID, "complete_lesson", "lesson", req.LessonID,
		map[string]interface{}{
			"course_id":       courseID,
			"time_spent_secs": req.TimeSpentSecs,
			"course_pct":      pct,
		})

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"lesson_id":      req.LessonID,
		"course_id":      courseID,
		"completion_pct": pct,
		"course_done":    pct == 100,
		"xp_awarded":     10,
	})
}
