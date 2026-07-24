import { MetadataRoute } from 'next';
import { serverDb } from '@/lib/server-db';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
    let siteName = 'Affordable Perfumes GH';
    let siteDescription = 'Authentic perfumes delivered across Ghana.';

    try {
        const { data: name } = await serverDb
            .from('site_settings')
            .select('value')
            .eq('key', 'site_name')
            .single();
        if (name?.value) siteName = name.value;

        const { data: desc } = await serverDb
            .from('site_settings')
            .select('value')
            .eq('key', 'site_description')
            .single();
        if (desc?.value) siteDescription = desc.value;
    } catch (e) { }

    return {
        name: siteName,
        short_name: siteName.split(' ')[0] || 'Store',
        description: siteDescription,
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        dir: 'ltr',
        lang: 'en',
        categories: ['shopping', 'lifestyle', 'beauty'],
        icons: [
            { src: '/icon', sizes: '32x32', type: 'image/png', purpose: 'any' },
            { src: '/apple-icon', sizes: '180x180', type: 'image/png', purpose: 'any' },
            { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
            { name: 'Shop', short_name: 'Shop', description: 'Browse all perfumes', url: '/shop', icons: [{ src: '/icon', sizes: '32x32' }] },
            { name: 'Cart', short_name: 'Cart', description: 'View your cart', url: '/cart', icons: [{ src: '/icon', sizes: '32x32' }] },
            { name: 'Track Order', short_name: 'Track', description: 'Track order status', url: '/order-tracking', icons: [{ src: '/icon', sizes: '32x32' }] },
        ],
    };
}
