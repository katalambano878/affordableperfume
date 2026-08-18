#!/bin/bash
# Hourly: catch Moolre payments missed by webhook.
# Install on big-vps root crontab:
#   0 * * * * /data/fleet/scripts/affordable-reconcile-cron.sh
set -euo pipefail

LOG_DIR=/var/log/affordable
LOG_FILE="$LOG_DIR/reconcile-cron.log"
mkdir -p "$LOG_DIR"

CID=$(sudo docker ps --format '{{.Names}}' | grep -E '^slrbujar' | head -1 || true)
if [ -z "$CID" ]; then
  echo "$(date -Is) no affordable container" >>"$LOG_FILE"
  exit 1
fi

KEY=$(sudo docker exec "$CID" printenv SUPABASE_SERVICE_ROLE_KEY || true)
if [ -z "$KEY" ]; then
  echo "$(date -Is) missing SUPABASE_SERVICE_ROLE_KEY" >>"$LOG_FILE"
  exit 1
fi

DIGEST=$(printf '%s' "$KEY" | sha256sum | awk '{print $1}')
BASE="${AFFORDABLE_APP_URL:-https://www.affordableperfumesgh.com}"

CODE=$(curl -sS -o /tmp/affordable-reconcile.json -w '%{http_code}' \
  -H "Authorization: Bearer ${DIGEST}" \
  "${BASE}/api/cron/reconcile-moolre?limit=60&days=30" || echo 000)

BODY=$(head -c 500 /tmp/affordable-reconcile.json 2>/dev/null || true)
echo "$(date -Is) http=$CODE $BODY" >>"$LOG_FILE"
