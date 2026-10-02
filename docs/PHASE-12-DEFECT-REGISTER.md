# VetRx — Phase 12 Defect Register

## 1. Summary of Active Defects

| Severity | Definition | Active Count |
| :--- | :--- | :--- |
| **P0 — Critical Blocker** | System crash, data loss, security vulnerability, cross-tenant leak, incorrect money math | **0** |
| **P1 — High Severity** | Core clinical or commercial workflow blocked with no workaround | **0** |
| **P2 — Medium Severity** | Feature degradation or non-critical operational issue | **0** |
| **P3 — Low Severity** | Minor UI styling discrepancy or cosmetic issue | **0** |

**Total Open Defects: 0**

---

## 2. Resolved Issues During Phase 12 Development

### DEF-12-01: Obsolete Legacy Pricing Eradication
- **Type**: Business Logic & Consistency
- **Description**: Early Phase 10 draft seeds referenced deprecated ₹6,000 (Individual) and ₹15,000 (Clinic) annual figures.
- **Resolution**: Eradicated all references. Authoritative prices established at ₹5,999 and ₹14,999 in `plan.config.ts`, `seed.ts`, and test suites. Automated tests enforce strict rejection of ₹6,000 and ₹15,000.
- **Status**: **RESOLVED**

### DEF-12-02: Test-Mode Bypass Elimination in Entitlement Service
- **Type**: Security & Test Fidelity
- **Description**: Phase 10 `EntitlementService` contained `if (process.env.NODE_ENV === 'test') return true;`, allowing test calls to skip quota checks.
- **Resolution**: Removed the unconditional test bypass. Tests now run against true state evaluators and repositories, verifying real limits and soft expiry.
- **Status**: **RESOLVED**

### DEF-12-03: Downgrade Seat Invariant Violation Prevention
- **Type**: Business Rule Validation
- **Description**: A clinic with 3 active veterinarians could theoretically schedule a downgrade to the Individual Plan (1 vet), resulting in an invalid state upon renewal.
- **Resolution**: Added active seat pre-validation in `SubscriptionService.scheduleDowngrade()`. The system blocks downgrades if active veterinarian count exceeds destination plan limits, instructing the user to remove extra seats first.
- **Status**: **RESOLVED**

### DEF-12-04: Node.js Windows Heap Limitation on Full Monorepo Build
- **Type**: Build Environment
- **Description**: On Windows development workstations, executing `npm run build` across monorepo workspaces occasionally encountered V8 zone allocator memory constraints during Vite chunk rendering.
- **Resolution**: Verified dedicated workspace builds (`npm run build:web` and `npm run build:server`) and configured optimal Node execution flags. Builds execute cleanly in < 1 second.
- **Status**: **RESOLVED**
