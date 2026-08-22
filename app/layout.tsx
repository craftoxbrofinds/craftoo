import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import localFont from "next/font/local";
import { getSiteSettingServer } from '@/lib/site-settings'

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

  const title = seo.title || brand.name || 'My Store'
  const description = seo.description || 'Free shipping on orders above ₹599, and easy returns.'
  const siteUrl = brand.site_url || 'https://example.com'
  const favicon = brand.favicon_url || '/favicon.ico'

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
        <Analytics />
      </body>
    </html>
  )
}
