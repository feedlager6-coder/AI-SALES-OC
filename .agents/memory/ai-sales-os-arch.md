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

## Phase 0 Complete — No Production Code Yet
As of 2025-07, only documentation exists. The next step is Sprint 1.1: monorepo setup, Docker Compose, Drizzle schema, Fastify boilerplate, JWT auth.

## Architecture Audit Readiness Score
Before audit: 42/100. After documentation round: 81/100. Remaining gaps documented in `docs/00-audit-report.md`.
