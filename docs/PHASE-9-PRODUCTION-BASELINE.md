# VetRx Phase 9: Production Operational Baseline

This document records the official pre-launch and operational baseline for VetRx Phase 9 (Production Launch & Stabilization) across code state, infrastructure metrics, database records, container health, and monitoring continuity.

---

## 1. Version & Deployment Baseline

| Parameter | Value | Status |
| :--- | :--- | :---: |
| **Git Branch** | `feature/stage-3-clinical-api-persistence` | **VERIFIED** |
| **Git Commit SHA** | `76eb633` (Base: `f696837`) | **VERIFIED** |
| **Release Candidate Tag** | `v0.8.0-rc.1` | **VERIFIED** |
| **Production Deployment SHA** | `76eb633` | **VERIFIED** |
| **Frontend Build** | Vite v8.2.2 + React 19 SPA (Build time: 1.18s, 0 errors) | **VERIFIED** |
| **Backend Version** | Node.js v20.18.0 / Express 4 / Prisma ORM 6.4.1 (29/29 tests pass) | **VERIFIED** |
| **Database Migration State** | `20260915000000_init` (1 migration applied, schema in sync) | **VERIFIED** |
| **Docker Compose Config** | `docker-compose.prod.yml` (v2 Compose specification) | **VERIFIED** |
| **Deployment Timestamp** | `2026-09-19T20:00:33Z` (Updated: `2026-09-20T02:01:42Z`) | **VERIFIED** |

---

## 2. Infrastructure & System Metrics

Recorded directly from the production VPS (`109.122.56.148`) on `2026-09-20T04:02:12Z`:

| Component | Observed Metric / Value | Operational Evaluation | Status |
| :--- | :--- | :--- | :---: |
| **Uptime** | Up 30 days, 8 hours, 21 minutes | Continuous system stability | **VERIFIED** |
| **Load Average** | `0.05, 0.05, 0.00` (1-min, 5-min, 15-min) | Minimal server utilization | **VERIFIED** |
| **Total RAM** | 1.9 GiB (2,048 MB) | System hardware capacity | **VERIFIED** |
| **RAM Usage** | 962 MiB used, 956 MiB available, 1.0 GiB buff/cache | 50% available memory headroom | **VERIFIED** |
| **Root Disk** | 30 GiB total, 19 GiB used, 9.4 GiB available (67% utilization) | Adequate storage headroom | **VERIFIED** |
| **Host OS** | Ubuntu 24.04 LTS (Kernel: 6.8.0-40-generic) | Production hardened Linux | **VERIFIED** |
| **NGINX Reverse Proxy** | Active running since 2026-09-13 (PID: 307340, memory: 7.2 MB) | Operational, TLS 1.3 active | **VERIFIED** |

---

## 3. Container Status & Health Checks

| Container Name | Image / Base | Status & Health | Port Mapping | Status |
| :--- | :--- | :--- | :--- | :---: |
| `vetrx-frontend-prod` | `nginx:alpine` (VetRx SPA) | Up 46+ minutes (`healthy`) | `127.0.0.1:3000->80/tcp` | **VERIFIED** |
| `vetrx-backend-prod` | `node:20-alpine` (VetRx API) | Up 46+ minutes (`healthy`) | `127.0.0.1:4000->4000/tcp` | **VERIFIED** |
| `vetrx-postgres-prod` | `postgres:16-alpine` | Up 45+ minutes (`healthy`) | `5432/tcp` (internal bridge) | **VERIFIED** |

---

## 4. Production Database Record Counts

Queried directly from `vetrx-postgres-prod` via `pg_stat_user_tables`:

