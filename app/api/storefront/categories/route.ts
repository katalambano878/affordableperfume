import { NextResponse } from 'next/server';
import { serverDb } from '@/lib/server-db';

let cache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes — categories rarely change

export async function GET() {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
        return NextResponse.json(cache.data, {
            headers: {
                'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
                'X-Cache': 'HIT'
            }
        });
    }

    try {
        const { data, error } = await serverDb
            .from('categories')
            .select('id, name, slug, image_url, parent_id, metadata')
            .eq('status', 'active')
            .order('name');

        if (error) {
            console.error('[Storefront API] Categories error:', error);
            return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
        }

        cache = { data, timestamp: Date.now() };

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
                'X-Cache': 'MISS'
            }
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Storefront API] Error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
