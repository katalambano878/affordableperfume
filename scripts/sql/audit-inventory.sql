-- Readonly inventory for DATABASE_AUDIT_AND_REPAIR_REPORT
SELECT current_database() AS db, version() AS pg_version;

SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;

SELECT n.nspname AS schema, c.relname AS table_name, a.attname AS column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull AS not_null,
       pg_get_expr(ad.adbin, ad.adrelid) AS default_value
FROM pg_attribute a
JOIN pg_class c ON a.attrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY c.relname, a.attnum;

SELECT tc.table_name, tc.constraint_name, tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;

SELECT tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public'
ORDER BY tablename, indexname;

SELECT n.nspname, p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('mark_order_paid','upsert_customer_from_order','update_customer_stats','handle_new_user','reduce_stock_on_order')
ORDER BY 2;

SELECT 'orders' AS t, COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'wholesale_applications', COUNT(*) FROM wholesale_applications;

SELECT COUNT(*) AS orphan_order_items
FROM order_items oi LEFT JOIN orders o ON o.id = oi.order_id WHERE o.id IS NULL;

SELECT order_number, COUNT(*) FROM orders GROUP BY order_number HAVING COUNT(*) > 1 LIMIT 20;

SELECT COUNT(*) AS paid_orders FROM orders WHERE payment_status::text = 'paid';
SELECT COUNT(*) AS paid_missing_moolre_ref
FROM orders
WHERE payment_status::text = 'paid'
  AND COALESCE(metadata->>'moolre_transaction_id','') = ''
  AND COALESCE(metadata->>'external_reference','') = '';
