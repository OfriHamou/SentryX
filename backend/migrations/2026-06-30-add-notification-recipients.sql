-- Migration: Add event-linked notification recipients and per-user read state
-- Date: 2026-06-30
-- Purpose: Support notification bell items linked to events with per-user read/unread status.

BEGIN;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id UUID NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_apps TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_event'
  ) THEN
    ALTER TABLE notifications
    ADD CONSTRAINT fk_notifications_event
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_recipients_notification'
  ) THEN
    ALTER TABLE notification_recipients
    ADD CONSTRAINT fk_notification_recipients_notification
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_recipients_user'
  ) THEN
    ALTER TABLE notification_recipients
    ADD CONSTRAINT fk_notification_recipients_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_recipients_notification_user
  ON notification_recipients(notification_id, user_id);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_user_read_at
  ON notification_recipients(user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification
  ON notification_recipients(notification_id);

CREATE INDEX IF NOT EXISTS idx_notifications_event
  ON notifications(event_id);

CREATE INDEX IF NOT EXISTS idx_notifications_target_apps
  ON notifications USING GIN(target_apps);

COMMIT;

