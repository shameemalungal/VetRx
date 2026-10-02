# VetRx Phase 9: Infrastructure & Application Monitoring Baseline

This document records the empirical operational metrics, error rates, and resource baselines captured during the VetRx Phase 9 production rollout.

---

## 1. System Hardware & Host Resources

Recorded from Ubuntu 24.04 LTS VPS (`109.122.56.148`) at `2026-09-20T04:02:12Z`:

| Parameter | Observed Baseline | Operational Threshold | Status |
| :--- | :---: | :---: | :---: |
| **System Uptime** | 30 days, 8 hours, 21 minutes | Continuous uptime | **VERIFIED** |
| **CPU Load Average** | `0.05, 0.05, 0.00` (1m, 5m, 15m) | Alert if > 1.80 sustained for 15 min | **NORMAL** |
| **Total System Memory** | 1.9 GiB (2,048 MB) | Physical RAM | **VERIFIED** |
| **Active Memory Used** | 962 MiB (47%) | Alert if > 1.6 GiB (80%) | **NORMAL** |
| **Free / Buffer Memory** | 956 MiB available, 1.0 GiB buffer/cache | Adequate memory headroom | **NORMAL** |
| **Root Filesystem** | 30 GiB total, 19 GiB used (67%) | Alert if > 85% (25.5 GiB) | **NORMAL** |
| **Available Disk Space** | 9.4 GiB free space | Sufficient for logs & DB growth | **NORMAL** |

---

## 2. Container & Service Health

| Service / Container | Running Status | Memory Consumption | Restart Count | Status |
| :--- | :---: | :---: | :---: | :---: |
| `vetrx-frontend-prod` | Up 46+ minutes (`healthy`) | ~12 MB | 0 | **STABLE** |
| `vetrx-backend-prod` | Up 46+ minutes (`healthy`) | ~75 MB | 0 | **STABLE** |
| `vetrx-postgres-prod` | Up 45+ minutes (`healthy`) | ~48 MB | 0 | **STABLE** |
| `nginx` (Host Reverse Proxy) | Active running (PID 307340) | ~7.2 MB | 0 | **STABLE** |

---

## 3. Application API Health & Latencies

Probed via HTTPS from external client:

| Metric | Target / Specification | Observed Live Measurement | Evaluation |
| :--- | :---: | :---: | :---: |
| **Readiness Endpoint** (`/api/ready`) | HTTP 200 `status: ready` | **HTTP 200 OK (138 ms)** | **PASS** |
| **General Health** (`/api/health`) | HTTP 200 `status: ok` | **HTTP 200 OK (85 ms)** | **PASS** |
| **Frontend Root Index** (`/`) | HTTP 200 HTML | **HTTP 200 OK (92 ms)** | **PASS** |
| **Database Pool Query** | `SELECT 1` in < 50 ms | **< 15 ms internal** | **PASS** |

---

## 4. HTTP Error Rate Monitoring

Logged across NGINX reverse proxy and Express application middleware:

| Error Category | Expected Frequency | Observed Count | Root Cause / Note |
| :--- | :---: | :---: | :--- |
| **HTTP 400 (Bad Request)** | Rare | 0 | Request payload schema validation |
| **HTTP 401 (Unauthorized)** | Expected on expired session | 2 | Normal: Unauthenticated browser visits to protected routes redirecting to `/login` |
| **HTTP 403 (Forbidden)** | Rare (Cross-tenant block) | 0 | Zero tenant boundary violations |
| **HTTP 404 (Not Found)** | Occasional | 0 | Standard missing route checks |
| **HTTP 409 (Conflict)** | Low | 0 | Account collision prevention |
| **HTTP 429 (Rate Limited)** | Zero during normal use | 0 | Rate limiter window: 100 req / 15 min |
| **HTTP 500 (Internal Error)** | **0 (Zero Tolerance)** | **0** | Zero unhandled exceptions |
| **HTTP 502/503 (Bad Gateway)** | **0 (Zero Tolerance)** | **0** | Backend container permanently available |

---

## 5. Security & Log Inspection

- **CORS Violations**: 0 reported. Strictly allows whitelisted domain (`https://vetrx.adcpmalappuram.in`).
- **Sensitive Data Redaction**: Express winston/console logger masks passwords, authorization tokens, and private cookies using regex sanitization filters.
- **Audit Log Continuity**: 121 security and authentication audit events logged cleanly in PostgreSQL `AuditLog` table.

---

## 6. Thresholds Table

| Metric | Normal Range | Warning Threshold | Critical Alert Threshold |
| :--- | :---: | :---: | :---: |
| **CPU Load** | 0.01 – 0.30 | > 1.20 for 10 min | > 1.80 for 5 min |
| **RAM Usage** | 800 – 1,100 MB | > 1,500 MB (75%) | > 1,750 MB (85%) |
| **Disk Usage** | 60% – 70% | > 80% (24 GiB) | > 90% (27 GiB) |
| **HTTP 5xx Errors** | 0 | > 3 in 5 minutes | > 10 in 5 minutes |
| **`/api/ready` Latency** | < 250 ms | > 1,000 ms | > 3,000 ms or Timeout |
