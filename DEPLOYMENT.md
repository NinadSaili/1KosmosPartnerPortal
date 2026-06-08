# Deployment Guide — 1Kosmos Partner Enablement Portal

---

## Local Development with Docker Compose

### Prerequisites

| Tool | Minimum version | Notes |
|------|-----------------|-------|
| Docker Desktop / Docker Engine | 24+ | `docker --version` |
| Docker Compose | v2.20+ | Bundled with Docker Desktop; standalone `docker compose` plugin otherwise |
| Node.js | 20 LTS | Required only for running the frontend outside Docker |
| Go | 1.22+ | Required only for running the backend outside Docker |
| Supabase CLI | latest | Optional — only needed if you want a fully local Supabase stack |

---

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/1kosmos/partner-portal.git
cd partner-portal

# 2. Create backend environment file and fill in values
cp backend/.env.example backend/.env
#    Open backend/.env in your editor and set at minimum:
#      SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET

# 3. Start the database and pgAdmin first so migrations can run against a live DB
docker compose up -d db pgadmin

# 4. Run database migrations
docker compose run --rm api go run ./cmd/migrate/...

# 5. (Optional) Apply seed data for local development
docker compose run --rm api go run ./cmd/seed/...

# 6. Start the API and frontend
docker compose up api frontend

# 7. Open the app
#    Frontend:  http://localhost:3000
#    API:       http://localhost:8080/api/v1
#    pgAdmin:   http://localhost:5050  (admin@admin.com / admin)
```

---

### Running Migrations

#### Automatic (recommended)

```bash
docker compose run --rm api go run ./cmd/migrate/...
```

The migrate command reads `DATABASE_URL` from the environment, discovers all
`*.sql` files under `backend/migrations/`, and applies any that have not yet
been recorded in the `schema_migrations` tracking table.

#### Manual with psql

```bash
# Connect directly to the Dockerised Postgres instance
docker compose exec db psql -U postgres -d partnerportal

# Inside psql, run each migration file in order:
\i /migrations/001_schema.sql
\i /migrations/002_indexes.sql
\i /migrations/003_seed_static.sql
\i /migrations/004_rls.sql

