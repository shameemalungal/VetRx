# VetRx Phase 9: Production Practitioner Onboarding Runbook

This guide provides the standard operating procedure for onboarding veterinary practitioners and clinics onto the live VetRx production platform (`https://vetrx.adcpmalappuram.in`).

---

## 1. Onboarding Checklist Overview

```
[1. Account Registration] ──▶ [2. Practice & Profile Setup] ──▶ [3. First Patient Intake]
                                                                        │
[6. Support & Feedback]  ◀── [5. Invoicing & Billing]   ◀── [4. Prescription & PDF]
```

---

## 2. Step-by-Step Onboarding Procedure

### Step 1: Account Registration
1. Navigate to: `https://vetrx.adcpmalappuram.in/register`
2. Enter your full name (e.g., `Dr. Arjun Menon`), active email address, and secure password (minimum 8 characters with at least one number or symbol).
3. Click **Create Practice Account**.
4. The system automatically creates your dedicated practice workspace and redirects to the dashboard.

### Step 2: Practice & Profile Setup
1. From the navigation sidebar, click **Settings** (`/settings`).
2. **Practitioner Details**:
   - Enter your Veterinary Council Registration Number (e.g., `KSVC-4821`).
   - Enter your educational qualifications (e.g., `BVSc & AH, MVSc`).
   - Upload your digital signature image (transparent PNG recommended) or clinic stamp.
3. **Clinic / Organisation Identity**:
   - Enter your Clinic Name (e.g., `Companion Pet Care Clinic`).
   - Provide clinic phone number, email, and physical clinic address.
   - Upload clinic logo mark (optional; renders on prescription letterhead).
4. Click **Save Settings**.

### Step 3: Owner & Client Registration
1. Click **Patients** (`/patients`) in the sidebar, then click **New Patient**.
2. Under **Owner Information**:
   - Enter the owner's 10-digit mobile phone number.
   - *Tip*: If the owner has visited before, their profile will appear automatically.
   - Enter owner name (e.g., `Smt. Lakshmi Nair`) and residential locality/address.

### Step 4: Patient Signalment & Registration
1. Select the **Species**:
   - Companion animals: *Canine, Feline, Avian, etc.*
   - Livestock / Farm animals: *Bovine, Caprine, Ovine, Equine, etc.*
2. Enter animal details:
   - Name (e.g., `Leo` for dogs, or ear-tag `KL-14-3829` for cattle).
   - Breed (e.g., `Golden Retriever` or `Crossbred Jersey`).
   - Sex (*Male / Female / Neutered / Spayed*).
   - Age (in years or months).
   - Body Weight in kg (e.g., `28.5 kg` — required for automated dose calculations).
3. Click **Save Patient**.

### Step 5: Clinical Prescription Workflow
1. Click **New Prescription** from the patient details page or the global header button.
2. Enter clinical notes:
   - **Symptoms**: Type chief complaints (e.g., `Vomiting, lethargy, anorexia for 2 days`).
   - **Diagnosis**: Type provisional or definitive diagnosis (e.g., `Acute Gastroenteritis`).
3. Add Medicines:
   - Type in the medicine search bar (e.g., `Ondansetron` or `Amoxicillin`).
   - Formulary autocomplete suggests brand name, generic formulation, strength, and presentation.
   - **Smart Dose Calculator**: If a dosing rule exists for the species, calculated mg/dose and volume in mL or tablets are computed automatically based on patient weight.
   - Enter administration instructions / Sig (e.g., `Give 1 tablet orally twice daily before meals for 5 days`).
4. Enter General Advice & Follow-Up interval (e.g., `Review in 3 days if symptoms persist`).
5. Click **Save Prescription**.

### Step 6: Document Generation (Print & PDF)
1. Click **View Document / Print** to open the authoritative document viewer.
2. Verify:
   - Practitioner header and registration number appear at top.
   - Patient signalment, symptoms, diagnosis, and Rx table render clearly.
   - Administration directions (Sig) are clearly legible.
   - Practitioner signature block is intact at the bottom.
3. Click **Print** for direct hardware thermal/A4 printing, or **Save PDF** to download a high-resolution PDF document for WhatsApp sharing.

### Step 7: Tax Invoicing & Receipt (Optional)
1. If the practice charges consultation or medicine fees, navigate to **Invoices** (`/invoices`) $\rightarrow$ **New Invoice**.
2. Select client and patient.
3. Click **Import from Prescription** to automatically import prescribed medicines into billing line items.
4. *Statutory Compliance Notice*: In accordance with veterinary regulations (Section 22), administration directions / Sig are automatically excluded from the invoice; only item name, quantity, and price appear.
5. Add consultation or procedure fees (e.g., Clinical Exam: ₹300.00).
6. Click **Save & Issue Invoice**.
7. To record payment, click **Add Payment** $\rightarrow$ select payment mode (*Cash, UPI, Card*) $\rightarrow$ generates a formal **Payment Receipt**.

### Step 8: Session & Persistence Verification
1. Click profile icon in bottom-left $\rightarrow$ click **Logout**.
2. Re-login at `/login` with your email and password.
3. Confirm all saved patients, prescriptions, invoices, and clinic settings load cleanly and immediately.

---

## 3. Practitioner Support Channels

If any questions, unexpected errors, or connectivity issues occur during daily practice:
- **Direct Support Contact**: `support@vetrx.in` / Helpdesk Administrator
- **Operating Hours**: Monday through Saturday, 08:00 to 20:00 IST
- **Emergency Reporting**: Refer to [`docs/PHASE-9-SUPPORT-RUNBOOK.md`](file:///c:/Antigravity/VetRx/docs/PHASE-9-SUPPORT-RUNBOOK.md) for priority issue escalation.
