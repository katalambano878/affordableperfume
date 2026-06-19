import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shop All Perfumes | Affordable Fragrances in Ghana',
  description: 'Browse authentic designer and niche perfumes at affordable prices. Fast delivery across Ghana. Shop Armaf, Areej, and more top fragrance brands.',
  keywords: ['buy perfume online ghana', 'affordable perfumes accra', 'designer fragrances ghana', 'armaf perfume ghana', 'niche perfumes ghana', 'fragrance delivery ghana'],
  openGraph: {
    title: 'Shop All Perfumes | Affordable Fragrances in Ghana',
    description: 'Browse authentic perfumes and fragrances delivered across Ghana. Designer & niche scents at unbeatable prices.',
    type: 'website',
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
