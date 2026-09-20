# VetRx Phase 9: Incident Response Runbook

This runbook establishes the strict incident management, containment, rollback, and recovery protocol for handling P0 (Critical Production Outage / Data Breach) and P1 (Critical Clinical / Financial Workflow Failure) events in production.

---

## 1. Incident Severity Definitions

- **P0 Incident (Critical Disaster / Security Breach)**:
  - Any cross-tenant data exposure (e.g. Practice A views Practice B's records).
  - Total production service outage (NGINX, backend, or database completely down).
  - Database corruption or catastrophic data loss.
  - Authentication bypass or critical security vulnerability.
- **P1 Incident (Major Clinical Blocker)**:
  - Prescription creation, saving, or document generation fails globally.
  - Tax invoice calculations yield incorrect mathematical totals.
  - Administration directions (Sig) leak into Tax Invoices or Payment Receipts (Section 22 breach).
  - Production service restart loops or high-frequency 500 errors.

---

## 2. Eleven-Step Incident Response Protocol

```
[1. Detect] ──▶ [2. Confirm] ──▶ [3. Contain] ──▶ [4. Assess Impact] ──▶ [5. Preserve Evidence]
                                                                                   │
[11. Close] ◀── [10. Add Test] ◀── [9. RCA Doc] ◀── [8. Communicate] ◀── [6. Fix or Rollback]
                                                                                   ▲
                                                                     [7. Verify Fix]
```

### Step 1: Detect
- Automated health check alert (`/api/ready` returning non-200 or connection error).
- Host resource anomaly (RAM > 90%, disk > 90%, Docker container unhealthy).
- Rapid influx of HTTP 500/502/503 errors in NGINX logs.
- Urgent practitioner hotline or support escalation.

### Step 2: Confirm
1. Verify live status immediately:
   ```bash
   curl.exe -i -s https://vetrx.adcpmalappuram.in/api/ready
   ```
2. Verify container state on VPS:
   ```bash
   ssh ncms@109.122.56.148 "docker ps --format 'table {{.Names}}\t{{.Status}}'"
   ```
3. Confirm if the issue affects a single user or all tenants.

### Step 3: Contain
- **If Cross-Tenant Leakage or Critical Security Breach**:
  Immediately place NGINX into maintenance mode to protect patient data:
  ```bash
  ssh ncms@109.122.56.148 "sudo systemctl stop nginx"
  ```
- **If Single Container Hang / Memory Spike**:
  Restart the specific affected container:
  ```bash
  ssh ncms@109.122.56.148 "cd /home/ncms/VetRx && docker compose -f docker-compose.prod.yml restart vetrx-backend-prod"
  ```

### Step 4: Assess Impact
- Quantify affected practices, users, and transactions.
- Check if clinical data or financial records were corrupted or dropped.
- Inspect database integrity:
  ```sql
  SELECT count(*) FROM "Prescription" WHERE "practiceId" IS NULL;
  ```

### Step 5: Preserve Evidence
Before altering or restarting production infrastructure:
1. Capture container logs:
   ```bash
   ssh ncms@109.122.56.148 "docker logs vetrx-backend-prod > /home/ncms/incident_backend_$(date +%Y%m%d_%H%M%S).log 2>&1"
   ```
2. Capture NGINX error logs:
   ```bash
   ssh ncms@109.122.56.148 "sudo tail -n 500 /var/log/nginx/error.log > /home/ncms/incident_nginx.log"
   ```
3. Capture emergency database backup:
   ```bash
   ssh ncms@109.122.56.148 "/home/ncms/scripts/backup_vetrx_db.sh"
   ```

### Step 6: Fix or Rollback Decision
Evaluate whether to apply a targeted Hotfix or execute an immediate Rollback:
- **Execute Rollback if**:
  - A recent deployment caused widespread instability, and the root cause cannot be fixed in < 30 minutes.
  - Follow the Phase 7 Rollback Runbook (`docs/PHASE-7-ROLLBACK-RUNBOOK.md`):
    ```bash
    git checkout <PREVIOUS_STABLE_SHA>
    docker compose -f docker-compose.prod.yml build
    docker compose -f docker-compose.prod.yml up -d
    ```
- **Execute Hotfix if**:
  - Root cause is isolated, minimal, and verifiable in < 15 minutes.
  - Implement change locally $\rightarrow$ run full automated regression test suite.

### Step 7: Verify Fix
Execute post-fix verification:
1. `npm --prefix web test`
2. `npm test`
3. `npm --prefix web run build`
4. `npx tsx scripts/phase6_comprehensive_integration_uat.ts`
5. Live curl to `/api/ready` on production returns `HTTP 200 OK`.

### Step 8: Communicate
- Send status update to affected clinic administrators:
  - Nature of the outage (non-technical, reassuring).
  - Confirmation that patient data remains intact.
  - Guidance on any actions required (e.g. refreshing browser).

### Step 9: Document Root Cause Analysis (RCA)
Within 24 hours of incident resolution, author a post-mortem containing:
- Incident summary & timeline (Discovery, Containment, Resolution).
- Technical root cause.
- Contributing factors.
- Permanent corrective actions.

### Step 10: Add Automated Regression Test
- Author a dedicated unit or integration test reproducing the exact failure scenario to guarantee the issue cannot recur in future releases.

### Step 11: Close Incident
- Log incident metrics, total downtime, and resolution evidence in `docs/PHASE-9-DEFECT-REGISTER.md`.
