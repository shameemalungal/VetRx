# VetRx Phase 10 — Commercial Decisions Register

**Date**: September 20, 2026  
**Status**: Authoritative Reference for Phase 10 & Future Commercial Phases  
**Governance Principle**: Technical architecture must not invent or hard-code provisional business defaults as immutable software logic. All unresolved pricing, packaging, and policy decisions are explicitly classified below.

---

## 1. Commercial Decision Status Matrix

The following table records the official status of commercial decisions. Where business decisions are under executive review or deferred to later phases, they are formally designated **TBD** with clear implementation boundaries.

| # | Business / Commercial Decision | Status in Phase 10 | Target Phase | Architecture Guardrail |
|:---|:---|:---:|:---:|:---|
| **1** | Free / Trial Tier Availability | **TBD** | Phase 12 | Architecture allows 0-price or trial-eligible plans without hard-coding rules. |
| **2** | Trial Duration (Days) | **TBD** | Phase 12 | Stored as configurable `trialPeriodDays: Int` on `SubscriptionPlan` (e.g. 14, 30); zero clinical blocking if null/0. |
| **3** | Monthly Subscription Price (INR) | **TBD** | Phase 12 | Stored in integer paise (`pricePaisa: Int`). No hard-coded fallback in code. |
| **4** | Annual Subscription Price (INR) | **TBD** | Phase 12 | Stored in integer paise. Discounts/offers managed via plan metadata or billing interval. |
| **5** | Plan Tier Naming & Segmentation | **TBD** | Phase 12 | Model supports dynamic plan codes (`TRIAL`, `MONTHLY`, `THREE_MONTHS`, `ANNUAL`). |
| **6** | Feature Limits & Quotas | **TBD** | Phase 12 | Defined as JSON payload (`featuresJson`) in `SubscriptionPlan`. No hard-coded gate in clinical code. |
| **7** | Practitioner / Seat Limits | **TBD** | Phase 12 | Stored as `maxUserSeats: Int` on `SubscriptionPlan`. Defaults to unmetered in Phase 10. |
| **8** | Patient Record Limits | **TBD** | Phase 12 | Architecture supports unmetered or metered; clinical controllers remain unmetered. |
| **9** | Statutory GST Rate & Treatment | **TBD** | Phase 13 | SaaS billing tax calculations are deferred to Phase 13 PayU invoicing. |
| **10** | SaaS Tax Invoice Requirements | **TBD** | Phase 13 | Kept strictly distinct from clinical veterinary invoices (`Invoice` model). |
| **11** | Grace Period Duration (Days) | **TBD** | Phase 12 | Stored as timestamp `gracePeriodEndsAt: DateTime?` on `Subscription`. |
| **12** | Cancellation & Mid-Cycle Terms | **TBD** | Phase 12 | Managed via `cancelAtPeriodEnd: Boolean` flag; no automatic data deletion. |
| **13** | Refund & Dispute Policy | **TBD** | Phase 13 | Stored as `status: REFUNDED` in `Payment`; payment gateway rules deferred to Phase 13. |
| **14** | Upgrade / Downgrade Proration | **TBD** | Phase 12 | Handled through transactional billing adjustments; deferred to Phase 12/13. |
| **15** | Coupon & Discount Engine | **TBD** | Phase 12 | Schema supports plan-level pricing; coupon tables not prematurely added in Phase 10. |
| **16** | Payment Failure Policy | **TBD** | Phase 13 | Status transitions (`PAST_DUE` -> `GRACE_PERIOD` -> `EXPIRED`) modeled without paywall. |
| **17** | Payment Gateway Selection | **PayU Planned** | Phase 13 | Provider-neutral `PaymentGateway` interface defined; no PayU SDK in Phase 10. |
| **18** | Payment Processing Activation | **Phase 13** | Phase 13 | No live payment calls, checkout pages, or buttons in Phase 10. |
| **19** | Google Authentication | **Phase 11** | Phase 11 | `AuthIdentity` model exists; no Google OAuth UI or activation in Phase 10. |
| **20** | Commercial Paywall Enforcement | **Phase 14** | Phase 14 | Zero enforcement against clinical workflows in Phase 10. All existing accounts stay active. |

---

## 2. Invariant Principles for Phase 10

1. **No Production Paywall**: Phase 10 creates the data models and service abstractions. Existing clinical endpoints (`/api/owners`, `/api/patients`, `/api/prescriptions`, `/api/invoices`, etc.) are untouched and unblocked.
2. **Clinical Data Permanence**: A subscription transition to `EXPIRED` or `CANCELLED` **must never delete or cascade-delete** clinical records (`Owner`, `Patient`, `Prescription`, `Invoice`, `Receipt`).
3. **Integer Paisa Currency Model**: All monetary representations in the commercial domain must use integer minor units (paise for INR). Floating-point currency calculations are strictly prohibited.
4. **Practice as Sole Billing Tenant**: Commercial subscriptions and payments belong strictly to `Practice`. Clinical records belong to `Practice`. Users belong to `Practice` via `PracticeMember`.
