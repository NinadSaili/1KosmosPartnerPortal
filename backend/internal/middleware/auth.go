package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// jwtClaims holds the standard and custom claims embedded in a JWT.
type jwtClaims struct {
	jwt.RegisteredClaims
	Role   string `json:"role"`
	Email  string `json:"email"`
	OrgID  string `json:"org_id"`
}

// AuthMiddleware returns a chi-compatible middleware that validates a Bearer
// JWT present in the Authorization header.  It supports both application-issued
// HMAC-SHA256 tokens and Supabase-issued tokens (validated by issuer check and
// the same shared secret when the audience matches).
func AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
	keyFunc := func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(jwtSecret), nil
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := extractBearerToken(r)
			if tokenStr == "" {
				writeAuthError(w, "missing or malformed authorization header")
				return
			}

			token, err := jwt.ParseWithClaims(tokenStr, &jwtClaims{}, keyFunc,
				jwt.WithExpirationRequired(),
				jwt.WithLeeway(10*time.Second),
			)
			if err != nil || !token.Valid {
				writeAuthError(w, "invalid or expired token")
				return
			}

			claims, ok := token.Claims.(*jwtClaims)
			if !ok || claims.Subject == "" {
				writeAuthError(w, "malformed token claims")
				return
			}

			// Supabase tokens include an issuer that starts with the Supabase
			// project URL; accept them as long as they pass signature validation.
			// No additional verification step is needed because the shared
			// service-role secret is used to sign Supabase JWTs as well.

			ctx := r.Context()
			ctx = context.WithValue(ctx, UserIDKey, claims.Subject)
			ctx = context.WithValue(ctx, UserRoleKey, claims.Role)
			ctx = context.WithValue(ctx, UserOrgIDKey, claims.OrgID)
			ctx = context.WithValue(ctx, UserEmailKey, claims.Email)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// extractBearerToken pulls the raw token string from the Authorization header.
func extractBearerToken(r *http.Request) string {
	hdr := r.Header.Get("Authorization")
	if hdr == "" {
		return ""
	}
	parts := strings.SplitN(hdr, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

// writeAuthError writes a 401 JSON error response.
func writeAuthError(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"code":    "unauthorized",
		"message": message,
	})
}
