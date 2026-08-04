import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
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

  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0);
  const limitRaw = Number(url.searchParams.get('limit') || 100) || 100;
  const limit = Math.min(Math.max(limitRaw, 1), 200);
  const to = offset + limit - 1;

  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(ORDER_FIELDS)
      .order('created_at', { ascending: false })
      .range(offset, to);

    if (error) throw new Error(error.message);

    const orders = data || [];
    return NextResponse.json({
      success: true,
      orders,
      offset,
      limit,
      hasMore: orders.length === limit,
    });
  } catch (err: any) {
    console.error('[AdminOrderList]', err.message);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to load orders' },
      { status: 500 }
    );
  }
}
