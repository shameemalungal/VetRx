-- ==============================================================================
-- VetRx Phase 14: User Management, RBAC & Practice Administration Migration
-- ==============================================================================

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "platformRole" "PlatformRole";

-- CreateTable
CREATE TABLE IF NOT EXISTS "PracticeInvitation" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PracticeInvitation_tokenHash_key" ON "PracticeInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PracticeInvitation_practiceId_idx" ON "PracticeInvitation"("practiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PracticeInvitation_email_idx" ON "PracticeInvitation"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PracticeInvitation_tokenHash_idx" ON "PracticeInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PracticeInvitation_status_idx" ON "PracticeInvitation"("status");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PracticeInvitation_practiceId_fkey'
    ) THEN
        ALTER TABLE "PracticeInvitation" ADD CONSTRAINT "PracticeInvitation_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PracticeInvitation_invitedById_fkey'
    ) THEN
        ALTER TABLE "PracticeInvitation" ADD CONSTRAINT "PracticeInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
