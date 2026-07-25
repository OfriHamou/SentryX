-- Migration: Add organization visitor management
-- Date: 2026-07-25

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(255) NULL,
  purpose TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
  face_image VARCHAR(512) NOT NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_visitors_status CHECK (status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED')),
  CONSTRAINT chk_visitors_date_order CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_visitors_tenant_dates
  ON visitors (tenant_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_visitors_tenant_status
  ON visitors (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_visitors_host_user
  ON visitors (host_user_id);

COMMIT;
