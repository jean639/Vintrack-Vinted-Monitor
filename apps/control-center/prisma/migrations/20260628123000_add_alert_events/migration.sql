CREATE TABLE "alert_events" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT,
    "monitor_id" INTEGER,
    "item_id" BIGINT,
    "channel" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "failure_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alert_events_userId_created_at_idx" ON "alert_events"("userId", "created_at");
CREATE INDEX "alert_events_monitor_id_created_at_idx" ON "alert_events"("monitor_id", "created_at");
CREATE INDEX "alert_events_item_id_idx" ON "alert_events"("item_id");
CREATE INDEX "alert_events_channel_status_idx" ON "alert_events"("channel", "status");

ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
