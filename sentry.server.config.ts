// Sentry for the Node.js server: API routes, server components, sitemap. Loaded by instrumentation.ts.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  // Every request is traced locally; 10% in production to stay inside the free quota.
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // Request bodies hold shoppers' names, phone numbers and addresses, and IPs are personal data,
  // so neither is sent. lib/logger.ts adds the order and user ids that are needed for debugging.
  dataCollection: { httpBodies: [], userInfo: false },

  // Receives browser events at our own domain, so ad blockers don't drop them (see instrumentation-client.ts).
  integrations: [Sentry.serveTunnelIntegration()],
})
