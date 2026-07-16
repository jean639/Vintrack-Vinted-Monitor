ALTER TABLE "User"
ADD COLUMN "monitor_onboarding_status" VARCHAR(20) NOT NULL DEFAULT 'pending';

-- Only accounts created after this migration should receive the automatic
-- first-monitor onboarding. Presets remain available to everyone in Create.
UPDATE "User"
SET "monitor_onboarding_status" = 'ineligible';
