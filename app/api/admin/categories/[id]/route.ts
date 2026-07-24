import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { serverDb } from '@/lib/server-db';
import { isPlainPostgres } from '@/lib/db/mode';
import { getPool } from '@/lib/db/pool';

type RouteCtx = { params: Promise<{ id: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function deleteCategoryCascade(categoryId: string) {
  if (isPlainPostgres()) {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rowCount: productCount } = await client.query(
        `UPDATE products SET category_id = NULL WHERE category_id = $1`,
        [categoryId]
      );

      const { rowCount: childCount } = await client.query(
        `UPDATE categories SET parent_id = NULL WHERE parent_id = $1`,
        [categoryId]
      );

      const del = await client.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);
      if ((del.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return { ok: false as const, reason: 'not_found' as const };
      }

      await client.query('COMMIT');
      return {
        ok: true as const,
        productsUncategorized: productCount ?? 0,
        subcategoriesOrphaned: childCount ?? 0,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  const { count: productCount } = await serverDb
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId);

  const { count: childCount } = await serverDb
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', categoryId);

  const { error: productErr } = await serverDb
    .from('products')
    .update({ category_id: null })
    .eq('category_id', categoryId);
  if (productErr) throw productErr;

  const { error: childErr } = await serverDb
    .from('categories')
    .update({ parent_id: null })
    .eq('parent_id', categoryId);
  if (childErr) throw childErr;

  const { data: deleted, error: deleteErr } = await serverDb
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .select('id')
    .maybeSingle();

  if (deleteErr) throw deleteErr;
  if (!deleted) {
    return { ok: false as const, reason: 'not_found' as const };
  }

  return {
    ok: true as const,
    productsUncategorized: productCount ?? 0,
    subcategoriesOrphaned: childCount ?? 0,
  };
}

export async function DELETE(request: Request, ctx: RouteCtx) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid category id' }, { status: 400 });
  }

  try {
    const result = await deleteCategoryCascade(id);
    if (!result.ok) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      productsUncategorized: result.productsUncategorized,
      subcategoriesOrphaned: result.subcategoriesOrphaned,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    console.error('[admin/categories DELETE]', err);
    return NextResponse.json(
      {
        error:
          message.includes('foreign key') || message.includes('violates')
            ? 'This category is still linked to other records and could not be removed. Try again or contact support.'
            : message,
      },
      { status: 400 }
    );
  }
}
