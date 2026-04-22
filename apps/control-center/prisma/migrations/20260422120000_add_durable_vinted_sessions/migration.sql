CREATE TABLE "vinted_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "vinted_user_id" BIGINT NOT NULL DEFAULT 0,
    "vinted_name" TEXT NOT NULL DEFAULT '',
    "access_token_ciphertext" TEXT NOT NULL,
    "refresh_token_ciphertext" TEXT,
    "cookie_header_ciphertext" TEXT,
    "csrf_token_ciphertext" TEXT,
    "anon_id_ciphertext" TEXT,
    "user_agent" TEXT,
    "phone_number_ciphertext" TEXT,
    "browser_linked" BOOLEAN NOT NULL DEFAULT false,
    "domain" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "linked_at" TIMESTAMP(6),
    "last_check" TIMESTAMP(6),
    "warmed_at" TIMESTAMP(6),
    "last_browser_sync_at" TIMESTAMP(6),
    "last_refresh_at" TIMESTAMP(6),
    "last_valid_at" TIMESTAMP(6),
    "invalid_reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vinted_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vinted_sessions_user_id_key" ON "vinted_sessions"("user_id");
CREATE INDEX "vinted_sessions_status_idx" ON "vinted_sessions"("status");
CREATE INDEX "vinted_sessions_last_check_idx" ON "vinted_sessions"("last_check");

ALTER TABLE "vinted_sessions"
ADD CONSTRAINT "vinted_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
