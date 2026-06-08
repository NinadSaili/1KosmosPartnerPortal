// Package services contains business logic for the partner portal.
package services

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"
	"github.com/rs/zerolog"

	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/1kosmos/partner-portal/pkg/email"
)

const anthropicAPIURL = "https://api.anthropic.com/v1/messages"
const anthropicVersion = "2023-06-01"
const anthropicModel = "claude-sonnet-4-6"

// AIQueryRequest is the full payload for an AI query.
type AIQueryRequest struct {
	Intent  string            `json:"intent"`
	Query   string            `json:"query"`
	Context map[string]string `json:"context,omitempty"`
}

// AISource is a citation from the knowledge base returned alongside an answer.
type AISource struct {
	SourceType string `json:"source_type"`
	SourceID   string `json:"source_id"`
	Snippet    string `json:"snippet"`
}

// AIQueryResponse is the full response returned by AIService.Query.
type AIQueryResponse struct {
	Answer  string     `json:"answer"`
	Sources []AISource `json:"sources,omitempty"`
}

// AIChunk is a streaming response chunk sent to the HTTP layer.
type AIChunk struct {
	Text    string     `json:"text,omitempty"`
	Sources []AISource `json:"sources,omitempty"`
	Done    bool       `json:"done,omitempty"`
}

// AIService encapsulates AI query logic using pgvector search and the
// Anthropic Claude API.
type AIService struct {
	db              *pgxpool.Pool
	repo            *repositories.AIRepository
	anthropicAPIKey string
	emailClient     *email.EmailClient
	log             zerolog.Logger
}

// NewAIService creates a new AIService.
func NewAIService(db *pgxpool.Pool, anthropicAPIKey string, emailClient *email.EmailClient, log zerolog.Logger) *AIService {
	return &AIService{
		db:              db,
		repo:            repositories.NewAIRepository(db),
		anthropicAPIKey: anthropicAPIKey,
		emailClient:     emailClient,
		log:             log,
	}
}

// systemPromptForIntent returns a system prompt tailored to the query intent.
func systemPromptForIntent(intent string) string {
	switch intent {
	case "search_training":
		return "You are a training assistant for the 1Kosmos Partner Portal. Help partners find relevant courses, learning paths, and certification programs. Use the provided context to answer questions about training materials."
	case "search_resources":
		return "You are a resource assistant for the 1Kosmos Partner Portal. Help partners find relevant documents, datasheets, case studies, and sales materials. Use the provided context to answer questions about available resources."
	case "generate_proposal":
		return "You are a pre-sales assistant for the 1Kosmos Partner Portal. Help partners generate proposal sections, ROI calculations, and competitive positioning content. Use the provided context to create compelling proposals."
	case "recommend_course":
		return "You are a learning advisor for the 1Kosmos Partner Portal. Recommend the most relevant next courses and certifications based on the partner's goals and current progress. Use the provided context to make personalized recommendations."
	default:
		return "You are a helpful assistant for the 1Kosmos Partner Portal. Answer questions about partner programs, training, resources, and deal registration using the provided context."
	}
}

// BuildPromptContext assembles the context text from retrieved embedding chunks.
func (s *AIService) BuildPromptContext(chunks []models.AIEmbedding) string {
	if len(chunks) == 0 {
		return ""
	}
	var sb strings.Builder
	sb.WriteString("Relevant knowledge base context:\n\n")
	for i, chunk := range chunks {
		sb.WriteString(fmt.Sprintf("--- Source %d (type: %s, id: %s) ---\n", i+1, chunk.ResourceType, chunk.ResourceID.String()))
		sb.WriteString(chunk.ContentChunk)
		sb.WriteString("\n\n")
	}
	return sb.String()
}

// SearchSimilarChunks performs a full-text fallback search when vector search
// is not available (e.g., no stored embeddings).
func (s *AIService) SearchSimilarChunks(ctx context.Context, queryText string, limit int) ([]models.AIEmbedding, error) {
	chunks, err := s.repo.SearchChunks(ctx, queryText, limit)
	if err != nil {
		return nil, fmt.Errorf("search similar chunks: %w", err)
	}
	return chunks, nil
}

