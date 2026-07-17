CREATE TABLE "item_preindex_samples" (
    "region" VARCHAR(10) NOT NULL,
    "item_id" BIGINT NOT NULL,
    "slug" VARCHAR(500),
    "first_seen_at" TIMESTAMP(6) NOT NULL,
    "proxy_source" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_preindex_samples_pkey" PRIMARY KEY ("region", "item_id")
);

CREATE TABLE "preindex_probe_runs" (
    "id" BIGSERIAL NOT NULL,
    "region" VARCHAR(10) NOT NULL,
    "item_id" BIGINT NOT NULL,
    "status_code" INTEGER,
    "duration_ms" INTEGER,
    "outcome" VARCHAR(30) NOT NULL,
    "proxy_source" VARCHAR(255),
    "checked_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preindex_probe_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "item_preindex_samples_region_first_seen_at_idx"
ON "item_preindex_samples"("region", "first_seen_at");

CREATE INDEX "preindex_probe_runs_region_checked_at_idx"
ON "preindex_probe_runs"("region", "checked_at");

CREATE INDEX "preindex_probe_runs_outcome_checked_at_idx"
ON "preindex_probe_runs"("outcome", "checked_at");
