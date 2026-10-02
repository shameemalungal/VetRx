# VetRx — Phase 12 Entitlements & Seat Limits

## 1. Entitlement Engine Architecture

The VetRx Entitlement Engine (`EntitlementService`) evaluates whether an authenticated practice and practitioner possess the necessary quota, seat count, and active subscription status to perform clinical and administrative actions.

---

## 2. Plan Entitlements & Limits Matrix

| Feature / Quota | 14-Day Trial | Individual (Monthly/Annual) | Clinic (Monthly/Annual) | Enterprise |
| :--- | :--- | :--- | :--- | :--- |
| **Veterinarian Seats** | 1 Veterinarian | Strictly 1 Veterinarian | Up to 5 Veterinarians | Custom / Unlimited |
| **Staff Members** | Unlimited | Unlimited | Unlimited | Unlimited |
| **Patient Quota** | Max 10 Patients | **Unlimited** | **Unlimited** | **Unlimited** |
| **Records / Patient** | Max 5 Records / Patient | **Unlimited** | **Unlimited** | **Unlimited** |
| **Treatment Packages** | Max 5 Packages | **Unlimited** | **Unlimited** | **Unlimited** |
| **Custom Medicines** | Max 10 Additions | **Unlimited** | **Unlimited** | **Unlimited** |
| **Smart Dose Engine** | Included | Included | Included | Included |
| **Print & PDF Engine** | Included | Included | Included | Included |
| **Billing & Invoices** | Included | Included | Included | Included |
| **Data Export** | Included | Included | Included | Included |

---

## 3. Practitioner Seat Rules

### 3.1 Individual Plan (Solo Practice)
- Allows strictly **1 active Veterinarian** (`PRACTICE_OWNER`).
- Attempting to invite or assign a 2nd user as a veterinarian is rejected with HTTP 403 `SEAT_LIMIT_REACHED`.
- Support staff (receptionists, compounders, administrative assistants) assigned non-veterinarian roles (`PRACTICE_ADMIN`, `PRACTICE_STAFF`) can be added without limit.

### 3.2 Clinic Plan (Group Practice)
- Supports up to **5 active Veterinarians**.
- The 6th veterinarian invite or assignment is rejected with HTTP 403 `SEAT_LIMIT_REACHED`.
- Supports unlimited support staff.

### 3.3 Enterprise Tier
- Negotiated seat allocations and multi-location management for large referral hospitals and academic clinics.

---

## 4. Enforcement Integration Points

Entitlement checks are executed synchronously in the API controllers before mutating database state:

```typescript
// Patients
POST /api/clinical/patients
  -> EntitlementService.assertCanCreatePatient(practiceId)

// Prescriptions
POST /api/clinical/prescriptions
  -> EntitlementService.assertCanCreateRecord(practiceId, patientId)

// Invoices & Receipts
POST /api/clinical/invoices
  -> EntitlementService.assertCanCreateRecord(practiceId, patientId)

// Treatment Packages
POST /api/clinical/packages
  -> EntitlementService.assertCanCreatePackage(practiceId)

// Formulary Additions
POST /api/clinical/medicines
  -> EntitlementService.assertCanAddMedicine(practiceId)

// Team Members
POST /api/practice/members
  -> EntitlementService.assertCanAddVeterinarian(practiceId, role)
```

---

## 5. Elimination of Test-Mode Bypass

In Phase 10, tests bypassed entitlement checks via `if (process.env.NODE_ENV === 'test') return true;`. In Phase 12, this bypass has been completely eliminated. All automated tests now test real entitlement logic, limits, soft expiry, and seat counters against deterministic in-memory mock repositories and database instances.
