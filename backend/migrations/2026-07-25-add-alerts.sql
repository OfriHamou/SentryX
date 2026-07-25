-- Migration: Add persistent operational alerts linked to abnormal events
-- Date: 2026-07-20

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  assigned_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  assigned_shift_id UUID NULL REFERENCES security_shifts(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,
  resolved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_alerts_event_id UNIQUE (event_id),
  CONSTRAINT chk_alerts_status CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_created_at
  ON alerts (tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_status
  ON alerts (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_alerts_assigned_user_status
  ON alerts (assigned_user_id, status);

INSERT INTO alerts (tenant_id, event_id, status)
SELECT event.tenant_id, event.id, 'OPEN'
FROM events event
WHERE event.event_type IS NOT NULL
  AND event.event_type != 'face_recognized'
  AND event.tenant_id IS NOT NULL
ON CONFLICT (event_id) DO NOTHING;

COMMIT;
