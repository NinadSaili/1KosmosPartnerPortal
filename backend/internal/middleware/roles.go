package middleware

import (
	"encoding/json"
	"net/http"
)

// contextKey is an unexported type used for all context value keys in this
// package.  Using a dedicated type prevents collisions with keys from other
// packages.
type contextKey int

const (
	// UserIDKey is the context key for the authenticated user's UUID string.
	UserIDKey contextKey = iota
	// UserRoleKey is the context key for the authenticated user's role string.
	UserRoleKey
	// UserOrgIDKey is the context key for the authenticated user's organisation UUID string.
	UserOrgIDKey
	// UserEmailKey is the context key for the authenticated user's email address.
	UserEmailKey
)

// RequireRole returns a middleware that allows the request to proceed only when
// the authenticated user's role (set by AuthMiddleware) is one of the provided
// roles.  It returns 403 Forbidden otherwise.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role := GetUserRole(r)
			if _, ok := allowed[role]; !ok {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"code":    "forbidden",
					"message": "you do not have permission to access this resource",
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// GetUserID returns the authenticated user's ID from the request context.
// Returns an empty string if not set.
func GetUserID(r *http.Request) string {
	v, _ := r.Context().Value(UserIDKey).(string)
	return v
}

// GetUserRole returns the authenticated user's role from the request context.
// Returns an empty string if not set.
func GetUserRole(r *http.Request) string {
	v, _ := r.Context().Value(UserRoleKey).(string)
	return v
}

// GetUserOrgID returns the authenticated user's organisation ID from the
// request context.  Returns an empty string if not set.
func GetUserOrgID(r *http.Request) string {
	v, _ := r.Context().Value(UserOrgIDKey).(string)
	return v
}

// GetUserEmail returns the authenticated user's email from the request context.
// Returns an empty string if not set.
func GetUserEmail(r *http.Request) string {
	v, _ := r.Context().Value(UserEmailKey).(string)
	return v
}
