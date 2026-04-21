-- Idempotent because early local builds of 20260421120000 only added monitor
-- Telegram columns. This migration safely upgrades those databases and is a
-- no-op for fresh databases that already have the tables.
CREATE TABLE IF NOT EXISTS "telegram_connections" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "chat_type" VARCHAR(50),
    "chat_title" VARCHAR(255),
    "username" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "telegram_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "telegram_connect_codes" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "userId" TEXT NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "used_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_connect_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "telegram_connections_userId_key" ON "telegram_connections"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_connect_codes_code_key" ON "telegram_connect_codes"("code");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_connections_userId_fkey'
  ) THEN
    ALTER TABLE "telegram_connections"
    ADD CONSTRAINT "telegram_connections_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_connect_codes_userId_fkey'
  ) THEN
    ALTER TABLE "telegram_connect_codes"
    ADD CONSTRAINT "telegram_connect_codes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "monitors" DROP COLUMN IF EXISTS "telegram_chat_id";
