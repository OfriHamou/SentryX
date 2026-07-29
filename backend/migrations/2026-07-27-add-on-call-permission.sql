-- Grant Customer Shift Duty access to operational security operators.
-- This migration is repeatable and does not add an OnCall data table.

BEGIN;

UPDATE roles
SET allowed_pages = jsonb_set(
  COALESCE(allowed_pages, '{}'::jsonb),
  '{on_call}',
  '["read"]'::jsonb,
  true
)
WHERE role_name = 'SECURITY_OPERATOR'
  AND COALESCE(allowed_pages -> 'on_call', 'null'::jsonb) IS DISTINCT FROM '["read"]'::jsonb;

COMMIT;
