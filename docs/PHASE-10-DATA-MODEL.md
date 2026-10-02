# VetRx Phase 10 — Commercial Data Model

**Document Version**: 1.0  
**Status**: Authoritative Database Design  
**Schema Implementation**: Prisma ORM with PostgreSQL  

---

## 1. Design Overview

The commercial data model is strictly additive. It introduces four new tables to the PostgreSQL database (`SubscriptionPlan`, `Subscription`, `Payment`, `PaymentEvent`) and establishes two clean relationships from the existing `Practice` model.

No existing clinical tables (`Owner`, `Patient`, `Medicine`, `TreatmentPackage`, `Prescription`, `Invoice`, `Receipt`, `DocumentSequence`, `AuditLog`) are altered.

---

## 2. Enums

### `SubscriptionStatus`
Represents the standard lifecycle states of a practice's subscription:
- `TRIAL`: Practice is in its introductory evaluation period.
- `ACTIVE`: Paid subscription in good standing.
- `PAST_DUE`: Renewal billing attempt failed; immediate retry pending.
- `GRACE_PERIOD`: Temporary operational extension allowing full access while awaiting payment.
- `EXPIRED`: Grace period elapsed without payment; restricted to read-only clinical history.
- `CANCELLED`: Subscription cancelled by subscriber; access remains valid until `currentPeriodEnd`.

### `BillingInterval`
Represents the recurrence interval for subscription plans:
- `MONTHLY`: Standard 30-day / 1-month recurrence.
- `THREE_MONTHS`: Quarterly 90-day recurrence.
- `ANNUAL`: 365-day / 12-month recurrence.
- `ONE_TIME`: Fixed duration or non-recurring trial cycle.

### `PaymentStatus`
Represents the authoritative lifecycle state of an internal commercial payment:
- `PENDING`: Payment order created, awaiting gateway callback or redirect.
- `AUTHORIZED`: Funds held by gateway, pending capture.
- `SUCCESS`: Payment successfully captured and verified.
- `FAILED`: Payment rejected, timed out, or cancelled by user.
- `REFUNDED`: Full transaction amount reversed to payer.
- `PARTIALLY_REFUNDED`: Fractional amount reversed.
- `CANCELLED`: Order abandoned before submission.

---

## 3. Entity Definitions

### 1. `SubscriptionPlan`
Defines available commercial tiers, billing cycles, and feature metadata.

```prisma
model SubscriptionPlan {
  id              String          @id @default(uuid())
  code            String          @unique // e.g. "TRIAL", "MONTHLY", "THREE_MONTHS", "ANNUAL"
  name            String          // Human-readable plan name
  description     String?
  interval        BillingInterval @default(MONTHLY)
  intervalCount   Int             @default(1)
  pricePaisa      Int             // Stored in integer paise (INR), e.g. 59900 = ₹599.00
  currency        String          @default("INR")
  trialPeriodDays Int             @default(0)
  maxUserSeats    Int             @default(1)
  featuresJson    Json            @default("{}")
  isActive        Boolean         @default(true)
  sortOrder       Int             @default(0)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  subscriptions   Subscription[]

  @@index([code])
  @@index([isActive])
}
```

### 2. `Subscription`
Tracks the ongoing commercial agreement between a `Practice` and a `SubscriptionPlan`. Designed to retain full subscription history across multiple terms.

```prisma
model Subscription {
  id                    String             @id @default(uuid())
  practiceId            String
  practice              Practice           @relation(fields: [practiceId], references: [id], onDelete: Cascade)
  planId                String
  plan                  SubscriptionPlan   @relation(fields: [planId], references: [id], onDelete: Restrict)
  status                SubscriptionStatus @default(TRIAL)
  trialStartsAt         DateTime?
  trialEndsAt           DateTime?
  currentPeriodStart    DateTime           @default(now())
  currentPeriodEnd      DateTime
  cancelledAt           DateTime?
  cancelAtPeriodEnd     Boolean            @default(false)
  gracePeriodEndsAt     DateTime?
  gatewayCustomerId     String?            // Future PayU or provider customer reference
  gatewaySubscriptionId String?            // Future recurring subscription reference
  metadata              Json?
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt

  payments              Payment[]

  @@index([practiceId])
  @@index([status])
  @@index([currentPeriodEnd])
}
```

