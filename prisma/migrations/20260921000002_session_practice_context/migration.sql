-- AlterTable
ALTER TABLE "Session" ADD COLUMN "practiceId" TEXT;

-- CreateIndex
CREATE INDEX "Session_practiceId_idx" ON "Session"("practiceId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
