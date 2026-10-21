# VetRx Shared Database and Cross-Platform Consistency Requirements

## Non-negotiable requirement

VetRx Web and VetRx Android are two clients of the same product. They must not operate separate production datasets. A successful mutation from either client must be persisted to the authoritative shared backend database and then be visible to the other client after refresh/revalidation or through a live update mechanism.

## Architecture

- **Authoritative production store:** the existing PostgreSQL database managed through the current Prisma/server backend.
- **Shared application services:** existing authenticated API endpoints, domain services, validation, invoice/prescription calculations, permission checks, audit trail, and subscription entitlements.
- **Web client and Android client:** same React/Vite application and same API contracts wherever possible. Capacitor is a packaging/native integration layer, not a second product implementation.
- **IndexedDB/Dexie:** existing browser-side/local working store only where the current architecture needs it. It must not silently become an independent authoritative production database on Android or imply cross-device synchronization where no server sync exists.
- **No Android-only database, no second schema, no separate business rules, and no independent identifiers for the same logical records.**

## Required mutation and read behavior

1. Every production write must go through the current authenticated API/domain service for any entity intended to be shared across devices.
2. The backend validates identity, active practice/tenant, role/permissions, entitlement, and domain invariants, then commits the change to PostgreSQL.
3. The client shows a clear saved/sync state and re-fetches or updates its normalized local cache only after server acknowledgement.
4. Web and Android reads must resolve the same practice-scoped server records. Switching practice must never expose another practice's cached records.
5. Updates made in web must appear in Android on refresh/re-entry, and updates made in Android must appear in web under the same conditions. For a stronger real-time experience, use existing server push capabilities if present; otherwise use explicit invalidation/refetch or controlled polling. Do not promise instant updates unless implemented and tested.
6. Handle concurrent edits explicitly: use server timestamps/version checks or equivalent conflict detection for mutable records; do not silently overwrite a newer server version with stale local data.
7. Prevent duplicate writes when a client retries after a timeout. Use existing idempotency keys where available and introduce them for high-risk operations such as invoice creation, prescription finalization, and visit/medicine usage where required.
8. Failed or unconfirmed writes must remain visibly unsaved/failed and retry safely. Do not display “saved” until the server confirms persistence.
9. Local-only demo/guest mode must be clearly separated from production authenticated practice data. It must never merge demo data into a real practice.
10. Data deletion, tenant switching, logout, and account changes must clear or isolate local caches correctly.

## Required entity audit

For every current VetRx entity/module, record:
- authoritative backend table/model and API endpoint;
- client storage/cache location;
- create/read/update/delete coverage;
- tenant/permission enforcement;
- cache invalidation or live-update behavior;
- conflict and retry behavior;
- cross-platform test proving the same record appears on both clients.

Include at minimum: owners, patients, medicines/catalogue, prescriptions and items, treatment packages and items, invoices and items, calls, visits, visit cases/procedures/medicine usage/timeline, owner locations, daily plans, follow-ups, recurring schedules, practice settings, inventory, account/membership, and subscriptions/entitlements.

If an entity currently exists only in Dexie and has no shared backend endpoint/model, document it as a gap and add the smallest appropriate extension to the existing backend/schema/API. Do not solve that gap by adding a second Android-only store.

## Cross-platform acceptance tests

- Create an owner and patient in web; confirm both appear in Android under the same practice.
- Create/update an owner and patient in Android; confirm the same records appear in web.
- Create a prescription in either client; verify the other client sees the same prescription and items with unchanged calculations.
- Create a treatment package in either client; apply it from the other client and verify medicines/instructions.
- Create an invoice in either client; verify the same invoice number, line items, totals, status, and generated document data on the other client.
- Create/update a call, visit, follow-up, location, or daily plan in either client and verify cross-client visibility.
- Change practice settings and membership/entitlement state in the backend and verify both clients enforce the current state.
- Simulate a network failure, retry, app restart, expired session, practice switch, and concurrent edit. Confirm no duplicate records, data leakage, or falsely reported save success.
- Verify the web app continues to work and no existing browser workflow regresses.

## Current evidence and caveat

The inspected repository contains a PostgreSQL Prisma schema and authenticated backend, as well as a Dexie/IndexedDB schema with owners, patients, prescriptions, packages, invoices, calls, visits, and follow-up-related tables. The existence of both storage layers means the current synchronization path must be audited entity by entity. It is not safe to assume every Dexie table is already synchronized with PostgreSQL.

The initial Capacitor changes are only foundation work. The shared-data audit and acceptance tests are required before the Android app can be considered complete or ready for release.
