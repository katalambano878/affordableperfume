import { MetadataRoute } from 'next';

const SITE_URL = 'https://affordableperfumesgh.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/checkout',
          '/cart',
          '/account/',
          '/auth/',
          '/pay/',
          '/wholesale',
          '/wholesale/',
          '/order-success',
          '/pwa-settings',
          '/maintenance',
          '/offline',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/checkout',
          '/cart',
          '/account/',
          '/auth/',
          '/pay/',
          '/wholesale',
          '/wholesale/',
          '/order-success',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
