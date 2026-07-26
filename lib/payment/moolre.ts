import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendOrderConfirmation } from '@/lib/notifications';

export type MoolreStatusResult = {
  status?: number | string;
  code?: string;
  message?: string;
  data?: {
    txstatus?: number | string;
    txtstatus?: number | string;
    status?: number | string;
    amount?: string | number;
    transactionid?: string | number;
    thirdpartyref?: string | number;
    externalref?: string;
    [key: string]: unknown;
  } | null;
  go?: unknown;
};

export type ReconcileVerdict =
  | 'already_paid'
  | 'marked_paid'
  | 'not_paid'
  | 'amount_mismatch'
  | 'not_moolre'
  | 'missing_credentials'
  | 'order_not_found'
  | 'error';

export type ReconcileResult = {
  orderNumber: string;
  email?: string | null;
  total?: number | string | null;
  verdict: ReconcileVerdict;
  message: string;
  moolreRef?: string;
  usedRef?: string;
  payment_status?: string;
  status?: string;
  moolre?: {
    code?: string;
    message?: string;
    txstatus?: number | string;
  };
};

function getMoolreCredentials() {
  const user = process.env.MOOLRE_API_USER;
  const pubkey = process.env.MOOLRE_API_PUBKEY;
  const account = process.env.MOOLRE_ACCOUNT_NUMBER;
  if (!user || !pubkey || !account) return null;
  return { user, pubkey, account };
}

export function isMoolrePaymentSuccessful(result: MoolreStatusResult | null | undefined): boolean {
  if (!result?.data) return false;

  const apiOk = result.status === 1 || result.status === '1';
  if (!apiOk) return false;

  const messageStr = String(result.message || '').toLowerCase();
  if (
    messageStr.includes('not found') ||
    messageStr.includes('fail') ||
    messageStr.includes('declined') ||
    messageStr.includes('error')
  ) {
    return false;
  }

  const tx = result.data.txstatus ?? result.data.txtstatus ?? result.data.status;
  const statusStr = String(tx ?? '').toLowerCase();
  const txOk =
    tx === 1 ||
    tx === '1' ||
    statusStr === 'success' ||
    statusStr === 'successful' ||
    statusStr === 'completed' ||
    statusStr === 'paid';
  const messageOk =
    messageStr.includes('successful') ||
    messageStr === 'success' ||
    messageStr.includes('transaction successful');

  return txOk || messageOk;
}

export async function fetchMoolrePaymentStatus(externalref: string): Promise<MoolreStatusResult> {
  const creds = getMoolreCredentials();
  if (!creds) {
    throw new Error('Missing Moolre API credentials');
  }

  const response = await fetch('https://api.moolre.com/open/transact/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-USER': creds.user,
      'X-API-PUBKEY': creds.pubkey,
    },
    body: JSON.stringify({
      type: 1,
      idtype: '1',
      id: externalref,
      accountnumber: creds.account,
    }),
  });

  return response.json();
}

export function orderRefsForMoolre(order: {
  order_number: string;
  metadata?: Record<string, unknown> | null;
}): string[] {
  const meta = order.metadata || {};
  const paymentRef = meta.moolre_payment_ref;
  return [typeof paymentRef === 'string' ? paymentRef : null, order.order_number].filter(
    (ref): ref is string => typeof ref === 'string' && ref.length > 0
  );
}

/**
 * Check Moolre for an order and mark paid when the provider confirms payment.
 */
