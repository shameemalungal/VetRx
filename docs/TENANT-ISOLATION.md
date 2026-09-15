# VetRx Multi-Doctor Tenant Isolation Architecture & Validation

## Executive Summary

VetRx implements a strict, multi-tenant architectural boundary centered on the **`Practice`** entity. Every practitioner account belongs to an isolated practice context. All clinical data models in PostgreSQL (`Owner`, `Patient`, `Medicine`, `TreatmentPackage`, `Prescription`, `Invoice`, `Receipt`, `AuditLog`) maintain mandatory `practiceId` foreign keys.

This document outlines the tenant boundary implementation, server-side derivation guarantees, and test verification proving that no practitioner can view, modify, search, or delete another practitioner's clinical records.

---

## 1. Core Isolation Principles

### Principle 1: Zero Trust of Client-Supplied Tenant Identifiers
The client application never dictates practice or doctor identity.
- Any client-sent header such as `X-Practice-Id` or body property `practiceId` is **completely ignored** by the server.
- Practice context is derived strictly by the `requirePractice` middleware via the verified session token (`vetrx_session` cookie):
  ```typescript
  // server/src/middleware/tenant.ts
  const membership = await prisma.practiceMember.findFirst({
    where: {
      userId: req.user.id,
      isActive: true,
    },
    include: { practice: true },
    orderBy: { createdAt: 'asc' },
  });
  req.practice = safePractice;
  req.membership = safeMembership;
  ```

### Principle 2: Mandatory `practiceId` Foreign Keys in Schema
All clinical and financial models in `prisma/schema.prisma` are strictly scoped to `Practice`:
* `Owner` (`practiceId`)
* `Patient` (`practiceId`, `ownerId`)
* `Medicine` (`practiceId`)
* `TreatmentPackage` (`practiceId`)
* `Prescription` (`practiceId`, `patientId`)
* `Invoice` (`practiceId`, `patientId`)
* `Receipt` (`practiceId`, `invoiceId`)
* `AuditLog` (`practiceId`, `userId`)

### Principle 3: Universal Server-Side Filtering
All database read, search, update, and delete queries inject `where: { practiceId: req.practice.id }`.
- If Doctor B queries a prescription or invoice ID belonging to Doctor A, the query returns `404 Not Found`, preventing ID enumeration and cross-tenant leakage.

---

## 2. Multi-Doctor Boundary Matrix

| Scenario | Doctor A (Practice A) | Doctor B (Practice B) | Enforcement Mechanism |
| :--- | :--- | :--- | :--- |
| **Practice Settings** | Can read & update Practice A settings | Rejected with `403 FORBIDDEN` if attempting to mutate Practice A | `PracticeService.updatePractice` owner check |
| **Patient Read / Search** | Returns only Practice A patients | Returns only Practice B patients; 0 cross-tenant records | Scoped `where: { practiceId }` filter |
| **Prescription Access** | Accesses Practice A prescriptions | Direct lookup of Practice A Rx ID returns `404 Not Found` | Scoped `where: { id, practiceId }` lookup |
| **Invoice Access** | Accesses Practice A invoices | Direct lookup of Practice A Invoice ID returns `404 Not Found` | Scoped `where: { id, practiceId }` lookup |
| **Dashboard Statistics** | Counters reflect Practice A only | Counters reflect Practice B only | Scoped aggregate queries |
| **Record Deletion** | Can delete own eligible records | Attempting deletion of Practice A record returns `404 Not Found` | Scoped mutation filter |

---

## 3. Automated Test Verification

The test suite [server/tests/multi_doctor_tenant_isolation.test.ts](file:///C:/Antigravity/VetRx/server/tests/multi_doctor_tenant_isolation.test.ts) validates these guarantees with two synthetic doctors:
- **Doctor A**: `Dr. Anita Sharma` (`Sharma Pet Care Clinic`, `practice-a-uuid-111`)
- **Doctor B**: `Dr. Brijesh Nair` (`Nair Equine & Small Animal Hospital`, `practice-b-uuid-222`)

### Test Results
```text
▶ Multi-Doctor Tenant Isolation — Rigorous Boundary Verification
  ✔ strictly ignores frontend-supplied practice/doctor IDs in headers or body
  ✔ prevents Doctor B from updating Doctor A practice details (403 FORBIDDEN)
  ✔ allows Doctor A to update Doctor A practice details
  ✔ verifies Doctor A reads Doctor A records, and Doctor B cannot read them
  ✔ verifies Doctor B cannot access Doctor A prescriptions or invoices
  ✔ ensures search results are strictly tenant-scoped
  ✔ ensures dashboard totals and counters remain strictly tenant-scoped
  ✔ verifies Doctor B cannot delete Doctor A records
✔ Multi-Doctor Tenant Isolation — Rigorous Boundary Verification (7.2114ms)
```

Total passing tests across the backend test suite: **15 tests passing, 0 failing**.
