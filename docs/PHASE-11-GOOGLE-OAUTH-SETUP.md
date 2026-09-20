# VetRx — Phase 11 Google OAuth Setup Guide

## 1. Overview

VetRx integrates Google OAuth 2.0 with OpenID Connect (OIDC) alongside existing email/password authentication. The architecture follows RFC 7636 (PKCE with S256 challenge method) and strictly validates ID tokens (issuer `accounts.google.com`, audience match, expiration) before resolving identity.

Secrets remain exclusively on the backend server. The client application never receives or handles client secrets.

---

## 2. Google Cloud Project Configuration

### Step 1: Create or Select GCP Project
1. Navigate to [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a project: `VetRx-Production` (or `VetRx-Staging`).

### Step 2: Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**.
2. **User Type**: External.
3. **App Information**:
   - App name: `VetRx Veterinary Practice Management`
   - User support email: Select authorized support email (e.g. `support@adcpmalappuram.in`)
   - App logo: Approved VetRx logo
4. **App Domain**:
   - Application home page: `https://vetrx.adcpmalappuram.in`
   - Application privacy policy link: `https://vetrx.adcpmalappuram.in/privacy`
   - Application terms of service link: `https://vetrx.adcpmalappuram.in/terms`
5. **Authorized Domains**:
   - Add `adcpmalappuram.in`
6. **Scopes**:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`

---

## 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
2. **Application Type**: Web application.
3. **Name**: `VetRx Web Client`.
4. **Authorized JavaScript Origins**:
   - Production: `https://vetrx.adcpmalappuram.in`
   - Local Development: `http://localhost:5173`, `http://localhost:4000`
5. **Authorized Redirect URIs**:
   - Production: `https://vetrx.adcpmalappuram.in/api/auth/google/callback`
   - Local Development: `http://localhost:4000/api/auth/google/callback`
6. Click **Create** and securely note:
   - Client ID (e.g., `xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com`)
   - Client Secret (e.g., `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx`)

---

## 4. Environment Configuration

### Local Development (`.env`)
```bash
GOOGLE_CLIENT_ID=your-dev-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-dev-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
```

### Production VPS (`/home/ncms/VetRx/.env`)
```bash
GOOGLE_CLIENT_ID=your-prod-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-prod-client-secret
GOOGLE_CALLBACK_URL=https://vetrx.adcpmalappuram.in/api/auth/google/callback
```

> [!CAUTION]
> NEVER commit `.env` files or Google client secrets to Git. Maintain secrets on the production host using file permissions `600`.

---

## 5. Security & Verification Checklist

- [x] Server-side code exchange (`https://oauth2.googleapis.com/token`)
- [x] PKCE code_verifier (32-byte base64url) and S256 code_challenge
- [x] Cryptographic state nonce stored in short-lived HTTP-only cookie (`vetrx_oauth_state`)
- [x] ID token claims validation (iss, aud, exp, sub)
- [x] Verified email enforcement (`email_verified === true`)
- [x] Stable provider subject (`sub`) stored as primary provider identifier
- [x] Server-side session generation (`vetrx_session` HttpOnly cookie)
