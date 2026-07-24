import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        const {
            data: { user },
            error: authError,
        } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('is_wholesaler')
            .eq('id', user.id)
            .single();

        if (!profile?.is_wholesaler) {
            return NextResponse.json({ error: 'Not an approved wholesaler' }, { status: 403 });
        }

        let query = supabaseAdmin
            .from('products')
            .select(`
                id, name, slug, price, wholesale_price, wholesale_moq, compare_at_price, quantity, description, metadata, moq,
                categories(id, name, slug),
                product_images(url, position),
                product_variants(id, name, price, quantity, option1, option2)
            `)
            .eq('status', 'active')
            .eq('is_wholesale', true)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (category && category !== 'all') {
            query = query.eq('categories.slug', category);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Wholesale API] Products error:', error);
            return NextResponse.json({ error: 'Failed to fetch wholesale products' }, { status: 500 });
        }

        return NextResponse.json(data, {
            headers: { 'Cache-Control': 'private, no-store' }
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Wholesale API] Error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
