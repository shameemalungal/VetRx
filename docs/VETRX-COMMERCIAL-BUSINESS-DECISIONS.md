# VetRx Commercial Business Decisions Register

This document records the official commercial, pricing, packaging, legal, and operational business decisions governing VetRx as an independent veterinary SaaS product.

---

## Business Decision Register

### BD-01: Trial Duration
- **Decision ID**: BD-01
- **Domain**: Trial Policy
- **Decision**: **14 calendar days**
- **Status**: **APPROVED**
- **Details**: Every newly registered practice automatically receives a 14-day trial period upon registration. The trial is bound to the `Practice` entity to prevent duplicate trial resets via email aliases.

---

### BD-02: Trial Feature Scope
- **Decision ID**: BD-02
- **Domain**: Trial Entitlements
- **Decision**: **Full Access (Unmetered)**
- **Status**: **APPROVED**
- **Details**: The 14-day trial grants unmetered access to all VetRx clinical and financial capabilities: unlimited owners, unlimited patients, unlimited prescriptions, smart dose calculator, treatment packages, prescription cloning, multi-item tax invoices, payment receipts, and high-fidelity PDF generation/printing.

---

### BD-03: Commercial Plan Names & Tier Segmentation
- **Decision ID**: BD-03
- **Domain**: Product Packaging
- **Decision**: **Four Billing Cycles with Seat-Based Scaling**
  1. **Trial**: 14 days (1 seat)
  2. **Monthly**: 1 month (5 seats)
  3. **3 Months (Quarterly)**: 3 months (5 seats)
  4. **Annual**: 12 months (10 seats)
- **Status**: **APPROVED**
- **Details**: All paid plans include identical full clinical and financial features. Segmentation is based on billing commitment and user seat capacity.

---

### BD-04: Monthly Subscription Pricing (INR)
- **Decision ID**: BD-04
- **Domain**: Pricing & Revenue
- **Decision**: **₹599 / month** (59900 integer paisa)
- **Status**: **APPROVED**
- **Details**: Includes up to 5 practitioner/staff seats, unlimited patients, and unlimited prescriptions.

---

### BD-05: Multi-Month & Annual Pricing (INR)
- **Decision ID**: BD-05
- **Domain**: Pricing & Revenue
- **Decision**:
  - **3 Months Plan**: **₹1,599 / 3 months** (effective ₹533/month, saving ₹198 over monthly)
  - **Annual Plan**: **₹6,588 / year** (Base: ₹7,188 [₹599 × 12] less **₹600 discount**; effective ₹549/month; includes 10 seats)
- **Status**: **APPROVED**

---

### BD-06: User / Seat Limits per Plan Tier
- **Decision ID**: BD-06
- **Domain**: Practice Membership Limits
- **Decision**:
  - **Trial**: **1 seat** (Practice Owner / Solo Doctor)
  - **Monthly Plan**: **5 seats** (Practice Owner + 4 Clinicians/Staff)
  - **3 Months Plan**: **5 seats** (Practice Owner + 4 Clinicians/Staff)
  - **Annual Plan**: **10 seats** (Practice Owner + 9 Clinicians/Staff)
- **Status**: **APPROVED**
- **Details**: Governed server-side by `PracticeMember` count active for the `practiceId`.

---

### BD-07: Patient Record Limits
- **Decision ID**: BD-07
- **Domain**: Usage Metering
- **Decision**: **Unlimited** across all tiers (Trial, Monthly, 3 Months, Annual)
- **Status**: **APPROVED**
- **Details**: VetRx SaaS access does not cap or penalize patient record volume.

---

### BD-08: Prescription Generation Limits
- **Decision ID**: BD-08
- **Domain**: Usage Metering
- **Decision**: **Unlimited** across all tiers
- **Status**: **APPROVED**
- **Details**: Veterinarians can generate, clone, edit, print, and save an unlimited volume of prescriptions.

---

