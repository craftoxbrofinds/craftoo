'use client'

import * as Sentry from '@sentry/nextjs'
import NextError from 'next/error'
import { useEffect } from 'react'

/** Shown when a page crashes while rendering; the crash is reported to Sentry. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        {/* The App Router doesn't expose a status code for render errors, so 0 shows a generic message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
