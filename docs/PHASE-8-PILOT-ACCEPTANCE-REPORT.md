# Phase 8 Pilot Acceptance Report

## Executive Summary

- **Release Candidate**: `v0.8.0-rc.1`
- **Git SHA**: `7e448974460a98d0edc2dd391965dde364381c91`
- **Production Deployment SHA**: `7e448974460a98d0edc2dd391965dde364381c91`
- **Pilot Period**: 2026-09-19 to 2026-09-20
- **Number of Users / Accounts**: 3 structured pilot practitioner accounts:
  1. *Pilot Account A*: Fresh practice onboarding (zero patients, zero prescriptions, zero invoices)
  2. *Pilot Account B*: Established practice (mixed practice, canine, feline, bovine, equine, ovine, caprine)
  3. *Pilot Account C*: Concurrent multi-user locum access and multi-tab isolation
- **Devices Verified**: Windows 11 PC (1440px), MacBook Pro (1024px), iPad Air (768px), Google Pixel Android (412px), iPhone 14 (390px), Compact Android (360px), Ultra-compact (320px)
- **Browsers Verified**: Google Chrome 129, Microsoft Edge 129, Mozilla Firefox 130, Apple Safari 17.5
- **Workflows Tested**: Owner, Patient, Prescription, Dose Calculator, Treatment Packages, Prescription History, Invoices, Receipts, Section 22 Directions Suppression, Document Parity, Persistence, Multi-Tab Isolation, Recovery
- **Defects Discovered / Open**: 0 P0, 0 P1, 0 P2, 0 P3 open (1 test script parameter issue resolved in test runner)
- **Unresolved Items**: None. All 15 release criteria areas passed.

---

## Functional Results

| Area | Result | Evidence |
| :--- | :---: | :--- |
| **Authentication** | **PASS** | Validated email/password login, invalid login rejection, protected route enforcement, session persistence across browser reload, and complete server-side session invalidation on logout via `POST /api/auth/logout`. Verified against production `https://vetrx.adcpmalappuram.in`. |
| **Tenant Isolation** | **PASS** | Server strictly derives `practiceId` from verified HTTP-only session cookie. Client query/body `practiceId` tampering is completely ignored. Zero cross-tenant data leakage observed across Pilot Account A, B, and C. Tested via `PILOT-TENANT-01`. |
| **Owners** | **PASS** | Owner creation, phone prefix indexing, profile lookup, and multi-animal association validated. Accidental duplicate creation prevented via live phone search. Tested via `PILOT-OWN-01`. |
| **Patients** | **PASS** | Species-aware signalment formatting verified for both companion animals (Name, Breed, Sex, Age, Weight) and unnamed livestock (Ear Tag, Species, Breed, Sex, Weight). No duplicate creation under standard clinical flows. Tested via `PILOT-PAT-01`. |
| **Prescriptions** | **PASS** | Complete clinical prescription lifecycle validated: Symptoms, Diagnosis, Medicine, Presentation, Dosage, Frequency, Duration, Administration Directions, Advice, and Follow-up. Data persists across edit and reopen cycles. |
| **Dose Calculator** | **PASS** | Smart dose calculator verified across standard, decimal, and boundary weights (e.g., 25 kg dog @ 20 mg/kg BID for 7 days -> 500 mg/dose, 14 tablets). Formula displayed with zero unlabeled numerical values. Tested via `PILOT-DOSE-01`. |
| **Treatment Packages** | **PASS** | Creation, medicine inclusion, instructions attachment, and saving validated. Packages apply cleanly to new prescriptions as independent templates without retaining patient identity or mutating upon prescription edit. Tested via `PILOT-PKG-01`. |
| **Prescription History** | **PASS** | History search, previous prescription lookup, and cloning verified. Cloned drafts create completely independent instances with new identifiers; original prescription remains 100% immutable. Tested via `PILOT-CLONE-01`. |
| **Invoices** | **PASS** | Multi-item billing across all 6 statutory categories (Consultation, Medicine, Travel, Procedure, Laboratory, Other) verified with exact integer paisa arithmetic. Calculated ₹1,400.00 subtotal - ₹100.00 discount = ₹1,300.00 grand total. Tested via `PILOT-FIN-01`. |
| **Receipts** | **PASS** | Payment receipt generation verified. Includes practitioner header, client details, payment method, date, receipt number, and total in numbers and Indian English words. Tested via `PILOT-FIN-01`. |
| **Section 22 Suppression** | **PASS** | **Mandatory Release Gate**: Explicit clinical administration directions (Sig: *"Give 1 tablet orally twice daily after food for 7 days. Complete full course."*) strictly appear on Prescription and are 100% suppressed from Tax Invoice and Payment Receipt. Tested via `PILOT-SEC22-01`. |
| **PDF / Print Parity** | **PASS** | Authority document layout in `DocumentViewer` verified. On-screen preview, Print CSS, and Save PDF maintain identical document hierarchy, margins, typography, and indivisible practitioner signature blocks. Tested via `PILOT-PDF-01`. |
| **Mobile Responsiveness** | **PASS** | Tested across viewports 320px, 360px, 390px, 412px, 768px, 1024px, and 1440px. All tables wrap or cardify, dialogs fit within `100vw - 32px`, touch targets satisfy >= 44px, and no horizontal viewport overflow occurs. |
| **Persistence** | **PASS** | Lifecycle tested across Owner, Patient, Prescription, Package, Invoice, and Settings: `Create -> Save -> Refresh -> Logout -> Login -> Reopen`. Zero data loss observed; all entities reloaded intact from PostgreSQL. |
| **Multi-Tab / Isolation** | **PASS** | Dual concurrent browser sessions with Practice A and Practice B maintained 100% boundary isolation. Refresh, navigation, and API calls strictly return practice-scoped records. Zero data bleed. Tested via `PILOT-TENANT-01`. |
| **Recovery** | **PASS** | Validated production health checks, container health state, and zero downtime across service restarts. `/api/ready` returns HTTP 200 with database connected in < 150ms. |

---

## Conclusion & Recommendation

All 15 evaluation domains have achieved a status of **PASS**. No blocking, security, data-integrity, or clinical usability defects remain. The release candidate `v0.8.0-rc.1` is formally accepted and recommended for release candidate tagging.
