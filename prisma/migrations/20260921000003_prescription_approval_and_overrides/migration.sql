-- CreateEnum
CREATE TYPE "OverrideEffect" AS ENUM ('ALLOW', 'DENY');

-- AlterTable
ALTER TABLE "Prescription" 
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "forwardingRemarks" TEXT,
  ADD COLUMN IF NOT EXISTS "forwardedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "forwardedToUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "forwardedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvalRemarks" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "requestedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "changeRequestRemarks" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Prescription_status_idx" ON "Prescription"("status");

-- CreateTable
CREATE TABLE IF NOT EXISTS "MemberPermissionOverride" (
    "id" TEXT NOT NULL,
    "practiceMemberId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "effect" "OverrideEffect" NOT NULL DEFAULT 'ALLOW',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MemberPermissionOverride_practiceMemberId_permission_key" ON "MemberPermissionOverride"("practiceMemberId", "permission");
CREATE INDEX IF NOT EXISTS "MemberPermissionOverride_practiceMemberId_idx" ON "MemberPermissionOverride"("practiceMemberId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "PrescriptionWorkflowHistory" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrescriptionWorkflowHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PrescriptionWorkflowHistory_prescriptionId_idx" ON "PrescriptionWorkflowHistory"("prescriptionId");
CREATE INDEX IF NOT EXISTS "PrescriptionWorkflowHistory_createdAt_idx" ON "PrescriptionWorkflowHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "Prescription" 
  ADD CONSTRAINT "Prescription_forwardedByUserId_fkey" FOREIGN KEY ("forwardedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Prescription" 
  ADD CONSTRAINT "Prescription_forwardedToUserId_fkey" FOREIGN KEY ("forwardedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Prescription" 
  ADD CONSTRAINT "Prescription_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Prescription" 
  ADD CONSTRAINT "Prescription_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MemberPermissionOverride" 
  ADD CONSTRAINT "MemberPermissionOverride_practiceMemberId_fkey" FOREIGN KEY ("practiceMemberId") REFERENCES "PracticeMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberPermissionOverride" 
  ADD CONSTRAINT "MemberPermissionOverride_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrescriptionWorkflowHistory" 
  ADD CONSTRAINT "PrescriptionWorkflowHistory_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrescriptionWorkflowHistory" 
  ADD CONSTRAINT "PrescriptionWorkflowHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrescriptionWorkflowHistory" 
  ADD CONSTRAINT "PrescriptionWorkflowHistory_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
