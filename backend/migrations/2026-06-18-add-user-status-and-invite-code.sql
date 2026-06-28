-- Migration: Add user status and tenant invite code for registration approval flow
-- Date: 2026-06-18
-- Purpose: Implement organization onboarding and approval workflow

-- Add status and approval fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'APPROVED';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by UUID NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejected_by UUID NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add foreign key constraints for approval tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_approved_by'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT fk_users_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_rejected_by'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT fk_users_rejected_by
    FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index on status for efficient querying of pending approvals
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Add invite code to tenants table. Keep it nullable for rollout safety.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS invite_code VARCHAR(100) NULL;

-- Backfill existing tenants with stable unique public invite codes.
-- These are separate onboarding codes, not tenant IDs.
UPDATE tenants
SET invite_code = 'ORG-' ||
  UPPER(SUBSTRING(RPAD(REGEXP_REPLACE(COALESCE(name, 'TENANT'), '[^A-Za-z0-9]+', '', 'g'), 3, 'X') FROM 1 FOR 3)) ||
  '-' ||
  UPPER(SUBSTRING(MD5(id::text) FROM 1 FOR 6))
WHERE invite_code IS NULL;

-- Add index on invite code for efficient lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_invite_code ON tenants(invite_code);

-- Ensure canonical platform and tenant roles exist.
INSERT INTO roles (role_name, allowed_pages)
VALUES
  ('SUPER_ADMIN', '{"all":["read","write"]}'::jsonb),
  (
    'TENANT_ADMIN',
    '{
      "customer_portal":["read"],
      "dashboard":["read"],
      "live":["read","write"],
      "history":["read"],
      "control":["read","write"],
      "alerts":["read","write"],
      "settings":["read","write"],
      "faces":["read","write"],
      "robots":["read","write"],
      "events":["read"],
      "organization_portal":["read"],
      "organization_users":["read","write"],
      "organization_settings":["read","write"],
      "organization_robots":["read","write"],
      "organization_visitors":["read","write"],
      "organization_on_call":["read","write"]
    }'::jsonb
  ),
  (
    'OPERATIONS_MANAGER',
    '{
      "customer_portal":["read"],
      "dashboard":["read"],
      "live":["read","write"],
      "history":["read"],
      "control":["read","write"],
      "alerts":["read","write"],
      "robots":["read","write"],
      "events":["read"],
      "organization_portal":["read"],
      "organization_robots":["read","write"],
      "organization_on_call":["read","write"],
      "organization_settings":["read"]
    }'::jsonb
  ),
  (
    'SECURITY_OPERATOR',
    '{
      "customer_portal":["read"],
      "dashboard":["read"],
      "live":["read"],
      "history":["read"],
      "control":["read","write"],
      "alerts":["read","write"],
      "robots":["read"],
      "events":["read"],
      "organization_portal":["read"],
      "organization_on_call":["read"]
    }'::jsonb
  ),
  (
    'VISITOR_MANAGER',
    '{
      "customer_portal":["read"],
      "dashboard":["read"],
      "live":["read"],
      "history":["read"],
      "alerts":["read"],
      "faces":["read","write"],
      "organization_portal":["read"],
      "organization_visitors":["read","write"],
      "organization_settings":["read"]
    }'::jsonb
  ),
  (
    'VIEWER',
    '{
      "customer_portal":["read"],
      "dashboard":["read"],
      "live":["read"],
      "history":["read"],
      "alerts":["read"],
      "robots":["read"],
      "events":["read"],
      "organization_portal":["read"],
      "organization_settings":["read"]
    }'::jsonb
  )
ON CONFLICT (role_name) DO UPDATE
SET allowed_pages = EXCLUDED.allowed_pages;

-- Verify migration success
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('status', 'approved_at', 'approved_by', 'rejected_at', 'rejected_by', 'rejection_reason', 'phone', 'job_title', 'updated_at')
UNION ALL
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tenants'
  AND column_name = 'invite_code'
ORDER BY column_name;
