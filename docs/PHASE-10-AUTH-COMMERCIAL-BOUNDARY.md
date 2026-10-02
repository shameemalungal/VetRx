# VetRx Phase 10 — Auth & Commercial Boundary

**Version**: 1.0  
**Domain**: Identity, Multi-Provider Architecture & Account Linking Governance  

---

## 1. Identity & Tenancy Mapping

VetRx decouples user identity from practice tenancy. A single authenticated identity maps to one or more practices through the `PracticeMember` role-based membership join model:

```
AuthIdentity (Google / Password)
       ↓
     User
       ↓
 PracticeMember (Role: PRACTICE_OWNER / PRACTICE_ADMIN / PRACTICE_STAFF)
       ↓
   Practice (The Commercial Tenant)
       ↓
  Subscription / Payment / Entitlements
```

---

## 2. Multi-Provider Compatibility

The `AuthIdentity` table supports multiple authentication providers:
- `provider: "password"`: Standard email + salted bcrypt password hash.
- `provider: "google"`: Google OAuth 2.0 / OpenID Connect subject ID (`providerUserId: sub`).
- `provider: "future_mykgvoa"`: Legacy placeholder (inactive, not in roadmap).

Each record in `AuthIdentity` maintains a composite unique constraint: `@@unique([provider, providerUserId])`.

---

## 3. Mandatory Account-Linking Rules

When Google Authentication is activated in Phase 11, the following non-negotiable security rules govern identity linking:

### Rule 1: No Blind Account Merging
If a user authenticates via Google with email `doctor@example.com`, and a pre-existing password account exists with that same normalized email:
- The system **MUST NOT** silently merge the accounts.
- The system **MUST NOT** automatically attach the Google identity to the existing user ID.
- The system **MUST NOT** create an orphaned second practice.
- The system **MUST** reject the login with `409 ACCOUNT_COLLISION` ("An account with this email address already exists. Please sign in with your email and password to link your Google account.").

### Rule 2: Explicit Authenticated Linking
Account linking is permitted **only when the user is already authenticated** within an active session using their existing credentials. From within authenticated account settings, the user may explicitly link their Google identity after proving ownership of the primary credentials.

### Rule 3: Single Commercial Tenant per Practice
A practice has exactly one primary owner (`Practice.ownerUserId`). Linking an additional identity provider to the owner's `User` account does not create a new practice or duplicate subscription entitlements.

---

## 4. Phase 10 Boundary Invariants

- **NO Google OAuth UI**: No "Sign in with Google" buttons or modal dialogues are added to the frontend in Phase 10.
- **NO Google Redirect Routes**: No public `/api/auth/google` redirect endpoints are activated in Phase 10.
- **Full Implementation Deferred to Phase 11**: All Google OAuth client configurations, SDKs, and callback handlers are formally scheduled for Phase 11.
