package router

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/1kosmos/partner-portal/internal/config"
	"github.com/1kosmos/partner-portal/internal/handlers"
	"github.com/1kosmos/partner-portal/internal/middleware"
)

// New builds and returns a fully configured chi.Router.
func New(cfg *config.Config, pool *pgxpool.Pool, log zerolog.Logger) chi.Router {
	r := chi.NewRouter()

	// ---------------------------------------------------------------------------
	// Global middleware
	// ---------------------------------------------------------------------------
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(middleware.CORSMiddleware(cfg.AllowedOrigins))

	// ---------------------------------------------------------------------------
	// Handler dependencies
	// ---------------------------------------------------------------------------
	auditLog := middleware.NewAuditLogger(pool, log)
	h := handlers.New(pool, cfg, log, auditLog)

	// ---------------------------------------------------------------------------
	// Public routes
	// ---------------------------------------------------------------------------
	r.Get("/api/v1/health", healthHandler)

	// Swagger UI — serve static assets under /swagger/
	r.Get("/swagger/*", swaggerHandler)

	// ---------------------------------------------------------------------------
	// Auth routes (no JWT, rate-limited)
	// ---------------------------------------------------------------------------
	r.Route("/api/v1/auth", func(r chi.Router) {
		r.Use(middleware.RateLimiter(30)) // 30 req/min per IP on auth endpoints
		r.Post("/register", h.Register)
		r.Post("/login", h.Login)
		r.Post("/magic-link", h.MagicLink)
		r.Post("/refresh", h.RefreshToken)
	})

	// ---------------------------------------------------------------------------
	// Protected routes — JWT required
	// ---------------------------------------------------------------------------
	auth := middleware.AuthMiddleware(cfg.JWTSecret)

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(auth)

		// Users
		r.Route("/users", func(r chi.Router) {
			r.With(middleware.RequireRole("vendor_admin")).Get("/", h.ListUsers)
			r.Get("/{id}", h.GetUser)
			r.Put("/{id}", h.UpdateUser)
			r.Put("/{id}/password", h.UpdatePassword)
			r.Delete("/{id}", h.DeleteUser)
		})

		// Organizations
		r.Route("/organizations", func(r chi.Router) {
			r.Get("/", h.ListOrganizations)
			r.Get("/{id}", h.GetOrganization)
			r.Post("/", h.CreateOrganization)
			r.Put("/{id}", h.UpdateOrganization)
		})

		// Onboarding
		r.Route("/onboarding", func(r chi.Router) {
			r.Get("/{orgId}", h.GetOnboarding)
			r.Put("/{orgId}", h.UpdateOnboarding)
		})

		// Dashboard
		r.Route("/dashboard", func(r chi.Router) {
			r.Get("/stats", h.GetDashboardStats)
			r.With(middleware.RequireRole("vendor_admin", "partner_admin")).Get("/team-progress", h.GetTeamProgress)
		})

		// Courses
		r.Route("/courses", func(r chi.Router) {
			r.Get("/", h.ListCourses)
			r.With(middleware.RequireRole("vendor_admin")).Post("/", h.CreateCourse)
			r.Get("/{id}", h.GetCourse)
			r.With(middleware.RequireRole("vendor_admin")).Put("/{id}", h.UpdateCourse)
			r.With(middleware.RequireRole("vendor_admin")).Delete("/{id}", h.DeleteCourse)

			// Lessons nested under courses
			r.Route("/{courseId}/lessons", func(r chi.Router) {
				r.Get("/", h.ListLessons)
				r.With(middleware.RequireRole("vendor_admin")).Post("/", h.CreateLesson)
				r.With(middleware.RequireRole("vendor_admin")).Put("/{id}", h.UpdateLesson)
				r.With(middleware.RequireRole("vendor_admin")).Delete("/{id}", h.DeleteLesson)
			})

			// Progress nested under courses
			r.Route("/{courseId}/progress", func(r chi.Router) {
				r.Get("/{userId}", h.GetCourseProgress)
				r.Post("/complete-lesson", h.CompleteLesson)
			})
		})

		// Certifications
		r.Route("/certifications", func(r chi.Router) {
			r.Get("/", h.ListCertifications)
			r.Get("/{id}", h.GetCertification)
			r.With(middleware.RequireRole("vendor_admin")).Post("/", h.CreateCertification)
			r.With(middleware.RequireRole("vendor_admin")).Put("/{id}", h.UpdateCertification)
		})

		// Assessments
		r.Route("/assessments", func(r chi.Router) {
			r.Get("/", h.ListAssessments)
			r.Post("/", h.CreateAssessment)
			r.With(middleware.RequireRole("vendor_admin")).Put("/{id}", h.UpdateAssessment)
		})

		// Issued certificates
		r.Route("/certificates", func(r chi.Router) {
			r.Get("/", h.ListCertificates)
			r.Get("/{id}", h.GetCertificate)
			r.Get("/{id}/pdf", h.GetCertificatePDF)
		})

		// Resources
		r.Route("/resources", func(r chi.Router) {
			r.Get("/", h.ListResources)
			r.Get("/{id}", h.GetResource)
			r.With(middleware.RequireRole("vendor_admin")).Post("/", h.CreateResource)
			r.With(middleware.RequireRole("vendor_admin")).Put("/{id}", h.UpdateResource)
			r.With(middleware.RequireRole("vendor_admin")).Delete("/{id}", h.DeleteResource)
		})

		// Deals
		r.Route("/deals", func(r chi.Router) {
			r.Get("/", h.ListDeals)
			r.Get("/{id}", h.GetDeal)
			r.Post("/", h.CreateDeal)
			r.Put("/{id}", h.UpdateDeal)
			r.With(middleware.RequireRole("vendor_admin")).Patch("/{id}/status", h.UpdateDealStatus)
		})

		// Announcements
		r.Route("/announcements", func(r chi.Router) {
			r.Get("/", h.ListAnnouncements)
			r.Get("/{id}", h.GetAnnouncement)
			r.With(middleware.RequireRole("vendor_admin")).Post("/", h.CreateAnnouncement)
			r.With(middleware.RequireRole("vendor_admin")).Put("/{id}", h.UpdateAnnouncement)
			r.With(middleware.RequireRole("vendor_admin")).Delete("/{id}", h.DeleteAnnouncement)
			r.Post("/{id}/read", h.MarkAnnouncementRead)
		})

		// AI query
		r.Route("/ai", func(r chi.Router) {
			r.Post("/query", h.AIQuery)
		})

		// Admin — vendor_admin only
		r.Route("/admin/users", func(r chi.Router) {
			r.Use(middleware.RequireRole("vendor_admin"))
			r.Post("/provision", h.ProvisionUser)
			r.Get("/audit-log", h.GetAuditLog)
		})
	})

	return r
}

// healthHandler responds with a simple 200 OK JSON payload for liveness probes.
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// swaggerHandler serves a minimal redirect / placeholder for the Swagger UI.
// In production this would be replaced with the actual embedded swagger-ui
// assets or a redirect to the hosted docs.
func swaggerHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("Swagger UI – mount your swagger-ui assets here.\n"))
}
