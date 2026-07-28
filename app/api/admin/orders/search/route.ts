import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { isPlainPostgres } from '@/lib/db/mode';
import { getPool } from '@/lib/db/pool';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ORDER_FIELDS = `
  id,
  order_number,
  email,
  total,
  status,
  payment_status,
  payment_method,
  shipping_method,
  created_at,
  phone,
  shipping_address,
  metadata,
  order_items (
    quantity,
    product_name
  )
`;

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (q.length < 2) {
    return NextResponse.json({ success: true, orders: [] });
  }

  const pattern = `%${q.replace(/[%_\\]/g, '\\$&')}%`;

  try {
    if (isPlainPostgres()) {
      const pool = getPool();
      const { rows } = await pool.query(
        `
        SELECT id
        FROM orders
        WHERE order_number ILIKE $1
           OR email ILIKE $1
           OR COALESCE(phone, '') ILIKE $1
           OR COALESCE(metadata->>'tracking_number', '') ILIKE $1
           OR COALESCE(metadata->>'first_name', '') ILIKE $1
           OR COALESCE(metadata->>'last_name', '') ILIKE $1
        ORDER BY created_at DESC
        LIMIT 50
        `,
        [pattern]
      );

      if (!rows.length) {
        return NextResponse.json({ success: true, orders: [] });
      }

      const ids = rows.map((r) => r.id);
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select(ORDER_FIELDS)
        .in('id', ids)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, orders: data || [] });
    }

    const { data: primary, error: primaryError } = await supabaseAdmin
      .from('orders')
      .select(ORDER_FIELDS)
      .or(`order_number.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (primaryError) throw new Error(primaryError.message);

    const { data: byTracking, error: trackingError } = await supabaseAdmin
      .from('orders')
      .select(ORDER_FIELDS)
      .filter('metadata->>tracking_number', 'ilike', pattern)
      .order('created_at', { ascending: false })
      .limit(50);

    if (trackingError) throw new Error(trackingError.message);

    const merged = new Map<string, Record<string, unknown>>();
    for (const order of [...(primary || []), ...(byTracking || [])]) {
      if (order && typeof order === 'object' && 'id' in order && order.id) {
        merged.set(String(order.id), order as Record<string, unknown>);
      }
    }

    const orders = Array.from(merged.values()).sort(
      (a, b) =>
        new Date(String(b.created_at || 0)).getTime() -
        new Date(String(a.created_at || 0)).getTime()
    );

    return NextResponse.json({ success: true, orders });
  } catch (err: any) {
    console.error('[AdminOrderSearch]', err.message);
    return NextResponse.json({ success: false, error: err.message || 'Search failed' }, { status: 500 });
  }
}
