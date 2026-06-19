import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { supabase } from '@/lib/supabase';
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { CMSProvider } from "@/context/CMSContext";
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563eb',
};

async function getSiteSettings() {
  let siteName = '';
  let siteTagline = '';
  let siteDescription = "";
  let siteLogo = '';
  let siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://affordableperfumesgh.com';
  if (siteUrl === '' || siteUrl === 'https://example.com') siteUrl = 'https://affordableperfumesgh.com';
  let ogImage = '';

  try {
    const { data } = await supabase.from('site_settings').select('key, value');
    if (data) {
      const settings = data.reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});

      if (settings.site_name) siteName = settings.site_name;
      if (settings.site_tagline) siteTagline = settings.site_tagline;
      if (settings.site_description) siteDescription = settings.site_description;
      if (settings.site_logo) siteLogo = settings.site_logo;
      if (settings.site_url) siteUrl = settings.site_url;
      if (settings.og_image) ogImage = settings.og_image;
    }
  } catch (e) {
    // Fail gracefully to defaults
  }

  return { siteName, siteTagline, siteDescription, siteLogo, siteUrl, ogImage };
}

export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteTagline, siteDescription, siteLogo, siteUrl, ogImage: ogImageSetting } = await getSiteSettings();
  const baseUrl = siteUrl.replace(/\/$/, '');
  const defaultDescription = 'Authentic perfumes and fragrances delivered across Ghana. Shop affordable designer and niche scents from Accra.';
  const desc = siteDescription || defaultDescription;
  const ogImage = ogImageSetting
    ? (ogImageSetting.startsWith('http') ? ogImageSetting : `${baseUrl}${ogImageSetting}`)
    : siteLogo
      ? (siteLogo.startsWith('http') ? siteLogo : `${baseUrl}${siteLogo}`)
      : `${baseUrl}/og-default`;

  const fullTitle = [siteName, siteTagline].filter(Boolean).join(' | ');
  const defaultTitle = (fullTitle && fullTitle.length > 15)
    ? fullTitle
    : 'Affordable Perfumes GH | Perfumes & Fragrances';

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: defaultTitle,
      template: siteName ? `%s | ${siteName}` : `%s`
    },
    description: desc,
    keywords: [
      siteName,
      "Affordable Perfumes Ghana",
      "Buy Perfumes Online Ghana",
      "Fragrances Accra",
      "Perfume Shop Ghana",
      "Designer Perfumes Ghana",
      "Niche Fragrances Ghana",
      "Original Perfumes Accra",
      "Fragrance Store Ghana",
      "Accra Perfume Delivery",
      "Ghana E-commerce Perfumes",
      "Armaf Perfume Ghana",
      "Areej Perfume Ghana",
      "Cheap Perfumes Accra",
      "Best Perfume Store Ghana",
      "Men Perfumes Ghana",
      "Women Fragrances Ghana"
    ],
    authors: [{ name: siteName }],
    creator: siteName,
    publisher: siteName,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    icons: {
      icon: [{ url: '/icon', type: 'image/png' }, { url: '/logo.svg', type: 'image/svg+xml', sizes: 'any' }],
      apple: [{ url: '/apple-icon', type: 'image/png', sizes: '180x180' }],
      shortcut: '/icon',
    },
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: siteName,
    },
    formatDetection: {
      telephone: true,
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
    },
    openGraph: {
      type: "website",
      locale: "en_GH",
      url: baseUrl,
      title: defaultTitle,
      description: desc,
      siteName: siteName || 'Affordable Perfumes GH',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: siteName || 'Affordable Perfumes GH - authentic fragrances delivered across Ghana',
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: desc,
      images: [ogImage],
      creator: '@store',
    },
    alternates: {
      canonical: baseUrl,
    },
  };
}

// Google Analytics Measurement ID
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
// Google reCAPTCHA v3 Site Key
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { siteName, siteDescription, siteLogo, siteUrl } = await getSiteSettings();
  return (
    <html lang="en">
      <head>
        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={siteName} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/apple-icon" />
        <link rel="icon" href="/icon" type="image/png" />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />

        <link
          href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Pacifico&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

        {/* Structured Data - Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Store",
              "name": siteName || "Affordable Perfumes GH",
              "url": siteUrl,
              "logo": siteLogo ? (siteLogo.startsWith('http') ? siteLogo : `${siteUrl}${siteLogo}`) : `${siteUrl}/logo.svg`,
              "description": siteDescription || "Authentic perfumes and fragrances delivered across Ghana.",
              "image": siteLogo ? (siteLogo.startsWith('http') ? siteLogo : `${siteUrl}${siteLogo}`) : `${siteUrl}/logo.svg`,
              "priceRange": "GH₵50 - GH₵1500",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "GH",
                "addressLocality": "Accra",
                "addressRegion": "Greater Accra"
              },
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": "5.6037",
                "longitude": "-0.1870"
              },
              "areaServed": {
                "@type": "Country",
                "name": "Ghana"
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service",
                "availableLanguage": "English",
                "areaServed": "GH"
              },
              "sameAs": [],
              "openingHoursSpecification": {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                "opens": "08:00",
                "closes": "20:00"
              },
              "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Perfumes & Fragrances",
                "itemListElement": [
                  { "@type": "OfferCatalog", "name": "Designer Perfumes" },
                  { "@type": "OfferCatalog", "name": "Niche Fragrances" },
                  { "@type": "OfferCatalog", "name": "Everyday Scents" }
                ]
              }
            })
          }}
        />
        {/* Structured Data - WebSite with SearchAction */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": siteName || "Affordable Perfumes GH",
              "url": siteUrl,
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": `${siteUrl}/shop?search={search_term_string}`
                },
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      </head>

      {/* Google Analytics */}
      {GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}

      {/* Google reCAPTCHA v3 */}
      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          strategy="afterInteractive"
        />
      )}

      <body className="antialiased font-sans overflow-x-hidden pwa-body">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:px-6 focus:py-3 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-lg"
        >
          Skip to main content
        </a>
        <CMSProvider>
          <CartProvider>
            <WishlistProvider>
              <div id="main-content">
                {children}
              </div>
            </WishlistProvider>
          </CartProvider>
        </CMSProvider>
      </body>
    </html>
  );
}
