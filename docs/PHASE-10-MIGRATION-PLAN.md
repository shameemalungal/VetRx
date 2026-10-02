# VetRx Phase 10 — Database Migration Plan & Safety Review

**Migration Name**: `phase10_commercial_foundation`  
**Database**: PostgreSQL 16  
**ORM**: Prisma ORM  
**Target Tables**: `SubscriptionPlan`, `Subscription`, `Payment`, `PaymentEvent`  
**Modified Existing Tables**: `Practice` (Foreign Key relations only)  

---

## 1. Non-Destructive Safety Assessment

### Invariant Checks
1. **Zero Drop Table Statements**: No existing table (`User`, `AuthIdentity`, `Session`, `Practice`, `PracticeMember`, `PracticeSettings`, `Owner`, `Patient`, `Medicine`, `TreatmentPackage`, `Prescription`, `PrescriptionItem`, `Invoice`, `InvoiceItem`, `Receipt`, `DocumentSequence`, `AuditLog`) is dropped.
2. **Zero Column Renames or Removals**: No columns are renamed or deleted from existing tables.
3. **Zero Data Truncation**: No data modification or deletion is performed on production rows.
4. **Additive Relationships**:
   - `Practice.subscriptions`: One-to-many relationship (`Subscription.practiceId` references `Practice.id` with `onDelete: Cascade`).
   - `Practice.payments`: One-to-many relationship (`Payment.practiceId` references `Practice.id` with `onDelete: Cascade`).
5. **Safe Foreign Key Defaults**:
   - New foreign keys in `Subscription` and `Payment` point to existing `Practice.id`.
   - Existing tables have zero new mandatory (NOT NULL without default) columns added.

---

## 2. Table Creation SQL Inspection

The migration will execute the following additive DDL:

```sql
-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'EXPIRED', 'CANCELLED');
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'THREE_MONTHS', 'ANNUAL', 'ONE_TIME');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');

-- CreateTable SubscriptionPlan
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "pricePaisa" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "trialPeriodDays" INTEGER NOT NULL DEFAULT 0,
    "maxUserSeats" INTEGER NOT NULL DEFAULT 1,
    "featuresJson" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable Subscription
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trialStartsAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "gracePeriodEndsAt" TIMESTAMP(3),
    "gatewayCustomerId" TEXT,
    "gatewaySubscriptionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable Payment
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "amountPaisa" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentProvider" TEXT NOT NULL DEFAULT 'PAYU',
    "internalReference" TEXT NOT NULL,
    "gatewayTransactionId" TEXT,
    "paymentMethod" TEXT,
    "gatewayResponseRaw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable PaymentEvent
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT,
    "rawPayload" JSONB,
    "processingStatus" TEXT NOT NULL DEFAULT 'PROCESSED',
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");
CREATE INDEX "SubscriptionPlan_code_idx" ON "SubscriptionPlan"("code");
CREATE INDEX "SubscriptionPlan_isActive_idx" ON "SubscriptionPlan"("isActive");

CREATE INDEX "Subscription_practiceId_idx" ON "Subscription"("practiceId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

CREATE UNIQUE INDEX "Payment_internalReference_key" ON "Payment"("internalReference");
CREATE INDEX "Payment_practiceId_idx" ON "Payment"("practiceId");
CREATE INDEX "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_gatewayTransactionId_idx" ON "Payment"("gatewayTransactionId");

CREATE UNIQUE INDEX "PaymentEvent_provider_eventId_key" ON "PaymentEvent"("provider", "eventId");
CREATE INDEX "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");
CREATE INDEX "PaymentEvent_receivedAt_idx" ON "PaymentEvent"("receivedAt");

-- AddForeignKeys
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## 3. Rollback Considerations

Should a rollback be required prior to release, the four new tables and three enums can be dropped cleanly without affecting any existing table:

```sql
DROP TABLE IF EXISTS "PaymentEvent" CASCADE;
DROP TABLE IF EXISTS "Payment" CASCADE;
DROP TABLE IF EXISTS "Subscription" CASCADE;
DROP TABLE IF EXISTS "SubscriptionPlan" CASCADE;
DROP TYPE IF EXISTS "PaymentStatus";
DROP TYPE IF EXISTS "BillingInterval";
DROP TYPE IF EXISTS "SubscriptionStatus";
```
Existing tables (`Practice`, `User`, `Prescription`, etc.) would remain completely intact.
