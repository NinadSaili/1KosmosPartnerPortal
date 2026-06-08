// Package handlers contains all HTTP handler functions for the partner portal
// API.  Each handler is a method on the *Handler type so that shared
// dependencies (database pool, config, logger, audit logger) are easily
// accessible without global state.
//
// Handler methods are split across multiple files in this package:
//
//	handlers.go           – Handler struct, New(), shared helpers, and
//	                        handlers not covered by the files below.
//	auth_handler.go       – /auth/*, /users/*
//	course_handler.go     – /courses/*, /courses/{id}/lessons/*, /courses/{id}/progress/*
//	dashboard_handler.go  – /dashboard/*
//	deal_handler.go       – /deals/*
//	announcement_handler.go – /announcements/*
//	onboarding_handler.go – /onboarding/*
//	resource_handler.go   – /resources/*
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/1kosmos/partner-portal/internal/config"
	"github.com/1kosmos/partner-portal/internal/middleware"
	"github.com/1kosmos/partner-portal/internal/models"
)

// Handler is the top-level handler container.  All route handler methods are
// defined on this type (split across multiple files in this package).
type Handler struct {
	pool     *pgxpool.Pool
	cfg      *config.Config
	log      zerolog.Logger
	auditLog *middleware.AuditLogger
}

// New constructs a Handler with its required dependencies.
func New(
	pool *pgxpool.Pool,
	cfg *config.Config,
	log zerolog.Logger,
	auditLog *middleware.AuditLogger,
) *Handler {
	return &Handler{
		pool:     pool,
		cfg:      cfg,
		log:      log,
		auditLog: auditLog,
	}
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// writeJSON serialises v to JSON and writes it with the given status code.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeError writes a standard ErrorResponse JSON body.
func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, models.ErrorResponse{Code: code, Message: message})
}

// decodeJSON decodes the request body into v.  Returns false and writes a 400
// if decoding fails.
func decodeJSON(w http.ResponseWriter, r *http.Request, v interface{}) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "request body is not valid JSON: "+err.Error())
		return false
	}
	return true
}

// ---------------------------------------------------------------------------
// Organization handlers
// ---------------------------------------------------------------------------

// ListOrganizations handles GET /api/v1/organizations.
func (h *Handler) ListOrganizations(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "list organizations not yet implemented")
}

// GetOrganization handles GET /api/v1/organizations/{id}.
func (h *Handler) GetOrganization(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "get organization not yet implemented")
}

// CreateOrganization handles POST /api/v1/organizations.
func (h *Handler) CreateOrganization(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "create organization not yet implemented")
}

// UpdateOrganization handles PUT /api/v1/organizations/{id}.
func (h *Handler) UpdateOrganization(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "update organization not yet implemented")
}

// ---------------------------------------------------------------------------
// Resource handlers (stub — not yet implemented)
// ---------------------------------------------------------------------------

// ListResources handles GET /api/v1/resources.
func (h *Handler) ListResources(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "list resources not yet implemented")
}

// GetResource handles GET /api/v1/resources/{id}.
func (h *Handler) GetResource(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "get resource not yet implemented")
}

// CreateResource handles POST /api/v1/resources (vendor_admin).
func (h *Handler) CreateResource(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "create resource not yet implemented")
}

// UpdateResource handles PUT /api/v1/resources/{id} (vendor_admin).
func (h *Handler) UpdateResource(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "update resource not yet implemented")
}

// DeleteResource handles DELETE /api/v1/resources/{id} (vendor_admin).
func (h *Handler) DeleteResource(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "delete resource not yet implemented")
}

// ---------------------------------------------------------------------------
// Deal handlers (stub — not yet implemented)
// ---------------------------------------------------------------------------

// ListDeals handles GET /api/v1/deals.
func (h *Handler) ListDeals(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "list deals not yet implemented")
}

// GetDeal handles GET /api/v1/deals/{id}.
func (h *Handler) GetDeal(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "get deal not yet implemented")
}

// CreateDeal handles POST /api/v1/deals.
func (h *Handler) CreateDeal(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "create deal not yet implemented")
}

// UpdateDeal handles PUT /api/v1/deals/{id}.
func (h *Handler) UpdateDeal(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "update deal not yet implemented")
}

// UpdateDealStatus handles PATCH /api/v1/deals/{id}/status (vendor_admin).
func (h *Handler) UpdateDealStatus(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "update deal status not yet implemented")
}

// ---------------------------------------------------------------------------
// Announcement handlers (stub — not yet implemented)
// ---------------------------------------------------------------------------

// ListAnnouncements handles GET /api/v1/announcements.
func (h *Handler) ListAnnouncements(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "list announcements not yet implemented")
}

// GetAnnouncement handles GET /api/v1/announcements/{id}.
func (h *Handler) GetAnnouncement(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "get announcement not yet implemented")
}

// CreateAnnouncement handles POST /api/v1/announcements (vendor_admin).
func (h *Handler) CreateAnnouncement(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "create announcement not yet implemented")
}

// UpdateAnnouncement handles PUT /api/v1/announcements/{id} (vendor_admin).
func (h *Handler) UpdateAnnouncement(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "update announcement not yet implemented")
}

// DeleteAnnouncement handles DELETE /api/v1/announcements/{id} (vendor_admin).
func (h *Handler) DeleteAnnouncement(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "delete announcement not yet implemented")
}

// MarkAnnouncementRead handles POST /api/v1/announcements/{id}/read.
func (h *Handler) MarkAnnouncementRead(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "mark announcement read not yet implemented")
}

// ---------------------------------------------------------------------------
// AI handler (stub — not yet implemented)
// ---------------------------------------------------------------------------

// AIQuery handles POST /api/v1/ai/query.
func (h *Handler) AIQuery(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "AI query not yet implemented")
}

// ---------------------------------------------------------------------------
// Admin handlers
// ---------------------------------------------------------------------------

// ProvisionUser handles POST /api/v1/admin/users/provision (vendor_admin).
func (h *Handler) ProvisionUser(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "provision user not yet implemented")
}

// GetAuditLog handles GET /api/v1/admin/users/audit-log (vendor_admin).
func (h *Handler) GetAuditLog(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not_implemented", "audit log not yet implemented")
}
