# Phase 8 Defect Register

This register tracks all defects, anomalies, and observations encountered during the VetRx Phase 8 Release Candidate and Controlled Pilot validation.

---

## Defect Severity Summary

| Severity | Definition | Open | Closed |
| :--- | :--- | :---: | :---: |
| **P0** | Release blocker: Tenant data exposure, authentication bypass, catastrophic data loss, database corruption | 0 | 0 |
| **P1** | Critical workflow failure: Prescription cannot be completed, invoice math incorrect, Section 22 directions leak, service unstable | 0 | 0 |
| **P2** | Major workflow defect with available workaround | 0 | 0 |
| **P3** | Minor defect or cosmetic/test script adjustment | 0 | 1 |
| **Total** | | **0** | **1** |

---

## Defect Log

### DEFECT-P8-01: Unit Mismatch in Pilot Financial Validation Test Script
- **ID**: DEFECT-P8-01
- **Date**: 2026-09-20
- **Environment**: Local Validation Test Suite (`scripts/phase8_controlled_pilot_validation.ts`)
- **Device / Browser**: Node.js v20.18.0 / tsx runtime
- **Module**: Financial Validation Harness / `invoiceUtils.ts` integration
- **Severity**: P3 (Minor Test Script Defect)
- **Description**: The Phase 8 automated test runner `phase8_controlled_pilot_validation.ts` passed `grandTotalPaisa / 100` into `formatINR()` and `numberToWordsINR()`. Because `invoiceUtils.ts` accepts integer paisa and internally divides by 100, dividing prior to the function call resulted in ₹13.00 instead of ₹1,300.00 in the test assertion.
- **Steps to Reproduce**:
  1. Execute initial draft of `scripts/phase8_controlled_pilot_validation.ts`.
  2. Observe assertion failure in test 7: expected `₹1,300.00`, received `₹13.00`.
- **Expected Result**: Validation script passes integer paisa (130000) directly to `formatINR(130000)` yielding `"₹1,300.00"` and `"Indian Rupees One Thousand Three Hundred Only"`.
- **Actual Result**: Test script divided paisa by 100 before passing into the utility, dividing twice.
- **Evidence**: Initial script execution log reported string mismatch on test 7.
- **Root Cause**: Test script authoring assumption that `formatINR` took rupees rather than paisa. Production code in `web/src/pages/invoices/invoiceUtils.ts` has always correctly expected integer paisa.
- **Fix**: Updated `scripts/phase8_controlled_pilot_validation.ts` line 273 and 276 to pass `grandTotalPaisa` directly to `formatINR(grandTotalPaisa)` and `numberToWordsINR(grandTotalPaisa)`.
- **Verification**: Re-executed `npx tsx scripts/phase8_controlled_pilot_validation.ts`. Test 7 passed with 100% precision:
  ```text
  [PASS] PILOT-FIN-01 [Invoice Financial Calculation - Pilot Account B (Established)]: Multi-category billing across all 6 statutory categories with exact integer paisa arithmetic
     -> Actual: Subtotal: ₹1,400.00, Discount: ₹100.00, Grand Total: ₹1,300.00. Words: "Indian Rupees One Thousand Three Hundred Only".
  ```
- **Status**: **CLOSED**

---

## Zero Open Defect Certification

As of 2026-09-20:
- **Open P0 Defects**: **0**
- **Open P1 Defects**: **0**
- **Open P2 Defects**: **0**
- **Open P3 Defects**: **0**

The Release Candidate satisfies all Phase 8 defect threshold criteria.
