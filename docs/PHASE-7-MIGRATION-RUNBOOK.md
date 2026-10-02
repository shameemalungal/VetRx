# VetRx — Production Migration Runbook

This document defines the mandatory, step-by-step procedure for authoring, testing, deploying, and rolling back database migrations in production.

---

## 1. Golden Rules of Schema Migrations

1. **Non-Destructive by Default:** Columns and tables must never be dropped in the same release where application code stops referencing them. Use a multi-phase deprecation cycle (Expand → Contract).
2. **Mandatory Backup Gate:** A fresh, verified database backup must be created immediately before executing any production migration.
3. **Deterministic Order:** All migrations must be checked into version control under `prisma/migrations/` and applied using `prisma migrate deploy`. Never apply manual, uncommitted SQL directly to production.
4. **Lock Timeout Caution:** Keep transactions short and avoid long-running exclusive locks on high-traffic tables.

---

## 2. Standard Production Migration Procedure

### Step 1: Pre-Migration Health Verification
1. Verify production health:
   ```bash
   curl -f https://vetrx.adcpmalappuram.in/api/health
   curl -f https://vetrx.adcpmalappuram.in/api/ready
   ```
2. Verify existing migration status:
   ```bash
   docker compose -f docker-compose.prod.yml exec backend npx prisma migrate status
   ```

### Step 2: Immediate Database Backup & Validation
Execute the automated backup script:
```bash
/home/ncms/scripts/backup_vetrx_db.sh
```
Verify the generated backup file:
```bash
LATEST_BACKUP=$(ls -t /home/ncms/backups/vetrx/vetrx_backup_*.sql.gz | head -n1)
# Verify file exists, is non-empty, and gzip integrity passes:
[ -s "$LATEST_BACKUP" ] && gzip -t "$LATEST_BACKUP" && echo "Backup verified: $LATEST_BACKUP"
```

### Step 3: Deploy Migration
Execute Prisma migration deployment inside the backend container:
```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```
Expected output:
```text
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "vetrx", schema "public" at "postgres:5432"
Applying migration `YYYYMMDDHHMMSS_name`
The following migration have been applied:
- YYYYMMDDHHMMSS_name
All migrations have been successfully applied.
```

### Step 4: Verify Schema Status
Confirm that all migrations are synchronized:
```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate status
```
Output must read:
```text
Database schema is up to date!
```

### Step 5: Service Verification
Restart backend to ensure connection pools and prepared statements refresh:
```bash
docker compose -f docker-compose.prod.yml restart backend
```
Wait 10 seconds, then check container logs and endpoints:
```bash
docker compose -f docker-compose.prod.yml logs --tail=50 backend
curl -f https://vetrx.adcpmalappuram.in/api/health
curl -f https://vetrx.adcpmalappuram.in/api/ready
```

### Step 6: Post-Migration Smoke Test
Perform a non-destructive read test:
1. Log in to `https://vetrx.adcpmalappuram.in`.
2. Open Patients and Prescriptions.
3. Verify recent clinical records load with complete signalment.

---

## 3. Migration Rollback Strategy

If a migration fails or causes application regression:

### Scenario A: Code Rollback (Additive / Non-Destructive Migration)
If the migration only added nullable columns or new tables:
1. Revert application code to the previous stable release commit.
2. Rebuild and restart the frontend and backend containers:
   ```bash
   git checkout <PREVIOUS_STABLE_COMMIT>
   docker compose -f docker-compose.prod.yml up -d --build
   ```
3. The unused new columns remain dormant in the database without breaking previous application code.

### Scenario B: Database State Restore (Destructive or Incompatible Migration)
If a migration corrupted data or introduced incompatible constraints:
1. Stop application traffic to prevent inconsistent writes:
   ```bash
   docker compose -f docker-compose.prod.yml stop backend
   ```
2. Follow the emergency restore procedure documented in `PHASE-7-BACKUP-RESTORE-DRILL.md`:
   - Restore the verified pre-migration backup (`$LATEST_BACKUP`).
   - Revert application code to `<PREVIOUS_STABLE_COMMIT>`.
   - Start backend:
     ```bash
     docker compose -f docker-compose.prod.yml start backend
     ```
   - Verify `/api/health` and `/api/ready`.
