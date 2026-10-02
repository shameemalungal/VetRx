# VetRx — Phase 11 Google Cloud OAuth Configuration Checklist

## 1. Google Cloud Console Configuration

### 1.1 Project & OAuth Consent Screen
1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Google Cloud Project (or create `VetRx-Production`)
3. Go to **APIs & Services** → **OAuth consent screen**
4. **User Type**:
   - Select **External** (unless restricting to an internal Google Workspace organization)
5. **App Information**:
   - **App name**: `VetRx` (or `VetRx Veterinary Practice Management`)
   - **User support email**: Authorized administrative email (e.g. `support@adcpmalappuram.in`)
   - **App logo**: Optional during testing / production logo
6. **App Domain**:
   - **Application home page**: `https://vetrx.adcpmalappuram.in`
   - **Application privacy policy link**: `https://vetrx.adcpmalappuram.in/privacy`
   - **Application terms of service link**: `https://vetrx.adcpmalappuram.in/terms`
   - **Authorized domains**: `adcpmalappuram.in`
7. **Developer Contact Information**:
   - Administrative email address
8. **Scopes**:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   *(These are non-sensitive standard OpenID Connect scopes)*
9. **Test Users** (If app status is **Testing**):
   - Add the specific Gmail / Google accounts that will be used for testing (e.g., your test Google accounts)
   - *Note: While in "Testing" publishing status, only users added to the Test Users list can authenticate without an authorization error.*

---

## 2. OAuth 2.0 Client Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. **Application type**: **Web application**
4. **Name**: `VetRx Web Client (Production)`
5. **Authorized JavaScript origins**:
   - `https://vetrx.adcpmalappuram.in`
6. **Authorized redirect URIs**:
   - `https://vetrx.adcpmalappuram.in/api/auth/google/callback`

> [!CRITICAL]
> **Redirect URI Exact Match**:
> - Must be EXACTLY `https://vetrx.adcpmalappuram.in/api/auth/google/callback`
> - Scheme: `https` (not http)
> - Subdomain: `vetrx`
> - Path: `/api/auth/google/callback`
> - Trailing slash: **NO** trailing slash
> Any discrepancy will trigger Google's `redirect_uri_mismatch` error (Error 400).

---

## 3. Production VPS Credential Deployment

Once the Client ID and Client Secret are generated in Google Cloud Console:

1. Connect to VPS:
   ```bash
   ssh ncms@109.122.56.148
   ```
2. Edit `/home/ncms/VetRx/.env`:
   ```bash
   nano /home/ncms/VetRx/.env
   ```
3. Populate the exact keys:
   ```env
   GOOGLE_CLIENT_ID=<REDACTED_GOOGLE_CLIENT_ID>.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=<REDACTED_GOOGLE_CLIENT_SECRET>
   GOOGLE_CALLBACK_URL=https://vetrx.adcpmalappuram.in/api/auth/google/callback
   ```
4. Restart the backend container safely:
   ```bash
   cd /home/ncms/VetRx
   docker compose -f docker-compose.prod.yml up -d --no-deps backend
   ```
5. Verify health:
   ```bash
   curl -i http://localhost:4000/api/health
   curl -i http://localhost:4000/api/ready
   ```
