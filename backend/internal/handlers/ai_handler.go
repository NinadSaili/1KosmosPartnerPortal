// Package handlers contains all HTTP handler functions for the partner portal API.
package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/1kosmos/partner-portal/internal/middleware"
	"github.com/1kosmos/partner-portal/internal/services"
	"github.com/1kosmos/partner-portal/pkg/email"
)

// aiSvc returns an AIService wired to the handler's pool and config.
func (h *Handler) aiSvc() *services.AIService {
	var emailClient *email.EmailClient
	if h.cfg.SendGridAPIKey != "" {
		emailClient = email.NewEmailClient(h.cfg.SendGridAPIKey, h.cfg.FromEmail)
	}
	return services.NewAIService(h.pool, h.cfg.AnthropicAPIKey, emailClient, h.log)
}

// AIQuery handles POST /api/v1/ai/query.
//
// It accepts an AIQueryRequest body and streams the response using
// Server-Sent Events (SSE) when the caller sends
// Accept: text/event-stream.  If the caller does not indicate SSE support,
// the assembled answer is returned as a regular JSON response.
//
// SSE event format:
//
//	data: {"text":"<incremental text>"}       – zero or more text events
//	data: {"sources":[...]}                   – citations from the knowledge base
//	data: [DONE]                              – terminal event
func (h *Handler) AIQuery(w http.ResponseWriter, r *http.Request) {
	var req services.AIQueryRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.Query == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "query is required")
		return
	}

	userID := middleware.GetUserID(r)
	svc := h.aiSvc()

	// Determine whether the client wants an SSE stream.
	wantsSSE := r.Header.Get("Accept") == "text/event-stream"

	resp, err := svc.Query(r.Context(), req, userID)
	if err != nil {
		h.log.Error().Err(err).Str("user_id", userID).Str("intent", req.Intent).Msg("ai query failed")
		if wantsSSE {
			// Best-effort: try to send an error event before the stream ends.
			sseWriteError(w, err)
			return
		}
		writeError(w, http.StatusInternalServerError, "ai_error", "AI query failed: "+err.Error())
		return
	}

	if wantsSSE {
		writeSSEResponse(w, resp)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// writeSSEResponse sets SSE headers and emits the assembled AI response as a
// sequence of Server-Sent Events.
func writeSSEResponse(w http.ResponseWriter, resp *services.AIQueryResponse) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering if present.
	w.WriteHeader(http.StatusOK)

	flusher, canFlush := w.(http.Flusher)

	// Emit the answer text as a single text event.
	if resp.Answer != "" {
		textPayload, _ := json.Marshal(map[string]string{"text": resp.Answer})
		fmt.Fprintf(w, "data: %s\n\n", textPayload)
		if canFlush {
			flusher.Flush()
		}
	}

	// Emit sources if any.
	if len(resp.Sources) > 0 {
		sourcesPayload, _ := json.Marshal(map[string]interface{}{"sources": resp.Sources})
		fmt.Fprintf(w, "data: %s\n\n", sourcesPayload)
		if canFlush {
			flusher.Flush()
		}
	}

	// Emit the terminal event.
	fmt.Fprintf(w, "data: [DONE]\n\n")
	if canFlush {
		flusher.Flush()
	}
}

// sseWriteError attempts to send an error over an SSE stream.  It sets the
// SSE headers only if they have not already been written.
func sseWriteError(w http.ResponseWriter, err error) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK) // SSE responses always start with 200.

	errPayload, _ := json.Marshal(map[string]string{"error": err.Error()})
	fmt.Fprintf(w, "data: %s\n\n", errPayload)
	fmt.Fprintf(w, "data: [DONE]\n\n")

	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
}
