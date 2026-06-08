package handlers

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/1kosmos/partner-portal/internal/middleware"
	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/1kosmos/partner-portal/internal/services"
)

// onboardingSvc builds an OnboardingService wired to the handler's pool.
func (h *Handler) onboardingSvc() *services.OnboardingService {
	return services.NewOnboardingService(repositories.NewOnboardingRepository(h.pool))
}

// ---------------------------------------------------------------------------
// GetOnboarding — GET /api/v1/onboarding/{orgId}
// ---------------------------------------------------------------------------

// GetOnboarding handles GET /api/v1/onboarding/{orgId}.
// Returns the onboarding checklist for an organisation; creates a default
// blank record if none exists yet.
func (h *Handler) GetOnboarding(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "orgId")
	callerRole := middleware.GetUserRole(r)
	callerOrgID := middleware.GetUserOrgID(r)

	// Partners may only see their own org's checklist.
	if callerRole != "vendor_admin" && callerOrgID != orgID {
		writeError(w, http.StatusForbidden, "forbidden", "you may only view your own organisation's onboarding checklist")
		return
	}

	svc := h.onboardingSvc()
	checklist, err := svc.GetOrCreateChecklist(r.Context(), orgID)
	if err != nil {
		h.log.Error().Err(err).Str("org_id", orgID).Msg("get onboarding failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to retrieve onboarding checklist")
		return
	}

	type response struct {
		Checklist       interface{} `json:"checklist"`
		ReadyToDealReg  bool        `json:"ready_to_deal_register"`
	}
	writeJSON(w, http.StatusOK, response{
		Checklist:      checklist,
		ReadyToDealReg: svc.IsReadyToDealRegister(checklist),
	})
}

// ---------------------------------------------------------------------------
// UpdateOnboarding — PUT /api/v1/onboarding/{orgId}
// ---------------------------------------------------------------------------

// UpdateOnboarding handles PUT /api/v1/onboarding/{orgId}.
// vendor_admin or partner_admin of the target org may update the checklist.
func (h *Handler) UpdateOnboarding(w http.ResponseWriter, r *http.Request) {
	orgID := chi.URLParam(r, "orgId")
	callerRole := middleware.GetUserRole(r)
	callerOrgID := middleware.GetUserOrgID(r)

	// Access control: vendor_admin can update any org; partner_admin only their own.
	switch callerRole {
	case "vendor_admin":
		// allowed
	case "partner_admin":
		if callerOrgID != orgID {
			writeError(w, http.StatusForbidden, "forbidden", "you may only update your own organisation's onboarding checklist")
			return
		}
	default:
		writeError(w, http.StatusForbidden, "forbidden", "insufficient permissions to update onboarding checklist")
		return
	}

	var body struct {
		ProfileCompleted    *bool `json:"profile_completed,omitempty"`
		ContractSigned      *bool `json:"contract_signed,omitempty"`
		TrainingCompleted   *bool `json:"training_completed,omitempty"`
		CertificationEarned *bool `json:"certification_earned,omitempty"`
		PortalAccessGranted *bool `json:"portal_access_granted,omitempty"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	svc := h.onboardingSvc()
	updated, err := svc.UpdateChecklist(r.Context(), orgID, services.UpdateChecklistRequest{
		ProfileCompleted:    body.ProfileCompleted,
		ContractSigned:      body.ContractSigned,
		TrainingCompleted:   body.TrainingCompleted,
		CertificationEarned: body.CertificationEarned,
		PortalAccessGranted: body.PortalAccessGranted,
	})
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "organisation not found")
			return
		}
		h.log.Error().Err(err).Str("org_id", orgID).Msg("update onboarding failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to update onboarding checklist")
		return
	}

	h.auditLog.WriteAudit(r.Context(), middleware.GetUserID(r), "update", "onboarding_checklist", orgID, nil)

	type response struct {
		Checklist      interface{} `json:"checklist"`
		ReadyToDealReg bool        `json:"ready_to_deal_register"`
	}
	writeJSON(w, http.StatusOK, response{
		Checklist:      updated,
		ReadyToDealReg: svc.IsReadyToDealRegister(updated),
	})
}
