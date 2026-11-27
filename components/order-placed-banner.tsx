'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, MessageCircle, X } from 'lucide-react'
import { LAST_ORDER_KEY, type LastOrder } from '@/lib/whatsapp-order'

/** Shown for this long after checkout, then the confirmation stops appearing. */
const SHOW_FOR_MS = 30 * 60 * 1000

/**
 * Shown on the home page after checkout sends an order: confirms it and offers to open WhatsApp
 * again (or for the first time, if the browser blocked the WhatsApp tab).
 */
export function OrderPlacedBanner() {
  const [order, setOrder] = useState<LastOrder | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LAST_ORDER_KEY)
      const saved = raw ? JSON.parse(raw) as LastOrder : null
      if (saved && typeof saved.ref === 'string' && Date.now() - saved.at < SHOW_FOR_MS) setOrder(saved)
      else if (saved) sessionStorage.removeItem(LAST_ORDER_KEY)
    } catch { /* storage unavailable or unreadable */ }
  }, [])

  const dismiss = () => {
    setOrder(null)
    try { sessionStorage.removeItem(LAST_ORDER_KEY) } catch {}
    const url = new URL(window.location.href)
    if (url.searchParams.has('order')) {
      url.searchParams.delete('order')
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }

  const markOpened = () => {
    if (!order) return
    const next = { ...order, whatsappOpened: true }
    setOrder(next)
    try { sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(next)) } catch {}
  }

  if (!order) return null

  return (
    <div role="status" className="relative z-40 border-b border-green-200 bg-green-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
        <CheckCircle2 size={22} className="hidden shrink-0 text-green-700 sm:block" aria-hidden="true" />
        <div className="min-w-0 flex-1 font-syndicatgrotesk text-sm text-green-900">
          <p className="font-semibold">
            {order.existing
              ? <>You’d already placed this order, so we kept order <span className="font-mono">{order.ref}</span> and didn’t make a second one. Your cart has been cleared.</>
              : <>Order <span className="font-mono">{order.ref}</span> placed. Your cart has been cleared.</>}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-green-800">
            {order.whatsappOpened
              ? 'Send the message in WhatsApp so our team can confirm your order. Didn’t go through? Open it again below.'
              : 'One last step: open WhatsApp and send the message so our team can confirm your order.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={order.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={markOpened}
            className={`inline-flex items-center gap-2 px-4 py-2.5 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
              order.whatsappOpened
                ? 'border border-green-700 text-green-800 hover:bg-green-100'
                : 'bg-[#1f8f4e] text-white hover:bg-[#177a41]'
            }`}
          >
            <MessageCircle size={14} aria-hidden="true" />
            {order.whatsappOpened ? 'Open WhatsApp again' : 'Open WhatsApp'}
          </a>
          <Link
            href="/orders"
            className="px-3 py-2.5 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.18em] text-green-800 underline-offset-2 hover:underline"
          >
            My orders
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="p-1.5 text-green-800/70 hover:text-green-900"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
