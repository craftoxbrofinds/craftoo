// Sentry in the shopper's browser: uncaught errors, failed fetches, page-load and navigation traces.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  dataCollection: { httpBodies: [], userInfo: false },

  // Send events through our own server (served by serveTunnelIntegration), because ad blockers
  // block sentry.io and would hide most errors from customers' phones.
  tunnel: true,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
