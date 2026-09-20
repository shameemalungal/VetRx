# VetRx — Phase 12 Trial & Subscription Architecture

## 1. System Overview

Phase 12 transforms VetRx's commercial domain models (established in Phase 10) into an operational subscription and trial management system. The architecture maintains strict multi-tenant isolation, integer paise monetary safety, deterministic state transitions, and a provider-neutral boundary ready for PayU integration in Phase 13.

```mermaid
graph TD
    User([Practitioner / Clinic Admin]) -->|Auth / Session| ServerSession[Server Session Context]
    ServerSession --> EntitlementGuard[Entitlement & Limit Guard]
    
    subgraph Commercial Engine
        CommercialController[Commercial Controller]
        SubscriptionService[Subscription Service]
        EntitlementService[Entitlement Service]
        PlanConfig[Authoritative Plan Config]
        PaymentGateway[Provider-Neutral PaymentGateway]
    end
    
    subgraph Data Tier (PostgreSQL)
        SubscriptionPlan[(SubscriptionPlan)]
        Subscription[(Subscription)]
        CommercialAccount[(CommercialAccount)]
        Practice[(Practice & Clinical Data)]
    end
    
    EntitlementGuard --> EntitlementService
    CommercialController --> SubscriptionService
    CommercialController --> EntitlementService
    SubscriptionService --> Subscription
    SubscriptionService --> CommercialAccount
    EntitlementService --> Practice
    SubscriptionService --> PlanConfig
    SubscriptionService --> PaymentGateway
```

---

## 2. Core Architectural Principles

### 2.1 Multi-Tenant Isolation
- Commercial state (`CommercialAccount`, `Subscription`, `Entitlement`) is strictly keyed by `practiceId`.
- The `practiceId` is derived exclusively on the server from the verified session (`req.practice.id`). Client-supplied identifiers in request bodies or query parameters are ignored.
- Reaching a usage limit or expiry in Practice A has zero side-effects or leakage into Practice B.

### 2.2 Strict Integer Paise Monetary Safety
- All prices, calculations, and financial balances are stored and manipulated as positive integers representing Indian Paise (1 INR = 100 paise).
- Floating point representations for monetary values are strictly prohibited in the domain layer.
- Formatters produce standardized Indian Rupee presentation strings (`₹599`, `₹5,999`, `₹1,499`, `₹14,999`) for client UI.

### 2.3 Provider-Neutral Payment Gateway Interface
- The `PaymentGateway` interface abstracts payment collection, customer setup, and payment method registration.
- Phase 12 establishes `PAYMENT_METHOD_PENDING` and dummy/mock hooks so that Phase 13 can plug in PayU without modifying `SubscriptionService`, `EntitlementService`, or `CommercialAccountService`.

### 2.4 Soft Expiry Architecture
- When a trial or subscription expires, **zero clinical data is deleted or altered**.
- The practice enters a read-only clinical mode:
  - Existing patients, prescriptions, treatment packages, invoices, and receipts remain 100% accessible, viewable, printable, and exportable.
  - Creation of new clinical records is paused until an active subscription is configured.

---

## 3. Commercial Domain Relationships

```
+-------------------------------------------------------------+
| Practice                                                    |
|  - id: UUID                                                 |
|  - name: String                                             |
|  - members: PracticeMember[] (vets & staff)                 |
+-------------------------------------------------------------+
                              | 1:1
                              v
+-------------------------------------------------------------+
| CommercialAccount                                           |
|  - id: UUID                                                 |
|  - practiceId: UUID                                         |
|  - status: ACTIVE | SUSPENDED | PAST_DUE | CANCELLED        |
|  - paymentMethodStatus: PENDING | CONFIGURED | REQUIRED     |
+-------------------------------------------------------------+
                              | 1:N
                              v
+-------------------------------------------------------------+
| Subscription                                                |
|  - id: UUID                                                 |
|  - commercialAccountId: UUID                                |
|  - planCode: TRIAL | INDIVIDUAL_* | CLINIC_* | ENTERPRISE   |
|  - status: TRIAL | ACTIVE | PAST_DUE | EXPIRED | CANCELLED  |
|  - trialStartsAt, trialEndsAt: DateTime                     |
|  - currentPeriodStart, currentPeriodEnd: DateTime           |
|  - cancelAtPeriodEnd: Boolean                               |
+-------------------------------------------------------------+
```

---

## 4. High-Level Lifecycle Matrix

| Event | Source State | Destination State | Immediate Access | Data Retention |
| :--- | :--- | :--- | :--- | :--- |
| **New Practice Signup** | None | `TRIAL` | Full (within limits) | 100% preserved |
| **Upgrade to Paid** | `TRIAL` / `EXPIRED` | `ACTIVE` | Full (unlimited patients) | 100% preserved |
| **Period Renewal Failure** | `ACTIVE` | `PAST_DUE` | Full (7-day grace) | 100% preserved |
| **Grace Period Expiry** | `PAST_DUE` | `EXPIRED` | Read-only clinical | 100% preserved |
| **Voluntary Cancellation**| `ACTIVE` | `ACTIVE` (`cancelAtPeriodEnd: true`) | Full until period end | 100% preserved |
| **Reactivation** | `ACTIVE` (`cancelAtPeriodEnd: true`) | `ACTIVE` (`cancelAtPeriodEnd: false`) | Full | 100% preserved |
| **Cancellation Expiry** | `ACTIVE` (`cancelAtPeriodEnd: true`) | `EXPIRED` | Read-only clinical | 100% preserved |

---

## 5. PayU Integration Boundary (Phase 13 Preparation)

In Phase 13, PayU will implement the existing `PaymentGateway` interface:
1. `createCustomer(practiceId, email, phone)` -> registers PayU customer identifier.
2. `createPaymentMandate(practiceId, planCode)` -> initiates PayU recurring mandate checkout.
3. `handleWebhook(payload, signature)` -> verifies PayU callback and triggers `SubscriptionService.handlePaymentSuccess()` or `handlePaymentFailure()`.

Phase 12 contains zero PayU-specific imports, ensuring decoupling and architecture purity.
