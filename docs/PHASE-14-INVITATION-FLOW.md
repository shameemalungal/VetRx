# VetRx Phase 14 — Invitation Architecture & Account Linking Flow

## 1. Invitation Lifecycle Overview

```
Practice Admin / Owner
         ↓
POST /api/practice/invitations
         ↓
Cryptographic Random Token (32-bytes)
         ↓
SHA-256 Hash stored in DB (Expires in 7 days)
         ↓
User receives raw token link
         ↓
User authenticates (Existing User OR New Registration via Email / Google)
         ↓
POST /api/practice/invitations/accept
         ↓
Verify Token Hash & Status (PENDING)
         ↓
Verify Expiration (now < expiresAt)
         ↓
Verify Email Matches Invitee Email
         ↓
Verify Commercial Seat Availability (VETERINARIAN)
         ↓
Atomic DB Transaction:
  1. PracticeInvitation status = ACCEPTED
  2. Upsert PracticeMember (role = invitation.role, isActive = true)
  3. Record AuditLog (INVITATION_ACCEPTED)
```

---

## 2. Token Security & Cryptography
- **Generation**: Generated via Node.js CSPRNG (`crypto.randomBytes(32).toString('hex')`).
- **Storage**: Only the SHA-256 hash (`crypto.createHash('sha256').update(rawToken).digest('hex')`) is persisted in `PracticeInvitation.tokenHash`.
- **One-Time Consumption**: Once consumed, the status transitions to `ACCEPTED`. Reusing the token returns `409 INVITATION_ALREADY_ACCEPTED`.
- **Revocation**: Can be revoked at any time by administrators (`POST /api/practice/invitations/:id/revoke`), setting status to `REVOKED`.
- **Expiration**: Invitations expire after 7 days (`expiresAt`). Attempting to accept an expired invitation returns `400 INVITATION_EXPIRED`.

---

## 3. Account Linking with Existing Users & Google Auth
- **Existing Users**: If an invited email already exists in VetRx, accepting the invitation links that existing `User` to the new practice via `PracticeMember`. No duplicate `User` accounts are created.
- **New Users**: Unregistered invitees can sign up via email/password or Google OAuth.
- **Identity Integrity**: The user account accepting the token must match the email on the invitation (`INVITATION_EMAIL_MISMATCH`). An imposter cannot hijack an invitation sent to another email address.

---

## 4. Commercial Seat Limit Integration
- **Veterinarian Invitations**: When inviting with role `VETERINARIAN`, `EntitlementService.assertCanAddSeat(practiceId, Role.VETERINARIAN)` is evaluated both:
  1. At creation time (preventing issuance of invalid invites).
  2. At acceptance time (preventing race conditions if seats filled up while invite was pending).
- **Staff Invitations**: Staff and Read-Only roles are unlimited on both Individual and Clinic plans and do not consume veterinarian seats.
