-- Add workspace_name column to users table.
-- Better Auth additionalFields require a corresponding DB column.
-- workspaceName is sent from the registration form so the first workspace
-- gets a meaningful name; it is stored here as nullable reference data.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "workspace_name" varchar(255);