### 3. `Payment`
Records individual commercial transactions for SaaS subscriptions. Never stores client-submitted or unverified status.

```prisma
model Payment {
  id                   String        @id @default(uuid())
  practiceId           String
  practice             Practice      @relation(fields: [practiceId], references: [id], onDelete: Cascade)
  subscriptionId       String?
  subscription         Subscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)
  amountPaisa          Int           // Strict integer paise: ₹100.00 = 10000
  currency             String        @default("INR")
  status               PaymentStatus @default(PENDING)
  paymentProvider      String        @default("PAYU")
  internalReference    String        @unique // Unique internal payment tracking ID
  gatewayTransactionId String?       // External PayU txnid or reference
  paymentMethod        String?       // UPI, CARD, NETBANKING
  gatewayResponseRaw   Json?
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt

  events               PaymentEvent[]

  @@index([practiceId])
  @@index([subscriptionId])
  @@index([status])
  @@index([gatewayTransactionId])
}
```

### 4. `PaymentEvent`
An immutable ledger of all inbound gateway webhooks and redirect callbacks, engineered with database-level idempotency protection.

```prisma
model PaymentEvent {
  id               String    @id @default(uuid())
  paymentId        String?
  payment          Payment?  @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  provider         String    // e.g. "PAYU"
  eventId          String    // External event ID or gateway transaction ID
  eventType        String    // e.g. "PAYMENT_SUCCESS", "PAYMENT_FAILED"
  payloadHash      String?   // SHA-256 hash of raw payload
  rawPayload       Json?
  processingStatus String    @default("PROCESSED") // "RECEIVED", "PROCESSED", "FAILED", "IGNORED"
  errorMessage     String?
  receivedAt       DateTime  @default(now())
  processedAt      DateTime?

  @@unique([provider, eventId]) // STRICT IDEMPOTENCY: Duplicate delivery rejected safely
  @@index([paymentId])
  @@index([receivedAt])
}
```

---

## 4. Updates to Existing Models

The only change to existing models is adding navigation relations to `Practice`:

```prisma
model Practice {
  // ... all existing fields remain unchanged ...

  // Commercial Relations (Phase 10)
  subscriptions     Subscription[]
  payments          Payment[]
}
```

---

## 5. Currency & Money Representation Invariant

- **Zero Floating-Point Arithmetic**: Storing currency as `Float` or `Decimal` introduces precision loss and rounding discrepancies in PostgreSQL and JavaScript runtimes.
- **Integer Paise Standard**:
  - Currency is standardized to Indian Rupee (`INR`).
  - All prices and charges are stored as 32-bit/64-bit integers representing **paise** (1 INR = 100 paise).
  - Examples:
    - ₹100.00 = `10000` paise
    - ₹599.00 = `59900` paise
    - ₹1,400.00 = `140000` paise
- **Display Conversion Helper**:
  $$\text{Rupees} = \frac{\text{amountPaisa}}{100}$$
  Formatting for display occurs only at the presentation layer using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.

---

## 6. Payment Event Idempotency Invariant

To guarantee that duplicate gateway callbacks (e.g. concurrent webhook deliveries or repeated user redirect hits) never result in duplicate subscription renewals or double billing:
1. `PaymentEvent` defines a database unique constraint: `@@unique([provider, eventId])`.
2. Any duplicate callback will fail database insertion with a unique constraint violation (`P2002` in Prisma).
3. The `PaymentService` intercepts this error and returns a successful idempotent confirmation without executing state changes.
