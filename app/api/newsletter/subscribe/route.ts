import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendNewsletterWelcome } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const clientId = getClientIdentifier(request);
    const rate = checkRateLimit(`newsletter:${clientId}`, {
      maxRequests: 8,
      windowSeconds: 60,
    });
    if (!rate.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again in a minute.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const raw = typeof body.email === 'string' ? body.email : '';
    const email = raw.trim().toLowerCase();

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (email.length > 254) {
      return NextResponse.json({ error: 'Email is too long.' }, { status: 400 });
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('customers')
      .select('id, tags')
      .eq('email', email)
      .maybeSingle();

    if (fetchError) {
      console.error('[newsletter] fetch customer:', fetchError.message);
      return NextResponse.json({ error: 'Could not save subscription. Please try again.' }, { status: 500 });
    }

    const newsletterTag = 'newsletter';
    let isNewSubscriber = false;

    if (existing?.id) {
      const tags: string[] = Array.isArray(existing.tags) ? existing.tags : [];
      if (!tags.includes(newsletterTag)) {
        isNewSubscriber = true;
        const { error: updateError } = await supabaseAdmin
          .from('customers')
          .update({
            tags: [...tags, newsletterTag],
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (updateError) {
          console.error('[newsletter] update tags:', updateError.message);
          return NextResponse.json({ error: 'Could not save subscription. Please try again.' }, { status: 500 });
        }
      }
    } else {
      isNewSubscriber = true;
      const { error: insertError } = await supabaseAdmin.from('customers').insert({
        email,
        full_name: 'Newsletter subscriber',
        tags: [newsletterTag],
      });
      if (insertError) {
        console.error('[newsletter] insert:', insertError.message);
        return NextResponse.json({ error: 'Could not save subscription. Please try again.' }, { status: 500 });
      }
    }

    if (isNewSubscriber) {
      try {
        await sendNewsletterWelcome(email);
      } catch (e) {
        console.error('[newsletter] welcome email failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: isNewSubscriber
        ? 'Welcome to the club! Check your inbox for your welcome offer.'
        : 'You are already subscribed. Check your inbox for past offers.',
    });
  } catch (e) {
    console.error('[newsletter] unexpected:', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
