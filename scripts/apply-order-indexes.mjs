import pg from 'pg';

const { Client } = pg;

const sqls = [
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_order_number ON orders (order_number)',
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tracking_number ON orders ((metadata->>'tracking_number'))",
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id ON order_items (order_id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_email_lower ON orders (lower(email))',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status_created ON orders (payment_status, created_at DESC)',
];

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
});

await client.connect();

for (const sql of sqls) {
  process.stdout.write(`${sql.slice(0, 72)}... `);
  try {
    await client.query(sql);
    console.log('OK');
  } catch (e) {
    console.log(`FAIL: ${e.message}`);
  }
}

const { rows } = await client.query(`
  SELECT indexname
  FROM pg_indexes
  WHERE indexname LIKE 'idx_orders%'
     OR indexname LIKE 'idx_order_items%'
  ORDER BY 1
`);
console.log('INDEXES:');
for (const r of rows) console.log(`  ${r.indexname}`);

await client.end();
