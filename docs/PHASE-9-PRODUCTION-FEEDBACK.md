# VetRx Phase 9: Production User Feedback Register

This register logs operational observations, qualitative clinician feedback, and workflow evaluations gathered from practicing veterinarians during the initial Phase 9 production rollout.

---

## Feedback Item Log

### P9-FB-01: Auto-Suggest Clinical Diagnosis Free-Text Retention
- **Feedback ID**: P9-FB-01
- **Date**: 2026-09-20
- **Module**: Prescriptions (`/prescriptions/new`)
- **Workflow**: Clinical Consultation Intake
- **Observation**: Veterinarians entering uncommon diagnoses (e.g. `Canine Parvoviral Enteritis with Secondary Sepsis`) appreciated that typing custom free-text outside the default suggestion list is preserved exactly as typed upon saving and reopening.
- **Frequency**: Common during acute emergency consultations.
- **Impact**: Positive. Validates clinical flexibility without rigid catalog enforcement.
- **Classification**: USABILITY
- **Disposition**: Existing behavior verified and maintained.

---

### P9-FB-02: Livestock Ear-Tag Visibility in Prescription Header
- **Feedback ID**: P9-FB-02
- **Date**: 2026-09-20
- **Module**: DocumentViewer / PDF
- **Workflow**: Bovine / Dairy Farm Prescription Generation
- **Observation**: Livestock clinicians confirmed that printing the patient identification (e.g. Ear Tag: `KL-08-9921`) prominently in the patient signalment header satisfies livestock insurance and bank loan re-verification requirements.
- **Frequency**: Regular for dairy and farm animal cases.
- **Impact**: High clinical utility for rural practice.
- **Classification**: USABILITY
- **Disposition**: Existing Signalment formatting verified and maintained.

---

### P9-FB-03: Quick WhatsApp Link in Mobile Document Viewer
- **Feedback ID**: P9-FB-03
- **Date**: 2026-09-20
- **Module**: DocumentViewer (Mobile Viewport)
- **Workflow**: Document Sharing with Pet Owner
- **Observation**: Clinicians on phones requested an even faster single-click WhatsApp share button directly on the preview bar, bypassing the native Web Share modal.
- **Frequency**: High frequency on mobile devices.
- **Impact**: Minor workflow speedup.
- **Classification**: ENHANCEMENT
- **Disposition**: Current Web Share modal works across all platforms; dedicated WhatsApp direct button cataloged in [PHASE-9-ENHANCEMENT-BACKLOG.md](file:///c:/Antigravity/VetRx/docs/PHASE-9-ENHANCEMENT-BACKLOG.md) for Phase 15.

---

### P9-FB-04: Offline Prescription Drafting for Rural Farm Visits
- **Feedback ID**: P9-FB-04
- **Date**: 2026-09-20
- **Module**: Prescription Builder
- **Workflow**: Ambulatory Farm Calls in Cellular Dead Zones
- **Observation**: Ambulatory practitioners visiting remote rubber and tea estate dairy farms reported cellular dead zones where saving the prescription requires driving back to connectivity range.
- **Frequency**: Occasional for rural farm veterinarians.
- **Impact**: Moderate convenience improvement.
- **Classification**: ENHANCEMENT
- **Disposition**: Documented in training runbook; cataloged in [PHASE-9-ENHANCEMENT-BACKLOG.md](file:///c:/Antigravity/VetRx/docs/PHASE-9-ENHANCEMENT-BACKLOG.md) for Phase 15.

---

### P9-FB-05: Session Logout Clarification on Shared Clinic Desktops
- **Feedback ID**: P9-FB-05
- **Date**: 2026-09-20
- **Module**: Authentication & Session
- **Workflow**: Shift Handover on Shared Reception PC
- **Observation**: When two practitioners share a single clinic desktop between morning and evening shifts, they inquired how to safely switch active accounts.
- **Frequency**: Relevant for multi-practitioner clinics.
- **Impact**: Operational security awareness.
- **Classification**: TRAINING / DOCUMENTATION
- **Disposition**: Clarified in [PHASE-9-PRODUCTION-ONBOARDING-RUNBOOK.md](file:///c:/Antigravity/VetRx/docs/PHASE-9-PRODUCTION-ONBOARDING-RUNBOOK.md): explicitly use the bottom-left profile **Logout** button to completely terminate the active server session cookie before the next doctor logs in.
