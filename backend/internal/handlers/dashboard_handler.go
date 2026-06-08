package handlers

import (
	"net/http"

	"github.com/1kosmos/partner-portal/internal/middleware"
	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/1kosmos/partner-portal/internal/services"
)

// dashboardSvc builds a DashboardService wired to the handler's pool.
func (h *Handler) dashboardSvc() *services.DashboardService {
	return services.NewDashboardService(repositories.NewDashboardRepository(h.pool))
}

// ---------------------------------------------------------------------------
// GetDashboardStats — GET /api/v1/dashboard/stats
// ---------------------------------------------------------------------------

// GetDashboardStats handles GET /api/v1/dashboard/stats.
//
//   - vendor_admin: global stats
//   - partner_admin: org-scoped stats
//   - partner_user: personal stats
func (h *Handler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	userRole := middleware.GetUserRole(r)
	orgID := middleware.GetUserOrgID(r)

	svc := h.dashboardSvc()
	stats, err := svc.GetStats(r.Context(), userID, userRole, orgID)
	if err != nil {
		h.log.Error().Err(err).Str("user_id", userID).Msg("get dashboard stats failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to retrieve dashboard statistics")
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

// ---------------------------------------------------------------------------
// GetTeamProgress — GET /api/v1/dashboard/team-progress
// ---------------------------------------------------------------------------

// GetTeamProgress handles GET /api/v1/dashboard/team-progress.
// Available to partner_admin and vendor_admin.
func (h *Handler) GetTeamProgress(w http.ResponseWriter, r *http.Request) {
	userRole := middleware.GetUserRole(r)
	orgID := middleware.GetUserOrgID(r)

	// vendor_admin may supply an org_id query param to inspect any org.
	if userRole == "vendor_admin" {
		if qOrgID := r.URL.Query().Get("org_id"); qOrgID != "" {
			orgID = qOrgID
		}
	}

	if orgID == "" {
		writeError(w, http.StatusBadRequest, "missing_org", "org_id is required for team progress")
		return
	}

	svc := h.dashboardSvc()
	progress, err := svc.GetTeamProgress(r.Context(), orgID)
	if err != nil {
		h.log.Error().Err(err).Str("org_id", orgID).Msg("get team progress failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to retrieve team progress")
		return
	}

	// Return an empty slice rather than null when there are no users.
	if progress == nil {
		progress = []repositories.UserProgress{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"org_id": orgID,
		"data":   progress,
	})
}
