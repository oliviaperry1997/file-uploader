/*
  Warnings:

  - Made the column `storagePath` on table `files` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "files" ADD COLUMN     "bucketName" TEXT NOT NULL DEFAULT 'files',
ALTER COLUMN "storagePath" SET NOT NULL;
