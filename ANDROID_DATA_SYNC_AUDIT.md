# VetRx Android Data Consistency Audit

Date: 2026-10-22
Branch: `feature/android-app-foundation-ui`

## Release requirement

The web app and Android app must use one authoritative PostgreSQL database through the existing API. Dexie/IndexedDB may be a cache or an explicitly queued offline workspace, but a local-only write must never be reported as a globally saved record. Cross-platform parity is a release gate.

## Findings verified from source

### 1. Local Dexie database is tenant-partitioned per browser/device

`web/src/db/schema.ts` creates `VetRxDB_<practiceId>` (or `VetRxDB_guest`) in IndexedDB. This is separate storage on each browser/device and does not itself provide cross-device replication.

### 2. Call & Visit service uses local-first writes and best-effort backend sync

`web/src/services/cvpService.ts` describes itself as offline-first and persists calls/visits in Dexie before attempting API requests. Several failure handlers log that backend sync failed and continue with the local record. Examples found during audit include call creation, owner/patient quick creation, daily-plan mutations, visit arrival/start/procedure/medicine usage/completion, and status changes.

This behavior is useful for offline capture but does not satisfy the strict shared-database guarantee without a durable sync queue, visible pending/error state, retry/idempotency, and server reconciliation.

### 3. Follow-up and recurrence service is local-only in its current service layer

`web/src/services/followUpService.ts` reads and mutates `db.followUps` and `db.recurringSchedules`; no API requests were found in that service file. The backend has CVP routes and database models, but this frontend service does not currently use them. Follow-ups and recurrence therefore cannot be assumed to be shared between devices.

### 4. Inventory already uses an API client

`web/src/services/inventoryApi.ts` calls the backend API. `inventorySync.ts` additionally copies inventory medicine information into Dexie formulary records. This is a projection/cache, not a reason to treat the Dexie formulary as authoritative.

### 5. Authentication is cookie-based

The frontend uses credentialed requests and the backend issues an HTTP-only session cookie. The Android build sets `VITE_API_URL=https://app.vetrx.brightbase.in`; a native-only fetch bridge routes relative `/api/*` requests to that host and includes credentials. The backend allows the packaged `https://localhost` origin and sets `SameSite=None; Secure` only for that native origin. A post-generation Android script enables third-party cookies in the WebView so the existing HTTP-only cookie session can be used. These changes are implemented but still require live Android login/session/logout tests before release.

## Implementation sequence

1. Keep Android packaging separate from the existing web build and build a debug APK in CI.
2. Introduce a shared API-base and native authentication strategy; verify login, session refresh, logout, practice switching, invitations, and password reset in Android.
3. Create an entity-by-entity API/cache matrix for owners, patients, medicines/formulary, prescriptions/items, treatment packages/items, invoices/items, calls, visits/cases/procedures/medicine usage/timeline, owner locations, daily plans, follow-ups, recurring schedules, settings, and inventory.
4. Migrate missing local-only entities to existing backend endpoints or add required endpoints to the current Express/Prisma backend. Do not create a second production database or duplicate business rules in Android.
5. Replace silent best-effort sync with server-confirmed writes online. If offline capture remains supported, use a durable outbox with stable idempotency keys, explicit pending/failed state, retries, conflict policy, and server reconciliation.
6. Add cross-platform integration tests: create/update/delete on web then read on Android, and vice versa; include practice/tenant isolation, duplicate retry, network failure, and stale cache cases.

## Current status

- Capacitor config is located in `web/`, beside the Vite app.
- Android-specific build mode, native back-button handling, API routing, cookie configuration, and an Android debug-build GitHub Actions workflow have been added.
- The workflow is a packaging/build check only. It does not establish feature parity or shared-database correctness.
- Do not release until Android authentication and all entity sync tests pass.
