-- Search Engine V4: new columns for companies and hunts
-- Pass 1 of AI_IMPLEMENTATION_PLAN.md

-- companies: V4 Signal domain model (full objects with date/weight/confidence)
ALTER TABLE "companies" ADD COLUMN "signals" jsonb DEFAULT '[]'::jsonb NOT NULL;

-- companies: Contact Discovery waterfall results (ContactCandidate[])
ALTER TABLE "companies" ADD COLUMN "contacts" jsonb DEFAULT '[]'::jsonb NOT NULL;

-- companies: field-level provenance — which provider supplied each field
ALTER TABLE "companies" ADD COLUMN "field_provenance" jsonb DEFAULT '{}'::jsonb NOT NULL;

-- companies: alternative names accumulated during dedup merges (ребрендинг, aliases)
ALTER TABLE "companies" ADD COLUMN "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL;

-- hunts: summary of which providers were queried and their outcome
ALTER TABLE "hunts" ADD COLUMN "search_plan_summary" jsonb DEFAULT '{}'::jsonb;

-- hunts: per-company rejection feedback (reason user dismissed a result)
ALTER TABLE "hunts" ADD COLUMN "rejection_feedback" jsonb DEFAULT '[]'::jsonb NOT NULL;
