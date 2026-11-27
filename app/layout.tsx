import type { Metadata } from 'next'
import { CookieConsent } from '@/components/cookie-consent'
import { StaleBuildReload } from '@/components/stale-build-reload'
import { CopyProtection } from '@/components/copy-protection'
import './globals.css'
import localFont from "next/font/local";
import { getSiteSettingServer } from '@/lib/site-settings'
import { resolveSiteUrl } from '@/lib/site-url'

const brandon = localFont({
  src: [
    { path: './fonts/brandon/brandon-regular.woff2', weight: '400', style: 'normal' },
  ],
  variable: '--font-brandon-grotesque',
  display: 'swap',
  preload: true,
})

const syndicatgrotesk = localFont({
  src: [
    { path: './fonts/syndicatgrotesk/syndicatgrotesk-regular.woff2', weight: '400', style: 'normal' },
  ],
  variable: '--font-syndicatgrotesk',
  display: 'swap',
  preload: true,
})

const simplyMono = localFont({
  src: [
    { path: './fonts/simply-mono/simplymono-regular.woff2', weight: '400', style: 'normal' },
  ],
  variable: '--font-simply-mono',
  display: 'optional',
  preload: false,
})

const kapraneuepro = localFont({
  src: [
    { path: './fonts/kapraneuepro/kapraneuepro.woff2', weight: '400', style: 'normal' },
  ],
  variable: '--font-kapraneuepro',
  display: 'optional',
  preload: false,
})

export async function generateMetadata(): Promise<Metadata> {
  const [brand, seo] = await Promise.all([
    getSiteSettingServer('brand'),
    getSiteSettingServer('seo'),
  ])

  const title = seo.title || brand.name || 'Craftoo'
  const description = seo.description || 'Free shipping on orders of ₹1,000 and above, and easy returns.'
  const siteUrl = resolveSiteUrl(brand.site_url)
  // There is no /favicon.ico, so fall back to the round Craftoo logo when settings don't set one.
  const favicon = brand.favicon_url || '/images/logo/craftoo-logo-round-256.png'

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    icons: {
      icon: [{ url: favicon, type: 'image/png' }],
      apple: favicon,
    },
    openGraph: seo.og_image
      ? {
          title,
          description,
          images: [{ url: seo.og_image, width: 1200, height: 630 }],
        }
      : undefined,
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${brandon.variable} ${syndicatgrotesk.variable} ${simplyMono.variable} ${kapraneuepro.variable}`}
    >
      <head>
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
      </head>
      <body className="font-brandon">
        {children}
        {/* Loads analytics only after the visitor accepts it. */}
        <CookieConsent />
        <StaleBuildReload />
        <CopyProtection />
      </body>
    </html>
  )
}
