ALTER TABLE "monitor_runs"
ADD COLUMN "fetch_source" VARCHAR(20) NOT NULL DEFAULT 'canonical';

CREATE TABLE "monitor_item_detections" (
    "monitor_id" INTEGER NOT NULL,
    "item_id" BIGINT NOT NULL,
    "first_source" VARCHAR(20) NOT NULL,
    "early_seen_at" TIMESTAMP(6),
    "canonical_seen_at" TIMESTAMP(6),
    "alert_queued_at" TIMESTAMP(6),
    "alert_sent_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitor_item_detections_pkey" PRIMARY KEY ("monitor_id", "item_id")
);

CREATE INDEX "monitor_item_detections_monitor_id_created_at_idx"
ON "monitor_item_detections"("monitor_id", "created_at");

ALTER TABLE "monitor_item_detections"
ADD CONSTRAINT "monitor_item_detections_monitor_id_fkey"
FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "monitor_runs_monitor_id_fetch_source_checked_at_idx"
ON "monitor_runs"("monitor_id", "fetch_source", "checked_at");
