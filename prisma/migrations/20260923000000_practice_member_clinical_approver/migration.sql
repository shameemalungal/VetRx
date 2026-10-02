-- AlterTable
ALTER TABLE "PracticeMember" ADD COLUMN IF NOT EXISTS "isClinicalApprover" BOOLEAN NOT NULL DEFAULT false;
