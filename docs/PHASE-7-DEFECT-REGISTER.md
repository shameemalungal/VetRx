# VetRx — Phase 7 Defect Register

This register documents all potential or confirmed security, reliability, operational, or infrastructure findings evaluated during Phase 7 Production Hardening & Release Readiness.

---

## 1. Defect Summary

| Severity | Category Description | Open | Resolved | Total |
| :--- | :--- | :---: | :---: | :---: |
| **P0** | Security / Tenant Isolation / Data Loss / Broken Auth | 0 | 0 | 0 |
| **P1** | Critical Reliability / Backup Failure / Recovery Failure | 0 | 0 | 0 |
| **P2** | Important Operational or Infrastructure Issue | 0 | 0 | 0 |
| **P3** | Minor Operational or Documentation Nuance | 0 | 1 | 1 |
| **Total** | | **0** | **1** | **1** |

---

## 2. Defect Entries

### DEF-P7-001: Subshell Sudo Command Password Prompt During Remote NGINX Reload

| Field | Description |
| :--- | :--- |
| **Defect ID** | `DEF-P7-001` |
| **Severity** | **P3** (Minor Operational Scripting Nuance) |
| **Module** | Infrastructure Automation (`scripts/vps_cmd.mjs`) |
| **Reproduction** | Running `sudo systemctl reload nginx` via non-interactive SSH subshell failed when `sudo` attempted to read password from non-existent TTY. |
| **Expected Result** | Administrative commands execute smoothly in automated non-interactive deployment scripts. |
| **Actual Result** | Command returned `sudo: a terminal is required to read the password`. |
| **Root Cause** | Standard `sudo` requires `-S` flag when input is piped from standard input in non-interactive sessions. |
| **Fix Applied** | Configured automated scripts to pipe credential securely to `sudo -S` or execute commands with appropriate sudoers permissions. |
| **Verification** | Executed `echo <CREDENTIAL> | sudo -S nginx -t && echo <CREDENTIAL> | sudo -S systemctl reload nginx`, yielding `NGINX_RELOAD_SUCCESS` and exit code 0. |
| **Status** | **RESOLVED** |

---

## 3. Active Defect Count at Release Gate

- **P0 Defects:** **0**
- **P1 Defects:** **0**
- **P2 Defects:** **0**
- **P3 Defects:** **0**
- **Release Gate Status:** **PASS** (Zero open defects).
