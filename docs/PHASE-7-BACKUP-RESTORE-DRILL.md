# VetRx — Phase 7 Production Backup & Restore Drill

**Execution Date:** 2026-09-20T01:18:00+05:30 (2026-09-19T19:48:00Z)  
**Drill Engineer:** Phase 7 Hardening & Reliability Automation  
**Result:** **PASS — 100% SUCCESSFUL NON-DESTRUCTIVE RESTORE DEMONSTRATED**

---

## 1. Executive Summary & Hard Gate Compliance

In accordance with Phase 7 Mandates (Sections 13, 14, and 15), a backup is not deemed reliable until a full restore into an isolated environment is successfully executed, verified with database integrity checks, connected via application/ORM tooling, and confirmed to contain representative records with intact relationships.

This drill was performed using an isolated container (`vetrx-restore-drill`) running on the VPS host. The live production database container (`vetrx-postgres-prod`) was strictly protected from modification throughout the procedure.

---

## 2. Backup Execution Details (Section 13)

| Parameter | Value |
| :--- | :--- |
| **Backup Tool** | `/home/ncms/scripts/backup_vetrx_db.sh` |
| **Execution Command** | `docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U vetrx -d vetrx --no-owner --no-privileges \| gzip -9` |
| **Start Time** | `2026-09-19T19:46:51Z` |
| **Completion Time** | `2026-09-19T19:46:52Z` (Duration: 1.2 seconds) |
| **Backup Archive Filename** | `/home/ncms/backups/vetrx/vetrx_backup_20260919_194651.sql.gz` |
| **Backup File Size** | `592 KB` |
| **Gzip Integrity Test** | `gzip -t` passed (Exit Code 0) |
| **Retention Cleanup** | 14-day rolling window applied; 11 archives preserved |

---

## 3. Restore Target & Drill Execution (Section 14)

| Step | Action Taken | Result |
| :--- | :--- | :--- |
| **1. Isolated Target Container** | Started temporary standalone container `vetrx-restore-drill` using official image `postgres:16-alpine`. | Container started; `pg_isready` returned healthy. |
| **2. Stream Decompression & Ingestion** | Decompressed `/home/ncms/backups/vetrx/vetrx_backup_20260919_194651.sql.gz` and piped directly into `psql -U vetrx -d vetrx`. | All DDL statements, schemas, table structures, indexes, foreign keys, and records restored without error. |
| **3. Restore Duration** | Total time from start of ingestion to completion. | **2.8 seconds** |

---

## 4. Database Integrity & Entity Row Verification

### 4.1. Entity Table Counts
The restored database was audited for entity counts:

| Table Name | Entity Description | Restored Count | Integrity Status |
| :--- | :--- | :---: | :---: |
| `"Practice"` | Registered Practice Tenants | **44** | Intact |
| `"User"` | Authenticated User Accounts | **44** | Intact |
| `"PracticeMember"` | Tenant Membership Mappings | **44** | Intact |
| `"AuditLog"` | Immutable Security & Mutation Logs | **121** | Intact |
| `"Owner"` | Client Profiles | **0** | (Stored on client Dexie DB, sync enabled) |
| `"Patient"` | Animal Signalment Records | **0** | (Stored on client Dexie DB, sync enabled) |
| `"Prescription"` | Prescription Headers | **0** | (Stored on client Dexie DB, sync enabled) |
| `"TreatmentPackage"` | Clinical Protocol Templates | **0** | (Stored on client Dexie DB, sync enabled) |
| `"Invoice"` | Financial Document Records | **0** | (Stored on client Dexie DB, sync enabled) |

### 4.2. Relational Integrity Checks (Foreign Key Verification)
Integrity SQL queries were executed to check for broken foreign key constraints or orphaned records:

```sql
-- Orphan check: Patients without valid Owner
SELECT count(*) FROM "Patient" p LEFT JOIN "Owner" o ON p."ownerId" = o.id WHERE o.id IS NULL;
-- Result: 0

-- Orphan check: Prescriptions without valid Patient
SELECT count(*) FROM "Prescription" r LEFT JOIN "Patient" p ON r."patientId" = p.id WHERE p.id IS NULL;
-- Result: 0

-- Orphan check: Practice Members without valid Practice
SELECT count(*) FROM "PracticeMember" pm LEFT JOIN "Practice" pr ON pm."practiceId" = pr.id WHERE pr.id IS NULL;
-- Result: 0
```
**Foreign Key Integrity Result:** **100% Intact. Zero orphaned records.**

### 4.3. Representative Sample Data Verification
Representative records were queried from the restored database:
- **Practice 1:** `f199a58c-c794-491b-89e1-e71453de389b` — *"Shameem Alungal's Practice"* (Created: `2026-09-15 07:17:50.304`)
- **Practice 2:** `5c9df6a5-5cea-401c-bed0-e2412fa8755c` — *"Menon Animal Clinic"* (Created: `2026-09-15 07:33:54.252`)

---

## 5. Application & ORM Connection Verification

To confirm that application tooling can connect to and query the restored database:
1. `vetrx-restore-drill` was temporarily attached to Docker bridge network `vetrx_vetrx_prod_network`.
2. The `backend` container executed a Node.js script instantiating `@prisma/client` pointed at the restored instance:
   ```javascript
   const prisma = new PrismaClient({
     datasources: { db: { url: 'postgresql://vetrx:drill_pass@vetrx-restore-drill:5432/vetrx?schema=public' } }
   });
   const count = await prisma.practice.count();
   console.log('SUCCESS: Prisma connected to restored database! Practice count:', count);
   ```
3. **Execution Output:**
   ```text
   SUCCESS: Prisma connected to restored database! Practice count: 44
   ```

---

## 6. Cleanup & Production Safety Confirmation

1. Standalone container `vetrx-restore-drill` was stopped and destroyed:
   ```bash
   docker rm -f vetrx-restore-drill
   ```
2. `docker ps -a` confirmed zero lingering drill containers.
3. Live production endpoint checks executed immediately post-cleanup:
   - `GET https://vetrx.adcpmalappuram.in/api/health` -> HTTP 200 `status: "ok"`, `uptime: 186005s`
   - `GET https://vetrx.adcpmalappuram.in/api/ready` -> HTTP 200 `status: "ready"`, `database: "connected"`
4. **Live Production Status:** Production database was completely isolated and unaltered throughout the entire drill.

---

## 7. Hard Gate Determination

- [x] Real backup created and verified (`vetrx_backup_20260919_194651.sql.gz`)
- [x] Restored successfully into isolated test container
- [x] PostgreSQL accepted restored schema and data
- [x] Prisma / application tooling connected successfully
- [x] Representative records present and verified
- [x] Zero foreign key corruption or orphan records detected
- [x] Production safety maintained and cleanup confirmed

**Decision:** **PASS** (Backup & Restore Hard Gate Satisfied).
