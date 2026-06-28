CREATE TABLE "monitor_runs" (
    "id" BIGSERIAL NOT NULL,
    "monitor_id" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "status_code" INTEGER,
    "duration_ms" INTEGER,
    "item_count" INTEGER NOT NULL DEFAULT 0,
    "new_item_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "proxy_source" VARCHAR(255),
    "region" VARCHAR(10) NOT NULL,
    "checked_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitor_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monitor_events" (
    "id" BIGSERIAL NOT NULL,
    "monitor_id" INTEGER NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitor_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(100),
    "target_id" VARCHAR(255),
    "status" VARCHAR(50) NOT NULL DEFAULT 'success',
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "monitor_runs_monitor_id_checked_at_idx" ON "monitor_runs"("monitor_id", "checked_at");
CREATE INDEX "monitor_runs_status_idx" ON "monitor_runs"("status");
CREATE INDEX "monitor_events_monitor_id_created_at_idx" ON "monitor_events"("monitor_id", "created_at");
CREATE INDEX "monitor_events_event_type_idx" ON "monitor_events"("event_type");
CREATE INDEX "audit_events_userId_created_at_idx" ON "audit_events"("userId", "created_at");
CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");

ALTER TABLE "monitor_runs" ADD CONSTRAINT "monitor_runs_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monitor_events" ADD CONSTRAINT "monitor_events_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
