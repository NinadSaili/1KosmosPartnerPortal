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

// ResourceFilter holds optional filter parameters for listing resources.
type ResourceFilter struct {
	Type     string
	Tag      string
	Search   string
	Page     int
	PageSize int
}

// ResourceWithTags is a Resource combined with its vertical tags.
type ResourceWithTags struct {
	models.Resource
	Tags []string `json:"tags"`
}

// UpdateResourceRequest carries the fields that may be changed on an existing
// resource.
type UpdateResourceRequest struct {
	Title        *string  `json:"title,omitempty"`
	Description  *string  `json:"description,omitempty"`
	ResourceType *string  `json:"resource_type,omitempty"`
	StoragePath  *string  `json:"storage_path,omitempty"`
	FileSize     *int64   `json:"file_size,omitempty"`
	MimeType     *string  `json:"mime_type,omitempty"`
	IsPublic     *bool    `json:"is_public,omitempty"`
	Tags         []string `json:"tags,omitempty"`
}

// ResourceService encapsulates all business logic for resources.
type ResourceService struct {
	repo *repositories.ResourceRepository
	db   *pgxpool.Pool
	log  zerolog.Logger
}

// NewResourceService creates a new ResourceService.
func NewResourceService(db *pgxpool.Pool, log zerolog.Logger) *ResourceService {
	return &ResourceService{
		repo: repositories.NewResourceRepository(db),
		db:   db,
		log:  log,
	}
}

// ListResources returns a paginated list of resources with their tags.
func (s *ResourceService) ListResources(ctx context.Context, filter ResourceFilter) ([]ResourceWithTags, int, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize < 1 || filter.PageSize > 100 {
		filter.PageSize = 20
	}
	offset := (filter.Page - 1) * filter.PageSize

	resources, total, err := s.repo.ListResources(ctx, filter.Type, filter.Tag, filter.Search, offset, filter.PageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("resource service list: %w", err)
	}

	result := make([]ResourceWithTags, 0, len(resources))
	for _, r := range resources {
		tags, err := s.repo.GetResourceTags(ctx, r.ID.String())
		if err != nil {
			s.log.Warn().Err(err).Str("resource_id", r.ID.String()).Msg("failed to fetch tags for resource")
			tags = []string{}
		}
		if tags == nil {
			tags = []string{}
		}
		result = append(result, ResourceWithTags{Resource: r, Tags: tags})
	}
	return result, total, nil
}

// GetResource returns a single resource with its tags.
func (s *ResourceService) GetResource(ctx context.Context, id string) (*ResourceWithTags, error) {
	res, err := s.repo.GetResourceByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("resource service get: %w", err)
	}
	tags, err := s.repo.GetResourceTags(ctx, id)
	if err != nil {
		s.log.Warn().Err(err).Str("resource_id", id).Msg("failed to fetch resource tags")
		tags = []string{}
	}
	if tags == nil {
		tags = []string{}
	}
	return &ResourceWithTags{Resource: *res, Tags: tags}, nil
}

// CreateResource inserts a new resource and sets its tags.
func (s *ResourceService) CreateResource(ctx context.Context, req models.CreateResourceRequest, uploaderID string) (*models.Resource, error) {
	uploaderUUID, err := uuid.Parse(uploaderID)
	if err != nil {
		return nil, fmt.Errorf("invalid uploader id: %w", err)
	}
	now := time.Now().UTC()
	res := &models.Resource{
		ID:           uuid.New(),
		Title:        req.Title,
		Description:  req.Description,
		ResourceType: req.ResourceType,
		StoragePath:  req.StoragePath,
		FileSize:     req.FileSize,
		MimeType:     req.MimeType,
		IsPublic:     req.IsPublic,
		DownloadCount: 0,
		CreatedBy:    uploaderUUID,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	created, err := s.repo.CreateResource(ctx, res)
	if err != nil {
		return nil, fmt.Errorf("resource service create: %w", err)
	}

	if len(req.VerticalTags) > 0 {
		if err := s.repo.SetResourceTags(ctx, created.ID.String(), req.VerticalTags); err != nil {
			s.log.Warn().Err(err).Str("resource_id", created.ID.String()).Msg("failed to set resource tags")
		}
	}
	return created, nil
}

// UpdateResource updates a resource's metadata and tags.
func (s *ResourceService) UpdateResource(ctx context.Context, id string, req UpdateResourceRequest) (*models.Resource, error) {
	updates := make(map[string]any)
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.ResourceType != nil {
		updates["resource_type"] = *req.ResourceType
	}
	if req.StoragePath != nil {
		updates["storage_path"] = *req.StoragePath
	}
	if req.FileSize != nil {
		updates["file_size"] = *req.FileSize
	}
	if req.MimeType != nil {
		updates["mime_type"] = *req.MimeType
	}
	if req.IsPublic != nil {
		updates["is_public"] = *req.IsPublic
	}

	updated, err := s.repo.UpdateResource(ctx, id, updates)
	if err != nil {
		return nil, fmt.Errorf("resource service update: %w", err)
	}

	if req.Tags != nil {
		if err := s.repo.SetResourceTags(ctx, id, req.Tags); err != nil {
			s.log.Warn().Err(err).Str("resource_id", id).Msg("failed to update resource tags")
		}
	}
	return updated, nil
}

// DeleteResource soft-deletes a resource.
func (s *ResourceService) DeleteResource(ctx context.Context, id string) error {
	if err := s.repo.DeleteResource(ctx, id); err != nil {
		return fmt.Errorf("resource service delete: %w", err)
	}
	return nil
}

// LogDownload writes an audit_log entry recording that a resource was downloaded.
func (s *ResourceService) LogDownload(ctx context.Context, resourceID, actorID string) error {
	var actorPtr *string
	if actorID != "" {
		s := actorID
		actorPtr = &s
	}
	var resPtr *string
	if resourceID != "" {
		r := resourceID
		resPtr = &r
	}

	const q = `
		INSERT INTO audit_log (actor_id, action, resource_type, resource_id, metadata, created_at)
		VALUES ($1, 'download', 'resource', $2, '{}'::jsonb, now())`

	if _, err := s.db.Exec(ctx, q, actorPtr, resPtr); err != nil {
		return fmt.Errorf("log download: %w", err)
	}

	// Also bump download_count
	const bumpQ = `UPDATE resources SET download_count = download_count + 1, updated_at = now() WHERE id = $1`
	if _, err := s.db.Exec(ctx, bumpQ, resourceID); err != nil {
		s.log.Warn().Err(err).Str("resource_id", resourceID).Msg("failed to increment download count")
	}
	return nil
}
