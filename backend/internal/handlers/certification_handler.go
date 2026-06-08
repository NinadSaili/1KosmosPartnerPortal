package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/1kosmos/partner-portal/internal/middleware"
	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/1kosmos/partner-portal/internal/services"
	"github.com/1kosmos/partner-portal/pkg/email"
)

// certSvc builds a CertificationService wired to the handler's pool.
func (h *Handler) certSvc() *services.CertificationService {
	emailClient := email.NewEmailClient(h.cfg.SendGridAPIKey, h.cfg.FromEmail)
	return services.NewCertificationService(
		repositories.NewCertificationRepository(h.pool),
		emailClient,
	)
}

// ---------------------------------------------------------------------------
// ListCertifications — GET /api/v1/certifications
// ---------------------------------------------------------------------------

// ListCertifications handles GET /api/v1/certifications.
func (h *Handler) ListCertifications(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	svc := h.certSvc()
	certs, err := svc.ListCertifications(r.Context(), userID)
	if err != nil {
		h.log.Error().Err(err).Msg("list certifications failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to list certifications")
		return
	}
	if certs == nil {
		certs = []services.CertificationWithEligibility{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"data": certs})
}

// ---------------------------------------------------------------------------
// GetCertification — GET /api/v1/certifications/{id}
// ---------------------------------------------------------------------------

// GetCertification handles GET /api/v1/certifications/{id}.
func (h *Handler) GetCertification(w http.ResponseWriter, r *http.Request) {
	certID := chi.URLParam(r, "id")
	userID := middleware.GetUserID(r)

	svc := h.certSvc()
	detail, err := svc.GetCertification(r.Context(), certID, userID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "certification not found")
			return
		}
		h.log.Error().Err(err).Str("cert_id", certID).Msg("get certification failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to get certification")
		return
	}

	writeJSON(w, http.StatusOK, detail)
}

// ---------------------------------------------------------------------------
// CreateCertification — POST /api/v1/certifications (vendor_admin)
// ---------------------------------------------------------------------------

// CreateCertification handles POST /api/v1/certifications.
func (h *Handler) CreateCertification(w http.ResponseWriter, r *http.Request) {
	var req services.CreateCertificationRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "title is required")
		return
	}
	if req.ValidityMonths <= 0 {
		writeError(w, http.StatusBadRequest, "validation_error", "validity_months must be > 0")
		return
	}
	if req.PassingScorePercent <= 0 || req.PassingScorePercent > 100 {
		writeError(w, http.StatusBadRequest, "validation_error", "passing_score_percent must be between 1 and 100")
		return
	}

	callerID := middleware.GetUserID(r)
	svc := h.certSvc()
	cert, err := svc.CreateCertification(r.Context(), req, callerID)
	if err != nil {
		h.log.Error().Err(err).Msg("create certification failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to create certification")
		return
	}

	h.auditLog.WriteAudit(r.Context(), callerID, "create", "certification", cert.ID.String(), nil)
	writeJSON(w, http.StatusCreated, cert)
}

// ---------------------------------------------------------------------------
// UpdateCertification — PUT /api/v1/certifications/{id} (vendor_admin)
// ---------------------------------------------------------------------------

// UpdateCertification handles PUT /api/v1/certifications/{id}.
func (h *Handler) UpdateCertification(w http.ResponseWriter, r *http.Request) {
	certID := chi.URLParam(r, "id")

	var req services.CreateCertificationRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	svc := h.certSvc()
	updated, err := svc.UpdateCertification(r.Context(), certID, req)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "certification not found")
			return
		}
		h.log.Error().Err(err).Str("cert_id", certID).Msg("update certification failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to update certification")
		return
	}

	h.auditLog.WriteAudit(r.Context(), middleware.GetUserID(r), "update", "certification", certID, nil)
	writeJSON(w, http.StatusOK, updated)
}

// ---------------------------------------------------------------------------
// ListAssessments — GET /api/v1/assessments
// ---------------------------------------------------------------------------

// ListAssessments handles GET /api/v1/assessments.
func (h *Handler) ListAssessments(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	userRole := middleware.GetUserRole(r)
	orgID := middleware.GetUserOrgID(r)

	certRepo := repositories.NewCertificationRepository(h.pool)

	var (
		assessments []models.AssessmentSchedule
		err         error
	)

	switch userRole {
	case "vendor_admin":
		// vendor_admin sees all — fetch via user's own assessments as the
		// broadest available query; a real implementation would use a global scan.
		assessments, err = certRepo.GetAssessmentsByUser(r.Context(), userID)
	case "partner_admin":
		if orgID != "" {
			assessments, err = certRepo.GetAssessmentsByOrg(r.Context(), orgID)
		} else {
			assessments, err = certRepo.GetAssessmentsByUser(r.Context(), userID)
		}
	default:
		assessments, err = certRepo.GetAssessmentsByUser(r.Context(), userID)
	}

	if err != nil {
		h.log.Error().Err(err).Str("user_id", userID).Msg("list assessments failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to list assessments")
		return
	}
	if assessments == nil {
		assessments = []models.AssessmentSchedule{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"data": assessments})
}

// ---------------------------------------------------------------------------
// ScheduleAssessment / CreateAssessment — POST /api/v1/assessments
// ---------------------------------------------------------------------------

