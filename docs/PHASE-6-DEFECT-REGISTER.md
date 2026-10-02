# VetRx — Phase 6 Defect Register

This register documents all defects identified, tracked, and verified during the Phase 6 Full Integration & End-to-End User Acceptance Testing cycle.

---

## Defect Summary

| Severity | Description | Active | Resolved | Total |
| :--- | :--- | :---: | :---: | :---: |
| **P0** | Security / Tenant Isolation / Data Loss | 0 | 0 | 0 |
| **P1** | Critical Clinical / Financial / Auth / Document Defect | 0 | 1 | 1 |
| **P2** | Important Functional Defect | 0 | 2 | 2 |
| **P3** | Minor UI / UX Defect | 0 | 1 | 1 |
| **Total** | | **0** | **4** | **4** |

---

## Defect Entries

### DEF-001: Administration Directions (Sig) Leaking Into Invoice & Receipt Line Items

| Attribute | Details |
| :--- | :--- |
| **Defect ID** | `DEF-001` |
| **Severity** | **P1** (Financial / Document Compliance Defect — Section 22 Mandate) |
| **Module** | Invoices & Payment Receipts (`ImportPrescriptionsModal.tsx`, `InvoiceBuilderPage.tsx`, `InvoiceDocument.tsx`, `ReceiptDocument.tsx`) |
| **Reproduction Steps** | 1. Create a prescription with medicine "Amoxicillin 250mg" and Sig "Give after food with drinking water. Complete full course."<br>2. Open Invoice Builder and click "Import Prescription".<br>3. Select the prescription item.<br>4. Generate and inspect Tax Invoice and Payment Receipt. |
| **Expected Result** | Statutory Tax Invoice and Payment Receipt line items must display only the medicine name and strength/presentation ("Amoxicillin 250mg"). Administration instructions (Sig) must be strictly suppressed from financial documents while remaining intact on the prescription. |
| **Actual Result** | Invoice item description contained `Amoxicillin 250mg (Give after food with drinking water. Complete full course.)`. |
| **Root Cause** | In `ImportPrescriptionsModal.tsx`, the imported item description string was concatenated as `${itm.brandName}${strVol} (${itm.directions})`. Similarly, `InvoiceBuilderPage.tsx` appended `imp.directions` into the draft description. |
| **Fix Applied** | 1. Stripped `itm.directions` concatenation in `ImportPrescriptionsModal.tsx` and `InvoiceBuilderPage.tsx`.<br>2. Reinforced `formatInvoiceItemDescription()` in `documentFormat.ts` to automatically strip any trailing parenthetical Sig instructions before rendering in `InvoiceDocument.tsx` and `ReceiptDocument.tsx`. |
| **Regression Test** | Automated test `INV-DIR-01` in `scripts/phase6_comprehensive_integration_uat.ts` verifies that imported medicines produce clean financial descriptions ("Amoxicillin 250mg") with directions suppressed. |
| **Status** | **RESOLVED** |

---

### DEF-002: Patient List Card Signalment & Badge Overflow on Narrow Mobile Viewports (360px)

| Attribute | Details |
| :--- | :--- |
| **Defect ID** | `DEF-002` |
| **Severity** | **P2** (Important UI/UX Responsive Defect) |
| **Module** | Patient Management (`web/src/pages/patients/Patients.css`, `AppShell.css`) |
| **Reproduction Steps** | 1. Open VetRx on a mobile viewport with width 360px (standard Android width).<br>2. Navigate to `/patients`.<br>3. Inspect patient cards containing patient ID `#CAN-8801` and weight badge `5 kg`. |
| **Expected Result** | Patient cards should fit neatly within the mobile screen bounds with symmetrical margins (10px) and no text or badge clipping. |
| **Actual Result** | On 360px viewports, `.patients-grid` lacked `minmax(0, 1fr)` constraints, causing patient cards and `#CAN-8801` / `5 kg` badges to clip off the right edge. |
| **Root Cause** | CSS grid column template used implicit minimum widths larger than 320px; `.patients-search-input` had excessive 44px left padding reducing usable input width. |
| **Fix Applied** | 1. In `Patients.css`, set `.patients-grid` to `grid-template-columns: minmax(0, 1fr)`.<br>2. Added `box-sizing: border-box`, `width: 100%`, `min-width: 0` to `.patient-card`.<br>3. Adjusted `.patients-search-input` mobile padding to 36px.<br>4. In `AppShell.css`, added `box-sizing: border-box; width: 100%; min-width: 0; padding: 12px 10px;` for mobile screens under 767px. |
| **Regression Test** | Automated headless Chromium test in `scripts/verify_mobile_views.mjs` verifies 0px horizontal overflow and zero clipping across 360px and 390px viewports. |
| **Status** | **RESOLVED** |

---

### DEF-003: Share Modal Copy Button Text Clipping on Small Screens

| Attribute | Details |
| :--- | :--- |
| **Defect ID** | `DEF-003` |
| **Severity** | **P2** (Important UI/UX Responsive Defect) |
| **Module** | UI Components (`web/src/components/ui/ShareModal.tsx`) |
| **Reproduction Steps** | 1. Open Share Document modal on a 360px mobile viewport.<br>2. Observe the "Copy Link" / "Share via WhatsApp" buttons and the share URL box. |
| **Expected Result** | Button labels should wrap cleanly and remain fully visible; URLs should break naturally. |
| **Actual Result** | Button text clipped vertically due to fixed `.btn` height rules; long URLs caused overflow. |
| **Root Cause** | Global `.btn` CSS specified fixed heights (`44px` / `38px`) with `white-space: nowrap` and `overflow: hidden`. |
| **Fix Applied** | Overrode modal button styles with `height: auto; min-height: 52px; white-space: normal; line-height: 1.35;` and added `word-break: break-all` to the URL display. |
| **Regression Test** | Automated visual snapshot and DOM overflow audit in `scripts/verify_mobile_views.mjs`. |
| **Status** | **RESOLVED** |

---

### DEF-004: Incomplete Age Unit Suffix in Certain Manual Patient Age Notes

| Attribute | Details |
| :--- | :--- |
| **Defect ID** | `DEF-004` |
| **Severity** | **P3** (Minor UI/UX Clinical Formatting Defect) |
| **Module** | Patient Formatting (`web/src/utils/patientFormat.ts`) |
| **Reproduction Steps** | 1. Create a patient with ageNote entered as raw numeric string "1" or "0.5".<br>2. View patient signalment subtitle. |
| **Expected Result** | Age should format with explicit units (e.g. "1 year", "6 months"), never bare numbers. |
| **Actual Result** | Raw numeric values were displayed without unit qualification. |
| **Root Cause** | In `formatPatientAge()`, single integer values lacked explicit singular/plural "year/years" and "month/months" unit mapping. |
| **Fix Applied** | Enhanced `formatPatientAge()` to normalize bare decimals and integers into explicit unit strings ("1 year", "6 months", "2 years"). |
| **Regression Test** | Automated test `PATIENT-E2E-02` in `scripts/phase6_comprehensive_integration_uat.ts`. |
| **Status** | **RESOLVED** |
