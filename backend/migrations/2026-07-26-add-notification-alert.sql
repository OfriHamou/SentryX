-- Migration: Link notifications to operational alerts
-- Date: 2026-07-26
-- This migration intentionally does not backfill historical alert notifications.

BEGIN;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS alert_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_alert'
  ) THEN
    ALTER TABLE notifications
    ADD CONSTRAINT fk_notifications_alert
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_alert
  ON notifications(alert_id);

-- A non-null alert_id identifies the single automatic notification for that Alert.
-- PostgreSQL permits any number of NULL values, preserving manual/generic notifications.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_alert_id
  ON notifications(alert_id)
  WHERE alert_id IS NOT NULL;

COMMIT;
