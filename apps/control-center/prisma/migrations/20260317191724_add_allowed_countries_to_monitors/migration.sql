-- AlterTable
ALTER TABLE "items" ADD COLUMN     "brand" VARCHAR(100),
ADD COLUMN     "extra_images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "monitors" ADD COLUMN     "allowed_countries" VARCHAR(500);
