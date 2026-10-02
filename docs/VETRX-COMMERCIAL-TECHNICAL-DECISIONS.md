# VetRx Commercial Technical Decisions Register

This document records the architectural and engineering decisions governing the design and implementation of the VetRx commercial SaaS engine, PayU payment gateway integration, Google identity provider, entitlement service, and data lifecycle management.

---

## Technical Decision Log

### TD-01: Decoupled Commercial Domain Architecture
- **Decision**: Architect the commercial domain (`SubscriptionPlan`, `Subscription`, `Payment`, `PaymentEvent`, `Entitlement`) completely independent of the clinical domain (`Owner`, `Patient`, `Prescription`, `Invoice`, `Receipt`).
- **Reason**: Clinical practice records must remain stable, HIPAA/statutory compliant, and unaffected by future changes in subscription models, pricing changes, or payment gateways.
- **Alternatives Considered**:
  - *Coupled schema*: Adding subscription status and payment tokens directly to the `Practice` or `Prescription` models. (Rejected: High regression risk, pollutes clinical queries, violates separation of concerns).
- **Chosen Approach**: Layered architecture where `Practice` is the shared tenant entity. Clinical models reference `practiceId`. The commercial service queries `Subscription` by `practiceId` to evaluate access via an `EntitlementService`.
- **Impact**: Zero modification to existing clinical schemas or Phase 4/5 frozen document rendering templates.
- **Status**: **APPROVED**

---

### TD-02: Server-Side Authoritative Entitlement Engine
- **Decision**: Centralize all feature gating and quota checks in a backend `EntitlementService` executed at the API middleware level.
- **Reason**: Frontend restrictions (hiding buttons, disabling routes) are purely UX enhancements and provide zero security. Malicious or modified clients can bypass frontend checks.
- **Alternatives Considered**:
  - *Frontend-only feature flags*: Relying on React state to hide features. (Rejected: Insecure, easily bypassed via direct REST API calls).
  - *Scattered ad-hoc checks*: Placing `if (practice.isPaid)` conditions inside individual controllers. (Rejected: Unmaintainable, violates DRY, introduces authorization bugs).
- **Chosen Approach**: Express middleware `requireEntitlement(featureKey)` that intercepts API requests, queries the cached `EntitlementService`, and enforces access before controller execution.
- **Impact**: Consistent, auditable security enforcement across all REST endpoints.
- **Status**: **APPROVED**

---

### TD-03: Gateway-Agnostic Payment Provider Abstraction
- **Decision**: Implement a generic `PaymentGateway` interface that encapsulates payment initiation, signature verification, callback handling, and refund processing, with a dedicated `PayUAdapter` implementation.
- **Reason**: Isolates gateway-specific payload structures (PayU hash algorithms, post parameters, status strings) from the core `BillingService`. Allows future gateway redundancy or migrations without rewriting subscription logic.
- **Alternatives Considered**:
  - *Direct PayU coupling*: Embedding PayU SDK calls and payload parsing directly in the billing controller. (Rejected: Locks system to single vendor, breaks testability with mock gateways).
- **Chosen Approach**:
  ```typescript
  interface PaymentGateway {
    createPaymentOrder(order: PaymentOrderRequest): Promise<PaymentOrderResponse>;
    verifyCallback(payload: Record<string, any>): Promise<VerifiedPaymentResult>;
    verifyWebhook(payload: Record<string, any>, signature: string): Promise<VerifiedPaymentResult>;
    getPaymentStatus(gatewayTransactionId: string): Promise<PaymentStatusResult>;
  }
  ```
- **Impact**: Enables 100% unit and integration test coverage using a `MockPaymentGateway` without hitting external network endpoints.
- **Status**: **APPROVED**

---

### TD-04: Server-Side Authoritative PayU Verification & Secret Isolation
- **Decision**: Strictly isolate all PayU merchant credentials (`PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT`) on the server. Never trust browser callbacks to activate subscriptions.
- **Reason**: Client browsers are untrusted environments. A client can forge a "success" callback or modify transaction parameters in transit.
- **Alternatives Considered**:
  - *Client-side callback confirmation*: Activating the subscription when the browser redirects to `/payment/success`. (Rejected: Severe financial fraud vulnerability).
