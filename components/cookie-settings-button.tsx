'use client'

import { openCookieSettings } from '@/lib/cookie-consent'

/** An inline "Cookie settings" link that reopens the cookie banner. */
export function CookieSettingsButton({ label = 'Cookie settings' }: { label?: string }) {
  return (
    <button type="button" onClick={openCookieSettings} className="text-rich-gold underline underline-offset-2 hover:opacity-80">
      {label}
    </button>
  )
}
