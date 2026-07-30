-- Migration: Add a lifecycle archive timestamp to Robots
-- Date: 2026-07-30
-- Repeatable: existing Robots remain active because archived_at stays NULL.

BEGIN;

ALTER TABLE robots
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_robots_tenant_archived_at
  ON robots (tenant_id, archived_at);

COMMIT;
