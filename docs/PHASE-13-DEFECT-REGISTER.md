# VetRx — Phase 13 Defect Register

## 1. Summary of Active Defects

| Severity | Definition | Active Count |
| :--- | :--- | :--- |
| **P0 — Critical Blocker** | System crash, data loss, security vulnerability, cross-tenant leak, money math error | **0** |
| **P1 — High Severity** | Core payment or subscription workflow blocked with no workaround | **0** |
| **P2 — Medium Severity** | Feature degradation or non-critical payment reconciliation delay | **0** |
| **P3 — Low Severity** | Minor UI styling discrepancy or cosmetic message nuance | **0** |

**Total Open Defects: 0**

---

## 2. Tracked Items During Phase 13 Development

| Defect ID | Description | Status | Resolution |
| :--- | :--- | :--- | :--- |
| `DEF-13-01` | SURL Browser return without backend verification vulnerability | RESOLVED | Architected mandatory server-to-server `verify_payment` check before any subscription activation. |
| `DEF-13-02` | Client amount tampering vulnerability | RESOLVED | Enforced server-side plan configuration derivation. Any client-provided amount is ignored and rejected. |
| `DEF-13-03` | Replay attacks on webhook receiver | RESOLVED | Enforced Prisma unique constraint `[provider, eventId]` on `PaymentEvent` for deterministic idempotency. |
| `DEF-13-04` | Non-integer rupee floating point representation | RESOLVED | All amounts stored and computed strictly as integer minor units (paise). |
