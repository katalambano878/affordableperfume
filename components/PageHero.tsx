import React from 'react';
import Image from 'next/image';
import { HERO_IMAGES, type HeroImageKey } from '@/lib/hero-images';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  /** Preset image key or absolute path under public (e.g. /heroes/...) */
  image?: HeroImageKey | string;
  children?: React.ReactNode;
  afterSubtitle?: React.ReactNode;
}

function resolveImageSrc(image?: HeroImageKey | string): string | undefined {
  if (!image) return undefined;
  if (image in HERO_IMAGES) return HERO_IMAGES[image as HeroImageKey];
  return image.startsWith('/') ? image : `/${image}`;
}

export default function PageHero({
  title,
  subtitle,
  image = 'perfumes',
  children,
  afterSubtitle,
}: PageHeroProps) {
  const imageSrc = resolveImageSrc(image);

  return (
    <div className="relative bg-blue-900 overflow-hidden min-h-[280px] md:min-h-[320px] flex items-center">
      {imageSrc ? (
        <>
          <Image
            src={imageSrc}
            alt=""
            fill
            loading="lazy"
            className="object-cover object-center"
            sizes="(max-width: 768px) 100vw, 1200px"
            quality={55}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-950/90 via-blue-900/75 to-blue-900/40" />
          <div className="absolute inset-0 bg-black/25" />
        </>
      ) : (
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        </div>
      )}
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-sm">{title}</h1>
        {subtitle && (
          <p className="text-xl md:text-2xl text-blue-50 max-w-3xl mx-auto leading-relaxed drop-shadow-sm">
            {subtitle}
          </p>
        )}
        {afterSubtitle}
        {children ? <div className="mt-8 max-w-2xl mx-auto">{children}</div> : null}
      </div>
    </div>
  );
}
