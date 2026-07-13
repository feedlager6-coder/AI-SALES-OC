---
name: AI Sales OS Architecture
description: Key durable decisions, risks, and conventions for the AI Sales OS project
---

## Core Entity Naming Rule
The main entity is **Company** (not Lead/Prospect/Account). There is no `leads` table.
"Lead" colloquially = Company in status before QUALIFIED.

**Why:** Multiple docs used inconsistent names causing confusion. Canonical source: `docs/domain_model.md`.

**How to apply:** Always use `companies`, `contacts`, `deals` in code. Never create a `leads` table.

## Plugin Interface Requirement
Every external provider (2GIS, Hunter, Mailgun, OpenAI, etc.) MUST implement a typed Plugin Interface from `packages/plugins/interfaces/`. Core never imports provider implementations directly.

**Why:** Enables adding new providers without touching core. Prevents vendor lock-in.

**How to apply:** Before adding any external API call, check `docs/plugin_architecture.md`. Create interface → implement → register in `register-all.ts`.

## Race Condition: Email Daily Limit Counter
The `sent_today` counter in `email_accounts` table MUST NOT be a plain SQL integer with concurrent workers. Use Redis INCR with EXPIRE at midnight.

**Why:** Two workers can both read `sent_today=49`, both check `<50`, both send, both increment → limit exceeded. See `docs/00-audit-report.md` RISK-001.

**How to apply:** `REDIS.INCR(email_account:{id}:sent_today)` + `EXPIREAT` key to midnight.

## Multitenancy: Double Protection
workspace_id check is REQUIRED at two levels: (1) application-level WHERE clause in every DB query, (2) PostgreSQL RLS policy. Both must be active.

**Why:** Single-layer protection has failed in SaaS systems. Cross-tenant data leaks are critical security issues.

## Soft Delete Required
All business entities (Company, Contact, Deal, Campaign) use `deleted_at TIMESTAMPTZ NULL`. Hard DELETE is forbidden.

**Why:** Preserves audit trail, prevents cascade data loss, needed for compliance.

## Sprint 1.1 Complete, Running on Replit (as of 2026-07-13)
Monorepo (pnpm+Turborepo), Drizzle schema, Fastify API, Next.js web, BullMQ workers all build/typecheck/lint clean and run on Replit. Next milestone: Sprint 1.2 (CRM core + workspace provisioning) — see project tasks.

## Replit Runtime Setup
No Docker/external Redis on Replit: `redis-server` is started inline by the "API Server" workflow command itself (system dep installed via nix). Only port 5000 is public — Next.js proxies `/api/*` to the internal Fastify server (port 3001) via `rewrites()` in `next.config.ts`, with `NEXT_PUBLIC_API_URL=""` set only for the web workflow (not shared, since the API's zod env schema requires a valid URL and rejects empty string).

**Why:** Browsers can't reach non-public ports on `*.replit.dev`; same-origin proxying avoids cross-port CORS/cookie issues entirely.

## Better Auth + Drizzle Adapter Gotchas
Two fixes were needed to make Better Auth's Drizzle adapter work with our schema: (1) `users` table needs an explicit `emailVerified` boolean column — Better Auth's adapter hard-requires it even though the docs don't call it out clearly. (2) Set `advanced.database.generateId: false` in `betterAuth()` options when your ID columns are `uuid` with a DB-side default (`gen_random_uuid()`) — otherwise Better Auth generates its own non-UUID string IDs and inserts fail.

**How to apply:** Any new Better-Auth-backed entity table (if the pattern is reused) needs the same `emailVerified`-style required-field check against the adapter's expectations, and the same uuid/generateId setting.

## Architecture Audit Readiness Score
Before audit: 42/100. After documentation round: 81/100. Remaining gaps documented in `docs/00-audit-report.md`.
