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

	checklist.ReadyToDealRegister = svc.IsReadyToDealRegister(checklist)
	writeJSON(w, http.StatusOK, checklist)
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
		MndaSigned                  *bool `json:"mnda_signed,omitempty"`
		ResellerAgreementSigned     *bool `json:"reseller_agreement_signed,omitempty"`
		AccountMappingDone          *bool `json:"account_mapping_done,omitempty"`
		SalesEnablementComplete     *bool `json:"sales_enablement_complete,omitempty"`
		TechnicalEnablementComplete *bool `json:"technical_enablement_complete,omitempty"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	svc := h.onboardingSvc()
	updated, err := svc.UpdateChecklist(r.Context(), orgID, services.UpdateChecklistRequest{
		MndaSigned:                  body.MndaSigned,
		ResellerAgreementSigned:     body.ResellerAgreementSigned,
		AccountMappingDone:          body.AccountMappingDone,
		SalesEnablementComplete:     body.SalesEnablementComplete,
		TechnicalEnablementComplete: body.TechnicalEnablementComplete,
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

	updated.ReadyToDealRegister = svc.IsReadyToDealRegister(updated)
	writeJSON(w, http.StatusOK, updated)
}
