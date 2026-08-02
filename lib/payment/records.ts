import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type PaymentAttemptStatus =
  | 'initiated'
  | 'pending'
  | 'successful'
  | 'failed'
  | 'cancelled'
  | 'amount_mismatch'
  | 'error';

export function hashPaymentPayload(payload: unknown): string {
  const normalized = JSON.stringify(payload ?? {});
  return createHash('sha256').update(normalized).digest('hex');
}

export async function recordPaymentAttempt(input: {
  orderId: string;
  orderNumber: string;
  userId?: string | null;
  internalRef: string;
  expectedAmount: number;
  currency?: string;
  gateway?: string;
  metadata?: Record<string, unknown>;
  status?: PaymentAttemptStatus;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('payment_attempts').upsert(
    {
      order_id: input.orderId,
      order_number: input.orderNumber,
      user_id: input.userId || null,
      gateway: input.gateway || 'moolre',
      internal_ref: input.internalRef,
      expected_amount: input.expectedAmount,
      currency: input.currency || 'GHS',
      status: input.status || 'initiated',
      metadata: input.metadata || {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'internal_ref' }
  );

  if (error) {
    console.error('[PaymentRecords] attempt upsert failed:', error.message);
  }
}

export async function markPaymentAttemptSuccessful(input: {
  internalRef?: string | null;
  orderNumber?: string | null;
  gatewayRef?: string | null;
  amountPaid?: number | null;
}): Promise<void> {
  const patch = {
    status: 'successful' as const,
    gateway_ref: input.gatewayRef || null,
    amount_paid: input.amountPaid ?? null,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    if (input.internalRef) {
      const { error } = await supabaseAdmin
        .from('payment_attempts')
        .update(patch)
        .eq('internal_ref', input.internalRef);
      if (!error) return;
      console.error('[PaymentRecords] attempt update by ref failed:', error.message);
    }
    if (input.orderNumber) {
      const { error } = await supabaseAdmin
        .from('payment_attempts')
        .update(patch)
        .eq('order_number', input.orderNumber)
        .neq('status', 'successful');
      if (error) console.error('[PaymentRecords] attempt update by order failed:', error.message);
    }
  } catch (err: any) {
    console.error('[PaymentRecords] mark successful error:', err?.message);
  }
}

/**
 * Record a callback event. Returns false if this exact event was already processed
 * (unique on gateway+payload_hash).
 */
export async function recordCallbackEvent(input: {
  gateway?: string;
  externalEventId?: string | null;
  eventType?: string;
  internalPaymentRef?: string | null;
  gatewayRef?: string | null;
  orderNumber?: string | null;
  payload: unknown;
  signatureValid?: boolean | null;
  processingStatus?: string;
  failureReason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ isDuplicate: boolean; id?: string }> {
  const gateway = input.gateway || 'moolre';
  const payloadHash = hashPaymentPayload({
    gateway,
    externalEventId: input.externalEventId || null,
    orderNumber: input.orderNumber || null,
    gatewayRef: input.gatewayRef || null,
    // Exclude volatile secret from hash content used for identity
    body: sanitizeCallbackForHash(input.payload),
  });

  const row = {
    gateway,
    external_event_id: input.externalEventId || null,
    event_type: input.eventType || 'callback',
    internal_payment_ref: input.internalPaymentRef || null,
    gateway_ref: input.gatewayRef || null,
    order_number: input.orderNumber || null,
    payload_hash: payloadHash,
    signature_valid: input.signatureValid ?? null,
    processing_status: input.processingStatus || 'received',
    failure_reason: input.failureReason || null,
    metadata: input.metadata || {},
    received_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('payment_callback_events')
    .insert(row)
    .select('id')
    .maybeSingle();

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('duplicate') || msg.includes('unique') || error.code === '23505') {
      return { isDuplicate: true };
    }
    console.error('[PaymentRecords] callback insert failed:', error.message);
    return { isDuplicate: false };
  }

  return { isDuplicate: false, id: data?.id };
}

export async function finalizeCallbackEvent(
  payloadHashOrId: { id?: string; payloadHash?: string },
  status: 'processed' | 'ignored_duplicate' | 'rejected' | 'error',
  failureReason?: string | null
): Promise<void> {
  const patch = {
    processing_status: status,
    failure_reason: failureReason || null,
    processed_at: new Date().toISOString(),
  };
  try {
    if (payloadHashOrId.id) {
      await supabaseAdmin.from('payment_callback_events').update(patch).eq('id', payloadHashOrId.id);
      return;
    }
  } catch (err: any) {
    console.error('[PaymentRecords] finalize callback failed:', err?.message);
  }
}

function sanitizeCallbackForHash(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  delete clone.secret;
  if (clone.data && typeof clone.data === 'object') {
    const data = { ...(clone.data as Record<string, unknown>) };
    delete data.secret;
    clone.data = data;
  }
  return clone;
}
