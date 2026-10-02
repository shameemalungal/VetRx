# Phase 8 Enhancement Backlog

This backlog catalogs feature requests, workflow enhancements, and non-critical optimizations identified during the Phase 8 Controlled Pilot. In accordance with the Phase 8 Absolute Rules (Section 2), all non-blocker enhancement requests are deferred to **Phase 10 — Post-Launch Enhancement** to preserve release candidate stability and the frozen baseline.

---

## Enhancement Matrix

| ID | Description | Pilot Source | Priority | Suggested Phase |
| :--- | :--- | :--- | :---: | :---: |
| **ENH-01** | Offline draft autosave & sync for rural ambulatory farm visits | FB-02 | Medium | Phase 10 |
| **ENH-02** | Direct one-tap WhatsApp Cloud API dispatch for Invoices & Rx | FB-03 | Low | Phase 10 |
| **ENH-03** | Dedicated ear-tag search filter tab in patient selector | FB-04 | Low | Phase 10 |
| **ENH-04** | Dynamic UPI QR code rendering in invoice footer notes | FB-06 | Medium | Phase 10 |
| **ENH-05** | Barcode / QR scanner for medicine packaging and batch tracking | Pilot Account B | Low | Phase 10 |
| **ENH-06** | LIMS PDF / CSV import for blood biochemistry and CBC analyzers | Pilot Account B | Low | Phase 10 |

---

## Detailed Enhancement Specifications

### ENH-01: Offline Draft Autosave & Sync
- **ID**: ENH-01
- **Description**: Provide IndexedDB-backed offline drafting for prescriptions and consultations during rural farm visits without active cellular connectivity, with automatic background sync when reconnected.
- **Reason Deferred**: VetRx baseline architecture requires active server-side tenant isolation and real-time database persistence. Introducing client-side offline conflict resolution would violate the frozen Phase 1/2 baseline and introduce unnecessary release risk.
- **Pilot Feedback**: FB-02 (Ambulatory veterinarians attending dairy farm calls in cellular dead zones).
- **Impact**: Quality-of-life improvement for rural livestock practices.
- **Suggested Future Phase**: Phase 10 — Post-Launch Enhancement
- **Priority**: Medium

---

### ENH-02: Direct WhatsApp Cloud API Integration
- **ID**: ENH-02
- **Description**: Enable server-side WhatsApp Business API integration to dispatch prescriptions and PDF links directly from the server to client mobile numbers with delivery receipts.
- **Reason Deferred**: Current system implements the native browser Web Share API and standard `https://wa.me` links, which require zero external API secrets, zero messaging costs, and 100% practitioner control. Adding external messaging gateways is an out-of-scope third-party integration.
- **Pilot Feedback**: FB-03 (Desire for single-click WhatsApp dispatch from the desktop invoice view).
- **Impact**: Modest time savings over current Web Share modal.
- **Suggested Future Phase**: Phase 10 — Post-Launch Enhancement
- **Priority**: Low

---

### ENH-03: Dedicated Ear-Tag Search Filter Tab
- **ID**: ENH-03
- **Description**: Add an explicit "Ear Tag" filter toggle in the patient lookup dialog for large animal practices.
- **Reason Deferred**: The current global patient search bar already indexes patient signalment and notes, correctly matching ear tags (e.g., `KL-08-9921`). No functional gap exists.
- **Pilot Feedback**: FB-04 (Bovine practitioner request for specialized tab).
- **Impact**: Minor UI convenience for mixed/livestock practices.
- **Suggested Future Phase**: Phase 10 — Post-Launch Enhancement
- **Priority**: Low

---

### ENH-04: Dynamic UPI QR Code in Invoice Footer
- **ID**: ENH-04
- **Description**: Allow practices to configure their Virtual Payment Address (VPA) / UPI ID in Practice Settings and dynamically render a Bharat QR code in the invoice footer alongside banking details.
- **Reason Deferred**: Invoices already render custom practice notes, bank transfer details, and payment instructions. Adding client-side QR generation libraries touches frozen document rendering templates.
- **Pilot Feedback**: FB-06 (Request for fast mobile client settlement).
- **Impact**: Faster payment collection for over-the-counter clinic billing.
- **Suggested Future Phase**: Phase 10 — Post-Launch Enhancement
- **Priority**: Medium

---

### ENH-05: Barcode / QR Scanner for Medicine Packaging
- **ID**: ENH-05
- **Description**: Utilize device camera in mobile view to scan medicine strip DataMatrix / EAN-13 barcodes to automatically look up drugs in the formulary.
- **Reason Deferred**: Formulary autocomplete with typeahead search already completes medicine selection in < 3 keystrokes. Camera barcode scanning requires additional hardware permissions and cross-device testing.
- **Pilot Feedback**: General pilot observation during high-volume inventory intake.
- **Impact**: Inventory management convenience.
- **Suggested Future Phase**: Phase 10 — Post-Launch Enhancement
- **Priority**: Low

---

### ENH-06: LIMS Diagnostic Report Parser
- **ID**: ENH-06
- **Description**: Automatically parse diagnostic reports (PDF/CSV) from in-clinic hematology and biochemistry analyzers and attach values to patient consultation history.
- **Reason Deferred**: Substantial new feature requiring multi-vendor file format parsers, far beyond Release Candidate scope.
- **Pilot Feedback**: Pilot Account B observation.
- **Impact**: Advanced clinic workflow integration.
- **Suggested Future Phase**: Phase 10 — Post-Launch Enhancement
- **Priority**: Low
