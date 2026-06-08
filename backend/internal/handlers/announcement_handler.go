// Package handlers contains all HTTP handler functions for the partner portal API.
package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/1kosmos/partner-portal/internal/middleware"
	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/1kosmos/partner-portal/internal/services"
)

// announcementSvc returns an AnnouncementService wired to the handler's pool.
func (h *Handler) announcementSvc() *services.AnnouncementService {
	return services.NewAnnouncementService(h.pool, h.log)
}

// ListAnnouncements handles GET /api/v1/announcements.
// Returns all published announcements, pinned first, then by published_at DESC.
// Each item includes an is_read flag for the current user.
// The response header X-Unread-Count carries the total unread count.
func (h *Handler) ListAnnouncements(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(q.Get("pageSize"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	userID := middleware.GetUserID(r)
	svc := h.announcementSvc()

	items, total, unreadCount, err := svc.ListAnnouncements(r.Context(), userID, page, pageSize)
	if err != nil {
		h.log.Error().Err(err).Msg("list announcements")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to list announcements")
		return
	}

	w.Header().Set("X-Unread-Count", strconv.Itoa(unreadCount))

	type announcementListResponse struct {
		Data        interface{} `json:"data"`
		Total       int         `json:"total"`
		Page        int         `json:"page"`
		PageSize    int         `json:"page_size"`
		UnreadCount int         `json:"unread_count"`
	}

	writeJSON(w, http.StatusOK, announcementListResponse{
		Data:        items,
		Total:       total,
		Page:        page,
		PageSize:    pageSize,
		UnreadCount: unreadCount,
	})
}

// GetAnnouncement handles GET /api/v1/announcements/{id}.
func (h *Handler) GetAnnouncement(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	a, err := h.announcementSvc().GetAnnouncement(r.Context(), id)
	if err != nil {
		if err == repositories.ErrNotFound {
			writeError(w, http.StatusNotFound, "not_found", "announcement not found")
			return
		}
		h.log.Error().Err(err).Str("id", id).Msg("get announcement")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to get announcement")
		return
	}

	writeJSON(w, http.StatusOK, a)
}

// CreateAnnouncement handles POST /api/v1/announcements (vendor_admin only).
func (h *Handler) CreateAnnouncement(w http.ResponseWriter, r *http.Request) {
	var req services.CreateAnnouncementRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "title is required")
		return
	}
	if req.Body == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "body is required")
		return
	}
	if req.Category == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "category is required")
		return
	}
	if req.Priority == "" {
		req.Priority = "normal"
	}

	createdBy := middleware.GetUserID(r)
	a, err := h.announcementSvc().CreateAnnouncement(r.Context(), req, createdBy)
	if err != nil {
		h.log.Error().Err(err).Msg("create announcement")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to create announcement: "+err.Error())
		return
	}

	h.auditLog.WriteAudit(r.Context(), createdBy, "create", "announcement", a.ID.String(), map[string]interface{}{
		"title": a.Title,
	})
	writeJSON(w, http.StatusCreated, a)
}

// UpdateAnnouncement handles PUT /api/v1/announcements/{id} (vendor_admin only).
func (h *Handler) UpdateAnnouncement(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req services.UpdateAnnouncementRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	updated, err := h.announcementSvc().UpdateAnnouncement(r.Context(), id, req)
	if err != nil {
		if err == repositories.ErrNotFound {
			writeError(w, http.StatusNotFound, "not_found", "announcement not found")
			return
		}
		h.log.Error().Err(err).Str("id", id).Msg("update announcement")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to update announcement: "+err.Error())
		return
	}

	actorID := middleware.GetUserID(r)
	h.auditLog.WriteAudit(r.Context(), actorID, "update", "announcement", id, nil)
	writeJSON(w, http.StatusOK, updated)
}

// DeleteAnnouncement handles DELETE /api/v1/announcements/{id} (vendor_admin only).
// This is a soft delete — sets deleted_at so it no longer appears in listings.
func (h *Handler) DeleteAnnouncement(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.announcementSvc().DeleteAnnouncement(r.Context(), id); err != nil {
		if err == repositories.ErrNotFound {
			writeError(w, http.StatusNotFound, "not_found", "announcement not found")
			return
		}
		h.log.Error().Err(err).Str("id", id).Msg("delete announcement")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to delete announcement")
		return
	}

	actorID := middleware.GetUserID(r)
	h.auditLog.WriteAudit(r.Context(), actorID, "delete", "announcement", id, nil)
	w.WriteHeader(http.StatusNoContent)
}

// MarkAnnouncementRead handles POST /api/v1/announcements/{id}/read.
// Upserts an announcement_reads record for the current user.
func (h *Handler) MarkAnnouncementRead(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID := middleware.GetUserID(r)

	if err := h.announcementSvc().MarkRead(r.Context(), userID, id); err != nil {
		h.log.Error().Err(err).Str("id", id).Msg("mark announcement read")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to mark announcement as read")
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}
