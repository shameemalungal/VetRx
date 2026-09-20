# VetRx Phase 10 — Commercial API Contract

**Version**: 1.0  
**Base Path**: `/api/commercial`  
**Security Standard**: `requireAuth` + `requirePractice`  

---

## 1. Authentication & Security Middleware

All commercial endpoints require an active, authenticated session cookie (`vetrx_session`) or `Authorization: Bearer <token>`.

### Request Context Derivation
The server derives tenant context internally:
- `req.user`: Authenticated user identity.
- `req.practice`: Active practice tenant derived from `PracticeMember`.

**Client Spoofing Resistance**: If a client includes `practiceId` in query parameters or request bodies, it is strictly ignored or rejected. All queries are scoped strictly to `req.practice.id`.

---

## 2. Endpoints Specification

### 1. `GET /api/commercial/status`
Returns the high-level commercial account status for the authenticated practice.

- **Access**: `PRACTICE_OWNER`, `PRACTICE_ADMIN`, `PRACTICE_STAFF`
- **Request Headers**: `Cookie: vetrx_session=...`

#### Success Response (HTTP 200 OK)
```json
{
  "practiceId": "11111111-1111-1111-1111-111111111111",
  "status": "UNRESTRICTED",
  "activePlan": {
    "code": "TRIAL",
    "name": "Full Access Evaluation",
    "billingInterval": "ONE_TIME"
  },
  "isPastDue": false,
  "isInGracePeriod": false,
  "isExpired": false,
  "daysRemainingInPeriod": null,
  "periodEnd": null
}
```

---

### 2. `GET /api/commercial/subscription`
Returns detailed active subscription information for the authenticated practice.

- **Access**: `PRACTICE_OWNER`, `PRACTICE_ADMIN`
- **Request Headers**: `Cookie: vetrx_session=...`

#### Success Response (HTTP 200 OK — Active Subscription Exists)
```json
{
  "id": "sub_12345",
  "practiceId": "11111111-1111-1111-1111-111111111111",
  "status": "TRIAL",
  "plan": {
    "id": "plan_trial_01",
    "code": "TRIAL",
    "name": "Trial Plan",
    "pricePaisa": 0,
    "currency": "INR",
    "interval": "ONE_TIME",
    "maxUserSeats": 1
  },
  "currentPeriodStart": "2026-09-20T00:00:00.000Z",
  "currentPeriodEnd": "2026-10-04T00:00:00.000Z",
  "cancelAtPeriodEnd": false,
  "cancelledAt": null,
  "gracePeriodEndsAt": null
}
```

#### Neutral Response (HTTP 200 OK — No Subscription Record Yet)
```json
{
  "subscription": null,
  "message": "Practice is in default foundational trial access."
}
```

---

### 3. `GET /api/commercial/entitlements`
Returns resolved capabilities, feature flags, and seat quotas for the authenticated practice.

- **Access**: All authenticated practice members
- **Request Headers**: `Cookie: vetrx_session=...`

#### Success Response (HTTP 200 OK)
```json
{
  "practiceId": "11111111-1111-1111-1111-111111111111",
  "status": "UNRESTRICTED",
  "planCode": "DEFAULT_FOUNDATION",
  "planName": "Standard Practice Access",
  "features": {
    "canCreatePatients": true,
    "canCreatePrescriptions": true,
    "canUseSmartDose": true,
    "canUseTreatmentPackages": true,
    "canCreateInvoices": true,
    "canGeneratePdf": true,
    "canExportData": true,
    "maxUserSeats": 10
  },
  "quotas": {
    "activeSeatsCount": 1,
    "maxSeatsAllowed": 10
  },
  "isReadOnly": false,
  "expiresAt": null,
  "gracePeriodEndsAt": null
}
```

---

## 3. Standard Error Responses

- **401 UNAUTHORIZED**: Missing, expired, or invalid session token.
- **403 NO_ACTIVE_PRACTICE**: User has no active practice membership.
- **404 NOT_FOUND**: Resource not found or belongs to another tenant.
