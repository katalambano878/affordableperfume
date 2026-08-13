import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendOrderConfirmation } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import {
    finalizeCallbackEvent,
    markPaymentAttemptSuccessful,
    recordCallbackEvent,
} from '@/lib/payment/records';

/**
 * Moolre Callback Payload Structure (from their actual API):
 * {
 *   "status": 1,
 *   "code": "P01",
 *   "message": "Transaction Successful",
 *   "data": {
 *     "txstatus": 1,   // live payloads use txstatus (docs sometimes say txtstatus)
 *     "payer": "233535998837",
 *     "terminalid": "",
 *     "accountnumber": "10789906062911",
 *     "name": "",
 *     "amount": "2",
 *     "value": "2",
 *     "transactionid": "42252702",
 *     "externalref": "ORD-1770330034217-441",
 *     "thirdpartyref": "74658410493"
 *   },
 *   "secret": "c23bc2ab-...",
 *   "ts": "2026-02-05 22:21:16",
 *   "go": null
 * }
 */

export async function POST(req: Request) {
    console.log('[Callback] POST received at', new Date().toISOString());

    try {
        // Rate limiting
        const clientId = getClientIdentifier(req);
        const rateLimitResult = checkRateLimit(`callback:${clientId}`, RATE_LIMITS.callback);

        if (!rateLimitResult.success) {
            console.warn('[Callback] Rate limited:', clientId);
            return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
        }

        let body: any = {};
        const contentType = req.headers.get('content-type') || '';

        // Parse body
        try {
            if (contentType.includes('application/json')) {
                body = await req.json();
            } else if (contentType.includes('form')) {
                const formData = await req.formData();
                body = Object.fromEntries(formData.entries());
            } else {
                const rawText = await req.text();
                try {
                    body = JSON.parse(rawText);
                } catch {
                    try {
                        body = Object.fromEntries(new URLSearchParams(rawText).entries());
                    } catch {
                        console.warn('[Callback] Could not parse body');
                    }
                }
            }
        } catch (parseError) {
            console.error('[Callback] Body parsing failed');
            return NextResponse.json({ success: false, message: 'Invalid Request Body' }, { status: 400 });
        }

        console.log('[Callback] Body keys:', Object.keys(body).join(', '));
        console.log('[Callback] Data keys:', body.data ? Object.keys(body.data).join(', ') : 'no data object');

        // ============================================================
        // EXTRACT FIELDS - Moolre nests payment data inside body.data
        // ============================================================
        const data = body.data || {};

        // ============================================================
        // SECURITY: Verify callback secret (Moolre puts it in body.data.secret)
        // ============================================================
        const expectedSecret = process.env.MOOLRE_CALLBACK_SECRET;
        const callbackSecret = body.secret || data.secret;
        if (expectedSecret) {
            if (!callbackSecret || callbackSecret !== expectedSecret) {
                console.error('[Callback] Secret mismatch or missing! Rejecting callback.');
                return NextResponse.json({ success: false, message: 'Invalid callback signature' }, { status: 403 });
            }
        } else {
            console.warn('[Callback] WARNING: MOOLRE_CALLBACK_SECRET not configured. Callback origin cannot be verified.');
        }

        // Order reference: check body.data.externalref first, then top-level fallbacks
        const meta = data.metadata || body.metadata || {};
        const rawExternalRef =
            data.externalref ||
            data.external_reference ||
            data.orderRef ||
            body.externalref ||
            body.orderRef ||
            body.external_reference ||
            meta.original_order_number;

        // Strip retry suffix (e.g., "ORD-123-R1770000000" -> "ORD-123")
        const merchantOrderRef = rawExternalRef
            ? String(rawExternalRef).replace(/-R\d+$/, '')
            : undefined;

        // Moolre's transaction reference
        const moolreReference =
            data.transactionid ||
            data.thirdpartyref ||
            body.reference ||
            'callback';

        // Payment status: body.status === 1 means API call succeeded.
        // Moolre has used both `txtstatus` (docs) and `txstatus` (live payloads).
        const apiStatus = body.status;
        const txStatus = data.txtstatus ?? data.txstatus ?? body.txtstatus ?? body.txstatus;
        const messageStr = String(body.message || data.message || '').toLowerCase();

        console.log('[Callback] Order ref:', merchantOrderRef,
            '| API status:', apiStatus,
            '| TX status:', txStatus,
            '| Message:', body.message,
            '| Moolre ref:', moolreReference);

        if (!merchantOrderRef) {
            console.error('[Callback] Missing order reference. Body:', JSON.stringify(body).substring(0, 500));
            return NextResponse.json({ success: false, message: 'Missing order reference' }, { status: 400 });
        }

        const signatureValid = expectedSecret
            ? !!(callbackSecret && callbackSecret === expectedSecret)
            : null;

        const callbackRecord = await recordCallbackEvent({
            gateway: 'moolre',
            externalEventId: moolreReference ? String(moolreReference) : null,
            eventType: 'moolre_callback',
            internalPaymentRef: rawExternalRef ? String(rawExternalRef) : null,
            gatewayRef: moolreReference ? String(moolreReference) : null,
            orderNumber: merchantOrderRef,
            payload: body,
            signatureValid,
            processingStatus: 'received',
            metadata: { ts: body.ts || null },
        });

        if (callbackRecord.isDuplicate) {
            console.log('[Callback] Duplicate event ignored for', merchantOrderRef);
            return NextResponse.json({ success: true, message: 'Duplicate callback ignored' });
        }

        // ============================================================
        // SECURITY: Strict success validation
        // ============================================================
        const apiOk = (apiStatus === 1 || apiStatus === '1');
        const txOk =
            txStatus === 1 ||
            txStatus === '1' ||
            String(txStatus || '').toLowerCase() === 'success' ||
            String(txStatus || '').toLowerCase() === 'successful';
        const messageOk = messageStr.includes('successful') || messageStr.includes('success');

        // Require API status, TX status, or an explicit success message —
        // and never treat clear failure messages as success.
        const isSuccess =
            (apiOk || txOk || messageOk) &&
            !messageStr.includes('fail') &&
            !messageStr.includes('error') &&
            !messageStr.includes('declined');

        if (isSuccess) {
            console.log(`[Callback] Payment SUCCESS for Order ${merchantOrderRef}`);

            // Check if order exists
            const { data: existingOrder, error: fetchError } = await supabaseAdmin
                .from('orders')
                .select('id, order_number, payment_status, total, metadata')
                .eq('order_number', merchantOrderRef)
                .single();

            if (fetchError || !existingOrder) {
                console.error('[Callback] Order not found:', merchantOrderRef);
                await finalizeCallbackEvent({ id: callbackRecord.id }, 'rejected', 'Order not found');
                return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
            }

            // Already paid - idempotent
            if (existingOrder.payment_status === 'paid') {
                console.log('[Callback] Order already paid, skipping:', merchantOrderRef);
                await markPaymentAttemptSuccessful({
                    internalRef: rawExternalRef ? String(rawExternalRef) : null,
                    orderNumber: merchantOrderRef,
                    gatewayRef: String(moolreReference),
                    amountPaid: Number(existingOrder.total),
                });
                await finalizeCallbackEvent({ id: callbackRecord.id }, 'ignored_duplicate', 'Order already paid');
                return NextResponse.json({ success: true, message: 'Order already processed' });
            }

            // ============================================================
            // SECURITY: Amount required and must match order total
            // ============================================================
            const rawAmount = data.amount ?? body.amount;
            if (rawAmount == null || rawAmount === '') {
                console.error('[Callback] MISSING AMOUNT — REJECTING! Order:', merchantOrderRef);
                await finalizeCallbackEvent({ id: callbackRecord.id }, 'rejected', 'Missing amount');
                return NextResponse.json({
                    success: false,
                    message: 'Payment amount missing from callback'
                }, { status: 400 });
            }
            const callbackAmount = parseFloat(String(rawAmount));
            const expectedAmount = Number(existingOrder.total);
            if (Number.isNaN(callbackAmount) || Math.abs(callbackAmount - expectedAmount) > 0.01) {
                console.error('[Callback] AMOUNT MISMATCH — REJECTING! Expected:', expectedAmount, 'Got:', callbackAmount, 'Order:', merchantOrderRef);
                await finalizeCallbackEvent(
                    { id: callbackRecord.id },
                    'rejected',
                    `Amount mismatch expected=${expectedAmount} got=${callbackAmount}`
                );
                return NextResponse.json({
                    success: false,
                    message: 'Payment amount does not match order total'
                }, { status: 400 });
            }

            // Mark order as paid via RPC
            const { data: orderJson, error: updateError } = await supabaseAdmin
                .rpc('mark_order_paid', {
                    order_ref: merchantOrderRef,
                    moolre_ref: String(moolreReference)
                });

            if (updateError) {
                console.error('[Callback] RPC Error:', updateError.message);
                await finalizeCallbackEvent({ id: callbackRecord.id }, 'error', updateError.message);
                return NextResponse.json({ success: false, message: 'Database update failed' }, { status: 500 });
            }

            if (!orderJson) {
                console.error('[Callback] Order not found after RPC:', merchantOrderRef);
                await finalizeCallbackEvent({ id: callbackRecord.id }, 'error', 'Order missing after RPC');
                return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
            }

            await markPaymentAttemptSuccessful({
                internalRef: rawExternalRef ? String(rawExternalRef) : null,
                orderNumber: merchantOrderRef,
                gatewayRef: String(moolreReference),
                amountPaid: callbackAmount,
            });

            // Persist MoMo SMS Transaction Id for receipt matching
            const thirdpartyref = data.thirdpartyref ?? body.thirdpartyref;
            if (thirdpartyref && orderJson.id) {
                try {
                    const prevMeta =
                        orderJson.metadata && typeof orderJson.metadata === 'object'
                            ? orderJson.metadata
                            : {};
                    const { data: refreshed } = await supabaseAdmin
                        .from('orders')
                        .update({
                            metadata: {
                                ...prevMeta,
                                moolre_thirdpartyref: String(thirdpartyref),
                                moolre_payer: data.payer ? String(data.payer) : prevMeta.moolre_payer,
                            },
                        })
                        .eq('id', orderJson.id)
                        .select('metadata')
                        .maybeSingle();
                    if (refreshed?.metadata) {
                        orderJson.metadata = refreshed.metadata;
                    }
                } catch (metaErr: any) {
                    console.warn('[Callback] Could not store thirdpartyref:', metaErr?.message);
                }
            }

            await finalizeCallbackEvent({ id: callbackRecord.id }, 'processed');

            console.log(
                '[Callback] Order updated!',
                JSON.stringify({
                    order: merchantOrderRef,
                    id: orderJson.id,
                    status: orderJson.status,
                    moolreRef: String(moolreReference),
                    thirdpartyref: thirdpartyref ? String(thirdpartyref) : undefined,
                    amount: callbackAmount,
                    verdict: 'marked_paid',
                })
            );

            // ACK Moolre immediately — never block callback success on SMS/email/stats.
            // Secondary work runs in the background on this long-lived Node process.
            void (async () => {
                try {
                    if (orderJson.email) {
                        await supabaseAdmin.rpc('update_customer_stats', {
                            p_customer_email: orderJson.email,
                            p_order_total: orderJson.total
                        });
                    }
                } catch (statsError: any) {
                    console.error('[Callback] Customer stats failed:', statsError.message);
                }

                try {
                    console.log('[Callback] Sending notifications for:', orderJson.order_number);
                    await sendOrderConfirmation(orderJson);
                    console.log('[Callback] Notifications sent!');
                } catch (notifyError: any) {
                    console.error('[Callback] Notification failed:', notifyError.message);
                }
            })();

            return NextResponse.json({ success: true, message: 'Payment verified and Order Updated' });

        } else {
            // Payment failed — never overwrite an already-paid order
            console.log(`[Callback] Payment FAILED for ${merchantOrderRef} | Status: ${apiStatus} | TX: ${txStatus}`);

            const { data: existingOrder } = await supabaseAdmin
                .from('orders')
                .select('id, payment_status, metadata')
                .eq('order_number', merchantOrderRef)
                .maybeSingle();

            if (existingOrder?.payment_status === 'paid') {
                await finalizeCallbackEvent(
                    { id: callbackRecord.id },
                    'ignored_duplicate',
                    'Delayed failure after success ignored'
                );
                return NextResponse.json({ success: true, message: 'Order already paid; failure ignored' });
            }

            if (existingOrder) {
                const prevMeta =
                    existingOrder.metadata && typeof existingOrder.metadata === 'object'
                        ? existingOrder.metadata
                        : {};
                await supabaseAdmin
                    .from('orders')
                    .update({
                        payment_status: 'failed',
                        metadata: {
                            ...prevMeta,
                            moolre_reference: moolreReference,
                            failure_reason: body.message || 'Payment failed',
                        },
                    })
                    .eq('order_number', merchantOrderRef)
                    .neq('payment_status', 'paid');
            }

            await finalizeCallbackEvent(
                { id: callbackRecord.id },
                'processed',
                body.message || 'Payment not successful'
            );
            return NextResponse.json({ success: false, message: 'Payment not successful' });
        }

    } catch (error: any) {
        console.error('[Callback] Critical Error:', error.message);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    return NextResponse.json({ message: 'Moolre callback endpoint ready', timestamp: new Date().toISOString() });
}
