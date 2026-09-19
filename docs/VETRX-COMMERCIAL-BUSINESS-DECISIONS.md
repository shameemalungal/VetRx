# VetRx Commercial Business Decisions Register

This document catalogs all open commercial, pricing, legal, and operational business decisions required to commercialize VetRx as an independent veterinary SaaS product.

In accordance with Phase 8 roadmap principles, **no commercial decisions, trial durations, plan prices, or limits are fabricated**. All pending items are formally registered below as **TBD — BUSINESS DECISION** awaiting executive approval prior to execution of Phase 12 (Trial & Subscription Plans) and Phase 13 (PayU Payment & Billing).

---

## Business Decision Register

### BD-01: Trial Duration
- **Decision ID**: BD-01
- **Domain**: Trial Policy
- **Question**: What is the default duration of the initial free trial granted to a new practice upon registration?
- **Status**: **TBD — BUSINESS DECISION**
- **Candidate Options**:
  - 14 calendar days
  - 30 calendar days
  - 60 calendar days (introductory pilot promotion)
- **Impact**: Determines user acquisition velocity, cash conversion cycle, and database storage for uncommitted registrations.
- **Architectural Prerequisite**: Trial duration must be a configurable parameter associated with the Practice record, not hard-coded in client or server logic.

---

### BD-02: Trial Feature Set & Scope
- **Decision ID**: BD-02
- **Domain**: Trial Entitlements
- **Question**: Does the trial provide full unmetered access to all VetRx capabilities (Full Featured), or a restricted subset?
- **Status**: **TBD — BUSINESS DECISION**
- **Candidate Options**:
  - **Full Access**: All clinical features, unlimited prescriptions, dose calculator, treatment packages, invoicing, receipts, and PDF/Print.
  - **Tiered Trial**: Full clinical features, but with watermark on exported PDFs or restricted multi-doctor seats.
- **Recommendation / Notes**: Veterinary practices require full workflow fidelity (Rx + Invoice + Print) to evaluate clinical adoption.

---

### BD-03: Commercial Plan Names & Segmentation
- **Decision ID**: BD-03
- **Domain**: Product Packaging
- **Question**: What are the official commercial tier names and market segmentations?
- **Status**: **TBD — BUSINESS DECISION**
- **Conceptual Candidate Profiles**:
  - Tier 1: Solo Practitioner / Ambulatory Vet (Single-seat, mobile-optimized)
  - Tier 2: Professional Clinic (Multi-staff, reception desk + doctor)
  - Tier 3: Hospital / Multi-Doctor Center (Multiple practitioners, centralized billing)
- **Rule**: Actual public branding and tier definitions must be formally approved before Phase 12.

---

### BD-04: Monthly Subscription Pricing (INR)
- **Decision ID**: BD-04
- **Domain**: Pricing & Revenue
- **Question**: What is the monthly recurring price per plan in Indian Rupees (INR), inclusive/exclusive of GST?
- **Status**: **TBD — BUSINESS DECISION**
- **Candidate Options**: TBD based on competitive analysis and willingness-to-pay studies among Indian veterinary practitioners.
- **Architectural Rule**: Prices must be stored in integer paisa (e.g., ₹999.00 = 99900 paisa) in configuration/database, never hard-coded in UI.

---

### BD-05: Annual Subscription Pricing & Discount (INR)
- **Decision ID**: BD-05
- **Domain**: Pricing & Revenue
- **Question**: What is the annual recurring price per plan, and what discount incentive is offered (e.g., 2 months free / 15–20% discount)?
- **Status**: **TBD — BUSINESS DECISION**
- **Impact**: Encourages annual upfront cash flow and decreases churn rate.

---

### BD-06: User / Seat Limits per Plan
- **Decision ID**: BD-06
- **Domain**: Practice Membership Limits
- **Question**: How many user accounts (PracticeMembers) are permitted per plan tier?
- **Status**: **TBD — BUSINESS DECISION**
- **Candidate Options**:
  - Solo tier: 1 Practitioner seat
  - Clinic tier: 1–3 seats (e.g., 1 Doctor + 2 Compounders/Staff)
  - Hospital tier: 5+ seats with role-based access control (PRACTICE_OWNER, PRACTICE_ADMIN, PRACTICE_STAFF)

---

### BD-07: Patient Record Limits
- **Decision ID**: BD-07
- **Domain**: Usage Metering
- **Question**: Should subscription plans impose caps on total active patient profiles, or offer unlimited patient records?
- **Status**: **TBD — BUSINESS DECISION**
- **Recommendation**: In accordance with Section 14, VetRx prefers fixed SaaS access billing rather than per-patient or per-prescription caps that penalize busy practices.

---

### BD-08: Prescription Generation Limits
- **Decision ID**: BD-08
- **Domain**: Usage Metering
- **Question**: Are prescription generations capped per billing cycle?
- **Status**: **TBD — BUSINESS DECISION**
- **Recommendation**: Unlimited prescriptions across all paid tiers to preserve core clinical utility.

---

### BD-09: Tier-Specific Feature Differentiation
- **Decision ID**: BD-09
- **Domain**: Entitlement Differentiation
- **Question**: Which advanced features are exclusive to higher-tier plans?
- **Status**: **TBD — BUSINESS DECISION**
- **Candidate Differentiators**:
  - Custom Clinic Letterhead & Logo Uploads
  - Multi-user concurrent access & Staff permission roles
  - Advanced Financial Analytics & Bulk Export
  - Priority Technical Support

---

