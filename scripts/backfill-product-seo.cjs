/**
 * Backfill SEO for products missing seo_title / seo_description / tags / focus keyword.
 * Run inside the app container:
 *   node scripts/backfill-product-seo.mjs
 */
const { createRequire } = require('module');
const requireApp = createRequire('/app/package.json');
const { Client } = requireApp('pg');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSeo({ name, description, categoryName, siteName, scentNotes }) {
  const brand = (siteName || 'Affordable Perfumes GH').trim();
  const productName = (name || 'Perfume').trim();
  const category = (categoryName || '').trim();
  const plainDesc = stripHtml(description);
  const notes = (scentNotes || '').trim();

  const seo_title = `${productName} | Buy Online in Ghana | ${brand}`.slice(0, 60);
  let seo_description = plainDesc;
  if (!seo_description) {
    seo_description = [
      `Shop authentic ${productName}${category ? ` from ${category}` : ''} at ${brand}.`,
      notes ? `Notes: ${notes}.` : '',
      'Fast nationwide delivery across Ghana. Verified quality fragrances at affordable prices.',
    ]
      .filter(Boolean)
      .join(' ');
  }
  seo_description = seo_description.slice(0, 160);

  const focus_keyword = productName.split(/\s+/).slice(0, 4).join(' ');
  const tags = Array.from(
    new Set(
      [
        productName,
        category,
        focus_keyword,
        'perfume Ghana',
        'fragrance Accra',
        'buy perfume online Ghana',
        brand,
      ]
        .map((t) => String(t).trim())
        .filter(Boolean)
    )
  );

  return { seo_title, seo_description, focus_keyword, tags, slug: slugify(productName) };
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const siteRes = await c.query(
    `SELECT value FROM site_settings WHERE key = 'site_name' LIMIT 1`
  );
  let siteName = 'Affordable Perfumes GH';
  const rawSite = siteRes.rows[0]?.value;
  if (typeof rawSite === 'string') {
    try {
      const parsed = JSON.parse(rawSite);
      siteName = typeof parsed === 'string' ? parsed : String(parsed);
    } catch {
      siteName = rawSite.replace(/^"|"$/g, '');
    }
  }

  const { rows } = await c.query(`
    SELECT p.id, p.name, p.description, p.slug, p.seo_title, p.seo_description, p.tags, p.metadata,
           c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.created_at DESC
  `);

  let updated = 0;
  for (const p of rows) {
    const meta = p.metadata && typeof p.metadata === 'object' ? p.metadata : {};
    const needsTitle = !p.seo_title || !String(p.seo_title).trim();
    const needsDesc = !p.seo_description || !String(p.seo_description).trim();
    const needsTags = !Array.isArray(p.tags) || p.tags.length === 0;
    const needsFocus = !meta.seo_focus_keyword;
    const needsSlug = !p.slug || !String(p.slug).trim();

    if (!needsTitle && !needsDesc && !needsTags && !needsFocus && !needsSlug) continue;

    const seo = buildSeo({
      name: p.name,
      description: p.description,
      categoryName: p.category_name,
      siteName: typeof siteName === 'string' ? siteName.replace(/^"|"$/g, '') : 'Affordable Perfumes GH',
      scentNotes: meta.scent_notes,
    });

    const nextMeta = {
      ...meta,
      seo_focus_keyword: meta.seo_focus_keyword || seo.focus_keyword,
      seo_noindex: meta.seo_noindex === true,
    };

    // Avoid slug collisions if regenerating
    let nextSlug = p.slug;
    if (needsSlug) {
      nextSlug = seo.slug || p.id.slice(0, 8);
      const clash = await c.query(
        `SELECT id FROM products WHERE slug = $1 AND id <> $2 LIMIT 1`,
        [nextSlug, p.id]
      );
      if (clash.rows.length) nextSlug = `${nextSlug}-${p.id.slice(0, 6)}`;
    }

    await c.query(
      `UPDATE products
       SET seo_title = COALESCE(NULLIF(TRIM(seo_title), ''), $1),
           seo_description = COALESCE(NULLIF(TRIM(seo_description), ''), $2),
           tags = CASE WHEN tags IS NULL OR cardinality(tags) = 0 THEN $3::text[] ELSE tags END,
           slug = COALESCE(NULLIF(TRIM(slug), ''), $4),
           metadata = $5::jsonb,
           updated_at = NOW()
       WHERE id = $6`,
      [
        seo.seo_title,
        seo.seo_description,
        seo.tags,
        nextSlug,
        JSON.stringify(nextMeta),
        p.id,
      ]
    );
    updated += 1;
    console.log(`updated: ${p.name}`);
  }

  console.log(`\nDone. Updated ${updated} of ${rows.length} products.`);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
