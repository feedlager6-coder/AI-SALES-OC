---
name: AI Sales OS Pipeline Bugs
description: Bugs found and fixed during MVP validation; runtime gotchas for the email worker pipeline
---

# AI Sales OS Pipeline Bugs (fixed 2026-07-28)

## Bug 1: contactId empty string → UUID constraint crash
**Files:** `apps/api/src/routes/campaigns.ts`, `apps/workers/src/email/email.worker.ts`
**Symptom:** DB insert into `email_sends` crashed with UUID type violation when no contactId was provided at enrollment.
**Fix:** Changed `contactId: body.contactId ?? ''` → `|| null` in the campaigns route job payload. Defensive fix in worker: `const contactId = payload.contactId || null`.
**Why:** The `contact_id` DB column is UUID-typed. Empty string `""` is not null/undefined so `?? null` passes it through unchanged.

## Bug 2: Worker only checked companies.emails[] (always empty in Discover flow)
**File:** `apps/workers/src/email/email.worker.ts`
**Symptom:** Every enrollment from Discover-sourced companies stopped with `email.no_recipient_email` because `companies.emails[]` is always `{}`. Real emails are in `companies.contacts` JSONB.
**Fix:** Extended fallback to iterate `contacts JSONB → c.email` after checking `emails[]`.
**Why:** The Discover flow / Mock provider populates `contacts` JSONB, not `emails[]`. The `emails[]` column is reserved for directly imported email addresses.

## Bug 3: Plugin not configured → emailSends stuck in 'queued', sequence frozen
**File:** `apps/workers/src/email/email.worker.ts`
**Symptom:** When Mailgun/Brevo not configured, worker returned early without updating the `emailSends` record (left as `queued`) and without advancing the sequence enrollment (left as `active`, frozen).
**Fix:** Now marks send as `status='bounced', provider_id='simulated'`, advances `currentStep`, and calls `scheduleNextStep` so the sequence continues.
**Why:** Without this fix, the first step of every sequence blocks forever when no email provider is configured — critical for dev/staging without real credentials.

## How to apply
Any time the email pipeline is touched:
1. contactId must always be null (not `""`) when absent
2. Recipient resolution: `contacts[].email` JSONB is the primary fallback for Discover-sourced companies
3. Plugin-not-configured path must always advance the sequence
