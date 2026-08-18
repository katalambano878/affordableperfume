import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { listPendingMoolreOrders, reconcileMoolreOrder } from '@/lib/payment/moolre';

export const maxDuration = 120;

/**
 * Hourly safety net: verify pending Moolre orders against Moolre status API
 * and mark paid + send confirmation when payment was missed by webhook.
 */
export async function GET(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 60), 1), 100);
  const days = Math.min(Math.max(Number(url.searchParams.get('days') || 30), 1), 90);

  try {
    const pending = await listPendingMoolreOrders(limit, { days, preferAttempted: true });

    const results: Array<{ orderNumber: string; verdict: string }> = [];
    let markedPaid = 0;
    let alreadyPaid = 0;
    let notPaid = 0;
    let errors = 0;

    for (const order of pending) {
      try {
        const result = await reconcileMoolreOrder(order.order_number, {
          sendNotifications: true,
        });
        results.push({ orderNumber: order.order_number, verdict: result.verdict });

        if (result.verdict === 'marked_paid') markedPaid += 1;
        else if (result.verdict === 'already_paid') alreadyPaid += 1;
        else if (result.verdict === 'error' || result.verdict === 'missing_credentials') errors += 1;
        else notPaid += 1;
      } catch (err: any) {
        errors += 1;
        results.push({
          orderNumber: order.order_number,
          verdict: `error:${err?.message || 'unknown'}`,
        });
      }
    }

    console.log(
      '[ReconcileCron]',
      JSON.stringify({
        checked: pending.length,
        markedPaid,
        alreadyPaid,
        notPaid,
        errors,
        days,
        limit,
      })
    );

    return NextResponse.json({
      success: true,
      summary: {
        checked: pending.length,
        marked_paid: markedPaid,
        already_paid: alreadyPaid,
        not_paid: notPaid,
        errors,
        days,
        limit,
      },
      marked: results.filter((r) => r.verdict === 'marked_paid'),
    });
  } catch (error: any) {
    console.error('[ReconcileCron] failed:', error?.message);
    return NextResponse.json({ success: false, message: error?.message || 'Reconcile failed' }, { status: 500 });
  }
}
