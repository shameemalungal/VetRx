# VetRx Phase 9: Operational Support Runbook

This document defines the production support procedures, triage workflows, incident classification, and resolution processes for veterinary practices operating on the VetRx platform.

---

## 1. Support Communication Channels

Veterinary clinicians and practice staff report operational difficulties, questions, or unexpected behavior via:
1. **Email Helpdesk**: `support@vetrx.in`
2. **In-App Issue Reporter**: Accessible from Settings $\rightarrow$ Help & Support
3. **Urgent Clinical Hotline**: Dedicated phone/WhatsApp support for P0/P1 emergency blockers during clinical hours (08:00–20:00 IST).

---

## 2. Intake Information Requirements

When logging a support request, support engineers must collect:
- **Practitioner Name**: Full name of the clinician.
- **Practice Name / ID**: Clinic name and registered practice context.
- **Module Affected**: *Prescriptions, Patients, Owners, Invoices, Receipts, Settings, Login, PDF/Print*.
- **Timestamp of Incident**: Exact date and time (IST) when the behavior occurred.
- **Client Environment**: Device (PC, Mac, iPhone, Android phone, Tablet) and browser (Chrome, Safari, Edge, Firefox).
- **Action Performed**: What the practitioner was attempting to do immediately prior to the issue.
- **Expected Result**: What should have happened according to normal clinical workflow.
- **Actual Result**: What actually happened (e.g. error banner, infinite spinner, blank screen).
- **Reproduction Steps**: Sequential actions to reproduce the issue.
- **Visual Evidence**: Screenshots or video recording of the screen (omitting sensitive client PII).

### STRICT PRIVACY & SECURITY RULES
Support engineers must **NEVER** request or collect:
- User passwords.
- Session cookies (`vetrx_session`).
- Server environment variables or secrets.
- Private encryption keys.

---

## 3. Severity Classification & Service Level Objectives (SLO)

| Severity Level | Definition & Clinical Impact | Target Initial Response | Target Resolution |
| :--- | :--- | :---: | :---: |
| **P0 — Critical Blocker** | Service down, data corruption, cross-tenant data exposure, complete inability to prescribe or login. | **< 15 minutes** | **< 2 hours** |
| **P1 — Major Clinical Failure** | Prescription cannot be saved, invoice total incorrect, Section 22 directions leak, PDF generation fails for all patients. | **< 30 minutes** | **< 4 hours** |
| **P2 — Major Workflow Issue** | Workaround exists (e.g. specific drug calculation warning, non-critical table formatting on mobile, slow search). | **< 2 hours** | **< 24 hours** |
| **P3 — Minor Defect / Cosmetic** | Typo in UI label, minor spacing imperfection, non-blocking cosmetic alignment. | **< 8 hours** | **Next release cycle** |
| **Enhancement** | New feature request, protocol suggestion, or workflow optimization. | **< 24 hours** | **Cataloged for Phase 15** |

---

## 4. Triage & Escalation Workflow

```
1. Support Intake ──▶ 2. Identity & Tenant Verification ──▶ 3. Severity Triage
                                                                      │
[Closed & Documented] ◀── [5. Verification & Deploy] ◀── [4. Engineering Fix (P0/P1)]
```

### Stage 1: Intake & Triage
1. Triage engineer logs the issue into `docs/PHASE-9-DEFECT-REGISTER.md` or the issue tracker.
2. Checks server logs using `docker logs vetrx-backend-prod --since 30m` or filters by `requestId`.
3. If classified as **P0** or **P1**, immediately activate the [Incident Response Runbook](file:///c:/Antigravity/VetRx/docs/PHASE-9-INCIDENT-RESPONSE-RUNBOOK.md).

### Stage 2: Investigation & Root Cause Analysis
1. Reproduce the issue on a local staging environment using anonymized test data.
2. Verify if the issue stems from:
   - Local device / connectivity dead-zone (e.g., rural farm visits).
   - Browser cache or stale session cookie.
   - Genuine application logic or API validation error.
   - NGINX rate limit or proxy timeout.

### Stage 3: Resolution Protocol
1. **Configuration / Session Issue**: Guide the practitioner to refresh, clear site data, or re-authenticate.
2. **Code Defect Fix**: Follow the strict hotfix protocol:
   - Develop minimal targeted correction.
   - Run full regression suites: `npm --prefix web test`, `npm test`, `npm --prefix web run build`, `phase6_comprehensive_integration_uat.ts`.
   - Deploy hotfix cleanly to production VPS.
   - Verify fix directly against `https://vetrx.adcpmalappuram.in`.

### Stage 4: Ticket Closure & Practitioner Communication
1. Notify the practitioner with clear, non-technical instructions confirming the resolution.
2. Request practitioner verification on their device.
3. Update defect entry in `PHASE-9-DEFECT-REGISTER.md` with status `CLOSED`, root cause, and verification timestamp.
