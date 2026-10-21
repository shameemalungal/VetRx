# VetRx Android App: implementation plan

## Goal

Deliver a complete Android application from the existing VetRx React/Vite app. Reuse current routes, components, clinical and financial rules, API contracts, authentication, practice access, and subscription entitlements. Do not create a parallel implementation of existing business logic.

## Confirmed repository facts

- The repository is a monorepo with a React 19 + Vite frontend in `web/`, an Express/TypeScript API in `server/`, and Prisma/PostgreSQL under `prisma/`.
- The frontend already has an app shell with mobile header, bottom navigation, and a More sheet.
- Existing routes include dashboard, calls, call registration/case detail, visit detail, day planning, field mode, follow-ups, patients, prescriptions, packages, invoices, inventory, settings, authentication, and platform administration.
- The app uses IndexedDB/Dexie as part of its local data flow. Authentication and backend persistence are also present; this needs a focused audit before deciding which records should sync at each workflow boundary.
- Stitch source screens are checked into `stitch/`, including mobile dashboard, mobile prescription clinical details, package library/creation flows, invoice creation/history/preview, plus `stitch/vetrx_design_system/DESIGN.md`.
- The current visual language is teal/blue, Plus Jakarta Sans headings, Inter body, and JetBrains Mono for numerical clinical/financial data.

## Engineering principles

1. Keep existing web app logic as the source of truth. Android should use the same React frontend, shared services, existing validations, formulas, and API.
2. Add native Android capability at the integration boundary (phone dialer, navigation/maps, notifications, camera/files, share sheet, printing, keyboard/safe areas) without duplicating clinical rules.
3. Do not remove the browser/web build or alter production data/back-end architecture simply to make Android work.
4. Keep the web release stable. All Android work stays on `feature/android-app-foundation-ui` until reviewed.
5. The initial native build should require internet for normal clinical operations, matching the current online-first product direction. Existing local-first/IndexedDB behaviors still need to be preserved and tested, not silently replaced.
6. UI improvements should follow Stitch's component hierarchy, touch targets, safe-area handling, spacing, clinical-grade contrast, compact cards, typography hierarchy, and restrained shadows. Do not paste static Stitch HTML in place of working React components.

## Work stages

### A. Foundation and build validation
- Capacitor config added for app id `com.vetrx.app`, name VetRx, and Vite `dist` output.
- Capacitor dependencies/scripts added to `web/package.json`.
- Safe-area metadata and mobile shell refinements added without changing route or business logic.
- Next: install workspace dependencies; generate and inspect Android platform; confirm Gradle/JDK/Android SDK compatibility; verify production API base URL and OAuth return flow.

### B. Android feature parity audit
For each existing route, document its main action, services/data stores used, API dependencies, browser-only features, and Android equivalent. Cover all user-facing modules, settings/account/subscriptions, and authorized platform-administration routes. Track known gaps as test cases, not assumptions.

### C. Native integrations
- Phone: invoke system dialler with the current owner/client phone number and return to the open case to save disposition.
- Visit: use Android-compatible map deep links for navigation; request location only for a user-visible, consented location workflow.
- Reminders: local notifications only for reminders whose timing and permission semantics are defined.
- Documents and media: Android-compatible save/share/open/print flows using existing generated documents and existing data model.
- Keyboard, status bar, safe areas, navigation/back button, and app resume state.

### D. UI quality pass guided by Stitch
- Review mobile dashboard, prescription details, treatment package library, invoice create/history/preview and add/edit-item flows.
- Preserve the screens' visual cues while binding every action to existing components/services/data. Avoid mock values.
- Improve dense forms, action hierarchy, card rhythm, empty/loading/error states, contrast, scroll behavior, sticky action bars, and bottom navigation on phones.
- Desktop/tablet appearance must not regress.

### E. Validation and release
- Run frontend lint/build and existing unit/flow tests.
- Add Android smoke tests for login/session restore, dashboard, patient lookup, prescription save/preview, package application, invoice save/preview/share, call-to-visit transitions, file handling, back navigation, lifecycle/resume, and entitlement restrictions.
- Produce a debug APK for on-device validation first; then prepare the release AAB/signing only after tests pass.

## Current status

A working branch named `feature/android-app-foundation-ui` has been created. The initial Capacitor configuration/dependency setup and scoped mobile UI refinements are committed there. These are a foundation only, not a completed or tested APK. Do not merge to `main` until dependency installation, Android generation, builds, and device checks succeed.
