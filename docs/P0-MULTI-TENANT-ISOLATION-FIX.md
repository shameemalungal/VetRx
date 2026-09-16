# P0 Resolution: Practitioner Profile & Cross-Account Data Isolation Fix

## Executive Summary

- **Incident Classification**: P0 Security & Multi-Tenant Data Isolation Defect
- **Target Repository**: `C:\Antigravity\VetRx`
- **Current Branch**: `feature/stage-3-clinical-api-persistence`
- **Production Environment**: `https://vetrx.adcpmalappuram.in`
- **Resolution Status**: **Fully Resolved, Tested, Deployed, and Verified in Production**

When testing with two independent accounts (Doctor Alpha and Doctor Beta) within the same browser, both accounts displayed the same practitioner profile and organization settings, and clinical records (such as patients) created under Account A were visible to Account B.

This document details the root causes identified, architectural remediation across both frontend and backend systems, testing proof (29 backend unit/integration tests + 10 automated end-to-end browser UAT checks), and production deployment verification.

---

## 1. Root Cause Analysis (RCA)

Investigation revealed that the leakage occurred due to defects across two layers:

### A. Frontend Layer: Shared Static Global IndexedDB and Incomplete Auth Teardown
1. **Single Global IndexedDB Database**:
   In `web/src/db/schema.ts`, Dexie was initialized statically as `export const db = new VetRxDatabase()`, which opened a single browser IndexedDB database named `VetRxDB`. All users logging into the browser accessed the exact same local database tables (`owners`, `patients`, `prescriptions`, `invoices`, `practitioners`).
2. **Unpartitioned Settings Store**:
   `web/src/store/settingsStore.ts` read settings directly from `db.practitioners.toCollection().first()`. When Doctor A registered or saved their profile, the record was saved in `VetRxDB.practitioners`. When Doctor B logged in subsequently on the same browser, `settingsStore.loadSettings()` loaded Doctor A's practitioner record from IndexedDB.
3. **Missing Session Teardown on Logout**:
   In `web/src/context/AuthContext.tsx`, the `logout()` handler cleared the user state in React context, but did not reset the Zustand `settingsStore`, did not switch or clear IndexedDB, and did not invalidate local storage keys.
4. **Static Route Hierarchy**:
   In `web/src/App.tsx`, the route tree did not unmount when switching accounts, meaning in-memory state in components and hooks persisted across session changes.

### B. Backend Layer: Missing Tenant-Authoritative REST Endpoints for Clinical Entities
1. While Prisma schemas in `prisma/schema.prisma` contained mandatory `practiceId` foreign keys and the `requirePractice` middleware existed, there were **no dedicated REST API controllers** mounted for `Owner`, `Patient`, `Medicine`, `TreatmentPackage`, `Prescription`, or `Invoice`.
2. As a consequence, the frontend relied on local client-side IndexedDB persistence, which had zero multi-tenant partitioning.

---

## 2. Architecture & Technical Remediation

### Architecture Overview

```
               Browser Session (Account A: Practice P_A)
                                  │
      ┌───────────────────────────┴───────────────────────────┐
      │                                                       │
      ▼                                                       ▼
Zustand Settings Store                         Dexie IndexedDB: "VetRxDB_P_A"
[reset() on session change]                    [Dynamically bound to Practice A]
      │                                                       │
      └───────────────────────────┬───────────────────────────┘
                                  │
                                  ▼ HTTP with `vetrx_session` Cookie
                 Server: /api/clinical/* & /api/practice/*
                 [requireAuth + requirePractice middleware]
                                  │
             `practiceId` derived STRICTLY from Session
             Cross-tenant queries return HTTP 404 (No Bleed)
                                  │
                                  ▼
                 PostgreSQL (Docker Container: vetrx-postgres)
                 All queries filtered: `where: { practiceId }`
```

---

### Key Remediation Components

