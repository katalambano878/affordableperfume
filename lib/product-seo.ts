/** Shared helpers to generate product SEO fields. */

export function slugifyProduct(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function stripHtml(value: string): string {
  return (value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export type ProductSeoInput = {
  name: string;
  description?: string | null;
  categoryName?: string | null;
  siteName?: string | null;
  scentNotes?: string | null;
};

export type ProductSeoFields = {
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
  tags: string[];
  slug: string;
};

export function buildProductSeo(input: ProductSeoInput): ProductSeoFields {
  const siteName = (input.siteName || 'Affordable Perfumes GH').trim();
  const name = (input.name || 'Perfume').trim();
  const category = (input.categoryName || '').trim();
  const plainDesc = stripHtml(input.description || '');
  const notes = (input.scentNotes || '').trim();

  const seo_title = `${name} | Buy Online in Ghana | ${siteName}`.slice(0, 60);

  let seo_description = plainDesc;
  if (!seo_description) {
    seo_description = [
      `Shop authentic ${name}${category ? ` from ${category}` : ''} at ${siteName}.`,
      notes ? `Notes: ${notes}.` : '',
      'Fast nationwide delivery across Ghana. Verified quality fragrances at affordable prices.',
    ]
      .filter(Boolean)
      .join(' ');
  }
  seo_description = seo_description.slice(0, 160);

  const focus_keyword = name.split(/\s+/).slice(0, 4).join(' ');

  const tags = Array.from(
    new Set(
      [
        name,
        category,
        focus_keyword,
        'perfume Ghana',
        'fragrance Accra',
        'buy perfume online Ghana',
        'Affordable Perfumes GH',
      ]
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );

  return {
    seo_title,
    seo_description,
    focus_keyword,
    tags,
    slug: slugifyProduct(name),
  };
}
