-- Normalize roles.allowed_pages into canonical object format:
-- {
--   "resource": ["read", "write"]
-- }
--
-- Migration strategy:
-- 1) Convert legacy array rows like ["dashboard", "reports"] into
--    {"dashboard": ["read"], "reports": ["read"]}
-- 2) Preserve wildcard admin semantics for legacy ["all"] / ["*"] by converting to
--    {"all": ["read", "write"]}
-- 3) Leave existing object rows unchanged in this migration.

WITH converted AS (
    SELECT
        r.id,
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(r.allowed_pages) AS e(value)
                WHERE lower(trim(e.value)) IN ('all', '*')
            )
            THEN jsonb_build_object('all', jsonb_build_array('read', 'write'))
            ELSE COALESCE(
                (
                    SELECT jsonb_object_agg(resource, jsonb_build_array('read'))
                    FROM (
                        SELECT DISTINCT lower(trim(e.value)) AS resource
                        FROM jsonb_array_elements_text(r.allowed_pages) AS e(value)
                        WHERE length(trim(e.value)) > 0
                    ) AS normalized_resources
                ),
                '{}'::jsonb
            )
        END AS normalized_allowed_pages
    FROM roles r
    WHERE jsonb_typeof(r.allowed_pages) = 'array'
)
UPDATE roles AS r
SET allowed_pages = c.normalized_allowed_pages
FROM converted AS c
WHERE r.id = c.id;
