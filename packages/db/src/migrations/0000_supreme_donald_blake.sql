CREATE TYPE "public"."workspace_plan" AS ENUM('trial', 'starter', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."workspace_subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'manager', 'sdr');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."company_source" AS ENUM('2gis', 'hhru', 'csv', 'manual', 'api');--> statement-breakpoint
CREATE TYPE "public"."company_status" AS ENUM('new', 'enriching', 'enriched', 'qualified', 'low_quality', 'contacted', 'replied', 'meeting', 'proposal', 'negotiation', 'won', 'closed_lost', 'paused_30d', 'opted_out');--> statement-breakpoint
CREATE TYPE "public"."enrichment_status" AS ENUM('pending', 'in_progress', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."contact_seniority" AS ENUM('c_level', 'vp', 'director', 'manager', 'individual');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('valid', 'invalid', 'catch_all', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."activity_direction" AS ENUM('outbound', 'inbound', 'internal');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('email_sent', 'email_opened', 'email_clicked', 'email_replied', 'email_bounced', 'call', 'meeting', 'note', 'status_change', 'enrichment_completed', 'ai_classified', 'task_created', 'deal_created', 'deal_stage_changed');--> statement-breakpoint
CREATE TYPE "public"."deal_stage" AS ENUM('new', 'qualified', 'proposal', 'negotiation', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'completed', 'snoozed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('call', 'email', 'meeting', 'proposal', 'follow_up', 'custom');--> statement-breakpoint
CREATE TYPE "public"."bounce_type" AS ENUM('hard', 'soft');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'paused', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."email_provider" AS ENUM('mailgun', 'brevo', 'ses', 'smtp');--> statement-breakpoint
CREATE TYPE "public"."email_send_status" AS ENUM('queued', 'sent', 'delivered', 'bounced', 'complained');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'paused', 'completed', 'replied', 'unsubscribed', 'bounced', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."reply_classification" AS ENUM('interested', 'not_now', 'not_interested', 'out_of_office', 'question', 'other');--> statement-breakpoint
CREATE TYPE "public"."warmup_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."ai_agent" AS ENUM('writer', 'classifier', 'extractor', 'icp_scorer', 'custom');--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"plan" "workspace_plan" DEFAULT 'trial' NOT NULL,
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"subscription_status" "workspace_subscription_status" DEFAULT 'trialing' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" varchar(100) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"role" "user_role" DEFAULT 'sdr' NOT NULL,
	"avatar_url" text,
	"telegram_chat_id" bigint,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"invited_by" uuid,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"inn" varchar(12),
	"ogrn" varchar(15),
	"domain" varchar(255),
	"name" varchar(500) NOT NULL,
	"legal_name" varchar(500),
	"industry" varchar(100),
	"okved_code" varchar(20),
	"city" varchar(255),
	"region" varchar(255),
	"address" text,
	"employees_count" varchar(50),
	"revenue_rub" bigint,
	"phones" text[] DEFAULT '{}' NOT NULL,
	"emails" text[] DEFAULT '{}' NOT NULL,
	"website" text,
	"linkedin_url" text,
	"vk_url" text,
	"telegram_url" text,
	"status" "company_status" DEFAULT 'new' NOT NULL,
	"icp_score" smallint DEFAULT 0 NOT NULL,
	"enrichment_status" "enrichment_status" DEFAULT 'pending' NOT NULL,
	"enriched_at" timestamp with time zone,
	"enrichment_sources" jsonb DEFAULT '[]' NOT NULL,
	"pain_points" text[] DEFAULT '{}' NOT NULL,
	"tech_stack" text[] DEFAULT '{}' NOT NULL,
	"growth_signals" text[] DEFAULT '{}' NOT NULL,
	"ai_summary" text,
	"source" "company_source" DEFAULT 'manual' NOT NULL,
	"source_id" varchar(500),
	"custom_fields" jsonb DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"company_id" uuid,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"full_name" varchar(500),
	"title" varchar(255),
	"seniority" "contact_seniority",
	"department" varchar(100),
	"email" varchar(255),
	"email_status" "email_status",
	"email_confidence" numeric(3, 2),
	"email_source" varchar(50),
	"phone" varchar(50),
	"linkedin_url" text,
	"telegram" varchar(100),
	"enrichment_status" "enrichment_status" DEFAULT 'pending' NOT NULL,
	"enriched_at" timestamp with time zone,
	"opted_out" boolean DEFAULT false NOT NULL,
	"opted_out_at" timestamp with time zone,
	"custom_fields" jsonb DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"company_id" uuid,
	"contact_id" uuid,
	"deal_id" uuid,
	"type" "activity_type" NOT NULL,
	"direction" "activity_direction",
	"subject" text,
	"body" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"performed_by" uuid,
	"automated" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"company_id" uuid,
	"contact_id" uuid,
	"assigned_to" uuid,
	"title" varchar(500) NOT NULL,
	"value_rub" bigint,
	"stage" "deal_stage" DEFAULT 'new' NOT NULL,
	"probability" smallint DEFAULT 0 NOT NULL,
	"expected_close" date,
	"lost_reason" text,
	"won_at" timestamp with time zone,
	"lost_at" timestamp with time zone,
	"custom_fields" jsonb DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"assigned_to" uuid,
	"created_by" uuid,
	"company_id" uuid,
	"contact_id" uuid,
	"type" "task_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" uuid,
	"name" varchar(255) NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"vertical" varchar(100),
	"icp_filter" jsonb DEFAULT '{}' NOT NULL,
	"sending_settings" jsonb DEFAULT '{
      "days": [1,2,3,4,5],
      "time_from": "09:00",
      "time_to": "18:00",
      "timezone": "Europe/Moscow",
      "daily_limit": 100
    }' NOT NULL,
	"stats" jsonb DEFAULT '{
      "enrolled": 0, "sent": 0, "opened": 0,
      "clicked": 0, "replied": 0, "meetings": 0
    }' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"provider" "email_provider" NOT NULL,
	"credentials_encrypted" text,
	"warmup_enabled" boolean DEFAULT false NOT NULL,
	"warmup_status" "warmup_status" DEFAULT 'not_started' NOT NULL,
	"reputation_score" smallint,
	"daily_limit" smallint DEFAULT 50 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"contact_id" uuid,
	"step_number" smallint NOT NULL,
	"subject" text,
	"body_html" text,
	"body_text" text,
	"from_email" varchar(255) NOT NULL,
	"to_email" varchar(255) NOT NULL,
	"provider_id" text,
	"provider" "email_provider",
	"status" "email_send_status" DEFAULT 'queued' NOT NULL,
	"bounce_type" "bounce_type",
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_sends_provider_id_unique" UNIQUE("provider_id")
);
--> statement-breakpoint
CREATE TABLE "sequence_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"sequence_id" uuid,
	"company_id" uuid,
	"contact_id" uuid,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"current_step" smallint DEFAULT 0 NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"reply_at" timestamp with time zone,
	"reply_classification" "reply_classification",
	"pause_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"name" varchar(255) NOT NULL,
	"steps" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent" "ai_agent" NOT NULL,
	"model" varchar(100) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"error_code" varchar(100),
	"input_hash" char(64),
	"output_preview" text,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"service" varchar(100) NOT NULL,
	"key_encrypted" text NOT NULL,
	"label" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrichment_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"company_id" uuid,
	"contact_id" uuid,
	"status" "enrichment_status" DEFAULT 'pending' NOT NULL,
	"providers_tried" jsonb DEFAULT '[]' NOT NULL,
	"results" jsonb DEFAULT '{}' NOT NULL,
	"error" text,
	"retry_count" smallint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_enrollment_id_sequence_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."sequence_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_jobs" ADD CONSTRAINT "enrichment_jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_jobs" ADD CONSTRAINT "enrichment_jobs_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "users_workspace_email_idx" ON "users" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE INDEX "users_workspace_idx" ON "users" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_workspace_inn_idx" ON "companies" USING btree ("workspace_id","inn") WHERE "companies"."inn" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_workspace_domain_idx" ON "companies" USING btree ("workspace_id","domain") WHERE "companies"."domain" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "companies_workspace_idx" ON "companies" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "companies_icp_score_idx" ON "companies" USING btree ("workspace_id","icp_score");--> statement-breakpoint
CREATE INDEX "companies_industry_idx" ON "companies" USING btree ("workspace_id","industry");--> statement-breakpoint
CREATE INDEX "companies_city_idx" ON "companies" USING btree ("workspace_id","city");--> statement-breakpoint
CREATE INDEX "companies_status_idx" ON "companies" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "companies_enrichment_pending_idx" ON "companies" USING btree ("workspace_id","created_at") WHERE "companies"."enrichment_status" = 'pending';--> statement-breakpoint
CREATE INDEX "companies_fts_idx" ON "companies" USING gin (to_tsvector('russian', "name" || ' ' || COALESCE("legal_name", '')));--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_workspace_email_idx" ON "contacts" USING btree ("workspace_id","email") WHERE "contacts"."email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "contacts_workspace_idx" ON "contacts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "contacts_company_idx" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE INDEX "activities_company_idx" ON "activities" USING btree ("company_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activities_workspace_idx" ON "activities" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activities_contact_idx" ON "activities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "deals_workspace_idx" ON "deals" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "deals_company_idx" ON "deals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "deals_stage_idx" ON "deals" USING btree ("workspace_id","stage");--> statement-breakpoint
CREATE INDEX "tasks_workspace_idx" ON "tasks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "tasks_assigned_to_idx" ON "tasks" USING btree ("assigned_to","status");--> statement-breakpoint
CREATE INDEX "tasks_company_idx" ON "tasks" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "campaigns_workspace_idx" ON "campaigns" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "email_accounts_workspace_idx" ON "email_accounts" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_accounts_workspace_email_idx" ON "email_accounts" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE INDEX "email_sends_enrollment_idx" ON "email_sends" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "email_sends_provider_id_idx" ON "email_sends" USING btree ("provider_id","provider");--> statement-breakpoint
CREATE INDEX "email_sends_workspace_idx" ON "email_sends" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_sequence_company_idx" ON "sequence_enrollments" USING btree ("sequence_id","company_id");--> statement-breakpoint
CREATE INDEX "enrollments_workspace_idx" ON "sequence_enrollments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "enrollments_active_idx" ON "sequence_enrollments" USING btree ("workspace_id","current_step") WHERE "sequence_enrollments"."status" = 'active';--> statement-breakpoint
CREATE INDEX "enrollments_company_idx" ON "sequence_enrollments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sequences_campaign_idx" ON "sequences" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "ai_logs_workspace_idx" ON "ai_logs" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "ai_logs_agent_idx" ON "ai_logs" USING btree ("workspace_id","agent");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_workspace_service_idx" ON "api_keys" USING btree ("workspace_id","service");--> statement-breakpoint
CREATE INDEX "api_keys_workspace_idx" ON "api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "audit_logs_workspace_idx" ON "audit_logs" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "enrichment_jobs_workspace_idx" ON "enrichment_jobs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "enrichment_jobs_company_idx" ON "enrichment_jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "enrichment_jobs_status_idx" ON "enrichment_jobs" USING btree ("workspace_id","status");