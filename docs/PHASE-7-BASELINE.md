# VetRx — Phase 7 Pre-Hardening Baseline Snapshot

**Date of Capture:** 2026-09-20T01:15:00+05:30  
**Status:** **HEALTHY / UNBROKEN BASELINE CONFIRMED**

---

## 1. Version Control Baseline

| Attribute | Captured Value | Notes |
| :--- | :--- | :--- |
| **Local Git Branch** | `feature/stage-3-clinical-api-persistence` | Up to date with origin |
| **Local Head Commit** | `54078db52fd23032c82c8179f128a91b0227921f` | `test(integration): complete Phase 6 UAT and integration validation` |
| **Origin Head Commit** | `54078db52fd23032c82c8179f128a91b0227921f` | Synced |
| **Production VPS Commit** | `54078db52fd23032c82c8179f128a91b0227921f` | Synced and running |
| **Working Tree Cleanliness** | Clean (untracked test artifacts isolated) | Ready |

---

## 2. Automated Test Baseline

| Test Suite | Command | Result | Timing |
| :--- | :--- | :---: | :---: |
| **Frontend Tests** | `npm --prefix web test` | **14 / 14 PASS** | 1.1s |
| **Backend Security Tests** | `npm test` | **29 / 29 PASS** | 1.4s |
| **Phase 6 Integration Matrix** | `npx tsx scripts/phase6_comprehensive_integration_uat.ts` | **29 / 29 PASS** | 1.8s |
| **Frontend Production Build** | `npm --prefix web run build` | **0 Errors (PASS)** | 586ms |
| **Mobile Responsiveness Audit** | `node scripts/verify_mobile_views.mjs` | **0px Overflow (PASS)** | 2.2s |

---

## 3. Production Environment & Service Status

| Component | Status | Details |
| :--- | :---: | :--- |
| **Production URL** | `https://vetrx.adcpmalappuram.in` | Resolving HTTP 200 OK |
| **Health Endpoint (`/api/health`)** | **OK** | `status: "ok"`, `uptime: 185691s` |
| **Readiness Endpoint (`/api/ready`)** | **READY** | `status: "ready"`, `database: "connected"` |
| **Docker: `vetrx-frontend-prod`** | **Up (healthy)** | Nginx Alpine, listening on port 80 (mapped to 127.0.0.1:3000) |
| **Docker: `vetrx-backend-prod`** | **Up (healthy)** | Express / Node 20 LTS, listening on 127.0.0.1:4000 |
| **Docker: `vetrx-postgres-prod`** | **Up (healthy)** | PostgreSQL 16 Alpine, port 5432 (internal only) |
| **Host Nginx Proxy** | **Active (running)** | Main PID: 307340, active since 2026-09-13 (6 days) |
| **TLS / SSL Certificate** | **Valid (Let's Encrypt)** | Valid until **Dec 12 17:25:18 2026 GMT** (83 days remaining) |

---

## 4. Production Host Capacity & Resource Sanity

| Resource | Metrics | Headroom Evaluation |
| :--- | :--- | :--- |
| **Disk Space (`/dev/vda1`)** | Total: 30 GB \| Used: 19 GB \| Available: **9.4 GB (33% free)** | Sufficient for current workload; backup retention actively capped |
| **System Memory (RAM)** | Total: 1918 MB \| Used: 987 MB \| Available: **931 MB (48% free)** | Healthy, zero swapping active |
| **CPU Load Average** | `0.00, 0.00, 0.00` | Zero CPU bottleneck |
| **Uptime** | `30 days, 7:29`, 0 unplanned reboots | Highly stable host runtime |

---

## 5. Production Database Backup Baseline

| Parameter | Configuration / Current Status |
| :--- | :--- |
| **Backup Script** | `/home/ncms/scripts/backup_vetrx_db.sh` |
| **Backup Storage Directory** | `/home/ncms/backups/vetrx` (Permissions: 700) |
| **Cron Schedule** | `0 2 * * *` (Daily at 02:00 UTC) |
| **Retention Policy** | 14 days rolling retention (`find -mtime +14 -delete`) |
| **Most Recent Backup** | `vetrx_backup_20260919_020001.sql.gz` (Size: 469 KB, non-empty, valid gzip) |
| **Historical Archive Count** | 10 backup archives spanning Sep 15 to Sep 19 |

---

## 6. Baseline Verification Decision

The baseline across local git, tests, build, VPS services, containers, PostgreSQL, host Nginx, SSL certificates, and backup storage is **VERIFIED HEALTHY AND STABLE**. No unexpected regressions or baseline defects exist.

Proceeding to Phase 7 Security Hardening, Backup Restore Drill, and Operational Readiness.
