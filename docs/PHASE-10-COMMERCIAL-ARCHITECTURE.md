# VetRx Phase 10 — SaaS Commercial Architecture

**Version**: 1.0  
**Phase**: Phase 10 — SaaS Commercial Foundation  
**Status**: Foundational Architecture  

---

## 1. Architectural Mission

VetRx is a multi-tenant veterinary practice-management platform. Phase 10 introduces the foundational commercial architecture required to support future SaaS operations (Google Authentication in Phase 11, Trial/Subscription Plans in Phase 12, PayU Payments in Phase 13, and Commercial Launch in Phase 14).

The core objective of Phase 10 is to build a **clean, extensible, practice-centric commercial domain model and service boundary** without:
- Activating a paywall or blocking existing clinical operations.
- Integrating or communicating with external payment gateways (PayU).
- Implementing Google OAuth login UI.
- Modifying frozen Phase 4 UI or Phase 5 PDF/print stationery.
- Performing destructive database modifications.

---

## 2. Core Domain Hierarchy

VetRx maintains strict separation across four primary domains:

```mermaid
graph TD
    subgraph Identity & Tenancy
        User[User] -->|joins via Role| PracticeMember[PracticeMember]
        Practice[Practice - The Commercial Tenant]
        PracticeMember -->|belongs to| Practice
        Practice --> PracticeSettings[PracticeSettings]
    end

    subgraph Commercial Domain (Phase 10)
        Practice -->|has history of| Subscription[Subscription]
        SubscriptionPlan[SubscriptionPlan] -->|governs| Subscription
        Practice -->|initiates| Payment[Payment]
        Subscription -.->|associated with| Payment
        Payment -->|records audit events| PaymentEvent[PaymentEvent]
        SubscriptionPlan -->|defines| Entitlement[Entitlements Engine]
    end

    subgraph Clinical Domain (Protected & Frozen)
        Practice --> Owner[Owner]
        Owner --> Patient[Patient]
        Practice --> Medicine[Medicine Formulary]
        Practice --> TreatmentPackage[TreatmentPackage]
        Patient --> Prescription[Prescription]
        Prescription --> PrescriptionItem[PrescriptionItem]
        Practice --> Invoice[Clinical Patient Invoice]
        Invoice --> InvoiceItem[InvoiceItem]
        Invoice --> Receipt[Clinical Payment Receipt]
    end
```

### The Practice Tenant Rule
1. **The Practice is the Commercial Tenant**: Subscriptions, plans, payments, and entitlements are attached exclusively to `Practice.id`.
2. **Users are Practitioners**: Individual doctors, nurses, and clinic administrators belong to a `Practice` via `PracticeMember`. They do not possess personal SaaS subscriptions for clinic operations.
3. **Clinical Data Isolation**: Patients, owners, prescriptions, and clinical invoices belong to `Practice.id`. They have zero direct foreign key references to `Subscription` or `Payment`.
4. **Clinical Document Separation**: The existing `Invoice` and `Receipt` tables represent **clinical fees billed to pet owners** for veterinary consultations and drugs. They are completely separate from SaaS B2B subscription payments.

---

## 3. Commercial Service Layer Boundaries

The backend commercial architecture is partitioned into focused, single-responsibility services located in `server/src/commercial/`:

```
server/src/commercial/
├── commercial.types.ts             # Domain interfaces, enums, DTOs
├── commercial.service.ts           # Centralized CommercialAccountService
├── subscription.service.ts         # Subscription lifecycle state transitions
├── entitlement.service.ts          # Capability & quota evaluation engine
├── payment.service.ts              # Payment records and webhook event idempotency
├── payment.provider.interface.ts   # Gateway-agnostic PaymentGateway interface
└── commercial.controller.ts        # Tenant-scoped REST read endpoints
```

### 1. `CommercialAccountService`
Answers the fundamental system inquiry: *"What is the commercial status of this practice?"*
- Computes aggregated practice commercial health (`status`, `activePlan`, `trialRemainingDays`, `isPastDue`).
- Encapsulates queries so clinical controllers never inspect raw subscription tables.

### 2. `SubscriptionService`
Manages formal lifecycle state transitions:
$$\text{TRIAL} \longrightarrow \text{ACTIVE} \longrightarrow \text{PAST\_DUE} \longrightarrow \text{GRACE\_PERIOD} \longrightarrow \text{EXPIRED} \mid \text{CANCELLED}$$
- Handles subscription history retention without overwriting historical records.
- Executes multi-record updates within atomic Prisma transactions (`prisma.$transaction`).

### 3. `EntitlementService`
Evaluates what a practice is authorized to perform based on its active plan:
- Resolves feature flags and seat quotas (`canAccessSmartDose`, `canAccessPackages`, `maxUserSeats`, etc.).
- Centralizes rule evaluation to prevent scattered `if (plan === 'PRO')` conditionals across clinical code.
- **Phase 10 Rule**: Defaults to unrestricted clinical access to guarantee 100% non-regression for existing practices.

### 4. `PaymentService`
Manages payment record creation, status updates, and gateway callback audit logging:
- Enforces integer paisa currency validation.
- Provides atomic idempotency for incoming payment events using database unique constraints.

### 5. `PaymentGateway` Interface
Defines the contract for external payment providers (to be implemented by PayU in Phase 13):
- Method signatures: `createPaymentOrder`, `verifyCallback`, `verifyWebhook`, `getPaymentStatus`.
- Allows full unit and integration testing without network dependencies.

---

## 4. Tenant Isolation & Security Invariants

1. **Session-Derived Tenancy Only**:
   - The server derives `practiceId` exclusively from the authenticated session (`req.practice.id`).
   - Client-supplied `practiceId` parameters in request bodies, query strings, or headers are strictly ignored or rejected.
2. **Safe 404 Boundaries**:
   - Commercial resource lookups (e.g. `GET /api/commercial/subscription`) enforce `where: { practiceId: req.practice.id }`.
   - Cross-practice attempts to query another tenant's payment or subscription fail safely with `404 Not Found`.
3. **Secret Redaction**:
   - No payment secrets, gateway keys, webhook salts, or session tokens are logged in audit records or console output.
4. **Zero Clinical Data Deletion**:
   - Subscription expiration or cancellation never cascades to clinical tables. Medical and statutory records remain permanent.
