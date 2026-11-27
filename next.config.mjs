import { withSentryConfig } from '@sentry/nextjs/config'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/supabase/:path*',
        destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/:path*`,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: 'craftoo',
  project: 'craftoo-web',

  // Uploads source maps so production stack traces show the real code. Skipped when the
  // token is not set. Keep SENTRY_AUTH_TOKEN in Vercel's environment variables, never in git.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,

  // Only print source map upload output in CI.
  silent: !process.env.CI,
})
