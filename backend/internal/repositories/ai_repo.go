// Package repositories contains all database access logic for the partner portal.
package repositories

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"

	"github.com/1kosmos/partner-portal/internal/models"
)

// AIRepository handles all database operations for AI embeddings and semantic
// search.
type AIRepository struct {
	db *pgxpool.Pool
}

// NewAIRepository creates a new AIRepository.
func NewAIRepository(db *pgxpool.Pool) *AIRepository {
	return &AIRepository{db: db}
}

// SearchChunks performs full-text search on the content_chunk column using
// to_tsvector + plainto_tsquery, ordered by ts_rank DESC.
func (r *AIRepository) SearchChunks(ctx context.Context, queryText string, limit int) ([]models.AIEmbedding, error) {
	const q = `
		SELECT id, resource_type, resource_id, content_chunk, embedding, token_count, created_at
		FROM ai_embeddings
		WHERE to_tsvector('english', content_chunk) @@ plainto_tsquery('english', $1)
		ORDER BY ts_rank(to_tsvector('english', content_chunk), plainto_tsquery('english', $1)) DESC
		LIMIT $2`

	rows, err := r.db.Query(ctx, q, queryText, limit)
	if err != nil {
		return nil, fmt.Errorf("search chunks: %w", err)
	}
	defer rows.Close()

	return scanEmbeddingRows(rows)
}

// SearchByVector performs cosine-distance similarity search using pgvector.
// Requires the pgvector extension and a vector column of matching dimensions.
// Results are ordered by cosine distance ascending (most similar first).
func (r *AIRepository) SearchByVector(ctx context.Context, embedding []float32, limit int) ([]models.AIEmbedding, error) {
	vec := pgvector.NewVector(embedding)

	const q = `
		SELECT id, resource_type, resource_id, content_chunk, embedding, token_count, created_at
		FROM ai_embeddings
		ORDER BY embedding <=> $1
		LIMIT $2`

	rows, err := r.db.Query(ctx, q, vec, limit)
	if err != nil {
		return nil, fmt.Errorf("vector search: %w", err)
	}
	defer rows.Close()

	return scanEmbeddingRows(rows)
}

// StoreEmbedding inserts a new AIEmbedding record.
func (r *AIRepository) StoreEmbedding(ctx context.Context, emb *models.AIEmbedding) error {
	const q = `
		INSERT INTO ai_embeddings
			(id, resource_type, resource_id, content_chunk, embedding, token_count, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (resource_type, resource_id, content_chunk) DO UPDATE
			SET embedding = EXCLUDED.embedding,
			    token_count = EXCLUDED.token_count`

	if emb.ID == uuid.Nil {
		emb.ID = uuid.New()
	}
	if emb.CreatedAt.IsZero() {
		emb.CreatedAt = time.Now().UTC()
	}

	if _, err := r.db.Exec(ctx, q,
		emb.ID, emb.ResourceType, emb.ResourceID, emb.ContentChunk, emb.Embedding, emb.TokenCount, emb.CreatedAt,
	); err != nil {
		return fmt.Errorf("store embedding: %w", err)
	}
	return nil
}

// GetEmbeddingsBySource returns all embeddings for a given source type and ID.
func (r *AIRepository) GetEmbeddingsBySource(ctx context.Context, sourceType, sourceID string) ([]models.AIEmbedding, error) {
	const q = `
		SELECT id, resource_type, resource_id, content_chunk, embedding, token_count, created_at
		FROM ai_embeddings
		WHERE resource_type = $1 AND resource_id = $2
		ORDER BY created_at ASC`

	rows, err := r.db.Query(ctx, q, sourceType, sourceID)
	if err != nil {
		return nil, fmt.Errorf("get embeddings by source: %w", err)
	}
	defer rows.Close()

	return scanEmbeddingRows(rows)
}

// scanEmbeddingRows scans pgx rows into a slice of AIEmbedding.
func scanEmbeddingRows(rows interface {
	Next() bool
	Scan(...interface{}) error
	Err() error
}) ([]models.AIEmbedding, error) {
	var items []models.AIEmbedding
	for rows.Next() {
		var e models.AIEmbedding
		if err := rows.Scan(
			&e.ID, &e.ResourceType, &e.ResourceID, &e.ContentChunk, &e.Embedding, &e.TokenCount, &e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan embedding: %w", err)
		}
		items = append(items, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate embeddings: %w", err)
	}
	return items, nil
}
