# VetRx Production Deployment Guide (VPS + Docker)

This document provides step-by-step instructions for deploying and maintaining VetRx on the Ubuntu 24.04 production VPS using Docker and NGINX.

---

## 1. System Specifications & Architecture

- **Domain**: `https://vetrx.adcpmalappuram.in`
- **VPS OS**: Ubuntu 24.04 LTS (2 vCPU, 2 GB RAM, 30 GB SSD)
- **Services Architecture**:
  - **Reverse Proxy**: Host-level NGINX with Let's Encrypt SSL terminating at port 443
  - **Frontend Container**: NGINX Alpine serving pre-compiled React 19 static bundle on `127.0.0.1:3000`
  - **Backend Container**: Node.js 22 (non-root `node` user) running compiled Express REST API on `127.0.0.1:4000`
  - **Database Container**: PostgreSQL 16 Alpine running on internal Docker network (`vetrx_prod_network`), isolated from public host ports.

---

## 2. Prerequisites on Ubuntu 24.04 VPS

Install Docker and Docker Compose plugin:

```bash
# Update package repositories
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release nginx wget openssl

# Add Docker's official GPG key & repository
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine & Compose plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker service
sudo systemctl enable --now docker

# Add deploy user to docker group
sudo usermod -aG docker ncms
```

---

## 3. Deployment Directory Setup & Environment Configuration

On the VPS, create the application home:

```bash
sudo mkdir -p /var/www/vetrx
sudo chown -R ncms:ncms /var/www/vetrx
cd /var/www/vetrx
```

Clone or sync the repository:

```bash
git clone https://github.com/shameemalungal/VetRx.git /var/www/vetrx
cd /var/www/vetrx
```

Create `/var/www/vetrx/.env`:

```bash
cp .env.example .env
nano .env
```

Generate strong cryptographically secure production secrets:

```bash
# Generate strong database password
openssl rand -hex 24

# Generate 64-character session secret
openssl rand -hex 32
```

Configure `.env` with production values:

```env
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

APP_URL=https://vetrx.adcpmalappuram.in
API_URL=https://vetrx.adcpmalappuram.in/api
CORS_ORIGIN=https://vetrx.adcpmalappuram.in

# PostgreSQL internal docker credentials
POSTGRES_DB=vetrx_production
POSTGRES_USER=vetrx_app
POSTGRES_PASSWORD=your_generated_secure_db_password_here

# Session settings
SESSION_SECRET=your_generated_64char_session_secret_here
SESSION_TTL_DAYS=30
COOKIE_NAME=vetrx_session

# Google OAuth (Configured in Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://vetrx.adcpmalappuram.in/api/auth/google/callback

# Rate limits
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=120
AUTH_RATE_LIMIT_MAX_REQUESTS=20
```

Protect `.env` permissions:

```bash
chmod 600 .env
```

---

## 4. Building and Starting Production Containers

Build the production containers and deploy database migrations:

```bash
# 1. Pull base images and build production containers
docker compose -f docker-compose.prod.yml build

# 2. Start PostgreSQL first and confirm health
docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml ps

# 3. Apply Prisma database migrations
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy --schema=./prisma/schema.prisma

# 4. Optional: Run seed script if initializing fresh database
docker compose -f docker-compose.prod.yml run --rm backend npm run db:seed

# 5. Start all production services
docker compose -f docker-compose.prod.yml up -d

# 6. Verify service health
docker compose -f docker-compose.prod.yml ps
```

---

## 5. NGINX Host Reverse Proxy Configuration

Configure `/etc/nginx/sites-available/vetrx.adcpmalappuram.in`:

```nginx
server {
    listen 80;
    server_name vetrx.adcpmalappuram.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vetrx.adcpmalappuram.in;

    ssl_certificate /etc/letsencrypt/live/vetrx.adcpmalappuram.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vetrx.adcpmalappuram.in/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Forward REST API calls to the Backend Container
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Request-Id $request_id;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }

    # Forward UI & Static Web Traffic to the Frontend Container
    location / {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Test and reload NGINX:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. Verification and Health Checks

Perform live operational health checks:

```bash
# 1. Backend Liveness Check
curl -i http://127.0.0.1:4000/api/health

# 2. Backend Database Readiness Check
curl -i http://127.0.0.1:4000/api/ready

# 3. Public Domain SSL & Routing Check
curl -i https://vetrx.adcpmalappuram.in/api/health
curl -i https://vetrx.adcpmalappuram.in/api/ready
```

Expected HTTP response for `/api/ready`:

```json
{
  "status": "ready",
  "database": "connected",
  "timestamp": "2026-09-15T..."
}
```

---

## 7. Operational Runbook

### Inspecting Logs
```bash
# Tail backend logs in real time
docker compose -f docker-compose.prod.yml logs -f backend

# Tail frontend web server logs
docker compose -f docker-compose.prod.yml logs -f frontend

# Tail database logs
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Performing Database Backup
```bash
# Backup PostgreSQL database to timestamped SQL dump
mkdir -p /var/backups/vetrx
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U vetrx_app vetrx_production > /var/backups/vetrx/backup-$(date +%Y%m%d-%H%M%S).sql
```

### Restoring Database Backup
```bash
docker compose -f docker-compose.prod.yml exec -T postgres psql -U vetrx_app vetrx_production < /var/backups/vetrx/backup-YYYYMMDD-HHMMSS.sql
```

### Rotating Session Secret
1. Edit `/var/www/vetrx/.env` and update `SESSION_SECRET` with a newly generated 64-character random string.
2. Restart backend:
   ```bash
   docker compose -f docker-compose.prod.yml restart backend
   ```
*(Note: Rotating session secret invalidates existing user sessions, safely prompting users to re-authenticate.)*

### Safe Zero-Downtime Application Updates
```bash
cd /var/www/vetrx
git pull origin main
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy --schema=./prisma/schema.prisma
docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend
```
