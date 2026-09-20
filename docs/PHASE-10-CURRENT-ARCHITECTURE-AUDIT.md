# VetRx Phase 10 — Repository & Architecture Audit

**Author**: Antigravity SaaS Platform Architect  
**Audit Date**: September 20, 2026  
**Scope**: Pre-implementation audit of VetRx codebase prior to introducing the SaaS Commercial Foundation (Phase 10).

---

## 1. Executive Summary

VetRx is an established, production-grade veterinary practice-management platform currently deployed and serving real clinical users at `https://vetrx.adcpmalappuram.in`. The application has successfully traversed Phases 0 through 9, completing infrastructure setup, authentication, clinical entities, UI design freeze (Phase 4), document/PDF architecture freeze (Phase 5), integration testing (Phase 6), production hardening (Phase 7), release candidate pilot (Phase 8), and production launch stabilization (Phase 9).

The system currently contains **zero commercial or billing models in the database schema** and **zero billing routes**. All 44 registered practices and 44 users in production operate with unmetered clinical access. 

This audit establishes the empirical baseline of the current codebase and defines the non-negotiable boundaries for Phase 10: introducing an additive, practice-centric commercial foundation without disrupting live clinical operations, without modifying frozen designs, and without activating premature paywalls.

---

## 2. Source Code & Version Control Baseline

- **Repository**: VetRx Monorepo (`vetrx-monorepo`)
- **Active Branch**: `feature/stage-3-clinical-api-persistence`
- **Current HEAD Commit SHA**: `22b1ba2f8646c1b9ea3fe285ef77ed510fd28515` (short: `22b1ba2`)
- **Documented Phase 9 Baseline SHA**: `76eb633` (Base release candidate: `f696837`, RC tag: `v0.8.0-rc.1`)
- **Git State**: Clean working tree on active branch; untracked local test/verification artifact folders present from prior phases.
- **Commit History Invariant**: No git reset or history rewriting was performed or will be performed.

---

## 3. Workspaces & Package Structure

The repository is configured as an `npm` monorepo containing two workspaces:

1. **Root Workspace (`package.json`)**:
   - Manages developer orchestration, Prisma CLI (`^6.4.1`), TypeScript (`^5.7.3`), `concurrently`, and test automation runners (`tsx ^4.19.3`).
2. **Backend Workspace (`server/package.json`)**:
   - `vetrx-server@1.0.0`, ECMAScript Modules (`"type": "module"`).
   - Core dependencies: `@prisma/client@^6.4.1`, `express@^4.21.2`, `helmet@^8.0.0`, `cors@^2.8.5`, `cookie-parser@^1.4.7`, `bcryptjs@^3.0.2`, `zod@^3.24.2`, `express-rate-limit@^7.5.0`, `dotenv@^16.4.7`.
3. **Frontend Workspace (`web/package.json`)**:
   - `web@0.0.0`, React 19 (`react@^19.0.0`, `react-dom@^19.0.0`), Vite 8 (`vite@^8.2.2`).
   - Client persistence: `dexie@^4.0.11` (IndexedDB offline store), `zustand@^5.0.3` (state management).
   - Icons & UI: `lucide-react@^1.16.0`, Tailwind CSS (`^3.4.17` - used in Phase 4 design language), `html2canvas@^1.4.1`, `jspdf@^3.0.0`.

---

## 4. Production Database & Schema Inspection

### Database Engine & Infrastructure
- **Engine**: PostgreSQL 16 on Docker container (`vetrx-postgres-prod`) hosted on Ubuntu VPS (`109.122.56.148`).
- **Connection**: Managed via Prisma ORM connection pooling over internal Docker network.
- **Migrations Directory**: Single migration `prisma/migrations/20260915000000_init/migration.sql` creating initial 18 public schema tables.

