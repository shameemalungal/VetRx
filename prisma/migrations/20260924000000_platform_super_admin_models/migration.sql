-- CreateEnum
CREATE TYPE "PracticeType" AS ENUM ('INDEPENDENT', 'CLINIC', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "PracticeStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('LOGIN_AUTH', 'INVITATION', 'PRACTICE_SETUP', 'USER_PERMISSIONS', 'PRESCRIPTION', 'PATIENT', 'INVOICE_BILLING', 'SUBSCRIPTION', 'PAYMENT', 'PDF_PRINT', 'TECHNICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED');

-- AlterTable
ALTER TABLE "Practice" ADD COLUMN "practiceType" "PracticeType" NOT NULL DEFAULT 'CLINIC';
ALTER TABLE "Practice" ADD COLUMN "status" "PracticeStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "PlatformIssue" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT,
    "userId" TEXT,
    "category" "IssueCategory" NOT NULL DEFAULT 'OTHER',
    "priority" "IssuePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "internalNotes" JSONB DEFAULT '[]',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAccessSession" (
    "id" TEXT NOT NULL,
    "platformAdminUserId" TEXT NOT NULL,
    "targetPracticeId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "reason" TEXT NOT NULL,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportAccessSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformIssue_practiceId_idx" ON "PlatformIssue"("practiceId");

-- CreateIndex
CREATE INDEX "PlatformIssue_userId_idx" ON "PlatformIssue"("userId");

-- CreateIndex
CREATE INDEX "PlatformIssue_status_idx" ON "PlatformIssue"("status");

-- CreateIndex
CREATE INDEX "PlatformIssue_priority_idx" ON "PlatformIssue"("priority");

-- CreateIndex
CREATE INDEX "SupportAccessSession_platformAdminUserId_idx" ON "SupportAccessSession"("platformAdminUserId");

-- CreateIndex
CREATE INDEX "SupportAccessSession_targetPracticeId_idx" ON "SupportAccessSession"("targetPracticeId");

-- CreateIndex
CREATE INDEX "SupportAccessSession_status_idx" ON "SupportAccessSession"("status");

-- AddForeignKey
ALTER TABLE "PlatformIssue" ADD CONSTRAINT "PlatformIssue_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformIssue" ADD CONSTRAINT "PlatformIssue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformIssue" ADD CONSTRAINT "PlatformIssue_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAccessSession" ADD CONSTRAINT "SupportAccessSession_platformAdminUserId_fkey" FOREIGN KEY ("platformAdminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAccessSession" ADD CONSTRAINT "SupportAccessSession_targetPracticeId_fkey" FOREIGN KEY ("targetPracticeId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAccessSession" ADD CONSTRAINT "SupportAccessSession_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
