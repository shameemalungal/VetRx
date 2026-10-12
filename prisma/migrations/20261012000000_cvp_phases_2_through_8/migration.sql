-- CreateEnum
CREATE TYPE "CallPriority" AS ENUM ('EMERGENCY', 'URGENT', 'COULD_NOT_ASSESS', 'PLANNED');

-- CreateEnum
CREATE TYPE "VisitFlexibility" AS ENUM ('MUST_ATTEND_TODAY', 'CAN_POSTPONE_TODAY', 'PREFERRED_TODAY', 'SPECIFIC_DATE');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('LOGGED', 'SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('REGISTERED', 'PLANNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('MANUAL', 'GPS', 'MAP', 'SAVED');

-- CreateEnum
CREATE TYPE "FollowUpReason" AS ENUM ('POST_TREATMENT_REVIEW', 'RECHECK', 'VACCINATION', 'DEWORMING', 'PREGNANCY_DIAGNOSIS', 'ARTIFICIAL_INSEMINATION', 'POST_OPERATIVE_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('UPCOMING', 'DUE', 'SCHEDULED', 'COMPLETED', 'POSTPONED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM_INTERVAL');

-- CreateEnum
CREATE TYPE "DurationEstimateSource" AS ENUM ('DEFAULT', 'PRACTICE_LEARNED', 'MANUAL_OVERRIDE');

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "callerPhone" TEXT NOT NULL,
    "ownerId" TEXT,
    "tempOwnerName" TEXT,
    "tempPatientName" TEXT,
    "species" TEXT,
    "animalCount" INTEGER NOT NULL DEFAULT 1,
    "symptoms" TEXT NOT NULL,
    "tentativeAssessment" TEXT,
    "priority" "CallPriority" NOT NULL DEFAULT 'PLANNED',
    "flexibility" "VisitFlexibility" NOT NULL DEFAULT 'MUST_ATTEND_TODAY',
    "preferredDate" TIMESTAMP(3),
    "locationAddress" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "CallStatus" NOT NULL DEFAULT 'LOGGED',
    "plannedProcedure" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerLocation" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Farm',
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationSource" "LocationSource" NOT NULL DEFAULT 'MANUAL',
    "accuracy" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "callId" TEXT,
    "ownerId" TEXT NOT NULL,
    "locationId" TEXT,
    "customAddress" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "VisitStatus" NOT NULL DEFAULT 'REGISTERED',
    "priority" "CallPriority" NOT NULL DEFAULT 'PLANNED',
    "flexibility" "VisitFlexibility" NOT NULL DEFAULT 'MUST_ATTEND_TODAY',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "preferredTimeWindow" TEXT,
    "timeEnRoute" TIMESTAMP(3),
    "timeArrived" TIMESTAMP(3),
    "timeStarted" TIMESTAMP(3),
    "timeCompleted" TIMESTAMP(3),
    "actualDurationMinutes" INTEGER,
    "actualTravelMinutes" INTEGER,
    "totalAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitCase" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT,
    "tempPatientName" TEXT,
    "species" TEXT,
    "headCount" INTEGER NOT NULL DEFAULT 1,
    "symptoms" TEXT,
    "doctorAssessment" TEXT,
    "prescriptionId" TEXT,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitProcedure" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT,
    "patientName" TEXT,
    "procedureCategory" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "notes" TEXT,
    "standardFee" DOUBLE PRECISION DEFAULT 0,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitMedicineUsage" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT,
    "patientName" TEXT,
    "medicineId" TEXT,
    "medicineName" TEXT NOT NULL,
    "batchNumber" TEXT,
    "quantityUsed" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "route" TEXT,
    "instructions" TEXT,
    "isStockDeducted" BOOLEAN NOT NULL DEFAULT false,
    "stockDeductionId" TEXT,
    "administeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitMedicineUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitTimelineEvent" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPlan" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "planDate" TIMESTAMP(3) NOT NULL,
    "doctorUserId" TEXT,
    "startLocationAddress" TEXT,
    "startLatitude" DOUBLE PRECISION,
    "startLongitude" DOUBLE PRECISION,
    "endLocationAddress" TEXT,
    "totalEstimatedKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEstimatedTravelMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalEstimatedVisitMinutes" INTEGER NOT NULL DEFAULT 0,
    "workingMinutesAvailable" INTEGER NOT NULL DEFAULT 480,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "dailyPlanId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "stopOrder" INTEGER NOT NULL DEFAULT 0,
    "estimatedArrival" TIMESTAMP(3),
    "estimatedDeparture" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "patientId" TEXT,
    "species" TEXT,
    "animalCount" INTEGER NOT NULL DEFAULT 1,
    "originVisitId" TEXT,
    "recurrenceRuleId" TEXT,
    "reason" "FollowUpReason" NOT NULL DEFAULT 'POST_TREATMENT_REVIEW',
    "procedureCategory" TEXT,
    "recommendedDate" TIMESTAMP(3) NOT NULL,
    "priority" "CallPriority" NOT NULL DEFAULT 'PLANNED',
    "flexibility" "VisitFlexibility" NOT NULL DEFAULT 'MUST_ATTEND_TODAY',
    "preferredTimeWindow" TEXT,
    "notes" TEXT,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'UPCOMING',
    "scheduledVisitId" TEXT,
    "scheduledCallId" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringSchedule" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "patientId" TEXT,
    "species" TEXT,
    "reason" "FollowUpReason" NOT NULL DEFAULT 'POST_TREATMENT_REVIEW',
    "procedureCategory" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL DEFAULT 'WEEKLY',
    "intervalDays" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "maxOccurrences" INTEGER,
    "generatedOccurrencesCount" INTEGER NOT NULL DEFAULT 0,
    "priority" "CallPriority" NOT NULL DEFAULT 'PLANNED',
    "flexibility" "VisitFlexibility" NOT NULL DEFAULT 'MUST_ATTEND_TODAY',
    "preferredTimeWindow" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedureDurationEstimate" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "procedureCategory" TEXT NOT NULL,
    "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "learnedDurationMinutes" INTEGER,
    "manualOverrideMinutes" INTEGER,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "source" "DurationEstimateSource" NOT NULL DEFAULT 'DEFAULT',
    "effectiveDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "incrementalPerAnimalMinutes" INTEGER NOT NULL DEFAULT 10,
    "lastCalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedureDurationEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Call_practiceId_idx" ON "Call"("practiceId");

-- CreateIndex
CREATE INDEX "Call_ownerId_idx" ON "Call"("ownerId");

-- CreateIndex
CREATE INDEX "Call_priority_idx" ON "Call"("priority");

-- CreateIndex
CREATE INDEX "Call_status_idx" ON "Call"("status");

-- CreateIndex
CREATE INDEX "Call_createdAt_idx" ON "Call"("createdAt");

-- CreateIndex
CREATE INDEX "OwnerLocation_practiceId_idx" ON "OwnerLocation"("practiceId");

-- CreateIndex
CREATE INDEX "OwnerLocation_ownerId_idx" ON "OwnerLocation"("ownerId");

-- CreateIndex
CREATE INDEX "Visit_practiceId_idx" ON "Visit"("practiceId");

-- CreateIndex
CREATE INDEX "Visit_ownerId_idx" ON "Visit"("ownerId");

-- CreateIndex
CREATE INDEX "Visit_status_idx" ON "Visit"("status");

-- CreateIndex
CREATE INDEX "Visit_scheduledDate_idx" ON "Visit"("scheduledDate");

-- CreateIndex
CREATE INDEX "VisitCase_practiceId_idx" ON "VisitCase"("practiceId");

-- CreateIndex
CREATE INDEX "VisitCase_visitId_idx" ON "VisitCase"("visitId");

-- CreateIndex
CREATE INDEX "VisitCase_patientId_idx" ON "VisitCase"("patientId");

-- CreateIndex
CREATE INDEX "VisitProcedure_practiceId_idx" ON "VisitProcedure"("practiceId");

-- CreateIndex
CREATE INDEX "VisitProcedure_visitId_idx" ON "VisitProcedure"("visitId");

-- CreateIndex
CREATE INDEX "VisitProcedure_patientId_idx" ON "VisitProcedure"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitMedicineUsage_idempotencyKey_key" ON "VisitMedicineUsage"("idempotencyKey");

-- CreateIndex
CREATE INDEX "VisitMedicineUsage_practiceId_idx" ON "VisitMedicineUsage"("practiceId");

-- CreateIndex
CREATE INDEX "VisitMedicineUsage_visitId_idx" ON "VisitMedicineUsage"("visitId");

-- CreateIndex
CREATE INDEX "VisitMedicineUsage_patientId_idx" ON "VisitMedicineUsage"("patientId");

-- CreateIndex
CREATE INDEX "VisitTimelineEvent_practiceId_idx" ON "VisitTimelineEvent"("practiceId");

-- CreateIndex
CREATE INDEX "VisitTimelineEvent_visitId_idx" ON "VisitTimelineEvent"("visitId");

-- CreateIndex
CREATE INDEX "VisitTimelineEvent_eventType_idx" ON "VisitTimelineEvent"("eventType");

-- CreateIndex
CREATE INDEX "DailyPlan_practiceId_idx" ON "DailyPlan"("practiceId");

-- CreateIndex
CREATE INDEX "DailyPlan_planDate_idx" ON "DailyPlan"("planDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPlan_practiceId_planDate_key" ON "DailyPlan"("practiceId", "planDate");

-- CreateIndex
CREATE INDEX "RouteStop_dailyPlanId_idx" ON "RouteStop"("dailyPlanId");

-- CreateIndex
CREATE INDEX "RouteStop_visitId_idx" ON "RouteStop"("visitId");

-- CreateIndex
CREATE INDEX "FollowUp_practiceId_idx" ON "FollowUp"("practiceId");

-- CreateIndex
CREATE INDEX "FollowUp_ownerId_idx" ON "FollowUp"("ownerId");

-- CreateIndex
CREATE INDEX "FollowUp_patientId_idx" ON "FollowUp"("patientId");

-- CreateIndex
CREATE INDEX "FollowUp_status_idx" ON "FollowUp"("status");

-- CreateIndex
CREATE INDEX "FollowUp_recommendedDate_idx" ON "FollowUp"("recommendedDate");

-- CreateIndex
CREATE INDEX "FollowUp_recurrenceRuleId_idx" ON "FollowUp"("recurrenceRuleId");

-- CreateIndex
CREATE INDEX "RecurringSchedule_practiceId_idx" ON "RecurringSchedule"("practiceId");

-- CreateIndex
CREATE INDEX "RecurringSchedule_ownerId_idx" ON "RecurringSchedule"("ownerId");

-- CreateIndex
CREATE INDEX "RecurringSchedule_status_idx" ON "RecurringSchedule"("status");

-- CreateIndex
CREATE INDEX "ProcedureDurationEstimate_practiceId_idx" ON "ProcedureDurationEstimate"("practiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcedureDurationEstimate_practiceId_procedureCategory_key" ON "ProcedureDurationEstimate"("practiceId", "procedureCategory");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerLocation" ADD CONSTRAINT "OwnerLocation_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerLocation" ADD CONSTRAINT "OwnerLocation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "OwnerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitCase" ADD CONSTRAINT "VisitCase_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitCase" ADD CONSTRAINT "VisitCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitCase" ADD CONSTRAINT "VisitCase_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitCase" ADD CONSTRAINT "VisitCase_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitProcedure" ADD CONSTRAINT "VisitProcedure_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitMedicineUsage" ADD CONSTRAINT "VisitMedicineUsage_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitTimelineEvent" ADD CONSTRAINT "VisitTimelineEvent_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPlan" ADD CONSTRAINT "DailyPlan_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_dailyPlanId_fkey" FOREIGN KEY ("dailyPlanId") REFERENCES "DailyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_originVisitId_fkey" FOREIGN KEY ("originVisitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "RecurringSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_scheduledVisitId_fkey" FOREIGN KEY ("scheduledVisitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSchedule" ADD CONSTRAINT "RecurringSchedule_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSchedule" ADD CONSTRAINT "RecurringSchedule_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSchedule" ADD CONSTRAINT "RecurringSchedule_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureDurationEstimate" ADD CONSTRAINT "ProcedureDurationEstimate_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
