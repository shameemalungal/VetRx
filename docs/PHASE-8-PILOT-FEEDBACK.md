# Phase 8 Controlled Pilot Feedback

This document records the qualitative and operational feedback gathered during the VetRx Phase 8 Controlled Pilot across Pilot Account A (Fresh Practice), Pilot Account B (Established Mixed Practice), and Pilot Account C (Concurrent Multi-User Practice).

---

## Feedback Item Log

### FB-01: Real-time Owner Duplicate Warning
- **Feedback ID**: FB-01
- **Workflow**: Owner Management (Pilot Workflow 1)
- **Observation**: When registering a new owner, typing an existing 10-digit mobile number immediately surfaces matching existing records via client/server search, preventing accidental duplicate creation. Practitioners appreciated this protection.
- **Frequency**: Common during fast patient intake.
- **Impact**: Positive. Prevents fragmented patient records under duplicate owners.
- **Classification**: Workflow improvement / Usability
- **Disposition**: Existing behavior verified and retained in baseline. No code changes needed.

---

### FB-02: Offline Draft Autosave for Farm Visits
- **Feedback ID**: FB-02
- **Workflow**: Prescription Drafting (Pilot Workflow 3)
- **Observation**: Rural ambulatory veterinarians visiting dairy farms frequently experience sporadic 4G connectivity dead-zones and requested local browser draft persistence that queues saves until connection is restored.
- **Frequency**: Occasional (specific to ambulatory farm calls).
- **Impact**: Moderate convenience improvement for field veterinarians.
- **Classification**: Feature request
- **Disposition**: Deferred to **Phase 10 — Post-Launch Enhancement** (ENH-01). Online connectivity is documented as a baseline operational prerequisite for Phase 9.

---

### FB-03: Quick WhatsApp Dispatch from Document Screen
- **Feedback ID**: FB-03
- **Workflow**: Document Sharing (PDF / Print / Invoices)
- **Observation**: The existing Native Web Share / WhatsApp link flow requires opening the Share modal and clicking "Share on WhatsApp". Practitioners requested a direct one-tap WhatsApp button in the primary action bar on mobile.
- **Frequency**: Frequent on mobile devices.
- **Impact**: Minor workflow speedup.
- **Classification**: Enhancement
- **Disposition**: Existing Share Modal is fully responsive, provides WhatsApp Web/App pre-filled text with client phone number, and satisfies Phase 5/6 acceptance criteria. Deferred optimization to **Phase 10 — Post-Launch Enhancement** (ENH-02).

---

### FB-04: Ear Tag Identification Search in Global Patient Picker
- **Feedback ID**: FB-04
- **Workflow**: Patient Management (Pilot Workflow 2)
- **Observation**: Bovine/livestock patients often lack conventional pet names and are identified primarily by government ear tags (e.g., `KL-08-9921`). The current system displays this seamlessly in the Signalment string, but practitioners requested a dedicated "Search by Tag" filter tab.
- **Frequency**: Moderate for livestock practices.
- **Impact**: Minor. The global search bar already indexes patient signalment and notes.
- **Classification**: Workflow improvement
- **Disposition**: Current global patient search matches the ear tag in signalment notes. Dedicated tag filter deferred to **Phase 10 — Post-Launch Enhancement** (ENH-03).

---

### FB-05: Multi-Tab Session Isolation Behavior
- **Feedback ID**: FB-05
- **Workflow**: Multi-Tab / Multi-Practice Access (Pilot Workflow 13)
- **Observation**: If a veterinarian opens two browser tabs with different practice logins, actions in Tab A correctly reject stale tokens or update strictly according to the active authenticated cookie. Practitioners were informed that HTTP-only session cookies maintain server-side tenant isolation.
- **Frequency**: Low (rare for single practitioners; relevant for multi-clinic locums).
- **Impact**: High security guarantee.
- **Classification**: Training / documentation issue
- **Disposition**: Addressed in user guidance and release documentation: use distinct browser profiles (or incognito windows) when actively managing two practices simultaneously on one machine.

---

### FB-06: Custom Invoice Footer & Bank Account Payment Details
- **Feedback ID**: FB-06
- **Workflow**: Invoicing & Payment Receipts (Pilot Workflows 14 & 15)
- **Observation**: Practitioners requested the ability to print their clinic's UPI ID / QR code or bank account details in the invoice footer notes.
- **Frequency**: Moderate for direct bank transfer payments.
- **Impact**: Convenience for client billing.
- **Classification**: Enhancement
- **Disposition**: Practice settings already supports custom notes/terms on invoices. Dedicated UPI QR rendering in footer deferred to **Phase 10 — Post-Launch Enhancement** (ENH-04).
