# VetRx — Phase 12 Plan Configuration & Authoritative Pricing

## 1. Authoritative Product Plans & Pricing

In strict compliance with approved business decisions BD-06, BD-07, and BD-30, VetRx establishes the following authoritative pricing schedule. All internal representations use exact integer paise (1 INR = 100 paise).

| Plan Code | Display Name | Interval | Price (INR) | Price (Paise) | Veterinarian Seats | Staff Seats | Paid Patient Limit | Annual Savings |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `TRIAL` | 14-Day Free Trial | 14 Days | ₹0 | `0` | 1 | Unlimited | 10 Patients (Trial Limit) | N/A |
| `INDIVIDUAL_MONTHLY` | Individual (Monthly) | Monthly | ₹599 | `59900` | 1 | Unlimited | Unlimited | N/A |
| `INDIVIDUAL_ANNUAL` | Individual (Annual) | Annual | ₹5,999 | `599900` | 1 | Unlimited | Unlimited | Save ₹1,189/yr (16.6%) |
| `CLINIC_MONTHLY` | Clinic (Monthly) | Monthly | ₹1,499 | `149900` | Up to 5 | Unlimited | Unlimited | N/A |
| `CLINIC_ANNUAL` | Clinic (Annual) | Annual | ₹14,999 | `1499900` | Up to 5 | Unlimited | Unlimited | Save ₹2,989/yr (16.6%) |
| `ENTERPRISE` | Enterprise | Custom | Custom | Custom | Unlimited / Custom | Unlimited | Unlimited | Negotiated |

---

## 2. Superseded Pricing Eradication

> [!CAUTION]
> **Zero Tolerance for Obsolete Pricing**:
> - Obsolete legacy figures (**₹6,000** for Individual Annual and **₹15,000** for Clinic Annual) are strictly eradicated across all code, configuration files, test suites, database seeds, and UI displays.
> - Any reference to ₹6,000 or ₹15,000 will cause automated assertion failures in `phase12_trial_and_subscription_plans.test.ts`.

### Authoritative Savings Math
1. **Individual Annual Plan**:
   - Monthly cost over 12 months: `₹599 × 12 = ₹7,188` (718,800 paise)
   - Annual plan price: `₹5,999` (599,900 paise)
   - Exact Annual Savings: `₹7,188 - ₹5,999 = ₹1,189` (118,900 paise)
   - Percentage: `1,189 / 7,188 ≈ 16.54%` (displayed as `~16.6%` or `Save ₹1,189/year`)

2. **Clinic Annual Plan**:
   - Monthly cost over 12 months: `₹1,499 × 12 = ₹17,988` (1,798,800 paise)
   - Annual plan price: `₹14,999` (1,499,900 paise)
   - Exact Annual Savings: `₹17,988 - ₹14,999 = ₹2,989` (298,900 paise)
   - Percentage: `2,989 / 17,988 ≈ 16.62%` (displayed as `~16.6%` or `Save ₹2,989/year`)

---

## 3. Plan Configuration Module: `server/src/commercial/plan.config.ts`

The authoritative single source of truth is maintained in `server/src/commercial/plan.config.ts`.

```typescript
export interface PlanDefinition {
  code: PlanCode;
  name: string;
  interval: BillingInterval;
  pricePaisa: number;
  currency: 'INR';
  maxVeterinarians: number;
  maxStaff: number; // -1 for unlimited
  maxPatients: number; // -1 for unlimited
  annualSavingsPaisa?: number;
  savingsPercentage?: number;
}
```

### Statutory Disclaimer
Every commercial screen, modal, and pricing display renders the statutory tax notice:
`"Prices shown are exclusive of GST."`
Phase 12 does not calculate or charge GST (deferred to Phase 13).
