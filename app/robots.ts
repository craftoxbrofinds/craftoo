import type { MetadataRoute } from 'next'
import { getSiteSettingServer } from '@/lib/site-settings'
import { resolveSiteUrl } from '@/lib/site-url'

export const revalidate = 3600

export default async function robots(): Promise<MetadataRoute.Robots> {
  const brand = await getSiteSettingServer('brand')
  const siteUrl = resolveSiteUrl(brand.site_url)
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private or per-shopper pages; nothing here should appear in search results.
      disallow: ['/admin', '/api/', '/checkout', '/orders', '/profile', '/signin', '/signup', '/supabase/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
