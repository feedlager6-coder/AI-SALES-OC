-- Run at PostgreSQL initialization
-- Sets up extensions required by AI Sales OS

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- Trigram similarity for fuzzy search

-- Note: Row-Level Security (RLS) policies are applied via Drizzle migrations
-- after the schema is created. See packages/db/src/migrations/