# Verify applied migrations
SELECT * FROM schema_migrations ORDER BY applied_at;
```

#### Verify the schema

```bash
docker compose exec db psql -U postgres -d partnerportal -c "\dt"
# Expected tables: users, organizations, courses, lessons, course_progress,
# certifications, assessments, issued_certificates, resources, deals,
# announcements, announcement_reads, audit_log, schema_migrations
```

---

### Supabase Setup

Supabase is used for authentication (magic links, JWT issuance) and as the
production Postgres host with pgvector enabled.

1. **Create a project** at [https://supabase.com/dashboard](https://supabase.com/dashboard).
   Choose the region closest to your primary user base.

2. **Enable the pgvector extension** (required for the AI query feature):

   ```sql
   -- Run in the Supabase SQL Editor
   create extension if not exists vector;
   ```

3. **Copy credentials** from *Project Settings → API* into `backend/.env`:

   ```
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_ANON_KEY=<anon-public-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-secret-key>
   ```

4. **Apply Row-Level Security policies.**
   The file `backend/migrations/004_rls.sql` contains RLS policies that use
   `auth.uid()` — a Supabase-specific function. These policies **cannot** be
   applied via the local Docker Postgres container; they must be run in the
   Supabase SQL Editor:

   - Open your project in the Supabase Dashboard.
   - Go to *SQL Editor → New query*.
   - Paste the contents of `backend/migrations/004_rls.sql`.
   - Click *Run*.

5. **Enable email confirmation** for production (disabled by default in
   Supabase):
   *Authentication → Providers → Email → Enable email confirmations*.

---

### Environment Variables Reference

All variables are read by the Go backend from `backend/.env` (local) or from
the platform secret store (production).

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string, e.g. `postgres://user:pass@host:5432/dbname?sslmode=require` |
| `SUPABASE_URL` | Yes | — | Your Supabase project URL (used for auth token verification) |
| `SUPABASE_ANON_KEY` | Yes | — | Supabase anon/public key (safe to use in browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Supabase service-role key — keep secret, backend only |
| `JWT_SECRET` | Yes | — | HS256 signing secret for internal JWTs; minimum 32 random bytes |
| `PORT` | No | `8080` | Port the Go HTTP server listens on |
| `ALLOWED_ORIGINS` | Yes | — | Comma-separated CORS origins, e.g. `https://partners.1kosmos.com` |
| `SENDGRID_API_KEY` | Yes | — | SendGrid API key for transactional email (magic links, welcome emails) |
| `SENDGRID_FROM_EMAIL` | Yes | — | Verified sender address, e.g. `noreply@partnerportal.1kosmos.com` |
| `OPENAI_API_KEY` | Yes | — | OpenAI API key used by the `/ai/query` endpoint |
| `OPENAI_MODEL` | No | `gpt-4o` | Model name passed to the OpenAI Chat Completions API |
| `LOG_LEVEL` | No | `info` | Zerolog level: `debug`, `info`, `warn`, `error` |
| `ENV` | No | `development` | Runtime environment label; set to `production` in prod |

---

### Seed Data

```bash
# Apply seed data (creates test users, a demo org, sample courses, etc.)
docker compose run --rm api go run ./cmd/seed/...
```

> **Note:** The seed script uses fixed UUIDs for all test records (see
> `backend/cmd/seed/main.go`). These are predictable identifiers meant for
> local development and automated testing only. **Never apply seed data to a
> production database** — the fixed UUIDs and plaintext test passwords are a
> security risk in any public-facing environment.

Default test credentials created by the seed:

| Email | Password | Role |
|---|---|---|
| `admin@1kosmos.com` | `Seed$ecret1` | `vendor_admin` |
| `partner-admin@acme.com` | `Seed$ecret1` | `partner_admin` |
| `user@acme.com` | `Seed$ecret1` | `partner_user` |

---

## Production Deployment

---

### Option A: Railway

Railway is the simplest option for teams that want zero-infrastructure
management. Note that Railway's built-in Postgres does **not** support the
pgvector extension; use a Supabase cloud database instead.

```bash
# 1. Install the Railway CLI
npm install -g @railway/cli

# 2. Authenticate and create a new project
railway login
railway init        # select "Empty project", name it "partner-portal"

# 3. Add a Postgres service (Railway managed)
#    NOTE: pgvector is not available on Railway Postgres.
#    Use Supabase as the external DATABASE_URL instead.
#    Skip this step and set DATABASE_URL to your Supabase connection string.

# 4. Link and create two services: backend and frontend
railway service create --name backend
railway service create --name frontend

# 5. Set all required environment variables via the Railway dashboard
#    (Project → backend service → Variables):
#      DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY,
#      SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, ALLOWED_ORIGINS,
#      SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, OPENAI_API_KEY, ENV=production

# 6. Deploy both services
railway up

# 7. (Optional) Set a custom domain
#    Dashboard → backend service → Settings → Custom Domain
#    Dashboard → frontend service → Settings → Custom Domain
```

Railway auto-detects the `Dockerfile` in each subdirectory and builds
accordingly.

---

### Option B: Fly.io

Fly.io gives you more control over regions and machine sizes. The recommended
setup deploys the Go API and the React/Nginx frontend as separate Fly apps,
with Supabase cloud as the database.

#### Backend

```bash
# 1. Install flyctl
curl -L https://fly.io/install.sh | sh

# 2. Launch the backend app from the backend directory
cd backend
fly launch
# Select: app name (e.g. partner-portal-api), region (closest to users),
#         no Postgres (we use Supabase), no Redis

# 3. Set secrets — these map to environment variables at runtime
fly secrets set \
  DATABASE_URL="postgres://..." \
  SUPABASE_URL="https://xxx.supabase.co" \
  SUPABASE_ANON_KEY="eyJ..." \
  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  JWT_SECRET="$(openssl rand -hex 32)" \
  ALLOWED_ORIGINS="https://partner-portal-web.fly.dev" \
  SENDGRID_API_KEY="SG.xxx" \
  SENDGRID_FROM_EMAIL="noreply@partnerportal.1kosmos.com" \
  OPENAI_API_KEY="sk-..." \
  ENV="production"

# 4. Deploy
fly deploy

# 5. Verify
curl https://partner-portal-api.fly.dev/api/v1/health
```

#### Frontend

```bash
# 1. Launch the frontend app from the frontend directory
cd ../frontend
fly launch
# Select: app name (e.g. partner-portal-web), same region

# 2. Set the API base URL so the React build points at the backend
fly secrets set VITE_API_BASE_URL="https://partner-portal-api.fly.dev/api/v1"

# 3. Deploy
fly deploy
```

#### Database

Use Supabase cloud (see [Supabase Setup](#supabase-setup) above). Do not run
a separate Postgres on Fly.io unless you have a specific reason — Supabase
provides managed backups, connection pooling via PgBouncer, and the pgvector
extension out of the box.

---

### Option C: Docker on Any VPS

Use this approach on DigitalOcean Droplets, AWS EC2, Hetzner, Linode, etc.

#### `docker-compose.prod.yml`

```yaml
version: "3.9"

services:
  api:
    image: ghcr.io/1kosmos/partner-portal-api:latest
    restart: always
    env_file:
      - /etc/partner-portal/secrets.env   # host-managed secrets file (600 perms)
    expose:
      - "8080"
    depends_on:
      - nginx
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/api/v1/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  frontend:
    image: ghcr.io/1kosmos/partner-portal-web:latest
    restart: always
    expose:
      - "3000"

  nginx:
    image: nginx:1.27-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro   # certbot certificates
    depends_on:
      - api
      - frontend
```

**Minimal `nginx/nginx.conf` snippet:**

```nginx
server {
    listen 443 ssl http2;
    server_name partners.1kosmos.com;

    ssl_certificate     /etc/letsencrypt/live/partners.1kosmos.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/partners.1kosmos.com/privkey.pem;

    location /api/ {
        proxy_pass http://api:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
    }
}

server {
    listen 80;
    server_name partners.1kosmos.com;
    return 301 https://$host$request_uri;
}
```

**Deploy:**

```bash
# Pull latest images and restart affected containers
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

---

### Post-Deployment Checklist

- [ ] All required environment variables are set (see table above)
- [ ] Database migrations applied (`go run ./cmd/migrate/...` or equivalent)
- [ ] `pgvector` extension enabled in Supabase (`CREATE EXTENSION vector;`)
- [ ] Supabase RLS policies applied via SQL Editor (`004_rls.sql`)
- [ ] `ALLOWED_ORIGINS` set to the exact frontend domain(s) — no trailing slash
- [ ] SendGrid sender address verified in the SendGrid dashboard
- [ ] Chromium is available in the container for PDF generation — it is
      installed automatically by the backend `Dockerfile` (`apt-get install -y chromium`)
- [ ] `GET /api/v1/health` returns `{"status":"ok"}`
- [ ] Supabase email confirmation enabled for production
- [ ] Seed data applied **only** on staging/test environments — never production

---

### CI/CD

The following GitHub Actions workflow runs on every push to `main`:
tests pass → Docker images are built and pushed to GHCR → the Fly.io
backend and frontend apps are redeployed.

```yaml
# .github/workflows/deploy.yml
name: Test → Build → Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_API: ghcr.io/${{ github.repository }}/api
  IMAGE_WEB: ghcr.io/${{ github.repository }}/web

jobs:
  test:
    name: Run tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: "1.22"

      - name: Run backend tests
        working-directory: backend
        run: go test ./... -race -coverprofile=coverage.out

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Run frontend tests
        working-directory: frontend
        run: |
          npm ci
          npm test -- --watchAll=false

  build-and-push:
    name: Build & push Docker images
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push API image
        uses: docker/build-push-action@v6
        with:
          context: backend
          push: true
          tags: ${{ env.IMAGE_API }}:latest,${{ env.IMAGE_API }}:${{ github.sha }}

      - name: Build and push Web image
        uses: docker/build-push-action@v6
        with:
          context: frontend
          push: true
          tags: ${{ env.IMAGE_WEB }}:latest,${{ env.IMAGE_WEB }}:${{ github.sha }}

  deploy:
    name: Deploy to Fly.io
    needs: build-and-push
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Install flyctl
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy backend
        working-directory: backend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
        run: flyctl deploy --remote-only --image ${{ env.IMAGE_API }}:${{ github.sha }}

      - name: Deploy frontend
        working-directory: frontend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
        run: flyctl deploy --remote-only --image ${{ env.IMAGE_WEB }}:${{ github.sha }}
```

**Required GitHub Actions secrets:**

| Secret | Description |
|---|---|
| `FLY_API_TOKEN` | Fly.io deploy token (`flyctl auth token`) |
| `GITHUB_TOKEN` | Automatically provided — no action needed |

---

### Monitoring and Observability

**Structured logging**

The backend uses [zerolog](https://github.com/rs/zerolog) and emits
newline-delimited JSON to stdout. Every log line includes `level`, `time`,
`request_id`, `method`, `path`, `status`, and `latency_ms`.

```bash
# Tail logs in production (Fly.io)
fly logs -a partner-portal-api

# Pipe to jq for readable local output
docker compose logs -f api | jq .
```

**Log shipping**

Pipe stdout to your preferred log aggregation platform:

- **Datadog:** Use the Datadog log agent or set the `DD_AGENT_HOST` environment variable with the `datadog-agent` sidecar pattern.
- **Logtail / Better Stack:** `fly logs | vector --config vector.toml` or use the Logtail Fly.io integration.
- **AWS CloudWatch:** Use the `awslogs` Docker log driver in `docker-compose.prod.yml`.

**Health check**

```
GET /api/v1/health
```

Returns HTTP 200 with `{"status":"ok","version":"1.0.0","timestamp":"..."}`.
Use this endpoint for:

- Docker `HEALTHCHECK` directive (already configured in `Dockerfile`)
- Fly.io health checks (configured in `fly.toml` under `[http_service.checks]`)
- Uptime monitors (UptimeRobot, Checkly, Better Uptime, etc.)

**Metrics (future work)**

A Prometheus-compatible `/api/v1/metrics` endpoint is planned. In the
meantime, derive key metrics from structured logs:

- Request rate and error rate by parsing `status` field
- P95/P99 latency from `latency_ms`
- AI query token usage from `tokens_used` field on `/ai/query` responses

---

### Security Hardening

**JWT Secret rotation**

Rotate `JWT_SECRET` periodically (recommended: every 90 days). After rotation,
all existing access tokens are immediately invalidated. Users will be prompted
to log in again; refresh tokens issued before rotation will also fail. Announce
a maintenance window before rotating in production.

```bash
# Generate a new 256-bit secret
openssl rand -hex 32

# Update the secret in Fly.io
fly secrets set JWT_SECRET="<new-value>" -a partner-portal-api
```

**Supabase service role key**

The `SUPABASE_SERVICE_ROLE_KEY` bypasses all Row-Level Security policies. It
must:

- Never be exposed to the frontend or included in any client-side bundle.
- Be stored only as a backend environment secret.
- Be rotated immediately if accidentally committed or leaked.

**CORS configuration**

Set `ALLOWED_ORIGINS` to the exact frontend origin — no wildcards in
production:

```
# Correct
ALLOWED_ORIGINS=https://partners.1kosmos.com

# Wrong — never use wildcard in production
ALLOWED_ORIGINS=*
```

If you serve the frontend from multiple domains (e.g. a CDN alias), list all
allowed origins as a comma-separated value:

```
ALLOWED_ORIGINS=https://partners.1kosmos.com,https://www.partners.1kosmos.com
```

**Supabase email confirmation**

Enable *Authentication → Providers → Email → Confirm email* in the Supabase
dashboard for production. This prevents account takeover via typo-squatted
email addresses. The magic-link flow already sends verification emails, but
password-based registration requires confirmation to be explicitly enabled.

**RLS policy review cadence**

Review all policies in `backend/migrations/004_rls.sql` after any schema
change that adds a new table or alters a foreign-key relationship. A missing
RLS policy on a new table defaults to `DENY ALL` in Supabase, which can
silently break features. Add a RLS policy review to your PR checklist for any
migration that changes the schema.

**Rate limiting**

The API enforces per-IP rate limits at the middleware layer:

- Auth endpoints (`/auth/*`): 10 requests per minute
- AI query endpoint (`/ai/query`): 20 requests per minute
- All other endpoints: 200 requests per minute

Adjust limits in `backend/internal/middleware/ratelimit.go` before production.
Consider placing an additional rate-limiting layer at the Nginx or CDN level
for DDoS mitigation.

**Dependency scanning**

```bash
# Go vulnerabilities
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...

# Node/npm vulnerabilities
npm audit --audit-level=high
```

Run these checks in CI by adding them as steps in the `test` job of the
GitHub Actions workflow.
