# VetRx — Modern Veterinary Practitioner Platform

VetRx is a high-efficiency veterinary practitioner web platform designed for clinical workflows: Patient Records, Prescription Writing, Optional Dose Calculations, Treatment Packages, Invoices, and Practice Management.

---

## 🏗️ Architecture (Stage 0 + Stage 1)

VetRx is structured as a robust, production-grade monorepo:

```text
VetRx/
├── web/                    # React 19 + Vite frontend (SPA with IndexedDB fallback)
├── server/                 # Node.js + TypeScript Express REST API
├── prisma/                 # Normalized multi-tenant PostgreSQL schema & migrations
├── docker-compose.yml      # Local development Docker Compose stack
├── docker-compose.prod.yml # Production VPS Docker Compose stack
├── .env.example            # Environment configuration template
├── DEPLOYMENT.md           # Ubuntu 24.04 VPS deployment & operations runbook
└── README.md
```

### Key Technical Highlights
- **Multi-Tenant Practice Isolation**: Every clinical and configuration entity is strictly bounded by `practiceId`. Tenant access is resolved server-side from session membership, ignoring untrusted client headers.
- **Secure Server-Managed Sessions**: HTTP-Only, SameSite=Lax cookies containing raw random tokens verified against SHA-256 database hashes.
- **Dual Authentication**:
  - **Google OAuth 2.0 (OpenID Connect)** with CSRF state protection.
  - **Email & Password** with Argon2/bcrypt hashing (cost 12), password strength enforcement, and atomic practice registration.
  - Collision protection: does not silently merge password accounts on Google email match.
- **Local-First Safety**: Existing IndexedDB clinical records remain safe and operational while backend authentication gates the practice workspace.
- **Docker-Based Deployment**: Multi-stage, non-root Node 22 backend container and NGINX Alpine static web container.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v20+ or v22+
- **npm**: v10+
- **PostgreSQL**: Local instance or Docker container (`postgres:16-alpine`)

### 2. Setup Environment
```bash
# Clone the repository
git clone https://github.com/shameemalungal/VetRx.git
cd VetRx

# Copy environment template
cp .env.example .env
```

### 3. Start Database & Backend
```bash
# Using Docker for PostgreSQL (optional)
docker compose up -d postgres

# Install server dependencies and generate Prisma client
cd server
npm install
npx prisma generate --schema=../prisma/schema.prisma

# Start backend development server (hot-reloading on port 4000)
npm run dev
```

### 4. Start Frontend
```bash
cd ../web
npm install

# Start Vite dev server (on port 5173)
npm run dev
```

Visit **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🧪 Testing and Verification

```bash
# Run backend security and tenant tests
cd server
npm test

# Run frontend build & lint verification
cd ../web
npm run lint
npm run build
```

---

## 🚢 Production Deployment

For complete instructions on deploying to the Ubuntu 24.04 VPS with NGINX reverse proxy, consult **[DEPLOYMENT.md](file:///C:/Antigravity/VetRx/DEPLOYMENT.md)**.
