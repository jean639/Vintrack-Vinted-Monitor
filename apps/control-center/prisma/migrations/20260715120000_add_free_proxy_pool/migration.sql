ALTER TABLE "monitors"
ADD COLUMN "proxy_source" VARCHAR(20) NOT NULL DEFAULT 'server';

UPDATE "monitors"
SET "proxy_source" = CASE
    WHEN "proxy_group_id" IS NULL THEN 'server'
    ELSE 'group'
END;

CREATE TABLE "free_proxies" (
    "id" SERIAL NOT NULL,
    "proxy_url" VARCHAR(500) NOT NULL,
    "protocol" VARCHAR(20) NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "port" INTEGER NOT NULL,
    "source" VARCHAR(50) NOT NULL DEFAULT 'manual',
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_checked_at" TIMESTAMP(6),
    "last_success_at" TIMESTAMP(6),
    "last_failure_at" TIMESTAMP(6),
    "quarantined_until" TIMESTAMP(6),
    "last_error" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "free_proxies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "free_proxies_proxy_url_key" ON "free_proxies"("proxy_url");
CREATE INDEX "free_proxies_status_quarantined_until_idx" ON "free_proxies"("status", "quarantined_until");
CREATE INDEX "free_proxies_source_idx" ON "free_proxies"("source");
