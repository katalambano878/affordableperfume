import { NextResponse } from 'next/server';
import { serverDb } from '@/lib/server-db';

// Simple in-memory cache
let cache: { data: Record<string, unknown>; timestamp: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes — products don't change frequently

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const featured = searchParams.get('featured') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');

    const cacheKey = `${featured}-${limit}-${category || 'all'}`;

    if (featured && cache && cache.data?.[cacheKey] && Date.now() - cache.timestamp < CACHE_TTL) {
        return NextResponse.json(cache.data[cacheKey], {
            headers: {
                'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
                'X-Cache': 'HIT'
            }
        });
    }

    try {
        let query = serverDb
            .from('products')
            .select(`
                id, name, slug, price, compare_at_price, quantity, description, metadata,
                categories(id, name, slug),
                product_images(url, position),
                product_variants(id, name, price, quantity)
            `)
            .order('created_at', { ascending: false });

        query = query.eq('status', 'active').or('is_wholesale.is.null,is_wholesale.eq.false');

        if (featured) {
            query = query.eq('featured', true).limit(limit);
        } else if (category) {
            query = query.limit(limit);
        } else {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Storefront API] Products error:', error);
            return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
        }

        if (!cache) cache = { data: {}, timestamp: Date.now() };
        cache.data[cacheKey] = data;
        cache.timestamp = Date.now();

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
                'X-Cache': 'MISS'
            }
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Storefront API] Error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
