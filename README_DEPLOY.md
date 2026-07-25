# AI Sales OS — Deployment Guide

> **Target platform:** Railway  
> **Stack:** Next.js 15 (Web) + Fastify 5 (API) + BullMQ (Workers) + PostgreSQL 16 + Redis 7

---

## Architecture Overview

The project runs as **three separate services** + two managed datastores:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web (Next.js) │────▶│  API (Fastify)  │────▶│ Workers (BullMQ)│
│   port: $PORT   │     │   port: $PORT   │     │   (no port)     │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                        │
                    ┌────────────┴────────────┐           │
                    │                         │           │
              ┌─────▼──────┐         ┌────────▼───────────▼─┐
              │ PostgreSQL │         │        Redis 7         │
              └────────────┘         └───────────────────────┘
```

- **Web** serves the Next.js frontend. Rewrites `/api/*` to the API service internally.
- **API** is the Fastify REST backend. Handles auth, business logic, and job dispatch.
- **Workers** process background BullMQ jobs (enrichment, email, AI, scraping, contact discovery).
- **PostgreSQL** is the primary database (Drizzle ORM, 6 migrations).
- **Redis** is the job queue broker (BullMQ) and counter store.

---

## Prerequisites

- [Railway account](https://railway.app)
- `railway` CLI: `npm install -g @railway/cli`
- `pnpm >= 10` and `node >= 22` for local development

---

## Local Development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your actual values
```

### 3. Start infrastructure (PostgreSQL + Redis)

**Option A — Replit (already configured):**
Both workflows are pre-configured. Start "API Server" and "Start application" from the Replit UI.

**Option B — Docker (local):**
```bash
docker compose -f infra/docker-compose.yml up -d
```

**Option C — Manual:**
- Start PostgreSQL 16 locally
- Start Redis 7 locally: `redis-server --port 6379`

### 4. Build packages (required before first run)

```bash
pnpm turbo run build --filter='./packages/*'
```

### 5. Run database migrations

```bash
cd packages/db && pnpm db:migrate && cd ../..
```

### 6. Start services

```bash
# Terminal 1 — API (port 3001)
cd apps/api && pnpm dev

# Terminal 2 — Web (port 3000 or 5000 on Replit)
cd apps/web && pnpm dev

# Terminal 3 — Workers (optional for local dev)
cd apps/workers && pnpm dev
```

Web is available at `http://localhost:3000` (or `http://localhost:5000` on Replit).

**Test credentials:** `test@example.com` / `testpass123`

---

## Railway Deployment

### Step 1 — Create a Railway project

```bash
railway login
railway init
```

### Step 2 — Add managed services

In the Railway dashboard, add:
- **PostgreSQL 16** plugin
- **Redis 7** plugin

Copy their connection URLs — you'll need them for environment variables.

### Step 3 — Create Railway services

Create **three services** from the same repository root:

| Service name | Root dir | Build command | Start command |
|---|---|---|---|
| `api` | `/` | see `apps/api/railway.toml` | `node apps/api/dist/server.js` |
| `web` | `/` | see `apps/web/railway.toml` | `node apps/web/.next/standalone/server.js` |
| `workers` | `/` | see `apps/workers/railway.toml` | `node apps/workers/dist/main.js` |

Each service reads its Railway config from the corresponding `railway.toml` file.

### Step 4 — Run database migrations (one-time)

Add a **one-off job** service or run from local CLI against the Railway PostgreSQL:

```bash
DATABASE_URL="<railway-postgres-url>" pnpm db:migrate
```

Or add a temporary Railway service with start command:
```bash
pnpm install --frozen-lockfile && pnpm turbo run build --filter='./packages/*' && cd packages/db && pnpm db:migrate
```

### Step 5 — Configure environment variables

Set the following in each Railway service. Variables shared across all three services can be set at the project level.

#### Shared (all three services)

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://:pass@host:6379` |
| `BETTER_AUTH_SECRET` | Auth signing secret (≥32 chars) | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | AES-256 key for API keys at rest (64 hex chars) | `openssl rand -hex 32` |
| `NODE_ENV` | Environment | `production` |
| `LOG_LEVEL` | Log verbosity | `info` |

#### API service only

| Variable | Description | Example |
|---|---|---|
| `PORT` | Set by Railway automatically | (automatic) |
| `BETTER_AUTH_URL` | **Public** URL of the API service | `https://api-xxx.railway.app` |

#### Web service only

| Variable | Description | Example |
|---|---|---|
| `PORT` | Set by Railway automatically | (automatic) |
| `NEXT_PUBLIC_API_URL` | Leave **empty** (uses relative rewrites) | `""` |
| `BETTER_AUTH_SECRET` | Must match API service | same value |
| `BETTER_AUTH_URL` | Public URL of the API service | `https://api-xxx.railway.app` |
| `INTERNAL_API_URL` | Internal Railway URL of the API service | `https://api.railway.internal` |

#### Workers service only

| Variable | Description |
|---|---|
| `DATABASE_URL` | Same as shared |
| `REDIS_URL` | Same as shared |
| `BETTER_AUTH_SECRET` | Same as shared |
| `ENCRYPTION_KEY` | Same as shared |
| `NODE_ENV=production` | |

#### Optional (enable specific integrations)

| Variable | Integration |
|---|---|
| `OPENAI_API_KEY` | AI email generation, classification |
| `ANTHROPIC_API_KEY` | Alternative AI provider |
| `TWOGIS_API_KEY` | 2GIS company search |
| `HUNTER_API_KEY` | Hunter.io email discovery |
| `SNOV_API_KEY` | Snov.io email discovery |
| `DADATA_API_KEY` | DaData enrichment (Russian registry) |
| `MAILGUN_API_KEY` + `MAILGUN_DOMAIN` | Email sending via Mailgun |
| `BREVO_API_KEY` | Email sending via Brevo |
| `TELEGRAM_BOT_TOKEN` | Telegram notifications |
| `MINIO_ENDPOINT` + `MINIO_PORT` + `MINIO_ACCESS_KEY` + `MINIO_SECRET_KEY` + `MINIO_BUCKET` | File storage |

### Step 6 — Deploy

```bash
# Deploy all services
railway up
```

Or push to the connected Git branch — Railway will redeploy automatically.

---

## Health Checks

Once deployed, verify each service:

```bash
# API health
curl https://<api-service>.railway.app/api/health

# Web — should return the Next.js app
curl https://<web-service>.railway.app/
```

---

## Generating Secure Keys

```bash
# BETTER_AUTH_SECRET (≥32 chars)
openssl rand -hex 32

# ENCRYPTION_KEY (exactly 64 hex chars = 32 bytes)
openssl rand -hex 32
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| API crashes on start | Missing required env var | Check Railway logs; ensure all shared vars are set |
| Web shows 502 on API calls | Rewrite points to localhost:3001 | See blocking issue above |
| Workers not processing jobs | `REDIS_URL` misconfigured | Verify Redis URL matches the one used by API |
| Auth errors / login fails | `BETTER_AUTH_SECRET` mismatch | Ensure Web and API use the same secret |
| DB migration fails | `DATABASE_URL` wrong or DB unreachable | Test connection string with `psql $DATABASE_URL` |
