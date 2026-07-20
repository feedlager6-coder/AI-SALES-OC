-- Sprint 1.6: Performance indexes (TD-002)
-- Adds missing FK indexes identified in pre-Sprint 1.6 audit.

-- sequence_enrollments.sequence_id — speeds up JOINs when resolving enrollment → campaign
CREATE INDEX IF NOT EXISTS "sequence_enrollments_sequence_idx"
  ON "sequence_enrollments" USING btree ("sequence_id");

-- sequence_enrollments.status — speeds up filtering active/completed enrollments per workspace
CREATE INDEX IF NOT EXISTS "sequence_enrollments_status_idx"
  ON "sequence_enrollments" USING btree ("workspace_id", "status");

-- email_sends.contact_id — speeds up per-contact send history queries
CREATE INDEX IF NOT EXISTS "email_sends_contact_idx"
  ON "email_sends" USING btree ("contact_id");

-- email_sends.enrollment_id — speeds up per-enrollment send lookups
CREATE INDEX IF NOT EXISTS "email_sends_enrollment_idx"
  ON "email_sends" USING btree ("enrollment_id");

-- email_sends.workspace + sent_at — speeds up workspace stats (emailsSent30d)
CREATE INDEX IF NOT EXISTS "email_sends_workspace_sent_idx"
  ON "email_sends" USING btree ("workspace_id", "sent_at");