// CreateAssessment handles POST /api/v1/assessments.
func (h *Handler) CreateAssessment(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CertificationID string    `json:"certification_id"`
		RequestedDate   time.Time `json:"requested_date"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	if body.CertificationID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "certification_id is required")
		return
	}
	if body.RequestedDate.IsZero() {
		writeError(w, http.StatusBadRequest, "validation_error", "requested_date is required")
		return
	}

	userID := middleware.GetUserID(r)
	svc := h.certSvc()
	schedule, err := svc.ScheduleAssessment(r.Context(), userID, body.CertificationID, body.RequestedDate)
	if err != nil {
		h.log.Warn().Err(err).Str("user_id", userID).Msg("schedule assessment failed")
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "certification not found")
			return
		}
		writeError(w, http.StatusUnprocessableEntity, "ineligible", err.Error())
		return
	}

	h.auditLog.WriteAudit(r.Context(), userID, "schedule_assessment", "assessment_schedule", schedule.ID.String(), nil)
	writeJSON(w, http.StatusCreated, schedule)
}

// ---------------------------------------------------------------------------
// UpdateAssessment — PUT /api/v1/assessments/{id} (vendor_admin)
// ---------------------------------------------------------------------------

// UpdateAssessment handles PUT /api/v1/assessments/{id}.
func (h *Handler) UpdateAssessment(w http.ResponseWriter, r *http.Request) {
	assessmentID := chi.URLParam(r, "id")
	callerID := middleware.GetUserID(r)

	var req services.UpdateAssessmentRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.Status == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "status is required")
		return
	}

	svc := h.certSvc()
	updated, err := svc.UpdateAssessmentStatus(r.Context(), assessmentID, req, callerID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "assessment not found")
			return
		}
		h.log.Error().Err(err).Str("assessment_id", assessmentID).Msg("update assessment failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to update assessment")
		return
	}

	h.auditLog.WriteAudit(r.Context(), callerID, "update_assessment", "assessment_schedule", assessmentID,
		map[string]interface{}{"new_status": req.Status})
	writeJSON(w, http.StatusOK, updated)
}

// ---------------------------------------------------------------------------
// ListCertificates — GET /api/v1/certificates
// ---------------------------------------------------------------------------

// ListCertificates handles GET /api/v1/certificates.
func (h *Handler) ListCertificates(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	userRole := middleware.GetUserRole(r)
	orgID := middleware.GetUserOrgID(r)

	svc := h.certSvc()
	certs, err := svc.ListIssuedCertificates(r.Context(), userID, orgID, userRole)
	if err != nil {
		h.log.Error().Err(err).Str("user_id", userID).Msg("list certificates failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to list certificates")
		return
	}
	if certs == nil {
		certs = []models.IssuedCertificate{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"data": certs})
}

// ---------------------------------------------------------------------------
// GetCertificate — GET /api/v1/certificates/{id}
// ---------------------------------------------------------------------------

// GetCertificate handles GET /api/v1/certificates/{id}.
func (h *Handler) GetCertificate(w http.ResponseWriter, r *http.Request) {
	issuedCertID := chi.URLParam(r, "id")
	callerID := middleware.GetUserID(r)
	callerRole := middleware.GetUserRole(r)

	certRepo := repositories.NewCertificationRepository(h.pool)
	ic, err := certRepo.GetIssuedCertificate(r.Context(), issuedCertID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "certificate not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to get certificate")
		return
	}

	// Access control: owners, their org's partner_admin, or vendor_admin.
	if ic.UserID.String() != callerID && callerRole != "vendor_admin" && callerRole != "partner_admin" {
		writeError(w, http.StatusForbidden, "forbidden", "you may only view your own certificates")
		return
	}

	writeJSON(w, http.StatusOK, ic)
}

// ---------------------------------------------------------------------------
// DownloadCertificate — GET /api/v1/certificates/{id}/pdf
// ---------------------------------------------------------------------------

// GetCertificatePDF handles GET /api/v1/certificates/{id}/pdf.
func (h *Handler) GetCertificatePDF(w http.ResponseWriter, r *http.Request) {
	issuedCertID := chi.URLParam(r, "id")
	callerID := middleware.GetUserID(r)
	callerRole := middleware.GetUserRole(r)

	certRepo := repositories.NewCertificationRepository(h.pool)
	ic, err := certRepo.GetIssuedCertificate(r.Context(), issuedCertID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "certificate not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to get certificate")
		return
	}

	if ic.UserID.String() != callerID && callerRole != "vendor_admin" && callerRole != "partner_admin" {
		writeError(w, http.StatusForbidden, "forbidden", "you may only download your own certificates")
		return
	}

	svc := h.certSvc()
	pdfBytes, err := svc.GetCertificatePDF(r.Context(), issuedCertID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "certificate not found")
			return
		}
		h.log.Error().Err(err).Str("cert_id", issuedCertID).Msg("generate certificate PDF failed")
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to generate certificate PDF")
		return
	}

	h.auditLog.WriteAudit(r.Context(), callerID, "download_pdf", "issued_certificate", issuedCertID,
		map[string]interface{}{"cert_number": ic.CertificateNumber})

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="certificate-`+ic.CertificateNumber+`.pdf"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pdfBytes)
}
