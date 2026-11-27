/**
 * The public address of the store, without a trailing slash. Used for metadata, the sitemap
 * and robots.txt so they all agree.
 *
 * Order: the "Site URL" brand setting (Admin → Settings), then NEXT_PUBLIC_SITE_URL, then
 * Vercel's production domain, then localhost for local development.
 */
export function resolveSiteUrl(brandSiteUrl?: string | null): string {
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const candidates = [
    brandSiteUrl,
    process.env.NEXT_PUBLIC_SITE_URL,
    vercelDomain ? `https://${vercelDomain}` : undefined,
  ]
  for (const candidate of candidates) {
    const value = candidate?.trim()
    if (!value) continue
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
      return url.origin
    } catch {
      // Not a usable URL; try the next one.
    }
  }
  return 'http://localhost:3000'
}
