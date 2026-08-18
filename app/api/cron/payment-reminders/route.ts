import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyCronAuth } from '@/lib/cron-auth';
import { sendPaymentLink } from '@/lib/notifications';
import { listPendingMoolreOrders, reconcileMoolreOrder } from '@/lib/payment/moolre';

// This endpoint is called by a cron job to send payment reminders
// for orders that haven't been paid within 15 minutes
export async function GET(request: Request) {
  try {
    const auth = verifyCronAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin;

    // First: catch paid-but-pending orders when Moolre callback was missed
    let reconciled = 0;
    try {
      const pendingForReconcile = await listPendingMoolreOrders(25, {
        days: 14,
        preferAttempted: true,
      });
      for (const order of pendingForReconcile) {
        const result = await reconcileMoolreOrder(order.order_number, {
          sendNotifications: true,
        });
        if (result.verdict === 'marked_paid') {
          reconciled += 1;
          console.log('[Payment Reminders] Reconciled paid order', order.order_number);
        }
      }
    } catch (reconcileErr: any) {
      console.error('[Payment Reminders] Reconcile pass failed:', reconcileErr?.message);
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: pendingOrders, error } = await supabase
      .from('orders')
      .select('id, order_number, email, phone, total, shipping_address, metadata')
      .neq('payment_status', 'paid')
      .eq('payment_reminder_sent', false)
      .lt('created_at', fifteenMinutesAgo)
      .order('created_at', { ascending: true })
      .limit(50); // Process max 50 at a time to avoid timeout

    if (error) {
      console.error('[Payment Reminders] Query error:', error);
      throw error;
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No pending reminders to send',
        processed: 0,
        reconciled,
      });
    }

    console.log(`[Payment Reminders] Found ${pendingOrders.length} orders to remind`);

    let sent = 0;
    let failed = 0;

    for (const order of pendingOrders) {
      try {
        // Send payment link notification
        await sendPaymentLink(order);

        // Mark as sent
        await supabase
          .from('orders')
          .update({ 
            payment_reminder_sent: true,
            payment_reminder_sent_at: new Date().toISOString()
          })
          .eq('id', order.id);

        sent++;
        console.log(`[Payment Reminders] Sent reminder for order ${order.order_number}`);
      } catch (err) {
        console.error(`[Payment Reminders] Failed for order ${order.order_number}:`, err);
        failed++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Processed ${pendingOrders.length} orders`,
      sent,
      failed,
      reconciled,
    });

  } catch (error: any) {
    console.error('[Payment Reminders] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
