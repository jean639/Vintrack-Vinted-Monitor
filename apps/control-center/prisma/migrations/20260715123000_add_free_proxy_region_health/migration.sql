CREATE TABLE "free_proxy_health" (
    "id" SERIAL NOT NULL,
    "proxy_id" INTEGER NOT NULL,
    "region" VARCHAR(10) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "success_streak" INTEGER NOT NULL DEFAULT 0,
    "failure_streak" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "last_status_code" INTEGER,
    "last_error" TEXT,
    "last_checked_at" TIMESTAMP(6),
    "last_success_at" TIMESTAMP(6),
    "last_failure_at" TIMESTAMP(6),
    "next_check_at" TIMESTAMP(6),
    "score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "free_proxy_health_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "free_proxy_health_proxy_id_region_key" ON "free_proxy_health"("proxy_id", "region");
CREATE INDEX "free_proxy_health_region_status_next_check_at_idx" ON "free_proxy_health"("region", "status", "next_check_at");
CREATE INDEX "free_proxy_health_status_score_idx" ON "free_proxy_health"("status", "score");

ALTER TABLE "free_proxy_health"
ADD CONSTRAINT "free_proxy_health_proxy_id_fkey"
FOREIGN KEY ("proxy_id") REFERENCES "free_proxies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "free_proxies"
SET "status" = 'pending',
    "failure_count" = 0,
    "quarantined_until" = NULL,
    "last_error" = NULL,
    "updated_at" = NOW()
WHERE "status" = 'active';
