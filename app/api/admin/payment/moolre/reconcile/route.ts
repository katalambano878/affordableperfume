import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import {
  listPendingMoolreOrders,
  reconcileMoolreOrder,
  type ReconcileResult,
} from '@/lib/payment/moolre';

/**
 * Admin Moolre reconciliation:
 * - POST { orderNumber } → check one pending order
 * - POST { mode: "pending", limit?: number } → check recent unpaid Moolre orders
 * - GET → list recent unpaid Moolre orders (no Moolre calls)
 */
export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') || 50);
    const orders = await listPendingMoolreOrders(limit);
    return NextResponse.json({
      success: true,
      count: orders.length,
      orders: orders.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        email: o.email,
        total: o.total,
        payment_status: o.payment_status,
        status: o.status,
        created_at: o.created_at,
        moolre_payment_ref: o.metadata?.moolre_payment_ref || null,
      })),
    });
  } catch (error: any) {
    console.error('[AdminReconcile] list failed:', error.message);
    return NextResponse.json({ success: false, message: error.message || 'Failed to list orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : '';
    const mode = body.mode === 'pending' ? 'pending' : 'single';
    const limit = Math.min(Math.max(Number(body.limit) || 40, 1), 80);

    if (mode === 'single') {
      if (!orderNumber) {
        return NextResponse.json({ success: false, message: 'Missing orderNumber' }, { status: 400 });
      }

      const result = await reconcileMoolreOrder(orderNumber, { sendNotifications: true });
      return NextResponse.json({
        success: result.verdict === 'already_paid' || result.verdict === 'marked_paid',
        result,
      });
    }

    const pending = await listPendingMoolreOrders(limit);
    const results: ReconcileResult[] = [];

    for (const order of pending) {
      const result = await reconcileMoolreOrder(order.order_number, { sendNotifications: true });
      results.push(result);
    }

    const summary = {
      checked: results.length,
      marked_paid: results.filter((r) => r.verdict === 'marked_paid').length,
      already_paid: results.filter((r) => r.verdict === 'already_paid').length,
      not_paid: results.filter((r) => r.verdict === 'not_paid').length,
      amount_mismatch: results.filter((r) => r.verdict === 'amount_mismatch').length,
      errors: results.filter((r) => r.verdict === 'error' || r.verdict === 'missing_credentials').length,
    };

    return NextResponse.json({
      success: true,
      summary,
      results,
    });
  } catch (error: any) {
    console.error('[AdminReconcile] failed:', error.message);
    return NextResponse.json({ success: false, message: error.message || 'Reconcile failed' }, { status: 500 });
  }
}
