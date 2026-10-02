#!/usr/bin/env bash
# =============================================================================
# VetRx Production Deployment Script — Inventory V1 + Full Feature Branch Merge
# Run this ON THE VPS as the deploy user (ncms or root).
# Usage: bash deploy_inventory_v1.sh
# =============================================================================

set -euo pipefail

DEPLOY_DIR="/var/www/vetrx"
COMPOSE="docker compose -f docker-compose.prod.yml"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/var/backups/vetrx"

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║   VetRx Production Deployment — Inventory V1                    ║"
echo "║   $(date)                              ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# ─── Step 0: Navigate to deploy directory ───────────────────────────────────
cd "$DEPLOY_DIR"
echo "▶ Working directory: $(pwd)"

# ─── Step 1: Verify containers are currently running ─────────────────────────
echo ""
echo "─── Step 1: Current container status ───────────────────────────────"
$COMPOSE ps

# ─── Step 2: Database backup BEFORE any changes ──────────────────────────────
echo ""
echo "─── Step 2: Pre-deployment database backup ──────────────────────────"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/pre-inventory-v1-$TIMESTAMP.sql"
echo "▶ Backing up database to: $BACKUP_FILE"
$COMPOSE exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-vetrx_app}" \
  "${POSTGRES_DB:-vetrx_production}" \
  > "$BACKUP_FILE"
echo "✅ Backup complete: $(du -sh $BACKUP_FILE | cut -f1)"

# ─── Step 3: Pull latest main branch ─────────────────────────────────────────
echo ""
echo "─── Step 3: Pull latest code from main ──────────────────────────────"
git fetch origin main
git checkout main
git pull origin main
echo "✅ Code updated. HEAD is now: $(git log --oneline -1)"

# ─── Step 4: Build new Docker images ─────────────────────────────────────────
echo ""
echo "─── Step 4: Build production Docker images ──────────────────────────"
echo "▶ Building backend image..."
$COMPOSE build backend
echo "▶ Building frontend image..."
$COMPOSE build frontend
echo "▶ Building website image..."
$COMPOSE build website
echo "✅ All images built"

# ─── Step 5: Run Prisma migrations ───────────────────────────────────────────
echo ""
echo "─── Step 5: Run Prisma database migrations ──────────────────────────"
echo "▶ Applying all pending migrations (including inventory_addon_v1)..."
$COMPOSE run --rm backend npx prisma migrate deploy --schema=./prisma/schema.prisma
echo "✅ Migrations applied"

# ─── Step 6: Restart services with zero downtime ────────────────────────────
echo ""
echo "─── Step 6: Rolling restart of application services ─────────────────"
echo "▶ Restarting backend (non-destructive)..."
$COMPOSE up -d --no-deps backend
sleep 5

echo "▶ Restarting frontend..."
$COMPOSE up -d --no-deps frontend
sleep 3

echo "▶ Restarting website..."
$COMPOSE up -d --no-deps website
echo "✅ Services restarted"

# ─── Step 7: Health checks ───────────────────────────────────────────────────
echo ""
echo "─── Step 7: Health verification ────────────────────────────────────"
sleep 8

echo "▶ Backend liveness check..."
if curl -sf http://127.0.0.1:4000/api/health > /dev/null; then
  echo "✅ Backend is UP"
else
  echo "❌ Backend health check FAILED — check logs:"
  $COMPOSE logs --tail=50 backend
  exit 1
fi

echo "▶ Backend readiness check (DB connected)..."
READY_RESPONSE=$(curl -sf http://127.0.0.1:4000/api/ready || echo "FAILED")
echo "   Response: $READY_RESPONSE"
if echo "$READY_RESPONSE" | grep -q '"status":"ready"'; then
  echo "✅ Backend DB is CONNECTED and READY"
else
  echo "❌ Backend readiness check FAILED"
  $COMPOSE logs --tail=50 backend
  exit 1
fi

echo "▶ Frontend static server check..."
if curl -sf http://127.0.0.1:3000/healthz > /dev/null; then
  echo "✅ Frontend NGINX is UP"
else
  echo "⚠️  Frontend healthz not responding (may still be starting)"
fi

echo "▶ Website static server check..."
if curl -sf http://127.0.0.1:3001/healthz > /dev/null; then
  echo "✅ Website NGINX is UP"
else
  echo "⚠️  Website healthz not responding (may still be starting)"
fi

# ─── Step 8: Final container status ─────────────────────────────────────────
echo ""
echo "─── Step 8: Final container status ─────────────────────────────────"
$COMPOSE ps

# ─── Step 9: Tail backend logs for 10 seconds to confirm clean startup ────────
echo ""
echo "─── Step 9: Backend startup log (10s) ──────────────────────────────"
timeout 10 $COMPOSE logs -f backend 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║   ✅ DEPLOYMENT COMPLETE                                         ║"
echo "║                                                                  ║"
echo "║   Backup saved to: $BACKUP_FILE"
echo "║                                                                  ║"
echo "║   Next steps:                                                    ║"
echo "║   1. Visit https://app.vetrx.brightbase.in and verify login      ║"
echo "║   2. Provision inventory_management entitlement for a test user  ║"
echo "║   3. Verify /inventory route is visible with the add-on active   ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
