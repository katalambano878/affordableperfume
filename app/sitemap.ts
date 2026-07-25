import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.affordableperfumesgh.com';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: '2026-06-01', changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/shop`, lastModified: '2026-06-01', changeFrequency: 'daily', priority: 0.95 },
    { url: `${SITE_URL}/categories`, lastModified: '2026-06-01', changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/blog`, lastModified: '2026-06-01', changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: '2026-06-01', changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/contact`, lastModified: '2026-06-01', changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/faqs`, lastModified: '2026-06-01', changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/shipping`, lastModified: '2026-06-01', changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/terms`, lastModified: '2026-06-01', changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: '2026-06-01', changeFrequency: 'yearly', priority: 0.3 },
  ];
}
