-- AlterTable
ALTER TABLE "items" ADD COLUMN "seller_login" VARCHAR(255);
ALTER TABLE "items" ADD COLUMN "seller_profile_url" TEXT;

-- CreateTable
CREATE TABLE "seller_bans" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "seller_id" BIGINT NOT NULL,
    "seller_login" VARCHAR(255),
    "seller_profile_url" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_bans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "items_seller_id_idx" ON "items"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_bans_userId_seller_id_key" ON "seller_bans"("userId", "seller_id");

-- CreateIndex
CREATE INDEX "seller_bans_seller_id_idx" ON "seller_bans"("seller_id");

-- AddForeignKey
ALTER TABLE "seller_bans" ADD CONSTRAINT "seller_bans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
