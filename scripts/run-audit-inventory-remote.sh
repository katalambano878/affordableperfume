#!/usr/bin/env bash
set -eu
PW=$(sudo docker exec fleet-postgres printenv POSTGRES_PASSWORD)
OUT=/tmp/db-audit-inventory.txt
{
  echo "=== DB / VERSION ==="
  sudo docker exec -e PGPASSWORD="$PW" fleet-postgres psql -U postgres -d affordableperfume -c "SELECT current_database() AS db, version();"
  echo "=== TABLES ==="
  sudo docker exec -e PGPASSWORD="$PW" fleet-postgres psql -U postgres -d affordableperfume -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1;"
  echo "=== AUTH TABLES ==="
  sudo docker exec -e PGPASSWORD="$PW" fleet-postgres psql -U postgres -d affordableperfume -c "SELECT tablename FROM pg_tables WHERE schemaname='auth' ORDER BY 1;"
  echo "=== ROW COUNTS ==="
  sudo docker exec -e PGPASSWORD="$PW" fleet-postgres psql -U postgres -d affordableperfume -c "
    SELECT 'orders' AS t, COUNT(*)::bigint AS n FROM orders
    UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
    UNION ALL SELECT 'products', COUNT(*) FROM products
    UNION ALL SELECT 'customers', COUNT(*) FROM customers
    UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
    UNION ALL SELECT 'wholesale_applications', COUNT(*) FROM wholesale_applications
    UNION ALL SELECT 'auth.users', COUNT(*) FROM auth.users;"
  echo "=== ORPHANS / DUPS ==="
  sudo docker exec -e PGPASSWORD="$PW" fleet-postgres psql -U postgres -d affordableperfume -c "
    SELECT COUNT(*) AS orphan_order_items FROM order_items oi LEFT JOIN orders o ON o.id=oi.order_id WHERE o.id IS NULL;
    SELECT COUNT(*) AS duplicate_order_numbers FROM (SELECT order_number FROM orders GROUP BY order_number HAVING COUNT(*)>1) d;
    SELECT COUNT(*) AS paid_orders FROM orders WHERE payment_status::text='paid';
    SELECT COUNT(*) AS paid_no_gateway_ref FROM orders
      WHERE payment_status::text='paid'
        AND COALESCE(metadata->>'moolre_transaction_id','')=''
        AND COALESCE(metadata->>'external_reference','')=''
        AND COALESCE(metadata->>'moolre_external_ref','')='';"
  echo "=== FUNCTIONS ==="
  sudo docker exec -e PGPASSWORD="$PW" fleet-postgres psql -U postgres -d affordableperfume -c "
    SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
    ('mark_order_paid','upsert_customer_from_order','update_customer_stats','handle_new_user','reduce_stock_on_order')
    ORDER BY 1;"
  echo "=== CONSTRAINTS COUNT ==="
  sudo docker exec -e PGPASSWORD="$PW" fleet-postgres psql -U postgres -d affordableperfume -c "
    SELECT constraint_type, COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema='public' GROUP BY 1 ORDER BY 1;"
  echo "=== ORDERS COLUMNS ==="
  sudo docker exec -e PGPASSWORD="$PW" fleet-postgres psql -U postgres -d affordableperfume -c "
    SELECT column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' ORDER BY ordinal_position;"
  echo "=== WHOLESALE COLUMNS ==="
  sudo docker exec -e PGPASSWORD="$PW" fleet-postgres psql -U postgres -d affordableperfume -c "
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns WHERE table_schema='public' AND table_name='wholesale_applications' ORDER BY ordinal_position;"
  echo "=== CONTACT EXISTS ==="
  sudo docker exec -e PGPASSWORD="$PW" fleet-postgres psql -U postgres -d affordableperfume -c "
    SELECT to_regclass('public.contact_submissions') IS NOT NULL AS contact_submissions_exists;"
  echo "=== UNIQUE ON order_number ==="
  sudo docker exec -e PGPASSWORD="$PW" fleet-postgres psql -U postgres -d affordableperfume -c "
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname='public' AND tablename='orders' AND indexdef ILIKE '%order_number%';"
} > "$OUT" 2>&1
cat "$OUT"
