-- Creates refresh token sessions table required by refresh token auth flow.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS refresh_token_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_refresh_token_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_active
    ON refresh_token_sessions (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_expires_at
    ON refresh_token_sessions (expires_at);
