package middleware

import (
	"net/http"

	chiCors "github.com/go-chi/cors"
)

// CORSMiddleware returns a chi-compatible CORS middleware configured for the
// partner portal.  Allowed origins are taken from configuration; all standard
// portal headers and methods are permitted.
func CORSMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	// Default to allowing all origins when none are configured (useful for
	// local development), while still being explicit in production.
	origins := allowedOrigins
	if len(origins) == 0 {
		origins = []string{"*"}
	}

	return chiCors.Handler(chiCors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           300, // seconds; browsers cache the preflight response
	})
}
