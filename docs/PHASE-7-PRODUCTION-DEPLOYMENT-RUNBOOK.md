# VetRx — Production Deployment Runbook

This document defines the strict, production-tested procedure for deploying new releases of VetRx to the live production environment (`https://vetrx.adcpmalappuram.in`).

---

## 1. Pre-Deployment Release Gate Checklist

Before initiating any production deployment, the deploying engineer must confirm:
- [ ] All automated unit, integration, and security tests pass locally (`npm test`, `npm --prefix web test`, `npx tsx scripts/phase6_comprehensive_integration_uat.ts`).
- [ ] Frontend production build succeeds cleanly (`npm --prefix web run build`).
- [ ] Release branch is clean and all changes are committed and pushed to `origin`.
- [ ] The exact release commit hash is documented and tagged (e.g. `git rev-parse HEAD`).
- [ ] Live production health check returns healthy prior to deployment (`/api/health` and `/api/ready`).

---

## 2. Standard Production Deployment Workflow

Execute the following steps sequentially on the production VPS (`109.122.56.148`):

### Step 1: Pre-Deployment Backup (Mandatory Gate)
Never pull code or touch containers without taking an immediate backup:
```bash
/home/ncms/scripts/backup_vetrx_db.sh
```
Verify the backup file exists, is non-empty, and gzip integrity passes:
```bash
LATEST_BACKUP=$(ls -t /home/ncms/backups/vetrx/vetrx_backup_*.sql.gz | head -n1)
gzip -t "$LATEST_BACKUP" && echo "Backup verified: $LATEST_BACKUP"
```

### Step 2: Fetch Code & Verify Release Commit
Navigate to the application repository on the VPS:
```bash
cd /home/ncms/VetRx
git fetch origin
git checkout feature/stage-3-clinical-api-persistence # or main / target release tag
git pull origin feature/stage-3-clinical-api-persistence
```
Record the deployed commit:
```bash
DEPLOYED_COMMIT=$(git rev-parse HEAD)
echo "Deploying commit: $DEPLOYED_COMMIT"
```

### Step 3: Database Migrations (If Applicable)
If database schema changes are included in the release:
```bash
docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate status
```

### Step 4: Build Container Images
Build the production Docker images:
```bash
# Build frontend container (Vite SPA + Nginx Alpine)
docker compose -f docker-compose.prod.yml build frontend

# Build backend container (Node 20 LTS Multi-Stage)
docker compose -f docker-compose.prod.yml build backend
```

### Step 5: Graceful Container Re-creation
Recreate and start the containers with zero downtime:
```bash
docker compose -f docker-compose.prod.yml up -d frontend backend
```

### Step 6: Post-Deployment Verification
1. Verify container status and healthcheck results:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```
   All containers (`vetrx-frontend-prod`, `vetrx-backend-prod`, `vetrx-postgres-prod`) must show `Up (healthy)`.

2. Query live health and readiness endpoints:
   ```bash
   curl -f https://vetrx.adcpmalappuram.in/api/health
   curl -f https://vetrx.adcpmalappuram.in/api/ready
   ```

3. Review container logs for startup errors or unhandled exceptions:
   ```bash
   docker compose -f docker-compose.prod.yml logs --tail=50 backend
   docker compose -f docker-compose.prod.yml logs --tail=50 frontend
   ```

4. Execute Production Smoke Test:
   - Load `https://vetrx.adcpmalappuram.in`.
   - Log in with valid credentials.
   - Open Patients and Prescriptions.
   - Test Print PDF and Save PDF generation.

5. Update deployment log / release notes with timestamp and `DEPLOYED_COMMIT`.
