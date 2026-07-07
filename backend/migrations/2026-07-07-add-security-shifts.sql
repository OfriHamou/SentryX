-- Migration: Add organization security shift management
-- Date: 2026-07-07

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS security_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assigned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
  notes TEXT NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_security_shifts_status CHECK (status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT chk_security_shifts_date_order CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_security_shifts_tenant_dates
  ON security_shifts (tenant_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_security_shifts_tenant_status
  ON security_shifts (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_security_shifts_assigned_user
  ON security_shifts (assigned_user_id);

UPDATE roles
SET allowed_pages = jsonb_set(
  allowed_pages,
  '{organization_security_shifts}',
  '["read","write"]'::jsonb,
  true
)
WHERE role_name IN ('TENANT_ADMIN', 'OPERATIONS_MANAGER');

UPDATE roles
SET allowed_pages = jsonb_set(
  allowed_pages,
  '{organization_security_shifts}',
  '["read"]'::jsonb,
  true
)
WHERE role_name = 'SECURITY_OPERATOR';

COMMIT;
