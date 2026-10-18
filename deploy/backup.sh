#!/usr/bin/env bash
# ==============================================================================
# Automated Database & Export Backup Utility for Website Lead Finder
# Keeps last 7 backups by default
# ==============================================================================

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

BACKUP_DIR="$APP_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_ARCHIVE="$BACKUP_DIR/backup_leadfinder_$TIMESTAMP.tar.gz"
RETENTION_COUNT=7

mkdir -p "$BACKUP_DIR"

echo "💾 Starting backup: $TIMESTAMP..."

# 1. Safe SQLite snapshot
TEMP_DB_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DB_DIR"' EXIT

if [ -f "$APP_DIR/data/leads.db" ]; then
  # Use Python to safely create an online SQLite backup snapshot without locking
  python3 -c "
import sqlite3
src = sqlite3.connect('$APP_DIR/data/leads.db')
dst = sqlite3.connect('$TEMP_DB_DIR/leads.db')
with dst:
    src.backup(dst)
dst.close()
src.close()
" || cp -p "$APP_DIR/data/leads.db" "$TEMP_DB_DIR/leads.db"
fi

# 2. Package database snapshot and exports into a tar.gz
tar -czf "$BACKUP_ARCHIVE" \
  -C "$TEMP_DB_DIR" . \
  -C "$APP_DIR" exports

echo "✅ Backup created successfully at:"
echo "   $BACKUP_ARCHIVE ($(du -h "$BACKUP_ARCHIVE" | cut -f1))"

# 3. Retention policy: Remove backups older than the most recent $RETENTION_COUNT
BACKUP_TOTAL=$(ls -1 "$BACKUP_DIR"/backup_leadfinder_*.tar.gz 2>/dev/null | wc -l || true)
if [ "$BACKUP_TOTAL" -gt "$RETENTION_COUNT" ]; then
  echo "🧹 Rotating old backups (retaining newest $RETENTION_COUNT)..."
  ls -1t "$BACKUP_DIR"/backup_leadfinder_*.tar.gz | tail -n +"$((RETENTION_COUNT + 1))" | xargs rm -f
fi

echo "✨ Backup procedure complete."
