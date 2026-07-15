CREATE INDEX "monitor_runs_checked_at_monitor_id_idx"
ON "monitor_runs"("checked_at", "monitor_id");

CREATE INDEX "items_monitor_id_found_at_idx"
ON "items"("monitor_id", "found_at");
