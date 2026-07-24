import Link from 'next/link';
import Image from 'next/image';
import { serverDb } from '@/lib/server-db';
import PageHero from '@/components/PageHero';
import { resolveStorageUrl } from '@/lib/storage-url';

export const revalidate = 0;

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  position: number | null;
};

export default async function CategoriesPage() {
  const { data: categoriesData } = await serverDb
    .from('categories')
    .select(`
      id,
      name,
      slug,
      description,
      image_url,
      position
    `)
    .eq('status', 'active')
    .order('position', { ascending: true });

  const categories: CategoryRow[] = (categoriesData as CategoryRow[] | null) ?? [];

  return (
    <div className="min-h-screen bg-white">
      <PageHero
        title="Shop by Category"
        subtitle="Browse fragrances by scent family, notes, and signature style"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {categories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 max-w-6xl mx-auto">
            {categories.map((category) => {
              const imageSrc =
                resolveStorageUrl(category.image_url) ||
                `https://via.placeholder.com/600x800?text=${encodeURIComponent(category.name)}`;

              return (
                <Link
                  key={category.id}
                  href={`/shop?category=${encodeURIComponent(category.slug)}`}
                  className="group block relative w-full max-w-[220px] mx-auto"
                >
                  <div className="aspect-[4/5] sm:aspect-[5/6] rounded-xl overflow-hidden relative shadow-md group-hover:shadow-lg transition-all duration-300">
                    <Image
                      src={imageSrc}
                      alt={category.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
                      quality={65}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent opacity-70 group-hover:opacity-85 transition-opacity duration-300" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                      <h3 className="font-serif font-bold text-white text-sm sm:text-base md:text-lg leading-tight line-clamp-2">
                        {category.name}
                      </h3>
                      {category.description ? (
                        <p className="text-white/75 text-[11px] sm:text-xs mt-1 line-clamp-2 hidden sm:block">
                          {category.description}
                        </p>
                      ) : null}
                      <div className="flex items-center text-white/90 text-[10px] sm:text-xs font-medium mt-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <span className="uppercase tracking-wider">Shop Now</span>
                        <i className="ri-arrow-right-line ml-1.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-xl">
            <i className="ri-inbox-line text-5xl text-gray-300 mb-4" />
            <p className="text-xl text-gray-500">No categories found.</p>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-700 to-blue-900 py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Can&apos;t Find What You&apos;re Looking For?</h2>
          <p className="text-base md:text-lg text-blue-100 mb-8 leading-relaxed max-w-2xl mx-auto">
            Try our advanced search or contact our team for personalised product recommendations
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-white text-blue-700 px-6 py-3 rounded-full font-medium hover:bg-blue-50 transition-colors whitespace-nowrap text-sm"
            >
              <i className="ri-search-line" />
              Search All Perfumes
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full font-medium hover:bg-blue-500 transition-colors whitespace-nowrap text-sm"
            >
              <i className="ri-customer-service-line" />
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
