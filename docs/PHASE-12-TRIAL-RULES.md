# VetRx — Phase 12 Trial Rules & Limits

## 1. 14-Day Trial System Overview

The VetRx trial provides prospective practices a full-fidelity evaluation environment to experience clinical workflows, Smart Dosing, and document generation, while safeguarding server capacity and abuse vectors through well-defined introductory limits.

---

## 2. Trial Duration & Server-Side Timestamp Calculation

- **Duration**: Exactly 14 calendar days (1,209,600 seconds).
- **Calculation**: Always computed deterministically on the server:
  ```typescript
  const trialStartsAt = new Date();
  const trialEndsAt = new Date(trialStartsAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  ```
- **Countdown Display**: The client UI displays real-time days remaining:
  ```typescript
  const daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  ```

---

## 3. Payment-Method-Required Architecture

In Phase 12, trials are initialized in a `PAYMENT_METHOD_PENDING` commercial state:
- Practices can explore features with configured test payment method status.
- The UI features a clear notice:
  `"Payment method required to start your trial."`
- The system is architected so Phase 13 can require an active PayU mandate registration without altering the underlying trial state machine.

---

## 4. Abuse Prevention & Trial Eligibility

- **Single Trial per Practice**: Exactly one trial subscription is permitted per practice.
- **Identity Deduplication**: Trial eligibility checks normalize emails (`email.toLowerCase().trim()`) and mobile numbers.
- **Unified Identity Protection**: Because Password and Google Authentication link to the same unified `User` account, logging in or signing up via alternating auth providers does **not** grant an additional trial.

---

## 5. Trial Introductory Usage Limits

| Resource | Maximum Allowance | Invariant & Enforcement | Error Code |
| :--- | :--- | :--- | :--- |
| **Patients** | 10 Patients | 10th patient succeeds. Attempting to create the 11th patient is blocked with HTTP 403. | `TRIAL_PATIENT_LIMIT_REACHED` |
| **Records Per Patient** | 5 Records / Patient | Sum of Prescriptions + Invoices + Receipts for a specific patient. 5th record succeeds; 6th record for that patient is blocked. Does not affect other patients under the 5-record threshold. | `TRIAL_RECORD_LIMIT_REACHED` |
| **Treatment Packages** | 5 Packages | 5th package succeeds. 6th package creation blocked with HTTP 403. | `TRIAL_PACKAGE_LIMIT_REACHED` |
| **Custom Medicines** | 10 Additions | 10th practice formulary addition succeeds. 11th custom medicine blocked. Standard global formulary medicines are unaffected. | `TRIAL_MEDICINE_LIMIT_REACHED` |
| **Veterinarian Seats** | 1 Seat | Only 1 active practitioner permitted during trial. Additional vets blocked. Unlimited staff permitted. | `SEAT_LIMIT_REACHED` |

---

## 6. Soft Expiry Policy

When the 14-day trial period expires:
1. **Zero Data Deletion**: Zero patients, prescriptions, packages, invoices, or practice profiles are ever deleted.
2. **Read-Only Clinical Mode**:
   - Veterinarians can view, search, reopen, print, and export all historical records.
   - Creating new patients, writing new prescriptions, creating invoices, or adding formulary medicines returns HTTP 403 `SUBSCRIPTION_EXPIRED`.
3. **Re-Activation**: Subscribing to an Individual or Clinic paid plan immediately restores full write privileges.
