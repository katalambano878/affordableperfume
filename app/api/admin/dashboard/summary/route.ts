import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { isPlainPostgres } from '@/lib/db/mode';
import { getPool } from '@/lib/db/pool';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Aggregated admin dashboard data — never loads full orders table into the browser.
 */
export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    if (isPlainPostgres()) {
      const pool = getPool();
      const { rows: aggRows } = await pool.query<{
        total_orders: string;
        paid_orders: string;
        revenue: string;
        customers: string;
      }>(`
        SELECT
          COUNT(*)::int AS total_orders,
          COUNT(*) FILTER (WHERE payment_status::text = 'paid')::int AS paid_orders,
          COALESCE(SUM(total) FILTER (WHERE payment_status::text = 'paid'), 0)::float8 AS revenue,
          COUNT(DISTINCT NULLIF(lower(email), ''))::int AS customers
        FROM orders
      `);

      const agg = aggRows[0] || {
        total_orders: 0,
        paid_orders: 0,
        revenue: 0,
        customers: 0,
      };

      const { rows: chartRows } = await pool.query<{ day: string; revenue: string }>(`
        SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
               COALESCE(SUM(total), 0)::float8 AS revenue
        FROM orders
        WHERE payment_status::text = 'paid'
          AND created_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days'
        GROUP BY 1
        ORDER BY 1
      `);

      const { rows: recentRows } = await pool.query(`
        SELECT id, order_number, email, created_at, total, status, shipping_address
        FROM orders
        WHERE payment_status::text = 'paid'
        ORDER BY created_at DESC
        LIMIT 5
      `);

      const { rows: lowStock } = await pool.query(`
        SELECT name, quantity
        FROM products
        WHERE quantity < 10
        ORDER BY quantity ASC
        LIMIT 5
      `);

      const { rows: topProducts } = await pool.query(`
        SELECT p.id, p.slug, p.name, p.quantity,
               (
                 SELECT pi.url FROM product_images pi
                 WHERE pi.product_id = p.id
                 ORDER BY COALESCE(pi.position, 0) ASC, pi.created_at ASC NULLS LAST
                 LIMIT 1
               ) AS image
        FROM products p
        ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST
        LIMIT 4
      `);

      const totalOrders = Number(agg.total_orders) || 0;
      const paidOrders = Number(agg.paid_orders) || 0;
      const revenue = Number(agg.revenue) || 0;
      const customers = Number(agg.customers) || 0;
      const avgOrderValue = paidOrders > 0 ? revenue / paidOrders : 0;

      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - (6 - i));
        return d.toISOString().slice(0, 10);
      });
      const chartMap = Object.fromEntries(last7Days.map((d) => [d, 0]));
      for (const row of chartRows) {
        if (chartMap[row.day] !== undefined) chartMap[row.day] = Number(row.revenue) || 0;
      }

      return NextResponse.json({
        success: true,
        stats: {
          revenue,
          totalOrders,
          paidOrders,
          customers,
          avgOrderValue,
        },
        chart: last7Days.map((date) => ({
          date: new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          }),
          revenue: chartMap[date] || 0,
        })),
        recentOrders: recentRows,
        lowStock,
        topProducts,
      });
    }

    // Hosted fallback (limited)
    const { count: totalOrders } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true });
    const { data: paid } = await supabaseAdmin
      .from('orders')
      .select('total')
      .eq('payment_status', 'paid')
      .limit(5000);
    const revenue = (paid || []).reduce(
      (s: number, o: { total?: number | string | null }) => s + Number(o.total || 0),
      0
    );

    return NextResponse.json({
      success: true,
      stats: {
        revenue,
        totalOrders: totalOrders || 0,
        paidOrders: paid?.length || 0,
        customers: 0,
        avgOrderValue: paid?.length ? revenue / paid.length : 0,
      },
      chart: [],
      recentOrders: [],
      lowStock: [],
      topProducts: [],
    });
  } catch (err: any) {
    console.error('[AdminDashboardSummary]', err.message);
    return NextResponse.json(
      { success: false, error: err.message || 'Dashboard summary failed' },
      { status: 500 }
    );
  }
}
