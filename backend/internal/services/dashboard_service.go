package services

import (
	"context"
	"fmt"

	"github.com/1kosmos/partner-portal/internal/repositories"
)

// DashboardStats is the full stats payload returned to the caller.
type DashboardStats struct {
	DealsRegistered       int                              `json:"deals_registered"`
	DealsApproved         int                              `json:"deals_approved"`
	CertsEarned           int                              `json:"certs_earned"`
	TrainingCompletionPct float64                          `json:"training_completion_pct"`
	RecentAnnouncements   []repositories.AnnouncementSummary `json:"recent_announcements"`
	UpcomingSessions      []UpcomingSession                `json:"upcoming_sessions"`
}

// UpcomingSession is a placeholder for future scheduled event data.
type UpcomingSession struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Date  string `json:"date"`
}

// UserProgress re-exports the repository type for external callers.
type UserProgressItem = repositories.UserProgress

// DashboardService encapsulates dashboard aggregation logic.
type DashboardService struct {
	dashRepo *repositories.DashboardRepository
}

// NewDashboardService constructs a DashboardService.
func NewDashboardService(dashRepo *repositories.DashboardRepository) *DashboardService {
	return &DashboardService{dashRepo: dashRepo}
}

// GetStats assembles the dashboard stats for the given actor.
//
//   - vendor_admin → global stats (no org filter)
//   - partner_admin / partner_user with an orgID → org-scoped stats
//   - partner_user without an orgID → personal stats (userID filter)
func (s *DashboardService) GetStats(ctx context.Context, userID, userRole, orgID string) (*DashboardStats, error) {
	var orgPtr, userPtr *string

	switch userRole {
	case "vendor_admin":
		// global — no filters
	case "partner_admin":
		if orgID != "" {
			orgPtr = &orgID
		}
	default: // partner_user
		if orgID != "" {
			orgPtr = &orgID
		} else if userID != "" {
			userPtr = &userID
		}
	}

	dealCounts, err := s.dashRepo.CountDealsByStatus(ctx, orgPtr)
	if err != nil {
		return nil, fmt.Errorf("dashboard_service: count deals: %w", err)
	}

	certs, err := s.dashRepo.CountCertsByOrg(ctx, orgPtr)
	if err != nil {
		return nil, fmt.Errorf("dashboard_service: count certs: %w", err)
	}

	completionRatio, err := s.dashRepo.GetTrainingCompletion(ctx, userPtr, orgPtr)
	if err != nil {
		return nil, fmt.Errorf("dashboard_service: training completion: %w", err)
	}

	announcements, err := s.dashRepo.GetRecentAnnouncements(ctx, 5)
	if err != nil {
		return nil, fmt.Errorf("dashboard_service: recent announcements: %w", err)
	}

	stats := &DashboardStats{
		DealsRegistered:       dealCounts["submitted"] + dealCounts["under_review"] + dealCounts["approved"] + dealCounts["rejected"] + dealCounts["draft"],
		DealsApproved:         dealCounts["approved"],
		CertsEarned:           certs,
		TrainingCompletionPct: completionRatio * 100,
		RecentAnnouncements:   announcements,
		UpcomingSessions:      []UpcomingSession{},
	}

	return stats, nil
}

// GetTeamProgress returns per-user lesson completion stats for an organisation.
func (s *DashboardService) GetTeamProgress(ctx context.Context, orgID string) ([]repositories.UserProgress, error) {
	progress, err := s.dashRepo.GetTeamProgress(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("dashboard_service: team progress: %w", err)
	}
	return progress, nil
}
