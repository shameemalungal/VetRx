#!/usr/bin/env bash
# ==============================================================================
# VetRx Production Database Backup Script
# Automatically dumps PostgreSQL database from Docker container to gzip archive.
# Rolling retention: 14 days
# ==============================================================================

set -euo pipefail

BACKUP_DIR="/home/ncms/backups/vetrx"
LOG_FILE="${BACKUP_DIR}/backup.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/vetrx_backup_${TIMESTAMP}.sql.gz"
COMPOSE_FILE="/home/ncms/VetRx/docker-compose.prod.yml"

# Create backup directory if it does not exist
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" | tee -a "${LOG_FILE}"
}

log "Starting VetRx PostgreSQL backup..."

# Source environment variables if .env exists
if [ -f "/home/ncms/VetRx/.env" ]; then
  # Extract POSTGRES_USER and POSTGRES_DB safely
  PG_USER=$(grep -E '^POSTGRES_USER=' /home/ncms/VetRx/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  PG_DB=$(grep -E '^POSTGRES_DB=' /home/ncms/VetRx/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

PG_USER=${PG_USER:-vetrx}
PG_DB=${PG_DB:-vetrx}

# Perform pg_dump inside postgres container and compress
if docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_dump -U "${PG_USER}" -d "${PG_DB}" --no-owner --no-privileges | gzip -9 > "${BACKUP_FILE}"; then
  # Verify file is non-empty and valid gzip
  if [ -s "${BACKUP_FILE}" ] && gzip -t "${BACKUP_FILE}"; then
    FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    chmod 600 "${BACKUP_FILE}"
    log "Backup created successfully: ${BACKUP_FILE} (Size: ${FILE_SIZE})"
  else
    log "ERROR: Backup file ${BACKUP_FILE} is empty or corrupted."
    rm -f "${BACKUP_FILE}"
    exit 1
  fi
else
  log "ERROR: pg_dump execution failed."
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# Apply 14-day rolling retention policy
log "Applying 14-day retention cleanup..."
find "${BACKUP_DIR}" -name "vetrx_backup_*.sql.gz" -type f -mtime +14 -delete

REMAINING_COUNT=$(find "${BACKUP_DIR}" -name "vetrx_backup_*.sql.gz" -type f | wc -l)
log "Retention check complete. Current backup count: ${REMAINING_COUNT}"
log "Backup job finished successfully."
