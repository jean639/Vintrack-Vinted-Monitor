ALTER TABLE "monitors"
ADD COLUMN "demo_expires_at" TIMESTAMP(6);

CREATE INDEX "monitors_active_demo_expiry_idx"
ON "monitors" ("demo_expires_at")
WHERE "status" = 'active' AND "demo_expires_at" IS NOT NULL;
