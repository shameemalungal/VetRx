# VetRx — Phase 12 User Acceptance Testing (UAT)

## 1. UAT Test Matrix & Execution Results

| Test ID | Objective | Steps Executed | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UAT-12-01** | **New Account Trial Onboarding** | Register new practice. Inspect commercial status API and Dashboard header. | Status is `TRIAL`, `trialEndsAt` is +14 days, `paymentMethodStatus` is `PENDING`. | Clean 14-day trial initialized. Days countdown rendered on dashboard. | **PASS** |
| **UAT-12-02** | **Patient Limit Enforcement** | Create 10 patients sequentially in a trial practice, then attempt an 11th. | 10th patient created successfully. 11th attempt returns HTTP 403 `TRIAL_PATIENT_LIMIT_REACHED`. | Exactly 10 patients permitted. 11th patient blocked with clear upgrade prompt. | **PASS** |
| **UAT-12-03** | **Package Limit Enforcement** | Create 5 treatment packages, then attempt a 6th. | 5th package succeeds. 6th attempt returns HTTP 403 `TRIAL_PACKAGE_LIMIT_REACHED`. | 5 packages saved. 6th package blocked safely. | **PASS** |
| **UAT-12-04** | **Per-Patient Record Limit** | Create 5 clinical records (Rx/Invoice) for Patient A, then a 6th. Check Patient B. | 6th record for Patient A blocked. Patient B (0 records) allowed to create records. | Per-patient scoping verified. Patient A blocked at 5, Patient B uninhibited. | **PASS** |
| **UAT-12-05** | **Account Identity Unification** | Sign up with Email/Password. Link Google OAuth identity. Inspect commercial account. | Single `CommercialAccount` shared across both authentication methods. | Zero duplicate accounts, zero duplicate trials. Identical subscription ID. | **PASS** |
| **UAT-12-06** | **Subscription & Billing UI** | Navigate to Settings -> Subscription & Billing. Inspect plan cards, meters, and modals. | Displays Individual (₹599/mo, ₹5,999/yr) and Clinic (₹1,499/mo, ₹14,999/yr). GST disclaimer visible. | Rich UI rendered with usage progress bars, savings badges, and modal dialogs. | **PASS** |
| **UAT-12-07** | **Multi-Tenant Commercial Isolation** | Practice A consumes all 10 trial patients. Practice B attempts to create its 1st patient. | Practice A blocked on 11th. Practice B creates 1st patient without restriction. | Strict tenant boundary verified. Zero quota leakage between practices. | **PASS** |
| **UAT-12-08** | **Soft Expiry Simulation** | Fast-forward trial timestamp beyond 14 days. Attempt clinical read and clinical write. | Historical records readable and exportable. New record creation returns HTTP 403 `SUBSCRIPTION_EXPIRED`. | Zero data loss. Read-only clinical mode engaged gracefully. | **PASS** |

---

## 2. UI Inspection & Copy Verification

1. **Pricing Cards**:
   - Individual: `₹599/month` and `₹5,999/year` (`Save ₹1,189/year` badge).
   - Clinic: `₹1,499/month` and `₹14,999/year` (`Save ₹2,989/year` badge).
   - Enterprise: `Custom` tier representation.
2. **Statutory Notices**:
   - `Prices shown are exclusive of GST.` rendered on every commercial screen.
3. **Value Proposition**:
   - `Simple, transparent pricing. No complicated per-patient or per-prescription charges.`
4. **Dashboard Header Status**:
   - Retains `Clinical Practice Command Center` and `Secure Cloud • Online`.
   - Compact status badge displays: `14-Day Trial • X days remaining` linking directly to `/settings?tab=subscription`.
