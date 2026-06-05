CREATE TABLE "monitor_limits" (
    "scope" VARCHAR(255) NOT NULL,
    "active_limit" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitor_limits_pkey" PRIMARY KEY ("scope")
);
