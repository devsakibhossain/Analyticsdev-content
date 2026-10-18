#!/usr/bin/env bash
# ==============================================================================
# Database & Export Restore Utility for Website Lead Finder
# Usage: ./deploy/restore.sh [path_to_backup_archive.tar.gz]
# ==============================================================================

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-backup-archive.tar.gz>"
  echo "Available backups in backups/:"
  ls -lh backups/backup_leadfinder_*.tar.gz 2>/dev/null || echo "No backups found."
  exit 1
fi

ARCHIVE_FILE="$1"

if [ ! -f "$ARCHIVE_FILE" ]; then
  echo "❌ Error: Backup archive '$ARCHIVE_FILE' does not exist."
  exit 1
fi

echo "⚠️  WARNING: Restoring this backup will replace current database and exports!"
read -p "Are you sure you want to proceed? (y/N): " -r CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Operation aborted."
  exit 0
fi

echo "🛑 Stopping backend and worker containers..."
docker compose stop backend worker || true

echo "📦 Extracting backup archive: $ARCHIVE_FILE..."
mkdir -p data exports
tar -xzf "$ARCHIVE_FILE" -C data leads.db 2>/dev/null || tar -xzf "$ARCHIVE_FILE" -C .
chmod 644 data/leads.db

echo "🚀 Restarting backend and worker containers..."
docker compose start backend worker

echo "✅ Restore completed successfully."
