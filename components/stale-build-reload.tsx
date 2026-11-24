'use client'

import { useEffect } from 'react'

const RELOAD_KEY = 'craftoo:stale-build-reload'

/**
 * After a new deploy, a tab opened on the old version asks for script files that no longer
 * exist, and Next.js shows "Application error: a client-side exception has occurred". When a
 * script file fails to load, reload the page once to pick up the new version. The guard stops a
 * reload loop if the file is genuinely missing.
 */
export function StaleBuildReload() {
  useEffect(() => {
    const isChunkError = (value: unknown) => {
      const text = value instanceof Error ? `${value.name} ${value.message}` : String(value ?? '')
      return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(text)
    }

    const reloadOnce = () => {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
        if (Date.now() - last < 30_000) return // reloaded moments ago; don't loop
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
      } catch { /* storage unavailable: still reload once */ }
      window.location.reload()
    }

    const onError = (event: ErrorEvent) => {
      // A <script> from our own build that 404s reports as a resource error on the element.
      const target = event.target as HTMLElement | null
      const failedScript = target instanceof HTMLScriptElement && target.src.includes('/_next/static/')
      if (failedScript || isChunkError(event.error ?? event.message)) reloadOnce()
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkError(event.reason)) reloadOnce()
    }

    window.addEventListener('error', onError, true)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError, true)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
