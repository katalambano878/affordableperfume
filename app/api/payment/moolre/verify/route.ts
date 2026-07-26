import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { reconcileMoolreOrder } from '@/lib/payment/moolre';

/**
 * Payment verification endpoint.
 * Called from the order-success page after the user completes payment on Moolre.
 *
 * SECURITY: We ONLY trust Moolre's API response for payment verification.
 */
export async function POST(req: Request) {
    try {
        const clientId = getClientIdentifier(req);
        const rateLimitResult = checkRateLimit(`verify:${clientId}`, RATE_LIMITS.payment);

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { success: false, message: 'Too many requests' },
                { status: 429 }
            );
        }

        const { orderNumber } = await req.json();

        if (!orderNumber || typeof orderNumber !== 'string') {
            return NextResponse.json({ success: false, message: 'Missing or invalid orderNumber' }, { status: 400 });
        }

        console.log('[Verify] Checking payment for:', orderNumber);
        const result = await reconcileMoolreOrder(orderNumber, { sendNotifications: true });

        if (result.verdict === 'already_paid' || result.verdict === 'marked_paid') {
            return NextResponse.json({
                success: true,
                status: result.status || 'processing',
                payment_status: 'paid',
                message: result.message,
            });
        }

        if (result.verdict === 'order_not_found') {
            return NextResponse.json({ success: false, message: result.message }, { status: 404 });
        }

        if (result.verdict === 'missing_credentials') {
            return NextResponse.json({
                success: false,
                status: result.status,
                payment_status: result.payment_status,
                message: result.message,
            }, { status: 503 });
        }

        if (result.verdict === 'not_moolre' || result.verdict === 'amount_mismatch') {
            return NextResponse.json({
                success: false,
                message: result.message,
            }, { status: 400 });
        }

        if (result.verdict === 'error') {
            return NextResponse.json({ success: false, message: result.message }, { status: 500 });
        }

        return NextResponse.json({
            success: false,
            status: result.status,
            payment_status: result.payment_status,
            message: result.message || 'Payment not yet confirmed by payment provider',
        });
    } catch (error: any) {
        console.error('[Verify] Error:', error.message);
        return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
    }
}
