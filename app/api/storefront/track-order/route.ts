import { NextResponse } from 'next/server';
import { serverDb } from '@/lib/server-db';
import { isPlainPostgres } from '@/lib/db/mode';
import { getPool } from '@/lib/db/pool';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

const ORDER_SELECT = `
  id,
  order_number,
  status,
  payment_status,
  total,
  email,
  created_at,
  shipping_address,
  metadata,
  order_items (
    id,
    product_name,
    variant_name,
    quantity,
    unit_price,
    metadata,
    products (
      product_images (url)
    )
  )
`;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findOrderByReference(reference: string) {
  const ref = reference.trim();
  if (!ref) return null;

  const { data: byNumber } = await serverDb
    .from('orders')
    .select(ORDER_SELECT)
    .eq('order_number', ref)
    .maybeSingle();

  if (byNumber) return byNumber;

  if (isPlainPostgres()) {
    const pool = getPool();
    const idRes = await pool.query<{ id: string }>(
      `SELECT id FROM orders WHERE metadata->>'tracking_number' = $1 LIMIT 1`,
      [ref]
    );
    const orderId = idRes.rows[0]?.id;
    if (!orderId) return null;

    const { data: byTracking } = await serverDb
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', orderId)
      .maybeSingle();
    return byTracking ?? null;
  }

  const { data: byTracking } = await serverDb
    .from('orders')
    .select(ORDER_SELECT)
    .filter('metadata->>tracking_number', 'eq', ref)
    .maybeSingle();

  return byTracking ?? null;
}

export async function POST(request: Request) {
  const clientId = getClientIdentifier(request);
  const rate = checkRateLimit(`track-order:${clientId}`, RATE_LIMITS.trackOrder);
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a moment and try again.' },
      {
        status: 429,
        headers: { 'X-RateLimit-Reset': String(rate.resetIn) },
      }
    );
  }

  let body: { reference?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  if (!reference) {
    return NextResponse.json({ error: 'Please enter your order or tracking number' }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: 'Please enter your email address for verification' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
  }

  try {
    const order = await findOrderByReference(reference);

    if (!order || normalizeEmail(order.email ?? '') !== normalizeEmail(email)) {
      return NextResponse.json(
        {
          error:
            'Order not found. Please check your order number, tracking number, and email, then try again.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ order });
  } catch (err) {
    console.error('[track-order]', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
