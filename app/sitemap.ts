import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getSiteSettingServer } from '@/lib/site-settings'
import { resolveSiteUrl } from '@/lib/site-url'
import { logger } from '@/lib/logger'

const log = logger.child({ route: 'sitemap.xml' })

// Rebuilt at most once an hour, so new products show up without a redeploy.
export const revalidate = 3600

/** Public pages that aren't backed by a database row. Account, cart and admin pages are left out. */
const STATIC_PAGES: { path: string; changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly'; priority: number }[] = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/play', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/policies/shipping', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/policies/returns', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/policies/privacy', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/policies/terms', changeFrequency: 'yearly', priority: 0.2 },
]

/** Same fallback the navbar and footer use for categories without a slug. */
const categorySlug = (category: { slug: string | null; name: string }) =>
  category.slug || category.name.toLowerCase().replace(/\s+/g, '-')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const brand = await getSiteSettingServer('brand')
  const siteUrl = resolveSiteUrl(brand.site_url)
  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map(page => ({
    url: `${siteUrl}${page.path === '/' ? '' : page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    log.warn('Supabase is not configured; sitemap lists static pages only')
    return entries
  }

  const supabase = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const [categories, products] = await Promise.all([
    supabase.from('categories').select('name, slug').eq('is_active', true).order('sort_order', { ascending: true, nullsFirst: false }),
    supabase.from('products').select('id').eq('is_active', true).order('sort_order', { ascending: true, nullsFirst: false }),
  ])

  // A failed query leaves that section out rather than failing the whole sitemap.
  if (categories.error) log.error('Could not load categories for the sitemap', { error: categories.error })
  if (products.error) log.error('Could not load products for the sitemap', { error: products.error })

  const seen = new Set<string>()
  for (const category of categories.data ?? []) {
    const slug = categorySlug(category)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    entries.push({ url: `${siteUrl}/category/${encodeURIComponent(slug)}`, changeFrequency: 'weekly', priority: 0.8 })
  }
  for (const product of products.data ?? []) {
    entries.push({ url: `${siteUrl}/products/${product.id}`, changeFrequency: 'weekly', priority: 0.7 })
  }

  log.info('Sitemap generated', {
    siteUrl,
    urls: entries.length,
    categories: seen.size,
    products: products.data?.length ?? 0,
  })
  return entries
}
