# VetRx Phase 11 — Google Auth Billing Diagnostic & Architecture Report

## 1. Executive Summary

- **Question**: Is ₹1,000 actually required to activate Google Sign-In for VetRx?
- **Authoritative Answer**: **NO. ABSOLUTELY NOT.**
- **Finding**: Google OAuth 2.0 / OpenID Connect authentication using standard identity scopes (`openid`, `email`, `profile`) is **100% FREE** and **does NOT require a Google Cloud Billing Account**, credit card, or payment of any kind.
- **Root Cause of ₹1,000 prompt**: Google Cloud Console prompts for a ₹1,000 refundable advance / verification mandate when creating or linking a **Google Cloud Billing Account** in India (under RBI e-mandate card verification rules) or when clicking "Activate Cloud Free Trial / Set up Billing". This is completely unnecessary for Google OAuth.

---

## 2. VetRx Implementation Audit

| Component | VetRx Implementation | Paid Service? |
| :--- | :--- | :--- |
| **OAuth Provider** | Server-side `GoogleOAuthProvider` via standard OIDC | **NO** (Free standard OIDC) |
| **Google Endpoints** | Authorization: `https://accounts.google.com/o/oauth2/v2/auth`<br>Token Exchange: `https://oauth2.googleapis.com/token`<br>UserInfo: `https://www.googleapis.com/oauth2/v3/userinfo` | **NO** (Free standard endpoints) |
| **Scopes Requested** | `openid`, `email`, `profile` | **NO** (Standard non-sensitive scopes) |
| **Google APIs Used** | None outside OAuth 2.0 / UserInfo endpoints | **NO** |
| **Google Identity Services (GIS)** | Not used on client; VetRx uses direct server-side OAuth redirect with PKCE | **NO** |
| **Paid Google Cloud APIs** | None (No Maps API, no Drive API, no Cloud Translation, no Vision) | **NO** |
| **Client Type** | OAuth 2.0 Client ID -> **Web application** | **NO** |
| **Callback URL** | `https://vetrx.adcpmalappuram.in/api/auth/google/callback` | **NO** |

---

## 3. Critical Scope Check

VetRx requests **only** three basic OpenID Connect identity scopes:
1. `openid`: Enables OpenID Connect standard token issuance (`id_token`).
2. `email`: Retrieves practitioner's email address and verification status (`email_verified`).
3. `profile`: Retrieves practitioner's name and avatar picture (`name`, `picture`).

### Scope Classification under Google OAuth Policies:
- **Non-sensitive scopes**: `openid`, `email`, `profile` are classified by Google as **non-sensitive**.
- They do **not** require Google App Verification.
- They do **not** require CASA security assessments.
- They do **not** require YouTube / Drive / Gmail API permissions.
- They do **not** trigger any billing or commercial fee.

---

## 4. Google Cloud Billing Diagnosis: Why Google is asking for ₹1,000

In India, whenever a user clicks:
- **"Activate Free Trial"** ($300 / ₹25,000 credit banner at the top of Google Cloud Console), OR
- **"Billing"** in the left navigation sidebar, OR
- **"Link a billing account"** to the project,

Google Cloud prompts the user to create a **Cloud Billing Account**. 

Under Reserve Bank of India (RBI) regulations for recurring payments and card auto-debit verification (e-mandate guidelines), Google Cloud charges a **₹1,000 refundable pre-authorization / advance credit** to verify Indian credit or debit cards.

### Critical Distinction:
- **Google Cloud Platform (GCP) Infrastructure / APIs**: Compute Engine, Cloud Run, Cloud Storage, Google Maps Platform — **REQUIRES BILLING ACCOUNT**.
- **Google Cloud OAuth 2.0 Client Credentials**: Sign-In with Google, OAuth Consent Screen, Client ID & Secret for web authentication — **DOES NOT REQUIRE A BILLING ACCOUNT**.

You can create projects, create OAuth 2.0 Client IDs, configure OAuth consent screens, and authenticate users with Google Sign-In on a Google Cloud project with **NO billing account attached**.

---

## 5. Google Auth Platform Configuration

Google Cloud Console has updated its navigation menu to **Google Auth Platform** (or **APIs & Services**):

| Section | Required Action for VetRx | Billing Needed? |
| :--- | :--- | :--- |
| **Branding / App Information** | Set App Name (`VetRx`), Support Email, Developer Email. (Do not upload custom logo initially to avoid unnecessary logo review). | **NO** |
| **Audience** | Set to **External**. App status: **Testing** (initially) or **In Production** (with non-sensitive scopes). | **NO** |
| **Data Access / Scopes** | Select only non-sensitive scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. | **NO** |
| **Clients / Credentials** | Create **OAuth client ID** -> **Web application**. Add origin `https://vetrx.adcpmalappuram.in` and redirect URI `https://vetrx.adcpmalappuram.in/api/auth/google/callback`. | **NO** |
| **Verification** | Since only non-sensitive scopes are used, **NO verification is required** by Google Trust & Safety. | **NO** |

---

## 6. Test Users Configuration (Zero Friction Testing)

While your OAuth consent screen is in **Testing** status:
1. Google allows up to **100 test users** (specific `@gmail.com` or Google Workspace accounts).
2. Go to **APIs & Services** → **OAuth consent screen** (or **Audience**).
3. Under **Test users**, click **+ ADD USERS**.
4. Add the email address of:
   - Your primary testing Google account (e.g. your personal or practice Gmail).
   - Any secondary test Google account.
5. Click **SAVE**.

### Benefits of Testing Mode:
- Zero verification required from Google.
- Immediate activation.
- Zero cost, zero billing account needed.
- Only users listed under "Test users" can authenticate during this phase.

---

## 7. Production Domain & Callback

- **Production Domain**: `https://vetrx.adcpmalappuram.in`
- **Authorized JavaScript Origin**: `https://vetrx.adcpmalappuram.in`
- **Authorized Redirect URI**: `https://vetrx.adcpmalappuram.in/api/auth/google/callback`

---

## 8. What is Required NOW vs LATER

### REQUIRED NOW (Zero Cost, No Billing):
1. Keep the Google Cloud project in the free tier with **no billing account**.
2. Configure **OAuth consent screen** with non-sensitive scopes (`openid`, `email`, `profile`).
3. Add your testing Google account to **Test users**.
4. Generate **OAuth 2.0 Web Client ID & Client Secret**.
5. Add Authorized Redirect URI: `https://vetrx.adcpmalappuram.in/api/auth/google/callback`.
6. Add the Client ID and Secret to `/home/ncms/VetRx/.env` on the VPS.
7. Restart backend container (`docker compose -f docker-compose.prod.yml up -d --no-deps backend`).

### REQUIRED LATER (For Public Launch / General Public Access):
1. Switch OAuth publishing status from **Testing** to **In Production** in OAuth consent screen.
2. Because VetRx only requests non-sensitive scopes (`openid`, `email`, `profile`), Google **does not require app verification** even in production (as long as no sensitive/restricted scopes and no custom logo requiring copyright verification are submitted).
3. Still requires **NO billing account** and **₹0 payment**.

---

## 9. Action Checklist

- [ ] **DO NOT** click "Activate Free Trial" or "Set up Billing".
- [ ] **DO NOT** pay ₹1,000 or enter credit card information.
- [ ] In Google Cloud Console, navigate directly to **APIs & Services** → **Credentials**.
- [ ] Under Credentials, locate or create an **OAuth 2.0 Client ID** (Web application).
- [ ] Copy the **Client ID** and **Client Secret**.
- [ ] Enter them into `/home/ncms/VetRx/.env` on VPS `109.122.56.148`.