### BD-09: Tier-Specific Feature Differentiation
- **Decision ID**: BD-09
- **Domain**: Entitlement Differentiation
- **Decision**: **Nil (100% Feature Parity Across Paid Tiers)**
- **Status**: **APPROVED**
- **Details**: All paid plans provide 100% access to all current and future clinical tools: Patients, Prescriptions, Formulary, Packages, Invoices, Receipts, Dose Calculator, and PDF/Print. Tiers differ solely by duration and seat limit.

---

### BD-10: Payment Grace Period Duration
- **Decision ID**: BD-10
- **Domain**: Billing Operations
- **Decision**: **14 calendar days**
- **Status**: **APPROVED**
- **Details**: When a subscription billing cycle ends or a renewal payment fails, the practice enters a 14-day `GRACE_PERIOD`. During this period, the practice retains full clinical access with a persistent, non-intrusive renewal warning banner in the dashboard.

---

### BD-11: Post-Expiry Access Model (Clinical Data Preservation)
- **Decision ID**: BD-11
- **Domain**: Clinical Continuity & Compliance
- **Decision**: **Read-Only History + Complete Data Export**
- **Status**: **APPROVED**
- **Details**: If the 14-day grace period lapses without payment:
  1. Clinical records (`Owner`, `Patient`, `Prescription`, `Invoice`, `Receipt`) are **PERMANENTLY PRESERVED**. Zero clinical data deletion.
  2. The account transitions to `EXPIRED` status.
  3. The practitioner retains full search, view, print, and export access for all existing medical records.
  4. Creating *new* prescriptions, invoices, or patients is disabled until renewed via PayU checkout.

---

### BD-12: Cancellation & Mid-Cycle Termination Policy
- **Decision ID**: BD-12
- **Domain**: Subscription Lifecycle
- **Decision**: **No Refund on Cancellation; Service Continues Until End of Paid Cycle**
- **Status**: **APPROVED**
- **Details**: If a subscriber cancels their plan mid-cycle, auto-renewal is disabled (`cancelAtPeriodEnd: true`). The practice retains full active access until the paid period ends (`currentPeriodEnd`), after which it transitions to `EXPIRED`.

---

### BD-13: Refund & Dispute Policy
- **Decision ID**: BD-13
- **Domain**: Legal & Financial
- **Decision**: **Strict No-Refund Policy Once Plan is Paid**
- **Status**: **APPROVED**
- **Details**: Once payment is processed through PayU, payments are non-refundable for all cycles (Monthly, 3 Months, Annual). Explicitly stated in the Terms of Service presented during checkout.

---

### BD-14: Plan Upgrade & Proration Policy
- **Decision ID**: BD-14
- **Domain**: Billing Math
- **Decision (Standard Prorated Credit)**:
  - When upgrading mid-cycle (e.g., Monthly to Annual, or adding seats), the unused value of the current billing cycle is calculated as a prorated credit:
    $$\text{Credit} = \left(\frac{\text{Remaining Days in Cycle}}{\text{Total Days in Cycle}}\right) \times \text{Current Cycle Price Paid}$$
    $$\text{Net PayU Checkout Amount} = \max(0, \text{New Plan Price} - \text{Credit})$$
  - Upon successful PayU payment, the new plan takes effect immediately and resets a full billing period.
- **Status**: **APPROVED (Proposed Standard SaaS Logic)**

---

### BD-15: Plan Downgrade & Seat Reconciliation Policy
- **Decision ID**: BD-15
- **Domain**: Billing Operations
- **Decision**:
  - Downgrades take effect at the **end of the current paid billing cycle** (no mid-cycle downgrade refunds per BD-12).
  - **Seat Reconciliation**: If the practice has more active staff members than permitted by the new tier (e.g. 8 active seats on an Annual plan downgrading to a 5-seat Monthly plan), the Practice Owner is prompted to select which 5 seats remain active. Excess accounts are set to `isActive: false` (deactivated, never deleted) and can be reactivated if the practice upgrades again.
- **Status**: **APPROVED (Proposed Standard SaaS Logic)**

---