### BD-10: Payment Grace Period Duration
- **Decision ID**: BD-10
- **Domain**: Billing Operations
- **Question**: When a recurring renewal fails or a payment is past due, how many calendar days of grace period are allowed before access is restricted?
- **Status**: **TBD — BUSINESS DECISION**
- **Candidate Options**: 3 days, 7 days, or 14 days.
- **Rule**: Clinical operations must not be abruptly severed mid-consultation without warning banners and a reasonable grace period.

---

### BD-11: Post-Expiry Access Model (Clinical Data Preservation)
- **Decision ID**: BD-11
- **Domain**: Clinical Continuity & Compliance
- **Question**: What level of access is granted to an account whose subscription has expired and passed the grace period?
- **Status**: **TBD — BUSINESS DECISION**
- **Mandatory Constraint (Section 18)**: Clinical data (Owners, Patients, Prescriptions, Invoices, Receipts) must **NEVER** be deleted upon subscription expiry.
- **Candidate Access Models**:
  - **Read-Only Mode**: Practitioner can search, view, and print past records and history, but cannot create new prescriptions or invoices until renewed.
  - **Account Management Only**: Login redirects to a renewal/subscription reactivation screen with an option to download a complete data export (JSON/CSV backup).

---

### BD-12: Cancellation & Mid-Cycle Termination Policy
- **Decision ID**: BD-12
- **Domain**: Subscription Lifecycle
- **Question**: When a practitioner cancels an active subscription, does access terminate immediately or remain active until the end of the paid billing period?
- **Status**: **TBD — BUSINESS DECISION**
- **Recommendation**: Standard SaaS best practice: access remains active until the end of `currentPeriodEnd`, after which the status transitions to `EXPIRED`.

---

### BD-13: Refund & Dispute Policy
- **Decision ID**: BD-13
- **Domain**: Legal & Financial
- **Question**: Under what circumstances are subscription payments refundable (e.g., 7-day money-back guarantee, non-refundable, prorated)?
- **Status**: **TBD — BUSINESS DECISION**
- **Impact**: Requires explicit Terms of Service and refund workflow documentation for PayU dispute handling.

---

### BD-14: Plan Upgrade & Proration Policy
- **Decision ID**: BD-14
- **Domain**: Billing Math
- **Question**: When a practice upgrades mid-cycle (e.g., Solo to Clinic), is the unused balance credited immediately (proration), or does the new plan start immediately with a new billing date?
- **Status**: **TBD — BUSINESS DECISION**

---

### BD-15: Plan Downgrade & Seat Reconcilation Policy
- **Decision ID**: BD-15
- **Domain**: Billing Operations
- **Question**: How are downgrades handled when a practice exceeds the lower tier's limits (e.g., downgrading from 3 seats to 1 seat)?
- **Status**: **TBD — BUSINESS DECISION**

---

### BD-16: PayU Settlement, Convenience Fee & GST Handling
- **Decision ID**: BD-16
- **Domain**: Payment Gateway Accounting
- **Question**:
  1. Are payment gateway processing fees absorbed by VetRx or passed to the subscriber?
  2. Is GST (18%) added on top of the base subscription price or included in the sticker price?
  3. What is the business entity name, GSTIN, and merchant category code (MCC) configured on the PayU merchant account?
- **Status**: **TBD — BUSINESS DECISION**

---

### BD-17: Commercial Launch Readiness Criteria
- **Decision ID**: BD-17
- **Domain**: Executive Governance
- **Question**: What quantitative operational milestones must be achieved during Phase 9 (Production Launch & Stabilization) before authorizing Phase 14 (Commercial VetRx Launch)?
- **Status**: **TBD — BUSINESS DECISION**
- **Candidate Milestones**:
  - Minimum 30 days of zero-downtime production operation
  - Minimum 25 active pilot practitioners with positive NPS
  - Zero unresolved P0/P1 clinical or financial defects
  - Complete PayU merchant KYC clearance and live webhook verification

---

## Decision Approvals Table

| Decision ID | Summary | Target Phase | Assigned Owner | Approved Date |
| :--- | :--- | :---: | :---: | :---: |
| **BD-01** | Trial Duration | Phase 12 | Product Leadership | Pending |
| **BD-02** | Trial Feature Scope | Phase 12 | Clinical Leadership | Pending |
| **BD-03** | Plan Names & Tiers | Phase 12 | Commercial / Marketing | Pending |
| **BD-04** | Monthly Prices (INR) | Phase 12 | Finance / Executive | Pending |
| **BD-05** | Annual Prices (INR) | Phase 12 | Finance / Executive | Pending |
| **BD-06** | Seat / User Limits | Phase 12 | Product Architecture | Pending |
| **BD-07** | Patient Record Limits | Phase 12 | Product Architecture | Pending |
| **BD-08** | Prescription Limits | Phase 12 | Clinical Leadership | Pending |
| **BD-09** | Feature Differentiation | Phase 12 | Product / Commercial | Pending |
| **BD-10** | Grace Period Duration | Phase 12 | Operations / Finance | Pending |
| **BD-11** | Post-Expiry Access | Phase 12 | Product / Legal | Pending |
| **BD-12** | Cancellation Policy | Phase 12 | Legal / Product | Pending |
| **BD-13** | Refund Policy | Phase 12 | Finance / Legal | Pending |
| **BD-14** | Upgrade / Proration | Phase 12 | Billing Architecture | Pending |
| **BD-15** | Downgrade Seat Policy | Phase 12 | Billing Architecture | Pending |
| **BD-16** | PayU Settlement & GST | Phase 13 | Finance / Accounting | Pending |
| **BD-17** | Commercial Launch Gate | Phase 14 | Executive Board | Pending |
