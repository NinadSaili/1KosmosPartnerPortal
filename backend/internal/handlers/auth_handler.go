package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/1kosmos/partner-portal/internal/middleware"
	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/1kosmos/partner-portal/internal/services"
	"github.com/1kosmos/partner-portal/pkg/validator"
)

// ---------------------------------------------------------------------------
// Helper: auth service accessor
// ---------------------------------------------------------------------------

func (h *Handler) authSvc() *services.AuthService {
	return services.NewAuthService(
		repositories.NewUserRepository(h.pool),
		h.cfg.SupabaseURL,
		h.cfg.SupabaseAnonKey,
	)
}

// ---------------------------------------------------------------------------
// Register — POST /api/v1/auth/register
// ---------------------------------------------------------------------------

// Register handles POST /api/v1/auth/register.
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	// Validate required fields.
	errs := validator.ValidateRequired(map[string]string{
		"email":     req.Email,
		"password":  req.Password,
		"full_name": req.FullName,
	})
	if errs != nil {
		if len(req.Email) > 0 && !validator.ValidateEmail(req.Email) {
			errs["email"] = "must be a valid email address"
		}
		writeJSON(w, http.StatusBadRequest, models.ErrorResponse{
			Code:    "validation_error",
			Message: "invalid request body",
			Details: errs,
		})
		return
	}
	if !validator.ValidateEmail(req.Email) {
		writeJSON(w, http.StatusBadRequest, models.ErrorResponse{
			Code:    "validation_error",
			Message: "invalid request body",
			Details: map[string]string{"email": "must be a valid email address"},
		})
		return
	}
	if len(req.Password) < 8 {
		writeJSON(w, http.StatusBadRequest, models.ErrorResponse{
			Code:    "validation_error",
			Message: "invalid request body",
			Details: map[string]string{"password": "must be at least 8 characters"},
		})
		return
	}

	svc := h.authSvc()

	// Create the Supabase auth user first.
	supabaseID, err := svc.CallSupabaseRegister(r.Context(), req.Email, req.Password)
	if err != nil {
		h.log.Error().Err(err).Msg("supabase register failed")
		if strings.Contains(err.Error(), "already registered") || strings.Contains(err.Error(), "422") {
			writeError(w, http.StatusConflict, "email_in_use", "an account with this email already exists")
			return
		}
		writeError(w, http.StatusBadGateway, "supabase_error", "failed to create auth account")
		return
	}

	// Build optional org UUID.
	createReq := services.CreateUserRequest{
		Email:      req.Email,
		FullName:   req.FullName,
		Role:       "partner_user",
		SupabaseID: supabaseID,
	}
	if req.OrganizationID != nil && *req.OrganizationID != "" {
		if !validator.ValidateUUID(*req.OrganizationID) {
			writeError(w, http.StatusBadRequest, "invalid_org_id", "organization_id must be a valid UUID")
			return
		}
		// parse handled inside CreateUser
	}

	user, err := svc.CreateUser(r.Context(), createReq)
	if err != nil {
		if errors.Is(err, repositories.ErrConflict) {
			writeError(w, http.StatusConflict, "email_in_use", "an account with this email already exists")
			return
		}
		h.log.Error().Err(err).Msg("create user failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to create user record")
		return
	}

	h.auditLog.WriteAudit(r.Context(), user.ID.String(), "register", "user", user.ID.String(), nil)
	writeJSON(w, http.StatusCreated, user)
}

// ---------------------------------------------------------------------------
// Login — POST /api/v1/auth/login
// ---------------------------------------------------------------------------

// Login handles POST /api/v1/auth/login.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "email and password are required")
		return
	}

	svc := h.authSvc()

	accessToken, refreshToken, err := svc.CallSupabaseLogin(r.Context(), req.Email, req.Password)
	if err != nil {
		h.log.Warn().Err(err).Str("email", req.Email).Msg("supabase login failed")
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "email or password is incorrect")
		return
	}

	// Fetch the portal user record for the response.
	user, err := repositories.NewUserRepository(h.pool).GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		h.log.Error().Err(err).Str("email", req.Email).Msg("user not found after successful auth")
		writeError(w, http.StatusUnauthorized, "user_not_found", "no portal account found for this email")
		return
	}

	h.auditLog.WriteAudit(r.Context(), user.ID.String(), "login", "user", user.ID.String(), nil)

	writeJSON(w, http.StatusOK, models.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    3600,
		User:         *user,
	})
}

// ---------------------------------------------------------------------------
// MagicLink — POST /api/v1/auth/magic-link
// ---------------------------------------------------------------------------

