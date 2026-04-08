ALTER TABLE "monitors" ADD COLUMN "name" VARCHAR(255) NOT NULL DEFAULT '';

UPDATE "monitors"
SET "name" = "query"
WHERE "name" = '';

ALTER TABLE "monitors" ALTER COLUMN "name" DROP DEFAULT;
