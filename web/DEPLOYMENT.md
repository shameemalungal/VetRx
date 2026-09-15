# VetRx Production Deployment Guide

Target Deployment Host: `https://vetrx.adcpmalappuram.in`  
Application Type: Single Page Application (SPA) / Progressive Web Application  
Storage Model: Offline-First Client-Side (IndexedDB via Dexie.js) — **No cloud database synchronization required**.

---

## 1. System Requirements

* **Node.js**: `v20.x` or `v22.x` / `v24.x` (LTS recommended)
* **Package Manager**: `npm` (`v10.x` or higher)
* **Web Server**: Any standard HTTP web server capable of static file hosting with SPA fallback (e.g., NGINX, Apache, Caddy, Cloudflare Pages, Netlify, AWS S3 + CloudFront).

---

## 2. Build & Packaging Instructions

From the `web/` directory:

```bash
# 1. Install dependencies cleanly
npm ci

# 2. Run type-checking and build production distribution
npm run build
```

The output artifacts will be placed in:
```text
c:\Antigravity\VetRx\web\dist
```

---

## 3. Web Server Configuration

### 3.1 Domain & HTTPS Requirement
* **Domain**: `vetrx.adcpmalappuram.in`
* **Base URL Path**: `/` (Root domain/subdomain deployment)
* **HTTPS**: **Mandatory**. Modern browser security requires HTTPS for secure IndexedDB storage persistence (`navigator.storage.persist()`) and modern web APIs.

### 3.2 SPA Route Fallback (Critical)
VetRx uses client-side routing via React Router. The web server **must serve `index.html` for all request paths** that do not correspond to existing static asset files (such as `/patients`, `/prescriptions`, `/invoices`, `/settings`).

#### Example NGINX Configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name vetrx.adcpmalappuram.in;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    root /var/www/vetrx/dist;
    index index.html;

    # Gzip / Brotli Compression
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    # Static assets with hash in filename (cache immutably for 1 year)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # Favicon and public assets
    location ~* \.(svg|png|ico|json)$ {
        expires 1d;
        add_header Cache-Control "public, max-age=86400";
        try_files $uri =404;
    }

    # SPA Fallback: route everything else to index.html
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name vetrx.adcpmalappuram.in;
    return 301 https://$host$request_uri;
}
```

#### Example Apache Configuration (`.htaccess`):
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

#### Example Caddyfile:
```caddy
vetrx.adcpmalappuram.in {
    root * /var/www/vetrx/dist
    file_server
    try_files {path} /index.html
}
```

---

## 4. Local-First Architecture & Data Safety

* **Storage Engine**: VetRx operates entirely in the practitioner's browser IndexedDB (`VetRxDB`).
* **No Remote Telemetry**: Patient medical data, prescriptions, and financial ledgers never leave the device.
* **Pre-Deployment Backup**:
  - Before upgrading an active deployment or switching devices, navigate to **Settings → Data Management (Backup & Restore)**.
  - Click **Download Full Backup (.json)**.
  - Retain the downloaded `vetrx-backup-YYYY-MM-DD.json` file in a secure location.
* **Restore Process**:
  - On the target browser/device, open **Settings → Data Management**.
  - Select **Restore from Backup**, review the verified record counts and schema version, and confirm replacement.
  - An automatic in-memory safety snapshot is generated prior to replacement.

---

## 5. Post-Deployment Smoke-Test Checklist

After deploying the `dist/` directory to `https://vetrx.adcpmalappuram.in`, verify:

1. **Root Load**: `https://vetrx.adcpmalappuram.in/` loads the Dashboard with green/teal branding and zero console errors.
2. **SPA Direct Route Reload**: Navigate to `https://vetrx.adcpmalappuram.in/settings` and press browser Refresh (`Ctrl+R` / `Cmd+R`). Confirm that the server serves `index.html` and does not return 404.
3. **Backup & Restore Card**: Open **Settings → Practitioner & Clinic**, confirm the **Data Management (Backup & Restore)** card appears, and verify the Browser Storage Status pill is visible.
4. **Data Export Test**: Click **Download Full Backup (.json)** and confirm a `.json` backup file is downloaded with correct record structures.
5. **Prescription Builder**: Navigate to `/prescriptions/new`, select a patient, add a medication, and verify dosage calculations and smart dosing helpers function properly.
6. **Mobile Form Factor**: Open DevTools responsive device mode (or mobile device at 375px/390px width) to confirm the floating mobile bottom navigation displays with zero horizontal clipping.
7. **Statutory Invoice Headers**: Open `/invoices` to confirm the authorized signatory and standard veterinary headers render properly.

---

## 6. Rollback Guidance

If a newly deployed bundle exhibits issues on the hosting server:
1. Re-point the web server's root directory (`root` in NGINX or Caddy) to the previous `dist/` directory.
2. Reload web server configurations (`nginx -s reload`).
3. Since client data is stored locally in the practitioner's browser IndexedDB with backward-compatible schema versioning (v1 through v5), rolling back static frontend assets does not destroy or alter existing IndexedDB records.