### Current Database Models (18 Public Tables)
1. `User`: Identity credentials, email, passwordHash, avatarUrl, emailVerified, isActive.
2. `AuthIdentity`: Multi-provider identity mapping (`google`, `password`, legacy `future_mykgvoa`).
3. `Session`: Session tracking with SHA-256 hashed tokens and expiration dates.
4. `Practice`: The primary multi-tenant boundary. Owner user ID, slug, active status.
5. `PracticeMember`: Membership join model associating `User` with `Practice` under a `Role` (`PRACTICE_OWNER`, `PRACTICE_ADMIN`, `PRACTICE_STAFF`).
6. `PracticeSettings`: Practice metadata (clinic name, doctor name, registration number, signature URL, logo URL).
7. `Owner`: Pet/animal owner directory, scoped by `practiceId`.
8. `Patient`: Animal record, scoped by `practiceId` and `ownerId`.
9. `Medicine`: Practice formulary/inventory, scoped by `practiceId`.
10. `TreatmentPackage`: Standardized prescription templates, scoped by `practiceId`.
11. `Prescription`: Clinical prescription record, scoped by `practiceId` and `patientId`.
12. `PrescriptionItem`: Line items for medicines, doses, frequencies, and durations.
13. `Invoice`: Financial billing record for clinical services and medicines, scoped by `practiceId`.
14. `InvoiceItem`: Line items for clinical invoice.
15. `Receipt`: Payment receipt voucher for clinical invoices, scoped by `practiceId`.
16. `DocumentSequence`: Sequential document numbering generator per practice/year/type.
17. `AuditLog`: System audit trail recording security and operational actions.
18. `_prisma_migrations`: Prisma migration state history table.

---

## 5. Authentication & Identity Architecture

- **Session Mechanics**:
  - State is managed via 64-character hex cryptographically secure tokens.
  - Hashed server-side using SHA-256 (`sessionTokenHash`) stored in the `Session` table.
  - Delivered to browsers via HTTP-only, SameSite=Lax cookies (`vetrx_session`).
- **Identity Abstraction (`AuthIdentity`)**:
  - Maps external or internal identity providers (`provider`, `providerUserId`) to internal `User.id`.
  - Unique constraint on `@@unique([provider, providerUserId])`.
  - Collision Safety: In `AuthService.handleOAuthIdentity`, if an incoming OAuth identity matches an existing normalized email with a password hash, it throws `409 ACCOUNT_COLLISION` rather than blindly merging accounts.
- **Frontend Auth Context (`AuthContext.tsx`)**:
  - Bootstraps session state on initial load via `GET /api/auth/me`.
  - Exposes `user`, `practice`, `membership`, `settings`.
  - Switches client-side Dexie IndexedDB database tenant context via `switchTenantDb(data.practice.id)`.

---

## 6. Multi-Tenant Isolation Architecture

- **The Non-Negotiable Tenant Unit**: `Practice`.
- **Server-Side Context Derivation**:
  - `requireAuth` validates the raw session token against `Session` and attaches `req.user`.
  - `requirePractice` inspects `prisma.practiceMember` for active memberships associated with `req.user.id` and attaches `req.practice` and `req.membership`.
  - **Zero Trust for Client-Supplied Identifiers**: Any `practiceId` supplied in request headers, query parameters, or request body is ignored or rejected. All database read/write queries are strictly bound to `req.practice.id`.
- **Query Scoping**:
  - Every clinical query uses `where: { id: entityId, practiceId: req.practice.id }`.
  - Unauthorized cross-tenant reads return `404 Not Found` rather than `403 Forbidden` to prevent resource existence enumeration.

---

## 7. Audit Logging Architecture

- Managed by `AuditService.record(...)` persisting to `AuditLog`:
  - `practiceId`: Scoped tenant practice.
  - `userId`: Actor who triggered the action.
  - `action`: String code (`USER_LOGGED_IN`, `USER_REGISTERED`, `PRACTICE_UPDATE`, etc.).
  - `resource`: Affected resource entity name.
  - `resourceId`: Identifier of the modified record.
  - `details`: Structured JSON payload (sanitized of passwords and tokens).
  - `ipAddress`, `userAgent`: Network context.

