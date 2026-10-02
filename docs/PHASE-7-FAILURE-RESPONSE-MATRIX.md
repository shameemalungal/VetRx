# VetRx — Phase 7 Failure Response Matrix

This matrix defines the standard detection signatures, impact levels, and immediate recovery procedures for production operational failure scenarios.

---

## Failure Response Matrix

| Failure Scenario | Severity | Detection Signature | Root Cause Candidates | Immediate Recovery Action | Verification Step |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Frontend Container Down** | **P1** | User experiences 502 Bad Gateway at `/`; Docker status shows `Exited`. | OOM kill, bad container reload, host port collision on 3000. | `docker compose -f docker-compose.prod.yml restart frontend` | `curl -f https://vetrx.adcpmalappuram.in/` returns HTTP 200. |
| **Backend API Down** | **P1** | API calls fail with 502 Bad Gateway; `/api/health` unreachable. | Unhandled runtime exception, Node.js memory exhaustion, bad deployment. | 1. Check `docker compose logs backend`.<br>2. `docker compose restart backend`.<br>3. Roll back code if bug. | `curl -f https://vetrx.adcpmalappuram.in/api/health` returns `status: "ok"`. |
| **PostgreSQL Unavailable** | **P0** | `/api/ready` returns HTTP 503 `database: "disconnected"`; queries fail. | Postgres container crash, disk full, corrupted data directory. | 1. `docker compose restart postgres`.<br>2. Check `docker logs vetrx-postgres-prod`.<br>3. If data corrupted, execute Category 3 restore. | `/api/ready` returns HTTP 200 `database: "connected"`. |
| **Host NGINX Proxy Down** | **P0** | Entire domain `vetrx.adcpmalappuram.in` fails with connection refused. | Nginx service crashed, syntax error on reload, expired TLS cert. | 1. Check `sudo systemctl status nginx`.<br>2. `sudo nginx -t`.<br>3. `sudo systemctl restart nginx`. | Domain resolves over HTTPS with valid certificate. |
| **Disk Near Full (> 85%)** | **P1** | Automated alert or `df -h /` shows < 15% free space remaining. | Docker build cache accumulation, old log files, backup growth. | 1. Run `docker system prune -f`.<br>2. Truncate stale logs in `/var/log`.<br>3. Enforce backup retention script. | `df -h /` shows >= 25% free disk capacity. |
| **Database Backup Failure** | **P1** | Daily cron job fails to output `vetrx_backup_*.sql.gz` or size is 0 bytes. | Disk full, postgres authentication error, gzip failure. | 1. Inspect `/home/ncms/backups/vetrx/backup.log`.<br>2. Run manual backup `/home/ncms/scripts/backup_vetrx_db.sh`.<br>3. Test with `gzip -t`. | Non-empty backup file generated with exit code 0. |
| **Invalid Deployment** | **P1** | Frontend blank screen, JavaScript runtime error, or API startup crash. | Incompatible frontend bundle, missing environment variable, failed migration. | Execute Category 1 rollback: `git checkout <STABLE_COMMIT>` and rebuild containers. | App loads cleanly without console errors. |
| **Session Authentication Failure** | **P1** | Valid users repeatedly redirected to `/login`; 401 on `/api/auth/me`. | Session secret mismatch, changed cookie domain, session table issue. | 1. Check `SESSION_SECRET` in `.env`.<br>2. Verify session table in DB (`SELECT count(*) FROM "Session"`).<br>3. Clear browser cookies and re-login. | Login succeeds and session cookie persists across page refresh. |
| **Tenant Isolation Defect** | **P0 (BLOCKER)** | Practice A observes records belonging to Practice B. | Missing `where: { practiceId }` in new query, trusted client ID. | 1. **IMMEDIATELY STOP RELEASING**.<br>2. Revert offending commit.<br>3. Audit database access logs.<br>4. Fix server-side query scoping. | Run `npm test` and `test_two_account_isolation.mjs` with 100% pass. |
