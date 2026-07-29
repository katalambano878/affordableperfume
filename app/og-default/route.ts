import { NextResponse } from 'next/server';

/** Legacy OG path — static PNG avoids Windows @vercel/og build crashes. */
export async function GET(request: Request) {
  return NextResponse.redirect(new URL('/og.png', request.url), 308);
}