| Table Name | Entity Scope | Live Row Count | Notes | Status |
| :--- | :--- | :---: | :--- | :---: |
| `User` | Practitioner Accounts | **44** | Registered practitioners | **VERIFIED** |
| `Practice` | Practice Tenants | **44** | Practice tenant boundaries | **VERIFIED** |
| `PracticeMember` | Tenant Memberships | **44** | User-to-practice role mapping | **VERIFIED** |
| `PracticeSettings` | Clinic Profiles | **44** | Clinic contact & signature info | **VERIFIED** |
| `AuthIdentity` | Authentication Identities | **44** | Password & OAuth identities | **VERIFIED** |
| `Session` | Active Session Tokens | **97** | Active practitioner sessions | **VERIFIED** |
| `AuditLog` | Security & Access Logs | **121** | Authentication & settings audits | **VERIFIED** |
| `_prisma_migrations` | Migration History | **1** | Baseline initial schema | **VERIFIED** |
| `Owner` | Client Profiles | **0** | Clean baseline for Phase 9 | **VERIFIED** |
| `Patient` | Animal Profiles | **0** | Clean baseline for Phase 9 | **VERIFIED** |
| `Prescription` | Clinical Prescriptions | **0** | Clean baseline for Phase 9 | **VERIFIED** |
| `PrescriptionItem` | Medicine Items | **0** | Clean baseline for Phase 9 | **VERIFIED** |
| `Invoice` | Tax Invoices | **0** | Clean baseline for Phase 9 | **VERIFIED** |
| `InvoiceItem` | Billing Items | **0** | Clean baseline for Phase 9 | **VERIFIED** |
| `Receipt` | Payment Receipts | **0** | Clean baseline for Phase 9 | **VERIFIED** |
| `TreatmentPackage` | Protocol Templates | **0** | Clean baseline for Phase 9 | **VERIFIED** |
| `Medicine` | Custom Clinic Formulary | **0** | Built-in formulary active in SPA | **VERIFIED** |
| `DocumentSequence` | Year Number Counters | **0** | Auto-generates on first issue | **VERIFIED** |

---

## 5. Production Health Endpoints

| Endpoint | Protocol | Expected | Observed Response | Status |
| :--- | :---: | :---: | :--- | :---: |
| `https://vetrx.adcpmalappuram.in` | HTTPS / TLS 1.3 | HTTP 200 | HTTP 200 OK (Content-Length: 1019, NGINX) | **VERIFIED** |
| `https://vetrx.adcpmalappuram.in/api/ready` | HTTPS / TLS 1.3 | HTTP 200 | HTTP 200 OK (`status: "ready"`, `database: "connected"`) | **VERIFIED** |
| `https://vetrx.adcpmalappuram.in/api/health` | HTTPS / TLS 1.3 | HTTP 200 | HTTP 200 OK (`status: "ok"`) | **VERIFIED** |

---

## 6. Backup Operational State

| Parameter | Configuration / Metric | Evaluation | Status |
| :--- | :--- | :--- | :---: |
| **Backup Cron** | `0 2 * * * /home/ncms/scripts/backup_vetrx_db.sh` | Daily automated at 02:00 UTC | **VERIFIED** |
| **Backup Directory** | `/home/ncms/backups/vetrx/` | Dedicated filesystem location | **VERIFIED** |
| **Retention Policy** | 14 days automated prune | Prunes archives > 14 days | **VERIFIED** |
| **Latest Backup** | `vetrx_backup_20260919_194651.sql.gz` (592 KB) | Integrity verified, gzipped | **VERIFIED** |
| **Total Archive Count** | 11 historical backups available | Stored safely on host disk | **VERIFIED** |
| **Restore Verification** | Phase 7 Restore Drill (`PHASE-7-BACKUP-RESTORE-DRILL.md`) | Verified 100% data recovery | **VERIFIED** |

---

## 7. Pre-Launch Test Suite Execution

| Test Suite | Execution Command | Result | Status |
| :--- | :--- | :---: | :---: |
| **Frontend Unit & Dosing** | `npm --prefix web test` | **14 / 14 PASS** | **VERIFIED** |
| **Backend Tenant & Security** | `npm test` | **29 / 29 PASS** | **VERIFIED** |
| **Phase 6 Comprehensive Integration** | `npx tsx scripts/phase6_comprehensive_integration_uat.ts` | **29 / 29 PASS** | **VERIFIED** |
| **Phase 8 Controlled Pilot Validation** | `npx tsx scripts/phase8_controlled_pilot_validation.ts` | **10 / 10 PASS** | **VERIFIED** |
| **Production Web Build** | `npm --prefix web run build` | **0 errors (1.18s)** | **VERIFIED** |

All systems, infrastructure, tests, and operational backups are **VERIFIED** and ready for controlled production onboarding.
