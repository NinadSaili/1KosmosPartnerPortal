package middleware

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

// AuditLogger writes audit records to the audit_log table without blocking
// the HTTP request path.
type AuditLogger struct {
	pool *pgxpool.Pool
	log  zerolog.Logger
}

// NewAuditLogger constructs an AuditLogger backed by the given connection pool.
func NewAuditLogger(pool *pgxpool.Pool, log zerolog.Logger) *AuditLogger {
	return &AuditLogger{pool: pool, log: log}
}

// WriteAudit asynchronously inserts a single row into the audit_log table.
// It spawns a short-lived goroutine so the caller is never blocked.
//
//   - actorID      – the UUID string of the user performing the action (empty for unauthenticated).
//   - action       – verb describing the operation, e.g. "create", "update", "delete".
//   - resourceType – the entity type, e.g. "deal", "user", "course".
//   - resourceID   – the UUID string of the affected resource (may be empty).
//   - metadata     – arbitrary key/value pairs to include for context.
func (a *AuditLogger) WriteAudit(
	ctx context.Context,
	actorID string,
	action string,
	resourceType string,
	resourceID string,
	metadata map[string]interface{},
) {
	// Capture values needed inside the goroutine before the request context
	// is potentially cancelled.
	metaJSON, err := json.Marshal(metadata)
	if err != nil {
		metaJSON = []byte("{}")
	}

	var actorPtr *string
	if actorID != "" {
		s := actorID
		actorPtr = &s
	}
	var resourcePtr *string
	if resourceID != "" {
		s := resourceID
		resourcePtr = &s
	}

	go func() {
		// Use a fresh background context so the write is not cancelled when the
		// HTTP request context ends.
		writeCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		const q = `
			INSERT INTO audit_log
				(actor_id, action, resource_type, resource_id, metadata, created_at)
			VALUES
				($1, $2, $3, $4, $5::jsonb, now())`

		if _, err := a.pool.Exec(writeCtx, q,
			actorPtr,
			action,
			resourceType,
			resourcePtr,
			string(metaJSON),
		); err != nil {
			a.log.Error().
				Err(err).
				Str("actor_id", actorID).
				Str("action", action).
				Str("resource_type", resourceType).
				Str("resource_id", resourceID).
				Msg("audit: failed to write audit log entry")
		}
	}()
}
