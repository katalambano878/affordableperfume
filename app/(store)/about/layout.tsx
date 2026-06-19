import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us | Affordable Perfumes GH',
  description: 'We source authentic perfumes from trusted fragrance houses worldwide. Learn how Affordable Perfumes GH delivers premium scents at affordable prices across Ghana.',
  keywords: ['affordable perfumes ghana', 'authentic fragrances accra', 'perfume store ghana', 'about affordable perfumes gh'],
  openGraph: {
    title: 'About Us | Affordable Perfumes GH',
    description: 'Learn our story — authentic perfumes from trusted fragrance houses delivered across Ghana at affordable prices.',
    type: 'website',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
