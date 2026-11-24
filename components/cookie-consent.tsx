'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Analytics } from '@vercel/analytics/next'
import { Cookie } from 'lucide-react'
import {
  getCookieChoice,
  onCookieChoiceChange,
  onOpenCookieSettings,
  setCookieChoice,
  type CookieChoice,
} from '@/lib/cookie-consent'

/**
 * Asks each visitor once whether to allow optional analytics, and loads Vercel Analytics only
 * after "Accept all". Essential storage is always used and explained in the banner.
 * "Cookie settings" in the footer reopens it.
 */
export function CookieConsent() {
  const pathname = usePathname()
  const [choice, setChoice] = useState<CookieChoice | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const saved = getCookieChoice()
    setChoice(saved)
    setOpen(saved === null)
    const offChange = onCookieChoiceChange(next => setChoice(next))
    const offOpen = onOpenCookieSettings(() => setOpen(true))
    return () => { offChange(); offOpen() }
  }, [])

  const choose = (next: CookieChoice) => {
    setCookieChoice(next)
    setOpen(false)
  }

  // Staff pages don't need the banner or shopper analytics.
  const isAdmin = pathname?.startsWith('/admin')

  return (
    <>
      {choice === 'all' && !isAdmin && <Analytics />}

      {open && !isAdmin && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-consent-title"
          className="fixed inset-x-3 bottom-3 z-[95] mx-auto max-w-xl border border-[#dccff0] bg-white p-4 shadow-[0_18px_50px_rgba(63,58,70,.18)] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center bg-[#f4eefb] text-[#7565a5]">
              <Cookie size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 font-syndicatgrotesk">
              <p id="cookie-consent-title" className="font-brandon text-sm font-black uppercase tracking-[0.1em] text-[#3f3a46]">
                Cookies &amp; storage
              </p>
              <p className="mt-1 text-xs leading-5 text-[#7d7484]">
                We use essential cookies and browser storage to keep you signed in, remember your cart and gift extras,
                and limit daily Flower Quest plays. With your OK we also count page visits anonymously to improve the
                store. We don’t use advertising or tracking cookies.{' '}
                <Link href="/policies/privacy#cookies" className="text-[#7565a5] underline underline-offset-2">Learn more</Link>
              </p>
              {choice && (
                <p className="mt-1 text-[11px] text-[#7d7484]">
                  Current choice: <span className="font-semibold text-[#3f3a46]">{choice === 'all' ? 'All cookies' : 'Essential only'}</span>
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => choose('all')}
                  className="bg-[#7565a5] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white hover:bg-[#5b4d8a] transition-colors"
                >
                  Accept all
                </button>
                <button
                  type="button"
                  onClick={() => choose('essential')}
                  className="border border-[#7565a5] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5b4d8a] hover:bg-[#f4eefb] transition-colors"
                >
                  Essential only
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
