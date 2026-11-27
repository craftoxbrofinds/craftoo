// Sentry for the edge runtime (middleware.ts). Loaded by instrumentation.ts.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  dataCollection: { httpBodies: [], userInfo: false },
  integrations: [Sentry.serveTunnelIntegration()],
})
