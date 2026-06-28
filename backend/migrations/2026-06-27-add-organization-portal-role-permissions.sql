-- Migration: Normalize roles for SentryX, Customer App, and Organization Portal
-- Date: 2026-06-27
-- Purpose: Replace legacy/page-test roles with canonical business roles.

BEGIN;

CREATE TEMP TABLE canonical_roles (
  role_name VARCHAR(50) PRIMARY KEY,
  allowed_pages JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO canonical_roles (role_name, allowed_pages)
VALUES
  ('SUPER_ADMIN', '{"all":["read","write"]}'::jsonb),
  (
    'TENANT_ADMIN',
    '{
      "customer_portal":["read"],
      "dashboard":["read"],
      "live":["read","write"],
      "control":["read","write"],
      "history":["read"],
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
      "control":["read","write"],
      "history":["read"],
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
      "control":["read","write"],
      "history":["read"],
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
  );

INSERT INTO roles (role_name, allowed_pages)
SELECT role_name, allowed_pages
FROM canonical_roles
ON CONFLICT (role_name) DO UPDATE
SET allowed_pages = EXCLUDED.allowed_pages;

CREATE TEMP TABLE role_remap (
  old_role_name VARCHAR(50) PRIMARY KEY,
  new_role_name VARCHAR(50) NOT NULL
) ON COMMIT DROP;

INSERT INTO role_remap (old_role_name, new_role_name)
VALUES
  ('ADMIN', 'SUPER_ADMIN'),
  ('ORG_ADMIN', 'TENANT_ADMIN'),
  ('OPERATOR', 'SECURITY_OPERATOR'),
  ('TEST_UPDATED', 'SECURITY_OPERATOR'),
  ('ANALYTICS', 'VIEWER'),
  ('SECURITY_UPDATED', 'VIEWER'),
  ('IZIC', 'VIEWER');

UPDATE users
SET role_id = new_roles.id
FROM roles old_roles
JOIN role_remap ON role_remap.old_role_name = old_roles.role_name
JOIN roles new_roles ON new_roles.role_name = role_remap.new_role_name
WHERE users.role_id = old_roles.id;

DO $$
DECLARE
  dangling_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO dangling_count
  FROM users
  JOIN roles ON roles.id = users.role_id
  WHERE roles.role_name NOT IN (SELECT role_name FROM canonical_roles);

  IF dangling_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete legacy roles: % users still reference non-canonical roles', dangling_count;
  END IF;
END $$;

DELETE FROM roles
WHERE role_name NOT IN (SELECT role_name FROM canonical_roles);

COMMIT;
