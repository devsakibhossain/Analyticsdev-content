#!/usr/bin/env bash
# ==============================================================================
# One-Command Application Update Script for Website Lead Finder
# ==============================================================================

set -euo pipefail

echo "================================================================"
echo "🔄 Updating Website Lead Finder Application"
echo "================================================================"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

# 1. Pull latest code if git repo
if [ -d .git ]; then
  echo "📥 Pulling latest git repository changes..."
  git pull origin main || git pull origin master || true
else
  echo "ℹ️  Non-git directory or git remote not configured, proceeding with local build..."
fi

# 2. Rebuild images
echo "🔨 Building Docker images..."
docker compose build

# 3. Rolling restart
echo "🚀 Applying container updates..."
docker compose up -d --remove-orphans

# 4. Clean up dangling images to keep disk clean
echo "🧹 Pruning unused Docker images..."
docker image prune -f

# 5. Wait and test health check
echo "⏳ Verifying application health..."
sleep 5

MAX_RETRIES=12
RETRY_COUNT=0
HEALTHY=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s -f http://127.0.0.1/api/health > /dev/null 2>&1 || curl -s -f http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  echo "   Waiting for backend to respond... ($((RETRY_COUNT+1))/$MAX_RETRIES)"
  sleep 3
  RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ $HEALTHY -eq 1 ]; then
  echo "✅ Application updated and healthy!"
  docker compose ps
else
  echo "⚠️  Application started, but health check did not respond immediately. Check logs with:"
  echo "   docker compose logs --tail 50 backend"
fi
