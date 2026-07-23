-- Migration: 0004_hunt_entity
-- Adds the hunts table — the central entity of the Discover flow.
-- Every user search request is persisted as a Hunt before search begins.

DO $$ BEGIN
  CREATE TYPE "public"."hunt_status" AS ENUM(
    'draft',
    'confirmed',
    'searching',
    'completed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "hunts" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "created_by"  uuid NOT NULL,
  "raw_query"   text NOT NULL,
  "intent_json" jsonb NOT NULL DEFAULT '{}',
  "status"      "hunt_status" NOT NULL DEFAULT 'draft',
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "hunts"
    ADD CONSTRAINT "hunts_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "hunts"
    ADD CONSTRAINT "hunts_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hunts_workspace_idx"   ON "hunts" ("workspace_id");
CREATE INDEX IF NOT EXISTS "hunts_created_by_idx"  ON "hunts" ("created_by");
CREATE INDEX IF NOT EXISTS "hunts_status_idx"       ON "hunts" ("status");