- **Chosen Approach**:
  1. Frontend submits checkout form to PayU.
  2. PayU redirects browser to `POST /api/billing/payu/return` (or sends server-to-server webhook).
  3. VetRx backend independently calculates the SHA-512 reverse hash:
     $$\text{hash} = \text{SHA512}(\text{SALT} \parallel \text{status} \parallel \dots \parallel \text{KEY})$$
  4. Backend verifies transaction amount, currency, and status against the internal `Payment` record.
  5. Only upon verified hash and status match does the backend transition the subscription to `ACTIVE`.
- **Impact**: Eliminates transaction tampering, man-in-the-middle payment spoofing, and unauthorized subscription activations.
- **Status**: **APPROVED**

---

### TD-05: Webhook & Callback Idempotency Handling
- **Decision**: Enforce strict database-level idempotency on all payment events using unique constraints on `[gateway, gatewayTransactionId]`.
- **Reason**: PayU and networks may retransmit callbacks or webhooks due to network retries, timeouts, or concurrent delivery.
- **Alternatives Considered**:
  - *Application-level checks*: In-memory checking of processed IDs. (Rejected: Fails across container restarts, multi-instance deployments, or race conditions).
- **Chosen Approach**:
  - Use database table `Payment` with `@unique([gateway, gatewayTransactionId])`.
  - Process callbacks within a PostgreSQL serializable transaction. If an event has already been marked `SUCCESS`, subsequent matching callbacks return HTTP 200 immediately without re-crediting or extending subscription periods.
- **Impact**: Prevents duplicate billing credits, duplicated subscription renewals, and race conditions.
- **Status**: **APPROVED**

---

### TD-06: Asynchronous Payment Reconciliation & Recovery
- **Decision**: Implement a background reconciliation worker to verify pending payments and resolve dropped callbacks.
- **Reason**: If a customer closes their browser tab before PayU redirects back, and if a webhook is delayed, a payment could remain in `INITIATED` status indefinitely while the customer was charged.
- **Alternatives Considered**:
  - *Manual customer support intervention*: Relying on support tickets to manually activate accounts. (Rejected: Poor user experience, operational overhead).
- **Chosen Approach**: A scheduled reconciliation task checks all `Payment` records in `INITIATED` status older than 15 minutes by polling PayU's server-to-server Verification API (`verify_payment`). If PayU confirms success, the subscription is activated asynchronously.
- **Impact**: Self-healing payment recovery with zero manual practitioner friction.
- **Status**: **APPROVED**

---

### TD-07: Production-Hardened Google OAuth Provider
- **Decision**: Utilize the existing `GoogleOAuthProvider` and `AuthIdentity` model, hardening it with strict state validation, CSRF protection, and error handling.
- **Reason**: The foundational Google OAuth provider exists in `server/src/auth/google.provider.ts` and `auth.service.ts`, but requires production secrets, callback error routing, and safe account linking.
- **Alternatives Considered**:
  - *External auth services (Auth0/Firebase Auth)*: Outsourcing auth. (Rejected: Introduces third-party runtime dependency, increases latency, violates existing self-contained Phase 2/7 architecture).
- **Chosen Approach**: Keep lightweight, native Google OAuth implementation using standard `fetch` with PKCE/crypto state cookies and SHA-256 session token hashing.
- **Impact**: Zero external runtime lock-in; seamless coexistence of email/password and Google login.
- **Status**: **APPROVED**

---

### TD-08: Safe Account Linking without Blind Merging
- **Decision**: Strictly prohibit automatic merging of Google OAuth identities with existing password accounts based solely on email matching.
- **Reason**: Prevents account takeover attacks where an attacker creates an unverified Google account with a victim's email to gain access to an existing password-protected VetRx practice.
- **Alternatives Considered**:
  - *Automatic email-based merge*: Merging on email match. (Rejected: Documented OWASP security vulnerability).
