// Package handlers contains all HTTP handler functions for the partner portal API.
package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/1kosmos/partner-portal/internal/middleware"
	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/1kosmos/partner-portal/internal/services"
)

// resourceSvc returns a ResourceService wired to the handler's pool.
func (h *Handler) resourceSvc() *services.ResourceService {
	return services.NewResourceService(h.pool, h.log)
}

// ListResources handles GET /api/v1/resources.
// Query params: type, tag, search, page, pageSize
func (h *Handler) ListResources(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(q.Get("pageSize"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	filter := services.ResourceFilter{
		Type:     q.Get("type"),
		Tag:      q.Get("tag"),
		Search:   q.Get("search"),
		Page:     page,
		PageSize: pageSize,
	}

	items, total, err := h.resourceSvc().ListResources(r.Context(), filter)
	if err != nil {
		h.log.Error().Err(err).Msg("list resources")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to list resources")
		return
	}

	writeJSON(w, http.StatusOK, models.PaginatedResponse[services.ResourceWithTags]{
		Data:     items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// GetResource handles GET /api/v1/resources/{id}.
// When ?download=true is present, an audit log entry is written and the
// storage_path is returned in the response body (no redirect).
func (h *Handler) GetResource(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	svc := h.resourceSvc()

	res, err := svc.GetResource(r.Context(), id)
	if err != nil {
		if err == repositories.ErrNotFound {
			writeError(w, http.StatusNotFound, "not_found", "resource not found")
			return
		}
		h.log.Error().Err(err).Str("id", id).Msg("get resource")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to get resource")
		return
	}

	// If ?download=true, log the event and surface the file URL explicitly.
	if r.URL.Query().Get("download") == "true" {
		actorID := middleware.GetUserID(r)
		if logErr := svc.LogDownload(r.Context(), id, actorID); logErr != nil {
			h.log.Warn().Err(logErr).Str("resource_id", id).Msg("failed to log download")
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"resource": res,
			"file_url": res.StoragePath,
		})
		return
	}

	writeJSON(w, http.StatusOK, res)
}

// CreateResource handles POST /api/v1/resources (vendor_admin only).
// Accepts JSON with a file_url / storage_path field; no multipart needed.
func (h *Handler) CreateResource(w http.ResponseWriter, r *http.Request) {
	var req models.CreateResourceRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "title is required")
		return
	}
	if req.ResourceType == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "resource_type is required")
		return
	}
	if req.StoragePath == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "storage_path (file_url) is required")
		return
	}

	uploaderID := middleware.GetUserID(r)
	res, err := h.resourceSvc().CreateResource(r.Context(), req, uploaderID)
	if err != nil {
		h.log.Error().Err(err).Msg("create resource")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to create resource")
		return
	}

	h.auditLog.WriteAudit(r.Context(), uploaderID, "create", "resource", res.ID.String(), map[string]interface{}{
		"title": res.Title,
	})
	writeJSON(w, http.StatusCreated, res)
}

// UpdateResource handles PUT /api/v1/resources/{id} (vendor_admin only).
func (h *Handler) UpdateResource(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req services.UpdateResourceRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	updated, err := h.resourceSvc().UpdateResource(r.Context(), id, req)
	if err != nil {
		if err == repositories.ErrNotFound {
			writeError(w, http.StatusNotFound, "not_found", "resource not found")
			return
		}
		h.log.Error().Err(err).Str("id", id).Msg("update resource")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to update resource")
		return
	}

	actorID := middleware.GetUserID(r)
	h.auditLog.WriteAudit(r.Context(), actorID, "update", "resource", id, nil)
	writeJSON(w, http.StatusOK, updated)
}

// DeleteResource handles DELETE /api/v1/resources/{id} (vendor_admin only).
func (h *Handler) DeleteResource(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.resourceSvc().DeleteResource(r.Context(), id); err != nil {
		if err == repositories.ErrNotFound {
			writeError(w, http.StatusNotFound, "not_found", "resource not found")
			return
		}
		h.log.Error().Err(err).Str("id", id).Msg("delete resource")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to delete resource")
		return
	}

	actorID := middleware.GetUserID(r)
	h.auditLog.WriteAudit(r.Context(), actorID, "delete", "resource", id, nil)
	w.WriteHeader(http.StatusNoContent)
}
