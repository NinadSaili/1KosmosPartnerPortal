package middleware

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

// ipBucket is a simple token-bucket rate limiter for a single IP address.
type ipBucket struct {
	mu          sync.Mutex
	tokens      float64
	maxTokens   float64
	refillRate  float64 // tokens per second
	lastRefill  time.Time
	lastRequest time.Time
}

// allow returns true if the request should be permitted, false if it exceeds
// the rate limit.  Tokens are refilled continuously based on elapsed time.
func (b *ipBucket) allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(b.lastRefill).Seconds()
	b.tokens += elapsed * b.refillRate
	if b.tokens > b.maxTokens {
		b.tokens = b.maxTokens
	}
	b.lastRefill = now
	b.lastRequest = now

	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

// rateLimiterStore holds per-IP buckets and manages periodic cleanup.
type rateLimiterStore struct {
	buckets sync.Map // key: IP string → *ipBucket
	rate    float64  // requests per second derived from requestsPerMinute
	max     float64  // burst size (same as requestsPerMinute)
}

// newRateLimiterStore constructs the store and starts a background cleanup
// goroutine that removes stale entries every 5 minutes.
func newRateLimiterStore(requestsPerMinute int) *rateLimiterStore {
	rps := float64(requestsPerMinute) / 60.0
	s := &rateLimiterStore{
		rate: rps,
		max:  float64(requestsPerMinute),
	}
	go s.cleanupLoop()
	return s
}

// bucket returns the existing bucket for ip, or creates a new full one.
func (s *rateLimiterStore) bucket(ip string) *ipBucket {
	v, loaded := s.buckets.Load(ip)
	if loaded {
		return v.(*ipBucket)
	}
	b := &ipBucket{
		tokens:      s.max,
		maxTokens:   s.max,
		refillRate:  s.rate,
		lastRefill:  time.Now(),
		lastRequest: time.Now(),
	}
	// Use LoadOrStore to avoid overwriting a concurrently inserted bucket.
	actual, _ := s.buckets.LoadOrStore(ip, b)
	return actual.(*ipBucket)
}

// cleanupLoop removes buckets that have not been accessed in the last 10 minutes.
func (s *rateLimiterStore) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-10 * time.Minute)
		s.buckets.Range(func(key, value interface{}) bool {
			b := value.(*ipBucket)
			b.mu.Lock()
			idle := b.lastRequest.Before(cutoff)
			b.mu.Unlock()
			if idle {
				s.buckets.Delete(key)
			}
			return true
		})
	}
}

// RateLimiter returns a chi-compatible middleware that enforces a per-IP token
// bucket rate limit.  requestsPerMinute controls both the burst capacity and
// the sustained throughput.  Clients that exceed the limit receive 429.
func RateLimiter(requestsPerMinute int) func(http.Handler) http.Handler {
	store := newRateLimiterStore(requestsPerMinute)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := realIP(r)
			if !store.bucket(ip).allow() {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", "60")
				w.WriteHeader(http.StatusTooManyRequests)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"code":    "rate_limit_exceeded",
					"message": "too many requests; please slow down",
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// realIP extracts the client IP, preferring X-Real-IP / X-Forwarded-For when
// present (chi's RealIP middleware normally handles this, but we guard here too).
func realIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		// X-Forwarded-For can be "client, proxy1, proxy2"; take the first.
		parts := splitComma(ip)
		if len(parts) > 0 {
			return parts[0]
		}
	}
	return r.RemoteAddr
}

// splitComma splits s on commas and trims whitespace from each part.
func splitComma(s string) []string {
	raw := make([]string, 0)
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			raw = append(raw, trimSpace(s[start:i]))
			start = i + 1
		}
	}
	raw = append(raw, trimSpace(s[start:]))
	return raw
}

func trimSpace(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}
