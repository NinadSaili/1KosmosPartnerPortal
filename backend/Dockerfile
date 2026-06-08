# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

# Cache dependency downloads separately from source
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /api ./cmd/api

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    chromium \
    chromium-chromedriver \
    nss \
    freetype \
    harfbuzz \
    ttf-freefont

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set Chromium environment variables for chromedp
ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/ \
    CHROMEDP_NO_SANDBOX=true

WORKDIR /home/appuser

# Copy the compiled binary from the builder stage
COPY --from=builder /api /api

# Ensure the binary is executable
RUN chmod +x /api

# Drop privileges
USER appuser

EXPOSE 8080

CMD ["/api"]
