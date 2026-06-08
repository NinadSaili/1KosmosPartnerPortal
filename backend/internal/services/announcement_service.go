// Package services contains business logic for the partner portal.
package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/1kosmos/partner-portal/internal/repositories"
)

// AnnouncementWithRead wraps an Announcement with a per-user is_read flag.
type AnnouncementWithRead = repositories.AnnouncementWithRead

// CreateAnnouncementRequest carries the fields for creating a new announcement.
type CreateAnnouncementRequest struct {
	Title           string   `json:"title"`
	Body            string   `json:"body"`
	Category        string   `json:"category"`
	Priority        string   `json:"priority"`
	TargetTiers     []string `json:"target_tiers,omitempty"`
	TargetVerticals []string `json:"target_verticals,omitempty"`
	PublishedAt     *string  `json:"published_at,omitempty"`
	ExpiresAt       *string  `json:"expires_at,omitempty"`
}

// UpdateAnnouncementRequest carries the fields that may be changed on an
// existing announcement.
type UpdateAnnouncementRequest struct {
	Title           *string  `json:"title,omitempty"`
	Body            *string  `json:"body,omitempty"`
	Category        *string  `json:"category,omitempty"`
	Priority        *string  `json:"priority,omitempty"`
	TargetTiers     []string `json:"target_tiers,omitempty"`
	TargetVerticals []string `json:"target_verticals,omitempty"`
	PublishedAt     *string  `json:"published_at,omitempty"`
	ExpiresAt       *string  `json:"expires_at,omitempty"`
	IsPublished     *bool    `json:"is_published,omitempty"`
}

// AnnouncementService encapsulates all business logic for announcements.
type AnnouncementService struct {
	repo *repositories.AnnouncementRepository
	log  zerolog.Logger
}

// NewAnnouncementService creates a new AnnouncementService.
func NewAnnouncementService(db *pgxpool.Pool, log zerolog.Logger) *AnnouncementService {
	return &AnnouncementService{
		repo: repositories.NewAnnouncementRepository(db),
		log:  log,
	}
}

// ListAnnouncements returns a paginated list of published announcements with
// per-user read flags.  It also returns the total count and the unread count
// for the current user.
func (s *AnnouncementService) ListAnnouncements(
	ctx context.Context,
	userID string,
	page, pageSize int,
) ([]AnnouncementWithRead, int, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	items, total, err := s.repo.ListPublished(ctx, userID, offset, pageSize)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("announcement service list: %w", err)
	}

	unread, err := s.repo.GetUnreadCount(ctx, userID)
	if err != nil {
		s.log.Warn().Err(err).Str("user_id", userID).Msg("failed to get unread count")
		unread = 0
	}

	if items == nil {
		items = []AnnouncementWithRead{}
	}
	return items, total, unread, nil
}

// GetAnnouncement returns a single announcement by ID.
func (s *AnnouncementService) GetAnnouncement(ctx context.Context, id string) (*models.Announcement, error) {
	a, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("announcement service get: %w", err)
	}
	return a, nil
}

// CreateAnnouncement inserts a new announcement created by createdBy.
func (s *AnnouncementService) CreateAnnouncement(
	ctx context.Context,
	req CreateAnnouncementRequest,
	createdBy string,
) (*models.Announcement, error) {
	createdByUUID, err := uuid.Parse(createdBy)
	if err != nil {
		return nil, fmt.Errorf("invalid creator id: %w", err)
	}

	a := &models.Announcement{
		ID:              uuid.New(),
		Title:           req.Title,
		Body:            req.Body,
		Category:        req.Category,
		Priority:        req.Priority,
		TargetTiers:     req.TargetTiers,
		TargetVerticals: req.TargetVerticals,
		CreatedBy:       createdByUUID,
	}

	if a.TargetTiers == nil {
		a.TargetTiers = []string{}
	}
	if a.TargetVerticals == nil {
		a.TargetVerticals = []string{}
	}

	if req.PublishedAt != nil && *req.PublishedAt != "" {
		t, parseErr := time.Parse(time.RFC3339, *req.PublishedAt)
		if parseErr != nil {
			// Try date-only format
			t, parseErr = time.Parse("2006-01-02", *req.PublishedAt)
			if parseErr != nil {
				return nil, fmt.Errorf("invalid published_at format (use RFC3339 or YYYY-MM-DD): %w", parseErr)
			}
		}
		a.PublishedAt = &t
	}

	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		t, parseErr := time.Parse(time.RFC3339, *req.ExpiresAt)
		if parseErr != nil {
			t, parseErr = time.Parse("2006-01-02", *req.ExpiresAt)
			if parseErr != nil {
				return nil, fmt.Errorf("invalid expires_at format (use RFC3339 or YYYY-MM-DD): %w", parseErr)
			}
		}
		a.ExpiresAt = &t
	}

	created, err := s.repo.Create(ctx, a)
	if err != nil {
		return nil, fmt.Errorf("announcement service create: %w", err)
	}
	return created, nil
}

// UpdateAnnouncement updates a published announcement's metadata.
func (s *AnnouncementService) UpdateAnnouncement(
	ctx context.Context,
	id string,
	req UpdateAnnouncementRequest,
) (*models.Announcement, error) {
	updates := make(map[string]any)

	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Body != nil {
		updates["body"] = *req.Body
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.TargetTiers != nil {
		updates["target_tiers"] = req.TargetTiers
	}
	if req.TargetVerticals != nil {
		updates["target_verticals"] = req.TargetVerticals
	}
	if req.PublishedAt != nil {
		if *req.PublishedAt == "" {
			updates["published_at"] = nil
		} else {
			t, parseErr := time.Parse(time.RFC3339, *req.PublishedAt)
			if parseErr != nil {
				t, parseErr = time.Parse("2006-01-02", *req.PublishedAt)
				if parseErr != nil {
					return nil, fmt.Errorf("invalid published_at: %w", parseErr)
				}
			}
			updates["published_at"] = t
		}
	}
	if req.ExpiresAt != nil {
		if *req.ExpiresAt == "" {
			updates["expires_at"] = nil
		} else {
			t, parseErr := time.Parse(time.RFC3339, *req.ExpiresAt)
			if parseErr != nil {
				t, parseErr = time.Parse("2006-01-02", *req.ExpiresAt)
				if parseErr != nil {
					return nil, fmt.Errorf("invalid expires_at: %w", parseErr)
				}
			}
			updates["expires_at"] = t
		}
	}

	updated, err := s.repo.Update(ctx, id, updates)
	if err != nil {
		return nil, fmt.Errorf("announcement service update: %w", err)
	}
	return updated, nil
}

// DeleteAnnouncement soft-deletes an announcement by setting deleted_at (which
// removes it from the published listing).
func (s *AnnouncementService) DeleteAnnouncement(ctx context.Context, id string) error {
	now := time.Now().UTC()
	updates := map[string]any{
		"deleted_at": now,
	}
	if _, err := s.repo.Update(ctx, id, updates); err != nil {
		return fmt.Errorf("announcement service delete: %w", err)
	}
	return nil
}

// MarkRead records that the given user has read an announcement.
func (s *AnnouncementService) MarkRead(ctx context.Context, userID, announcementID string) error {
	if err := s.repo.MarkRead(ctx, userID, announcementID); err != nil {
		return fmt.Errorf("announcement service mark read: %w", err)
	}
	return nil
}

// GetUnreadCount returns the number of unread published announcements for a user.
func (s *AnnouncementService) GetUnreadCount(ctx context.Context, userID string) (int, error) {
	count, err := s.repo.GetUnreadCount(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("announcement service unread count: %w", err)
	}
	return count, nil
}
