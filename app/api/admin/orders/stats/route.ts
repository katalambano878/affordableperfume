import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { isPlainPostgres } from '@/lib/db/mode';
import { getPool } from '@/lib/db/pool';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    if (isPlainPostgres()) {
      const pool = getPool();
      const { rows } = await pool.query<{
        total: string;
        paid: string;
        awaiting: string;
        pending: string;
        processing: string;
        shipped: string;
        delivered: string;
        cancelled: string;
      }>(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE payment_status::text = 'paid')::int AS paid,
          COUNT(*) FILTER (WHERE payment_status::text IS DISTINCT FROM 'paid')::int AS awaiting,
          COUNT(*) FILTER (WHERE status::text = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE status::text = 'processing')::int AS processing,
          COUNT(*) FILTER (WHERE status::text = 'shipped')::int AS shipped,
          COUNT(*) FILTER (WHERE status::text = 'delivered')::int AS delivered,
          COUNT(*) FILTER (WHERE status::text = 'cancelled')::int AS cancelled
        FROM orders
      `);

      const row = rows[0] || {
        total: 0,
        paid: 0,
        awaiting: 0,
        pending: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
      };

      return NextResponse.json({
        success: true,
        total: Number(row.total),
        paid: Number(row.paid),
        awaiting: Number(row.awaiting),
        byStatus: {
          all: Number(row.total),
          pending: Number(row.pending),
          processing: Number(row.processing),
          shipped: Number(row.shipped),
          delivered: Number(row.delivered),
          cancelled: Number(row.cancelled),
        },
      });
    }

    const { count: total, error: totalError } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true });
    if (totalError) throw new Error(totalError.message);

    const { count: paid, error: paidError } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'paid');
    if (paidError) throw new Error(paidError.message);

    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
    const byStatus: Record<string, number> = { all: total || 0 };
    for (const status of statuses) {
      const { count, error } = await supabaseAdmin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', status);
      if (error) throw new Error(error.message);
      byStatus[status] = count || 0;
    }

    return NextResponse.json({
      success: true,
      total: total || 0,
      paid: paid || 0,
      awaiting: (total || 0) - (paid || 0),
      byStatus,
    });
  } catch (err: any) {
    console.error('[AdminOrderStats]', err.message);
    return NextResponse.json(
      { success: false, error: err.message || 'Stats failed' },
      { status: 500 }
    );
  }
}
