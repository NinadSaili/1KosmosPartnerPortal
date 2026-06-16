// Package handlers contains all HTTP handler functions for the partner portal API.
package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/1kosmos/partner-portal/internal/middleware"
	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/1kosmos/partner-portal/internal/services"
	"github.com/1kosmos/partner-portal/pkg/email"
)

// dealSvc returns a DealService wired to the handler's dependencies.
func (h *Handler) dealSvc() *services.DealService {
	var emailClient *email.EmailClient
	if h.cfg.SendGridAPIKey != "" {
		emailClient = email.NewEmailClient(h.cfg.SendGridAPIKey, h.cfg.FromEmail)
	}
	return services.NewDealService(h.pool, emailClient, zerolog.Logger(h.log))
}

// ListDeals handles GET /api/v1/deals.
// Filters: status, search (company_name). Visibility is role-dependent.
func (h *Handler) ListDeals(w http.ResponseWriter, r *http.Request) {
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
	userRole := middleware.GetUserRole(r)
	orgID := middleware.GetUserOrgID(r)
	status := q.Get("status")
	search := q.Get("search")

	deals, total, err := h.dealSvc().ListDeals(r.Context(), userID, userRole, orgID, status, search, page, pageSize)
	if err != nil {
		h.log.Error().Err(err).Msg("list deals")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to list deals")
		return
	}

	if deals == nil {
		deals = []models.Deal{}
	}
	writeJSON(w, http.StatusOK, models.PaginatedResponse[models.Deal]{
		Data:     deals,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// GetDeal handles GET /api/v1/deals/{id}.
// Returns full deal detail including documents and status history.
// Enforces ownership/org visibility per caller's role.
func (h *Handler) GetDeal(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID := middleware.GetUserID(r)
	userRole := middleware.GetUserRole(r)
	orgID := middleware.GetUserOrgID(r)

	detail, err := h.dealSvc().GetDeal(r.Context(), id, userID, userRole, orgID)
	if err != nil {
		if err == repositories.ErrNotFound {
			writeError(w, http.StatusNotFound, "not_found", "deal not found")
			return
		}
		h.log.Error().Err(err).Str("id", id).Msg("get deal")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to get deal")
		return
	}

	writeJSON(w, http.StatusOK, detail)
}

// CreateDeal handles POST /api/v1/deals.
// Available to partner_user and partner_admin. Initial status is "draft".
// Documents may be attached inline via the documents array (storage URLs).
func (h *Handler) CreateDeal(w http.ResponseWriter, r *http.Request) {
	var req services.CreateDealRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	// Required field validation
	if req.CompanyName == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "company_name is required")
		return
	}
	if req.ContactName == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "contact_name is required")
		return
	}
	if req.ContactEmail == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "contact_email is required")
		return
	}
	if req.Vertical == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "vertical is required")
		return
	}
	if req.ExpectedCloseDate == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "expected_close_date is required")
		return
	}

	submitterID := middleware.GetUserID(r)
	orgID := middleware.GetUserOrgID(r)

	deal, err := h.dealSvc().CreateDeal(r.Context(), req, submitterID, orgID)
	if err != nil {
		h.log.Error().Err(err).Msg("create deal")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to create deal: "+err.Error())
		return
	}

	h.auditLog.WriteAudit(r.Context(), submitterID, "create", "deal", deal.ID.String(), map[string]interface{}{
		"company_name": deal.CompanyName,
		"status":       deal.Status,
	})
	writeJSON(w, http.StatusCreated, deal)
}

// UpdateDeal handles PUT /api/v1/deals/{id}.
// Only the submitter can update a draft deal; vendor_admin can update any deal.
func (h *Handler) UpdateDeal(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req services.UpdateDealRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	actorID := middleware.GetUserID(r)
	actorRole := middleware.GetUserRole(r)

	updated, err := h.dealSvc().UpdateDeal(r.Context(), id, req, actorID, actorRole)
	if err != nil {
		if err == repositories.ErrNotFound {
			writeError(w, http.StatusNotFound, "not_found", "deal not found")
			return
		}
		h.log.Error().Err(err).Str("id", id).Msg("update deal")
		writeError(w, http.StatusBadRequest, "update_error", err.Error())
		return
	}

	h.auditLog.WriteAudit(r.Context(), actorID, "update", "deal", id, nil)
	writeJSON(w, http.StatusOK, updated)
}

// UpdateDealStatus handles PATCH /api/v1/deals/{id}/status.
// Validates transition rules:
//
//	draft → submitted         (submitter)
//	submitted → under_review  (vendor_admin)
//	under_review → approved   (vendor_admin)
//	under_review → rejected   (vendor_admin)
//	rejected → submitted      (submitter, for resubmission)
//
// Sends an email notification on every transition.
func (h *Handler) UpdateDealStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req models.UpdateDealStatusRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.Status == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "status is required")
		return
	}

	actorID := middleware.GetUserID(r)
	actorRole := middleware.GetUserRole(r)

	comment := ""
	if req.Comment != nil {
		comment = *req.Comment
	}

	updated, err := h.dealSvc().UpdateStatus(r.Context(), id, req.Status, actorID, actorRole, comment)
	if err != nil {
		if err == repositories.ErrNotFound {
			writeError(w, http.StatusNotFound, "not_found", "deal not found")
			return
		}
		h.log.Error().Err(err).Str("id", id).Msg("update deal status")
		writeError(w, http.StatusBadRequest, "transition_error", err.Error())
		return
	}

	h.auditLog.WriteAudit(r.Context(), actorID, "status_change", "deal", id, map[string]interface{}{
		"new_status": req.Status,
	})
	writeJSON(w, http.StatusOK, updated)
}