- **Chosen Approach**: If a Google login occurs with an email matching an existing password account, the server rejects the login with `409 ACCOUNT_COLLISION` ("An account with this email address already exists. Please sign in with your email and password to link your Google account."). Account linking is permitted only when the user is already authenticated with their primary password.
- **Impact**: 100% security against identity spoofing and unauthorized practice takeovers.
- **Status**: **APPROVED**

---

### TD-09: Billing UI Placement & Architecture
- **Decision**: Integrate the future Commercial Billing UI as a dedicated section in `SettingsPage` (`/settings?tab=billing`) and an optional top-level `/billing` route for Practice Owners, without modifying clinical screens.
- **Reason**: Preserves the established, frozen Phase 4 AppShell navigation and avoids cluttering clinical workflows (Prescriptions, Patients, Invoices) with commercial prompts.
- **Alternatives Considered**:
  - *Top navigation banner*: Persistent subscription status in header. (Rejected: Distracting during clinical consultations).
  - *Modal popups*: Intrusive paywalls. (Rejected: Violates clinical workflow continuity).
- **Chosen Approach**: Clean, dedicated Billing tab displaying current plan, trial countdown (if applicable), billing interval, payment history table, and PayU upgrade/renew actions.
- **Impact**: Respects frozen clinical UI; accessible exclusively to authorized practice administrators.
- **Status**: **APPROVED**

---

### TD-10: Practice-Bound Trial Enforcement Model
- **Decision**: Associate trials with the `Practice` entity rather than the individual `User` email address.
- **Reason**: Prevents trivial trial abuse wherein a user creates multiple email aliases to operate the same practice continuously without paying.
- **Alternatives Considered**:
  - *User-level trials*: Storing trial dates on `User`. (Rejected: Easily exploited by creating new user accounts).
- **Chosen Approach**: `Subscription` record references `practiceId`. When a practice is registered, it receives a single initial trial period. Adding members to a practice does not grant additional trials.
- **Impact**: Fair, abuse-resistant trial management.
- **Status**: **APPROVED**

---

### TD-11: Clinical Data Retention & Non-Destructive Expiry
- **Decision**: Enforce an immutable data retention policy: subscription expiry, non-payment, or cancellation **never** deletes clinical data (`Owner`, `Patient`, `Prescription`, `Invoice`, `Receipt`).
- **Reason**: Veterinary medical ethics, state veterinary council regulations, and client trust mandate that clinical records remain intact.
- **Alternatives Considered**:
  - *Automated database purge after 30 days*: Deleting inactive accounts. (Rejected: Catastrophic data loss risk, legally unacceptable for medical records).
- **Chosen Approach**: Transition expired practices to a restricted access state (read-only clinical history, accessible data export) while retaining all database rows indefinitely until formal legal retention policy guidelines are enacted.
- **Impact**: Zero data loss risk; practitioner records remain completely recoverable upon resubscription.
- **Status**: **APPROVED**

---

### TD-12: Tamper-Resistant Commercial Audit Logging
- **Decision**: Record all commercial state transitions (subscription creation, tier upgrade, payment success, payment failure, cancellation, administrative override) in the PostgreSQL `AuditLog` table.
- **Reason**: Financial dispute resolution, statutory tax compliance, and multi-tenant security auditing require an immutable record of who initiated each transaction and when.
- **Alternatives Considered**:
  - *Application log files only*: Relying on Winston/Morgan text logs. (Rejected: Difficult to query, prone to rotation/truncation, cannot be queried directly from the database).
- **Chosen Approach**: Utilize the existing `AuditLog` model (`action: "SUBSCRIPTION_UPDATE" | "PAYMENT_CONFIRMED" | "PLAN_UPGRADE"`, `practiceId`, `userId`, `details: Json`).
- **Impact**: Comprehensive financial and operational audit trail.
- **Status**: **APPROVED**
