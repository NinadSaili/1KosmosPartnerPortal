package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/google/uuid"
)

// CreateUserRequest holds the fields needed to create a new portal user.
type CreateUserRequest struct {
	Email          string
	FullName       string
	Role           string
	OrganizationID *uuid.UUID
	SupabaseID     string // pre-created Supabase auth user ID
}

// UpdateUserRequest holds the updatable profile fields.
type UpdateUserRequest struct {
	FullName  *string
	Title     *string
	Phone     *string
	AvatarURL *string
}

// AuthService provides authentication and user-management operations.
type AuthService struct {
	userRepo    *repositories.UserRepository
	supabaseURL string
	anonKey     string
}

// NewAuthService constructs an AuthService.
func NewAuthService(userRepo *repositories.UserRepository, supabaseURL, anonKey string) *AuthService {
	return &AuthService{
		userRepo:    userRepo,
		supabaseURL: supabaseURL,
		anonKey:     anonKey,
	}
}

// ---------------------------------------------------------------------------
// User CRUD
// ---------------------------------------------------------------------------

// CreateUser inserts a new user record after validating email uniqueness.
func (s *AuthService) CreateUser(ctx context.Context, req CreateUserRequest) (*models.User, error) {
	existing, err := s.userRepo.GetUserByEmail(ctx, req.Email)
	if err != nil && !errors.Is(err, repositories.ErrNotFound) {
		return nil, fmt.Errorf("auth_service: check email: %w", err)
	}
	if existing != nil {
		return nil, repositories.ErrConflict
	}

	id := uuid.New()
	if req.SupabaseID != "" {
		parsed, parseErr := uuid.Parse(req.SupabaseID)
		if parseErr == nil {
			id = parsed
		}
	}

	role := req.Role
	if role == "" {
		role = "partner_user"
	}

	user := &models.User{
		ID:             id,
		Email:          req.Email,
		FullName:       req.FullName,
		Role:           role,
		OrganizationID: req.OrganizationID,
		IsActive:       true,
	}

	return s.userRepo.CreateUser(ctx, user)
}

// GetUser fetches a user by ID.
func (s *AuthService) GetUser(ctx context.Context, id string) (*models.User, error) {
	return s.userRepo.GetUserByID(ctx, id)
}

// UpdateUser updates the profile fields that are non-nil in the request.
// It sets profile_completed=true when all required fields are present.
func (s *AuthService) UpdateUser(ctx context.Context, id string, req UpdateUserRequest) (*models.User, error) {
	updates := make(map[string]any)
	if req.FullName != nil {
		updates["full_name"] = *req.FullName
	}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Phone != nil {
		updates["phone"] = *req.Phone
	}
	if req.AvatarURL != nil {
		updates["avatar_url"] = *req.AvatarURL
	}

	// Fetch current user to evaluate completeness after applying updates.
	current, err := s.userRepo.GetUserByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("auth_service: get current user: %w", err)
	}

	// Determine effective field values (merge incoming updates over current).
	effectiveFullName := current.FullName
	if req.FullName != nil {
		effectiveFullName = *req.FullName
	}
	effectiveTitle := current.Title
	if req.Title != nil {
		effectiveTitle = req.Title
	}
	effectivePhone := current.Phone
	if req.Phone != nil {
		effectivePhone = req.Phone
	}

	// Profile is complete when full_name, title, and phone are all set.
	if effectiveFullName != "" && effectiveTitle != nil && *effectiveTitle != "" &&
		effectivePhone != nil && *effectivePhone != "" {
		updates["profile_completed"] = true
	}

	return s.userRepo.UpdateUser(ctx, id, updates)
}

// ListUsers returns a paginated list of users, filtered by org and/or role.
func (s *AuthService) ListUsers(ctx context.Context, orgID string, role string, page, pageSize int) ([]models.User, int, error) {
	if pageSize <= 0 {
		pageSize = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * pageSize

	var orgPtr, rolePtr *string
	if orgID != "" {
		orgPtr = &orgID
	}
	if role != "" {
		rolePtr = &role
	}

	return s.userRepo.ListUsers(ctx, orgPtr, rolePtr, offset, pageSize)
}

// ---------------------------------------------------------------------------
// Supabase Auth proxy calls
// ---------------------------------------------------------------------------

type supabaseSignupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type supabaseSignupResponse struct {
	ID string `json:"id"`
}

// CallSupabaseRegister creates a user in Supabase auth and returns the new user UUID.
func (s *AuthService) CallSupabaseRegister(ctx context.Context, email, password string) (string, error) {
	body, _ := json.Marshal(supabaseSignupRequest{Email: email, Password: password})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		s.supabaseURL+"/auth/v1/signup",
		bytes.NewReader(body),
	)
	if err != nil {
		return "", fmt.Errorf("supabase register: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.anonKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("supabase register: http: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("supabase register: unexpected status %d: %s", resp.StatusCode, string(raw))
	}

	var out supabaseSignupResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", fmt.Errorf("supabase register: decode response: %w", err)
	}
	if out.ID == "" {
		return "", fmt.Errorf("supabase register: empty user id in response")
	}
	return out.ID, nil
}

type supabaseTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

// CallSupabaseLogin authenticates with Supabase and returns access + refresh tokens.
func (s *AuthService) CallSupabaseLogin(ctx context.Context, email, password string) (string, string, error) {
	body, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": password,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		s.supabaseURL+"/auth/v1/token?grant_type=password",
		bytes.NewReader(body),
	)
	if err != nil {
		return "", "", fmt.Errorf("supabase login: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.anonKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("supabase login: http: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("supabase login: unexpected status %d: %s", resp.StatusCode, string(raw))
	}

	var out supabaseTokenResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", "", fmt.Errorf("supabase login: decode response: %w", err)
	}
	return out.AccessToken, out.RefreshToken, nil
}

// CallSupabaseMagicLink sends a magic-link email via Supabase.
func (s *AuthService) CallSupabaseMagicLink(ctx context.Context, email string) error {
	body, _ := json.Marshal(map[string]string{"email": email})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		s.supabaseURL+"/auth/v1/magiclink",
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("supabase magic-link: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.anonKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("supabase magic-link: http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase magic-link: unexpected status %d: %s", resp.StatusCode, string(raw))
	}
	return nil
}

// CallSupabaseRefresh exchanges a refresh token for a new access token.
func (s *AuthService) CallSupabaseRefresh(ctx context.Context, refreshToken string) (string, string, error) {
	body, _ := json.Marshal(map[string]string{"refresh_token": refreshToken})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		s.supabaseURL+"/auth/v1/token?grant_type=refresh_token",
		bytes.NewReader(body),
	)
	if err != nil {
		return "", "", fmt.Errorf("supabase refresh: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.anonKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("supabase refresh: http: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("supabase refresh: unexpected status %d: %s", resp.StatusCode, string(raw))
	}

	var out supabaseTokenResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", "", fmt.Errorf("supabase refresh: decode response: %w", err)
	}
	return out.AccessToken, out.RefreshToken, nil
}

// ensure time is imported (used implicitly via repositories timestamps)
var _ = time.Now
