#!/usr/bin/env bash
set -eu
PW=$(sudo docker exec fleet-postgres printenv POSTGRES_PASSWORD)
run_sql() {
  local sql="$1"
  echo "RUN: ${sql:0:80}..."
  if sudo docker exec -e PGPASSWORD="$PW" fleet-postgres \
    psql -U postgres -d affordableperfume -v ON_ERROR_STOP=1 -c "$sql"; then
    echo OK
  else
    echo FAIL
  fi
}

run_sql "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_order_number ON orders (order_number);"
run_sql "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tracking_number ON orders ((metadata->>'tracking_number'));"
run_sql "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);"
run_sql "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_email_lower ON orders (lower(email));"
run_sql "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status_created ON orders (payment_status, created_at DESC);"

echo "--- indexes ---"
sudo docker exec -e PGPASSWORD="$PW" fleet-postgres \
  psql -U postgres -d affordableperfume -c \
  "SELECT indexname FROM pg_indexes WHERE tablename IN ('orders','order_items') AND (indexname LIKE 'idx_orders%' OR indexname LIKE 'idx_order_items%') ORDER BY 1;"