### BD-16: PayU Settlement, Convenience Fee & GST Handling
- **Decision ID**: BD-16
- **Domain**: Payment Gateway Accounting
- **Decision**:
  1. **Convenience Fees**: VetRx absorbs all PayU payment processing fees (UPI, Debit/Credit Card, NetBanking). The subscriber pays exactly the displayed price (e.g., exactly ₹599.00).
  2. **GST Handling**: Displayed subscription prices are **All-Inclusive (inclusive of 18% GST)**:
     - ₹599 / month = ₹507.63 Base + ₹91.37 GST (18%)
     - ₹1,599 / 3 months = ₹1,355.08 Base + ₹243.92 GST (18%)
     - ₹6,588 / year = ₹5,583.05 Base + ₹1,004.95 GST (18%)
  3. Tax invoices generated for subscribers will itemize the 18% GST component with VetRx's registered GSTIN for B2B input tax credit (ITC) claims.
- **Status**: **APPROVED (Proposed Standard SaaS Logic)**

---

### BD-17: Quantitative Phase 9 Stabilization Exit Criteria for Phase 14 Launch
- **Decision ID**: BD-17
- **Domain**: Executive Governance & Quality Gate
- **Decision**: Phase 9 must satisfy all of the following empirical criteria prior to initiating Phase 14 Commercial Launch:
  1. **Production Stability**: Minimum **30 consecutive days** of live production uptime ($\ge 99.9\%$) without unhandled crashes or emergency downtime.
  2. **Active Pilot Clinical Usage**: Minimum **10 active veterinary practitioners** regularly generating prescriptions and invoices weekly.
  3. **Zero Defect Threshold**: **0 open P0** and **0 open P1** defects in the production defect register.
  4. **Backup & Recovery Verification**: Automated daily PostgreSQL dumps running reliably with verified test restores.
  5. **PayU Merchant Verification**: Active PayU production account with verified KYC, production API keys configured in server environment, and 100% test transaction pass in PayU Sandbox.
- **Status**: **APPROVED (Proposed Standard Operational Criteria)**

---

## Decision Summary Table

| Decision ID | Summary | Plan / Value | Status |
| :--- | :--- | :--- | :---: |
| **BD-01** | Trial Duration | **14 calendar days** | **APPROVED** |
| **BD-02** | Trial Feature Scope | **Full access (unmetered)** | **APPROVED** |
| **BD-03** | Plan Tiers | **Trial, Monthly, 3 Months, Annual** | **APPROVED** |
| **BD-04** | Monthly Price | **₹599 / month** (all-inclusive) | **APPROVED** |
| **BD-05** | Multi-Month & Annual | **₹1,599 (3 mos) / ₹6,588 (Annual, ₹600 off)** | **APPROVED** |
| **BD-06** | User Seat Limits | **Trial: 1, Monthly: 5, 3 Mos: 5, Annual: 10** | **APPROVED** |
| **BD-07** | Patient Records | **Unlimited** across all tiers | **APPROVED** |
| **BD-08** | Prescriptions | **Unlimited** across all tiers | **APPROVED** |
| **BD-09** | Feature Differentiators | **Nil (100% feature parity on all paid tiers)** | **APPROVED** |
| **BD-10** | Grace Period | **14 calendar days** | **APPROVED** |
| **BD-11** | Post-Expiry Access | **Read-only history + data export (zero data loss)** | **APPROVED** |
| **BD-12** | Cancellation Policy | **No refund; active until period ends** | **APPROVED** |
| **BD-13** | Refund Policy | **Strictly non-refundable once paid** | **APPROVED** |
| **BD-14** | Upgrade / Proration | **Prorated unused credit applied to upgrade** | **APPROVED** |
| **BD-15** | Downgrade Seat Policy | **Takes effect at period end; excess seats deactivated** | **APPROVED** |
| **BD-16** | PayU Fees & GST | **Fees absorbed; prices include 18% GST** | **APPROVED** |
| **BD-17** | Commercial Launch Gate | **30d uptime, 10 active vets, 0 P0/P1, PayU KYC** | **APPROVED** |
