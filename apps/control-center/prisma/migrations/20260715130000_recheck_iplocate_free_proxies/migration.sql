-- The previous validator warmed Vinted twice before the catalog request. Recheck
-- IPLocate candidates once with the corrected validation path.
UPDATE "free_proxies"
SET "status" = 'pending',
    "failure_count" = 0,
    "last_error" = NULL,
    "quarantined_until" = NULL,
    "updated_at" = NOW()
WHERE "source" LIKE 'iplocate%'
  AND "status" = 'disabled';

UPDATE "free_proxy_health" AS "fph"
SET "status" = 'pending',
    "success_streak" = 0,
    "failure_streak" = 0,
    "last_error" = NULL,
    "next_check_at" = NOW(),
    "updated_at" = NOW()
FROM "free_proxies" AS "fp"
WHERE "fp"."id" = "fph"."proxy_id"
  AND "fp"."source" LIKE 'iplocate%'
  AND "fph"."status" IN ('dead', 'cooldown');