---

## 8. Clinical Financial Models vs. SaaS Commercial Billing

A critical distinction observed in the codebase:
- `Invoice`, `InvoiceItem`, and `Receipt` currently exist in `prisma/schema.prisma`.
- **These are purely clinical practice invoices** issued by veterinarians to animal owners for clinical consultations, surgeries, and dispensed medicines.
- **They are NOT SaaS subscription billing invoices**.
- Under no circumstances should the clinical `Invoice` model be repurposed or overloaded for VetRx SaaS subscription billing. The SaaS commercial domain must be entirely distinct.

---

## 9. Existing Commercial & Billing Gaps

The audit reveals the following gaps:
1. **No Subscription Plan Model**: No entity to represent SaaS tiers, pricing in paise, billing intervals, or active status.
2. **No Practice Subscription Model**: No entity to store a practice's subscription lifecycle status (`TRIAL`, `ACTIVE`, `PAST_DUE`, `GRACE_PERIOD`, `EXPIRED`, `CANCELLED`), trial dates, or renewal dates.
3. **No Commercial Payment Model**: No entity to store SaaS payment orders, PayU gateway transaction references, amounts in integer paise, or verification status.
4. **No Payment Event Model**: No immutable ledger for gateway webhooks or callbacks with idempotency guarantees.
5. **No Entitlement Abstraction**: Feature gating does not exist; all practices currently possess unmetered access to all features.
6. **No Commercial API Endpoints**: No routes under `/api/commercial/*` or `/api/billing/*`.

---

## 10. Risks & Failure Modes

1. **Risk of Accidental Paywall / Clinical Regression**: If Phase 10 introduces strict entitlement checks inside clinical controllers before Phase 14, existing production practices would suddenly be locked out.
   - *Mitigation*: Phase 10 introduces the `EntitlementService` and `SubscriptionService` as isolated boundaries. Clinical controllers will **not** invoke commercial blocking middleware in Phase 10.
2. **Risk of Destructive Database Migration**: Running migrations against the live database could accidentally drop tables, columns, or truncate production data.
   - *Mitigation*: All Phase 10 Prisma schema changes are purely additive (new tables and new foreign key relations on `Practice`). Review the generated SQL line-by-line before applying.
3. **Risk of Currency Precision Errors**: Using floating-point numbers for money leads to rounding errors in invoices and reconciliation.
   - *Mitigation*: The commercial domain model mandates integer paise (`pricePaisa: Int`, `amountPaisa: Int`), representing INR currency with zero floating-point math.
4. **Risk of Webhook Replay / Duplicate Payment Activation**: PayU or network retries sending duplicate callbacks.
   - *Mitigation*: Database-level unique constraints on `[gateway, gatewayTransactionId]` in the `PaymentEvent` and `Payment` models, evaluated inside serializable transactions.

---

## 11. Recommended Phase 10 Implementation Boundaries

Based on this audit, Phase 10 will strictly execute:
1. **Commercial Data Models**: Add `SubscriptionPlan`, `Subscription`, `Payment`, `PaymentEvent` to `prisma/schema.prisma`.
2. **Additive Migration**: Generate a clean, non-destructive migration script.
3. **Domain Types & Services**: Implement `CommercialAccountService`, `SubscriptionService`, `EntitlementService`, and `PaymentService` in `server/src/commercial/`.
4. **Provider Abstraction**: Define `PaymentGateway` interface for future PayU integration (no actual PayU calls or credentials).
5. **Read-Only Commercial API**: Implement `GET /api/commercial/status`, `GET /api/commercial/subscription`, `GET /api/commercial/entitlements` strictly scoped by authenticated session `practiceId`.
6. **Commercial Test Suite**: Automated tests covering tenant isolation, integer paise arithmetic, payment idempotency, and lifecycle state transitions.
7. **Zero Clinical Disruption**: No changes to existing clinical models, controllers, or Phase 4/5 frozen UI/PDF documents.