// MagicLink handles POST /api/v1/auth/magic-link.
func (h *Handler) MagicLink(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if !validator.ValidateEmail(body.Email) {
		writeError(w, http.StatusBadRequest, "validation_error", "a valid email address is required")
		return
	}

	svc := h.authSvc()
	if err := svc.CallSupabaseMagicLink(r.Context(), body.Email); err != nil {
		h.log.Error().Err(err).Str("email", body.Email).Msg("magic-link failed")
		writeError(w, http.StatusBadGateway, "supabase_error", "failed to send magic link")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "magic link sent"})
}

// ---------------------------------------------------------------------------
// RefreshToken — POST /api/v1/auth/refresh
// ---------------------------------------------------------------------------

// RefreshToken handles POST /api/v1/auth/refresh.
func (h *Handler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "refresh_token is required")
		return
	}

	svc := h.authSvc()
	accessToken, newRefresh, err := svc.CallSupabaseRefresh(r.Context(), body.RefreshToken)
	if err != nil {
		h.log.Warn().Err(err).Msg("token refresh failed")
		writeError(w, http.StatusUnauthorized, "invalid_token", "refresh token is invalid or expired")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"access_token":  accessToken,
		"refresh_token": newRefresh,
	})
}

// ---------------------------------------------------------------------------
// GetProfile — GET /api/v1/users/{id}
// ---------------------------------------------------------------------------

// GetUser handles GET /api/v1/users/{id}.
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	targetID := chi.URLParam(r, "id")
	callerID := middleware.GetUserID(r)
	callerRole := middleware.GetUserRole(r)

	// Only the user themselves or a vendor_admin may read a profile.
	if callerID != targetID && callerRole != "vendor_admin" {
		writeError(w, http.StatusForbidden, "forbidden", "you may only view your own profile")
		return
	}

	user, err := repositories.NewUserRepository(h.pool).GetUserByID(r.Context(), targetID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to fetch user")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// ---------------------------------------------------------------------------
// UpdateProfile — PUT /api/v1/users/{id}
// ---------------------------------------------------------------------------

// UpdateUser handles PUT /api/v1/users/{id}.
func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	targetID := chi.URLParam(r, "id")
	callerID := middleware.GetUserID(r)
	callerRole := middleware.GetUserRole(r)

	if callerID != targetID && callerRole != "vendor_admin" {
		writeError(w, http.StatusForbidden, "forbidden", "you may only update your own profile")
		return
	}

	var body struct {
		FullName  *string `json:"full_name,omitempty"`
		Title     *string `json:"title,omitempty"`
		Phone     *string `json:"phone,omitempty"`
		AvatarURL *string `json:"avatar_url,omitempty"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	svc := h.authSvc()
	updated, err := svc.UpdateUser(r.Context(), targetID, services.UpdateUserRequest{
		FullName:  body.FullName,
		Title:     body.Title,
		Phone:     body.Phone,
		AvatarURL: body.AvatarURL,
	})
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to update user")
		return
	}

	h.auditLog.WriteAudit(r.Context(), callerID, "update", "user", targetID, nil)
	writeJSON(w, http.StatusOK, updated)
}

// ---------------------------------------------------------------------------
// DeleteUser — DELETE /api/v1/users/{id}
// ---------------------------------------------------------------------------

// DeleteUser handles DELETE /api/v1/users/{id}.
func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	targetID := chi.URLParam(r, "id")
	callerRole := middleware.GetUserRole(r)
	if callerRole != "vendor_admin" {
		writeError(w, http.StatusForbidden, "forbidden", "only vendor_admin may delete users")
		return
	}

	if err := repositories.NewUserRepository(h.pool).DeleteUser(r.Context(), targetID); err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to delete user")
		return
	}

	h.auditLog.WriteAudit(r.Context(), middleware.GetUserID(r), "delete", "user", targetID, nil)
	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// ListUsers — GET /api/v1/users
// ---------------------------------------------------------------------------

// ListUsers handles GET /api/v1/users.
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	callerRole := middleware.GetUserRole(r)
	callerOrgID := middleware.GetUserOrgID(r)

	// Determine orgID filter scope.
	var filterOrgID string
	switch callerRole {
	case "vendor_admin":
		// vendor_admin can optionally filter by org via query param.
		filterOrgID = r.URL.Query().Get("org_id")
	case "partner_admin":
		filterOrgID = callerOrgID
	default:
		writeError(w, http.StatusForbidden, "forbidden", "insufficient permissions to list users")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	roleFilter := r.URL.Query().Get("role")

	svc := h.authSvc()
	users, total, err := svc.ListUsers(r.Context(), filterOrgID, roleFilter, page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to list users")
		return
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	writeJSON(w, http.StatusOK, models.PaginatedResponse[models.User]{
		Data:     users,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}
