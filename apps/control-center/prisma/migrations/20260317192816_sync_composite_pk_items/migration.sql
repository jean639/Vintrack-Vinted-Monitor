/*
  Warnings:

  - The primary key for the `items` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Made the column `monitor_id` on table `items` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "items" DROP CONSTRAINT "items_pkey",
ALTER COLUMN "monitor_id" SET NOT NULL,
ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id", "monitor_id");