#### 1. Backend: Server-Authoritative Clinical REST API
- **Implementation**: Created [`server/src/clinical/clinical.service.ts`](file:///c:/Antigravity/VetRx/server/src/clinical/clinical.service.ts) and [`server/src/clinical/clinical.controller.ts`](file:///c:/Antigravity/VetRx/server/src/clinical/clinical.controller.ts), mounted under `/api` in [`server/src/app.ts`](file:///c:/Antigravity/VetRx/server/src/app.ts).
- **Enforcement**:
  - All routes protected by `requireAuth` and `requirePractice`.
  - `practiceId` is **never accepted from the client request body or query string**. It is bound directly from `req.practice.id`.
  - All read, list, update, and delete queries enforce `where: { id, practiceId: req.practice.id }`.
  - Cross-practice lookups return `404 Not Found`, eliminating ID enumeration and cross-tenant data leaks.
  - All mutations record an audit trail via `AuditLog` with `practiceId` and `userId`.

#### 2. Frontend: Dynamic Tenant Partitioning in IndexedDB
- **Implementation**: Modified [`web/src/db/schema.ts`](file:///c:/Antigravity/VetRx/web/src/db/schema.ts).
- Parameterized `VetRxDatabase(name: string)` and created `switchTenantDb(practiceId: string | null)`.
- Dexie opens isolated databases per practice:
  - Account with Practice `P_A` -> IndexedDB `VetRxDB_P_A`
  - Account with Practice `P_B` -> IndexedDB `VetRxDB_P_B`
  - Unauthenticated / Guest -> IndexedDB `VetRxDB_guest`
- Exported `db` as an ES6 `Proxy`, allowing all existing UI components and Dexie hooks (`useLiveQuery`) to seamlessly read and write to the active tenant's database without code changes.

#### 3. Frontend: Settings Store Isolation & Re-Synchronization
- **Implementation**: Updated [`web/src/store/settingsStore.ts`](file:///c:/Antigravity/VetRx/web/src/store/settingsStore.ts).
- Added `reset()` method to clear in-memory state on logout.
- Updated `loadSettings()` to synchronize with the backend authoritative settings endpoint (`/api/practice/settings`) before falling back to local storage.
- Updated `savePractitioner()` and `saveOrganisation()` to sync updates to `/api/practice/settings`.

#### 4. Frontend: Complete Auth Lifecycle Hooking & Component Remounting
- **Implementation**: Updated [`web/src/context/AuthContext.tsx`](file:///c:/Antigravity/VetRx/web/src/context/AuthContext.tsx) and [`web/src/App.tsx`](file:///c:/Antigravity/VetRx/web/src/App.tsx).
- Upon `login`, `register`, and `refreshSession`:
  - Activates tenant database: `await switchTenantDb(practice.id)`.
  - Loads practice settings: `await useSettingsStore.getState().loadSettings()`.
- Upon `logout`:
  - Calls `POST /api/auth/logout`.
  - Switches database: `await switchTenantDb(null)`.
  - Resets settings store: `useSettingsStore.getState().reset()`.
  - Clears `localStorage` active practice keys.
- Keyed route container in `App.tsx`: `<AuthenticatedAppRoutes key={practice.id} />` ensures the entire component tree, hooks, and local state are cleanly unmounted and recreated whenever the tenant changes.

---

## 3. Verification & Validation Evidence

### A. Backend Unit & Integration Tests (29 of 29 Passed)
The backend test suite was run using Jest and Supertest (`npm test`):
- **15 existing authentication & tenant isolation tests**:
  - Registration, login, session validation.
  - Organization settings isolation.
  - Multi-tenant role permissions.
- **14 new clinical & profile isolation regression tests** in [`server/tests/clinical_and_profile_isolation.test.ts`](file:///c:/Antigravity/VetRx/server/tests/clinical_and_profile_isolation.test.ts):
  - Doctor A and Doctor B register independent practices.
  - Doctor A creates Owner, Patient, Medicine, Package, Prescription, Invoice.
  - Doctor B queries all entities and receives `0` records or `404 Not Found`.
  - Doctor B attempts direct mutation/deletion of Doctor A records; rejected with `404 Not Found`.
  - Doctor A and Doctor B profiles and practice settings are completely segregated.

**Execution Result**:
```
PASS tests/clinical_and_profile_isolation.test.ts
PASS tests/auth.test.ts
PASS tests/tenant_isolation.test.ts
PASS tests/audit.test.ts

Test Suites: 4 passed, 4 total
Tests:       29 passed, 29 total
Snapshots:   0 total
Time:        4.108 s
Ran all test suites.
```

---

### B. Production End-to-End Automated Browser UAT (10 of 10 Passed)
Script [`scripts/test_two_account_isolation.mjs`](file:///c:/Antigravity/VetRx/scripts/test_two_account_isolation.mjs) executed against production (`https://vetrx.adcpmalappuram.in`) using Puppeteer:

1. **Phase 1: Account A Registration & Patient Creation**
   - Registered Doctor Alpha (`doc.alpha.<timestamp>@vetrx.test`) with practice "Alpha Veterinary Clinic".
   - Verified `/api/auth/me` identity.
   - Created patient "Patient Alpha" (Canine) under "Alpha Owner".
   - Verified patient appears in Doctor Alpha's directory.
2. **Phase 2: Account A Logout**
   - Logged out via session API and cleared local state.
   - Verified navigation to `/login`.
3. **Phase 3: Account B Registration & Cross-Account Inspection**
   - Registered Doctor Beta (`doc.beta.<timestamp>@vetrx.test`) with practice "Beta Veterinary Clinic".
   - Verified `/api/auth/me` returns Doctor Beta identity.
   - **Critical Check**: Verified Doctor Beta UI header/sidebar does NOT display Doctor Alpha or Alpha Clinic.
   - **Critical Check**: Navigated to `/patients` in Doctor Beta account; verified **zero records of Patient Alpha** (0% data bleed).
   - Created patient "Patient Beta" (Feline) under "Beta Owner"; verified visible in Doctor Beta directory.
4. **Phase 4: Account B Logout & Re-login as Account A**
   - Logged out Doctor Beta, logged in as Doctor Alpha.
   - **Critical Check**: Verified Doctor Alpha sees Patient Alpha.
   - **Critical Check**: Verified Doctor Alpha CANNOT see Patient Beta (0% data bleed).
5. **Phase 5: Diagnostics Audit**
   - Verified zero unhandled console errors and zero runtime exceptions.

**Execution Result**:
```
===============================================================
Starting Two-Account Isolation Test on: https://vetrx.adcpmalappuram.in
Account A: doc.alpha.1789521636655@vetrx.test (Doctor Alpha)
Account B: doc.beta.1789521636655@vetrx.test (Doctor Beta)
===============================================================

--- Phase 1: Register & Setup Account A ---
[✅ PASS] [Auth A] Account A Session & Identity Verification: User: Doctor Alpha, Practice: Alpha Veterinary Clinic
Registering Patient Alpha under Account A...
[✅ PASS] [Patient A] Patient Alpha Visible in Account A Directory: Found: true

--- Phase 2: Logout Account A ---
[✅ PASS] [Logout A] Account A Logged Out and Navigated to /login: URL: https://vetrx.adcpmalappuram.in/login

--- Phase 3: Register & Verify Account B (Isolation Check) ---
[✅ PASS] [Auth B] Account B Identity strictly isolated from Account A: User: Doctor Beta, Practice: Beta Veterinary Clinic
[✅ PASS] [UI Isolation B] Account B UI does NOT display Account A Profile or Practice: Contains Doctor Alpha: false
[✅ PASS] [Data Isolation B] Account B cannot view Account A Patient Alpha (Zero Data Bleed): Patient Alpha leaked into Account B: false
Registering Patient Beta under Account B...
[✅ PASS] [Patient B] Patient Beta Visible in Account B Directory: Found: true

--- Phase 4: Logout Account B & Re-login Account A ---
[✅ PASS] [Data Isolation A] Account A sees Patient Alpha: Found Patient Alpha: true
[✅ PASS] [Data Isolation A] Account A cannot see Patient Beta: Patient Beta leaked into Account A: false

--- Phase 5: Storage & Runtime Diagnostics ---
[✅ PASS] [Diagnostics] Zero Unhandled Console & Page Runtime Exceptions: Console Errors: 0, Page Errors: 0

===============================================================
TEST SUMMARY: 10/10 Checks Passed
===============================================================
```

---

## 4. Production Deployment Status

- **Branch**: `feature/stage-3-clinical-api-persistence`
- **Host**: VPS `109.122.56.148`
- **Docker Compose Status**:
  - `vetrx-backend-prod`: Up (healthy), port 3000
  - `vetrx-frontend-prod`: Up (healthy), port 80
  - `vetrx-postgres-prod`: Up (healthy), port 5432 (database volume intact and untouched)
- **Health Endpoints**:
  - `GET https://vetrx.adcpmalappuram.in/` -> `200 OK`
  - `GET https://vetrx.adcpmalappuram.in/api/health` -> `200 OK` (`{"status":"ok"}`)
  - `GET https://vetrx.adcpmalappuram.in/api/ready` -> `200 OK` (`{"status":"ready"}`)

---

## 5. Security & Isolation Guarantee Summary

| Concern | Before Fix | After Fix |
| :--- | :--- | :--- |
| **Practitioner Profile in UI** | Leaked across accounts via shared IndexedDB | Strictly isolated: Zustand store reset and practice-namespaced Dexie DB |
| **Practice Settings** | Shared local cached record across logins | Server-authoritative sync + scoped database tables per tenant |
| **Clinical Records (Patients, Rx, etc.)** | Account B saw Account A records on same browser | Complete isolation: `VetRxDB_<practiceId>` + server-side filtering |
| **API Boundary Verification** | Missing clinical endpoints | Scoped queries: `where: { practiceId: req.practice.id }` returning 404 on foreign IDs |
| **Session Teardown on Logout** | In-memory and local DB state remained | Full teardown: Dexie switched to guest, store cleared, component tree unmounted |
