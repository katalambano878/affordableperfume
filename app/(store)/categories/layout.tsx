import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Perfume Categories | Shop by Fragrance Family',
  description: 'Browse perfumes by category — Designer, Niche, Everyday scents, Oud, Floral, Fresh, and more. Find your signature scent with nationwide delivery in Ghana.',
  keywords: ['perfume categories ghana', 'designer perfumes accra', 'niche fragrances ghana', 'oud perfume ghana', 'floral fragrances'],
  openGraph: {
    title: 'Perfume Categories | Shop by Fragrance Family',
    description: 'Explore perfumes by fragrance family and scent profile. Designer, Niche, and Everyday scents delivered across Ghana.',
    type: 'website',
  },
};

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
