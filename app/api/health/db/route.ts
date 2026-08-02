import { NextResponse } from 'next/server';
import { isPlainPostgres } from '@/lib/db/mode';
import { getPool } from '@/lib/db/pool';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REQUIRED_TABLES = [
  'orders',
  'order_items',
  'products',
  'profiles',
  'customers',
  'contact_submissions',
  'payment_attempts',
  'payment_callback_events',
  'schema_migrations',
];

/**
 * Safe DB health check — no credentials, host, or row data exposed.
 */
export async function GET() {
  if (!isPlainPostgres()) {
    return NextResponse.json(
      { status: 'unhealthy', reason: 'plain_postgres_disabled' },
      { status: 503 }
    );
  }

  try {
    const pool = getPool();
    const ping = await pool.query('SELECT 1 AS ok');
    if (!ping.rows?.[0]) {
      return NextResponse.json({ status: 'unhealthy', reason: 'ping_failed' }, { status: 503 });
    }

    const { rows } = await pool.query<{ table_name: string }>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      `,
      [REQUIRED_TABLES]
    );

    const present = new Set(rows.map((r) => r.table_name));
    const missing = REQUIRED_TABLES.filter((t) => !present.has(t));

    if (missing.length) {
      return NextResponse.json(
        {
          status: 'degraded',
          reason: 'missing_required_tables',
          missingCount: missing.length,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      plainPostgres: true,
      requiredTables: REQUIRED_TABLES.length,
    });
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', reason: 'query_failed' },
      { status: 503 }
    );
  }
}
