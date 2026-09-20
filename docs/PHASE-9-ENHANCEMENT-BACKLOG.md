# VetRx Phase 9: Enhancement Backlog

This backlog catalogs feature requests, non-critical optimizations, and workflow suggestions identified during Phase 9 production monitoring. In accordance with the Phase 9 rules, all enhancement requests are deferred to **Phase 15 — Post-Launch Optimization & Growth** to preserve the frozen baseline and ensure operational stability.

---

## Enhancement Matrix

| ID | Description | Source | Priority | Destination Phase |
| :--- | :--- | :--- | :---: | :---: |
| **ENH-P9-01** | Direct one-tap WhatsApp link on mobile DocumentViewer preview bar | P9-FB-03 | Low | Phase 15 |
| **ENH-P9-02** | IndexedDB offline draft queuing with background sync for rural farm calls | P9-FB-04 | Medium | Phase 15 |
| **ENH-P9-03** | Auto-focus search input on modal open in Patient Selector dialog | Pilot Feedback | Low | Phase 15 |
| **ENH-P9-04** | Bluetooth thermal receipt printer ESC/POS direct raw streaming | Hardware Pilot | Low | Phase 15 |
| **ENH-P9-05** | Bulk CSV export for statutory practice audit reporting | Practitioner Request | Low | Phase 15 |

---

## Detailed Specifications

### ENH-P9-01: Direct WhatsApp Button on DocumentViewer
- **Description**: Add a dedicated green "Send via WhatsApp" button on the mobile header bar that directly opens `https://wa.me/?text=...` with the owner's phone number prefilled, skipping the native Web Share modal.
- **Reason Deferred**: The current Web Share modal provides complete, multi-platform sharing (WhatsApp, SMS, Email, AirDrop) with zero errors.
- **Target Phase**: Phase 15 — Post-Launch Optimization & Growth

### ENH-P9-02: Offline Draft Queuing for Rural Farm Visits
- **Description**: Enable client-side draft caching in IndexedDB when offline, with an automatic background sync queue that pushes saved prescriptions to PostgreSQL once network connectivity is restored.
- **Reason Deferred**: Requires complex client-side conflict resolution, offline validation rules, and schema migrations that risk destabilizing the production baseline.
- **Target Phase**: Phase 15 — Post-Launch Optimization & Growth

### ENH-P9-03: Modal Dialog Auto-Focus
- **Description**: Automatically focus the search text field when the patient or medicine picker modal opens, saving a tap on touch devices.
- **Reason Deferred**: Non-critical usability refinement.
- **Target Phase**: Phase 15 — Post-Launch Optimization & Growth

### ENH-P9-04: Bluetooth ESC/POS Direct Thermal Printing
- **Description**: Direct raw socket connection to 58mm/80mm Bluetooth portable thermal receipt printers for ambulatory practitioners.
- **Reason Deferred**: Current system uses the browser's standard `window.print()` with verified compact stationery styles that print cleanly to all standard mobile and desktop printers.
- **Target Phase**: Phase 15 — Post-Launch Optimization & Growth

### ENH-P9-05: Bulk Audit CSV Export
- **Description**: Download all practice consultations and invoices as a consolidated Excel/CSV file for end-of-year tax accounting.
- **Reason Deferred**: Existing database backups and in-app invoice lists cover record preservation.
- **Target Phase**: Phase 15 — Post-Launch Optimization & Growth
