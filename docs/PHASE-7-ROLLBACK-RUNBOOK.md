# VetRx — Production Rollback Runbook

This document details the exact procedures for rolling back application code, container images, and database state in the event of an operational defect or release regression.

---

## 1. Categorization of Rollback Modes

Operational incidents require distinct rollback interventions based on the layer affected:

| Rollback Category | Target Layer | Data Loss Risk | Downtime Window |
| :--- | :--- | :---: | :---: |
| **Category 1: Code Rollback** | Frontend / Backend Application Code | **None** | Zero Downtime |
| **Category 2: Database Migration Rollback** | Reversible Schema Constraints | Minimal / None | < 1 minute |
| **Category 3: Full Database Restore** | Database State Corruption / Data Loss | Data written since backup is lost | 2–5 minutes |

---

## 2. Category 1: Application Code Rollback

Use this procedure when a release introduces a bug in UI, clinical logic, PDF generation, or API behavior, and database schema changes were additive or absent.

### Execution Steps:
1. Identify the previous stable release commit hash:
   ```bash
   PREVIOUS_COMMIT="<KNOWN_GOOD_COMMIT_HASH>"
   ```
2. Check out the previous commit on the production VPS:
   ```bash
   cd /home/ncms/VetRx
   git checkout "$PREVIOUS_COMMIT"
   ```
3. Rebuild and restart the application containers:
   ```bash
   docker compose -f docker-compose.prod.yml build frontend backend
   docker compose -f docker-compose.prod.yml up -d frontend backend
   ```
4. Verify application recovery:
   ```bash
   curl -f https://vetrx.adcpmalappuram.in/api/health
   curl -f https://vetrx.adcpmalappuram.in/api/ready
   ```
5. Confirm that the previous stable version is serving traffic.

---

## 3. Category 2: Database Migration Rollback

Prisma does not execute automatic down migrations. A schema rollback is feasible **only if** the changes made were strictly non-destructive (e.g., adding an optional column or index).

### Procedure:
1. Revert to the previous application version code (Category 1 above).
2. Because prior application code ignores newly added optional columns or unused tables, the application can safely run against the forward-migrated database without disruption.
3. Author a new, forward-fixing migration to remove unwanted objects if necessary in the next planned maintenance window:
   ```bash
   npx prisma migrate dev --name revert_unwanted_change
   ```
4. **Caution:** Never attempt manual `DROP TABLE` or `DROP COLUMN` in production without verifying foreign key dependencies and archiving data.

---

## 4. Category 3: Emergency Database State Restore

Use this emergency procedure **only** when a migration or data corruption incident has compromised the integrity of active production data and forward-fixing is impossible.

> [!CAUTION]
> Restoring a past backup restores the database to the exact timestamp of that backup. Any records created between the backup timestamp and the restore moment will be permanently overwritten.

### Execution Steps:
1. **Stop Application Traffic Immediately:**
   Stop the backend service to halt further writes to the database:
   ```bash
   cd /home/ncms/VetRx
   docker compose -f docker-compose.prod.yml stop backend
   ```

2. **Locate the Pre-Incident Verified Backup:**
   ```bash
   BACKUP_TO_RESTORE=$(ls -t /home/ncms/backups/vetrx/vetrx_backup_*.sql.gz | head -n1)
   echo "Restoring from: $BACKUP_TO_RESTORE"
   gzip -t "$BACKUP_TO_RESTORE" || { echo "Backup corrupted! Aborting."; exit 1; }
   ```

3. **Restore Database from Gzip Archive:**
   ```bash
   gunzip -c "$BACKUP_TO_RESTORE" | docker compose -f docker-compose.prod.yml exec -T postgres psql -U vetrx -d vetrx
   ```

4. **Verify Relational Integrity:**
   Run integrity queries inside the database container:
   ```bash
   docker compose -f docker-compose.prod.yml exec -T postgres psql -U vetrx -d vetrx -c "
   SELECT count(*) FROM \"Practice\";
   SELECT count(*) FROM \"User\";
   SELECT count(*) FROM \"AuditLog\";
   "
   ```

5. **Revert Application Code to Compatible Commit:**
   ```bash
   git checkout "$PREVIOUS_STABLE_COMMIT"
   docker compose -f docker-compose.prod.yml build backend frontend
   ```

6. **Restart Backend Service:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d backend frontend
   ```

7. **Execute Health & Smoke Checks:**
   ```bash
   curl -f https://vetrx.adcpmalappuram.in/api/health
   curl -f https://vetrx.adcpmalappuram.in/api/ready
   ```