export async function reconcileMoolreOrder(
  orderNumber: string,
  options: { sendNotifications?: boolean } = {}
): Promise<ReconcileResult> {
  const sendNotifications = options.sendNotifications !== false;

  if (!/^ORD-\d+-\d+$/.test(orderNumber)) {
    return {
      orderNumber,
      verdict: 'order_not_found',
      message: 'Invalid order number format',
    };
  }

  if (!getMoolreCredentials()) {
    return {
      orderNumber,
      verdict: 'missing_credentials',
      message: 'Payment verification unavailable',
    };
  }

  const { data: order, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, payment_status, status, total, email, phone, shipping_address, payment_method, metadata')
    .eq('order_number', orderNumber)
    .single();

  if (fetchError || !order) {
    return {
      orderNumber,
      verdict: 'order_not_found',
      message: 'Order not found',
    };
  }

  if (order.payment_status === 'paid') {
    return {
      orderNumber,
      email: order.email,
      total: order.total,
      verdict: 'already_paid',
      message: 'Order already paid',
      payment_status: order.payment_status,
      status: order.status,
    };
  }

  const method = order.payment_method || order.metadata?.payment_method;
  if (method && method !== 'moolre') {
    return {
      orderNumber,
      email: order.email,
      total: order.total,
      verdict: 'not_moolre',
      message: 'This order does not use Moolre payment',
      payment_status: order.payment_status,
      status: order.status,
    };
  }

  const refs = orderRefsForMoolre(order);
  let lastPayload: MoolreStatusResult | null = null;
  let usedRef: string | undefined;
  let moolreRef: string | undefined;
  let amountMismatch = false;

  for (const externalref of refs) {
    try {
      const payload = await fetchMoolrePaymentStatus(externalref);
      lastPayload = payload;
      console.log('[MoolreReconcile]', orderNumber, 'ref=', externalref, JSON.stringify(payload));

      if (!isMoolrePaymentSuccessful(payload)) continue;

      if (payload.data?.amount != null) {
        const paidAmount = parseFloat(String(payload.data.amount));
        const expectedAmount = Number(order.total);
        if (Math.abs(paidAmount - expectedAmount) > 0.01) {
          amountMismatch = true;
          continue;
        }
      }

      usedRef = externalref;
      moolreRef = String(
        payload.data?.transactionid || payload.data?.thirdpartyref || externalref || 'moolre-reconcile'
      );
      break;
    } catch (err: any) {
      console.warn('[MoolreReconcile] status error', orderNumber, err?.message);
    }
  }

  if (amountMismatch && !moolreRef) {
    return {
      orderNumber,
      email: order.email,
      total: order.total,
      verdict: 'amount_mismatch',
      message: 'Moolre payment amount does not match order total',
      payment_status: order.payment_status,
      status: order.status,
      moolre: {
        code: lastPayload?.code,
        message: lastPayload?.message,
        txstatus: lastPayload?.data?.txstatus ?? lastPayload?.data?.txtstatus,
      },
    };
  }

  if (!moolreRef) {
    return {
      orderNumber,
      email: order.email,
      total: order.total,
      verdict: 'not_paid',
      message: lastPayload?.message || 'Payment not yet confirmed by payment provider',
      payment_status: order.payment_status,
      status: order.status,
      moolre: {
        code: lastPayload?.code,
        message: lastPayload?.message,
        txstatus: lastPayload?.data?.txstatus ?? lastPayload?.data?.txtstatus,
      },
    };
  }

  const { data: orderJson, error: updateError } = await supabaseAdmin.rpc('mark_order_paid', {
    order_ref: orderNumber,
    moolre_ref: moolreRef,
  });

  if (updateError) {
    return {
      orderNumber,
      email: order.email,
      total: order.total,
      verdict: 'error',
      message: updateError.message || 'Failed to update order',
      usedRef,
      moolreRef,
    };
  }

  if (orderJson?.email) {
    try {
      await supabaseAdmin.rpc('update_customer_stats', {
        p_customer_email: orderJson.email,
        p_order_total: orderJson.total,
      });
    } catch (statsError: any) {
      console.error('[MoolreReconcile] Customer stats failed:', statsError.message);
    }
  }

  if (sendNotifications && orderJson) {
    try {
      await sendOrderConfirmation(orderJson);
    } catch (notifyError: any) {
      console.error('[MoolreReconcile] Notification failed:', notifyError.message);
    }
  }

  return {
    orderNumber,
    email: orderJson?.email ?? order.email,
    total: orderJson?.total ?? order.total,
    verdict: 'marked_paid',
    message: 'Payment verified with Moolre and order marked paid',
    usedRef,
    moolreRef,
    payment_status: 'paid',
    status: orderJson?.status || 'processing',
    moolre: {
      code: lastPayload?.code,
      message: lastPayload?.message,
      txstatus: lastPayload?.data?.txstatus ?? lastPayload?.data?.txtstatus,
    },
  };
}

export async function listPendingMoolreOrders(limit = 50) {
  const capped = Math.min(Math.max(limit, 1), 100);
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, email, total, payment_status, status, payment_method, metadata, created_at')
    .neq('payment_status', 'paid')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw new Error(error.message);

  const pending = (data || []).filter((order) => {
    const method = order.payment_method || order.metadata?.payment_method;
    return method === 'moolre';
  });

  return pending.slice(0, capped);
}
