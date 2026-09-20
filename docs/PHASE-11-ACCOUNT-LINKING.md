# VetRx — Phase 11 Account Linking Architecture

## 1. Core Identity Principle

VetRx maintains a unified commercial tenancy and user model:

```
User
 ├── AuthIdentity: password
 └── AuthIdentity: google
           │
           ▼
     PracticeMember
           │
           ▼
        Practice
```

Authentication via Email/Password or Google MUST resolve to **one underlying VetRx account**.

---

## 2. Deterministic Account Resolution Matrix

| Scenario | Condition | Action Taken | Resulting Entities |
| :--- | :--- | :--- | :--- |
| **Case A: Existing Email User** | User registered with email/password; later signs in via Google with same verified email (`email_verified: true`) | Locate existing `User`. Attach new `AuthIdentity(provider: google, providerUserId: sub)`. Create standard `vetrx_session`. | **0 duplicate Users, 0 duplicate Practices, 0 duplicate PracticeMembers**. Existing practice & data preserved. |
| **Case B: Existing Google User** | `AuthIdentity(provider: google, providerUserId: sub)` already exists | Fetch associated `User`. Resolve `PracticeMember` and `Practice`. Issue standard session. | Authenticates existing user directly. |
| **Case C: New Google User** | No existing user or identity with matching email | Create `User` + `AuthIdentity(google)` + `Practice` + `PracticeMember` + `PracticeSettings` in an atomic database transaction. | Fresh practitioner tenant created. |
| **Case D: Unverified Email Claim** | Google returns unverified email (`email_verified: false`) | **Reject with 409 UNVERIFIED_OAUTH_EMAIL**. Do NOT merge or authenticate. | Zero account modification. Prevents identity spoofing. |
| **Explicit Linking (Settings)** | Authenticated user clicks "Connect Google" | Starts OAuth flow with `action=link`. Verifies Google `sub` is not attached to any other user. Links identity to current user. | Google connected to active user account. |
| **Identity Collision** | Google account is already attached to User B, but User A tries to link it | **Reject with 409 GOOGLE_IDENTITY_ALREADY_LINKED**. | No unauthorized cross-user takeover. |
| **Unlinking Google** | User requests Google disconnect | Checks `hasPassword`. If user has no password configured, **rejects with 400 CANNOT_REMOVE_LAST_AUTH_METHOD**. If password configured, removes Google `AuthIdentity`. | Prevents practitioner account lockout. |

---

## 3. Email Normalization Policy

All emails are normalized identically across the entire application:
```typescript
const normalizedEmail = email.toLowerCase().trim();
```

No provider-specific case manipulation or dotted Gmail tricks are permitted to bypass identity lookups.

---

## 4. Account Management Operations

### Set Password (`POST /api/auth/password/set`)
Available to users created via Google OAuth who do not yet have a password.
- Requires user to be authenticated.
- Enforces VetRx password strength policy (min 8 characters, alphanumeric).
- Creates `AuthIdentity(provider: 'password')` with bcrypt hash ($2b$, cost 12).

### Change Password (`POST /api/auth/password/change`)
Available to users with an existing password.
- Verifies current password against existing bcrypt hash before updating.
- Updates password hash and logs security audit event.

### Unlink Google (`DELETE /api/auth/identities/google`)
- Verified that at least one alternate authentication method remains (i.e. password).
- Deletes Google `AuthIdentity` record safely without mutating user or practice tenancy.