// StoreEmbedding stores a content chunk and its vector embedding.
func (s *AIService) StoreEmbedding(ctx context.Context, sourceType, sourceID, chunkText string, embedding []float32) error {
	emb := &models.AIEmbedding{
		ResourceType: sourceType,
		ContentChunk: chunkText,
		Embedding:    pgvector.NewVector(embedding),
	}
	// parse sourceID as UUID
	if err := emb.ResourceID.Scan(sourceID); err != nil {
		return fmt.Errorf("invalid source id: %w", err)
	}
	emb.TokenCount = len(strings.Fields(chunkText))
	emb.CreatedAt = time.Now().UTC()

	if err := s.repo.StoreEmbedding(ctx, emb); err != nil {
		return fmt.Errorf("store embedding: %w", err)
	}
	return nil
}

// Query performs semantic search and calls the Anthropic Claude API,
// returning the assembled answer and source citations.
func (s *AIService) Query(ctx context.Context, req AIQueryRequest, userID string) (*AIQueryResponse, error) {
	// Step 1: Retrieve similar chunks from the knowledge base.
	// Try vector search first; fall back to full-text search.
	chunks, err := s.repo.SearchChunks(ctx, req.Query, 5)
	if err != nil {
		s.log.Warn().Err(err).Msg("full-text chunk search failed, proceeding without context")
		chunks = nil
	}

	// Step 2: Build the prompt.
	contextBlock := s.BuildPromptContext(chunks)
	systemPrompt := systemPromptForIntent(req.Intent)

	var userMessage strings.Builder
	if contextBlock != "" {
		userMessage.WriteString(contextBlock)
		userMessage.WriteString("---\n\n")
	}
	if len(req.Context) > 0 {
		userMessage.WriteString("Additional context provided by the user:\n")
		for k, v := range req.Context {
			userMessage.WriteString(fmt.Sprintf("- %s: %s\n", k, v))
		}
		userMessage.WriteString("\n")
	}
	userMessage.WriteString("Question: ")
	userMessage.WriteString(req.Query)

	// Step 3: Call Anthropic API with streaming.
	answer, err := s.callAnthropicStreaming(ctx, systemPrompt, userMessage.String())
	if err != nil {
		return nil, fmt.Errorf("anthropic call: %w", err)
	}

	// Step 4: Build citations from retrieved chunks.
	sources := make([]AISource, 0, len(chunks))
	for _, chunk := range chunks {
		snippet := chunk.ContentChunk
		if len(snippet) > 200 {
			snippet = snippet[:200] + "…"
		}
		sources = append(sources, AISource{
			SourceType: chunk.ResourceType,
			SourceID:   chunk.ResourceID.String(),
			Snippet:    snippet,
		})
	}

	return &AIQueryResponse{
		Answer:  answer,
		Sources: sources,
	}, nil
}

// anthropicRequestBody is the JSON body sent to the Anthropic Messages API.
type anthropicRequestBody struct {
	Model     string               `json:"model"`
	MaxTokens int                  `json:"max_tokens"`
	Stream    bool                 `json:"stream"`
	System    string               `json:"system"`
	Messages  []anthropicMessage   `json:"messages"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// anthropicStreamEvent is a single SSE data payload from the Anthropic API.
type anthropicStreamEvent struct {
	Type  string                 `json:"type"`
	Index int                    `json:"index"`
	Delta *anthropicStreamDelta  `json:"delta,omitempty"`
}

type anthropicStreamDelta struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// callAnthropicStreaming posts to the Anthropic Messages API with stream=true,
// reads the SSE response, and returns the assembled text.
func (s *AIService) callAnthropicStreaming(ctx context.Context, systemPrompt, userMessage string) (string, error) {
	if s.anthropicAPIKey == "" {
		return "", fmt.Errorf("anthropic API key not configured")
	}

	body := anthropicRequestBody{
		Model:     anthropicModel,
		MaxTokens: 2048,
		Stream:    true,
		System:    systemPrompt,
		Messages: []anthropicMessage{
			{Role: "user", Content: userMessage},
		},
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicAPIURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("build http request: %w", err)
	}
	req.Header.Set("x-api-key", s.anthropicAPIKey)
	req.Header.Set("anthropic-version", anthropicVersion)
	req.Header.Set("content-type", "application/json")
	req.Header.Set("accept", "text/event-stream")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("anthropic API error %d: %s", resp.StatusCode, string(errBody))
	}

	// Parse the SSE stream.
	var assembled strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()

		// SSE lines begin with "data: "
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var event anthropicStreamEvent
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			// Skip malformed events
			continue
		}

		// content_block_delta events carry the incremental text.
		if event.Type == "content_block_delta" && event.Delta != nil && event.Delta.Type == "text_delta" {
			assembled.WriteString(event.Delta.Text)
		}
	}
	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("reading stream: %w", err)
	}

	return assembled.String(), nil
}
