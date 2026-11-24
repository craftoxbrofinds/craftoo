'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, MessageCircle, ShoppingBag, Sparkles, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { WHATSAPP_NUMBER } from '@/lib/whatsapp-order'
import { describeGiftExtraKeys } from '@/lib/gift-extras'
import { formatDateIST } from '@/lib/datetime'

type OrderItem = {
  id: string
  quantity: number
  price: number | string
  gift_extras?: string[] | null
  gift_photos?: string[] | null
  products: { id: string; name: string; image?: string | null } | null
}

type CustomerOrder = {
  id: string
  order_number: string | null
  status: string | null
  created_at: string
  total: number | string
  charges_total?: number
  order_items: OrderItem[] | null
}

/** Where an order is, as the customer sees it. */
const STAGES = [
  { key: 'placed', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
] as const

const STAGE_INDEX: Record<string, number> = { pending: 0, processing: 1, paid: 1, shipped: 2, delivered: 3 }

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Awaiting confirmation', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  processing: { label: 'Confirmed', cls: 'bg-[#f4eefb] text-[#5b4d8a] border-[#dccff0]' },
  paid: { label: 'Paid', cls: 'bg-[#f4eefb] text-[#5b4d8a] border-[#dccff0]' },
  shipped: { label: 'On its way', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  delivered: { label: 'Delivered', cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-700 border-red-200' },
}

function getFirstImage(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr) && arr.length > 0) return arr[0]
  } catch {}
  return raw
}

const rupees = (value: number) => {
  const paise = Math.round(value * 100) % 100 !== 0
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: 2 })}`
}

const orderNumber = (order: CustomerOrder) => order.order_number || order.id.slice(0, 8).toUpperCase()

/** A WhatsApp link to the team about one order, with the order number filled in. */
function whatsappAbout(order: CustomerOrder): string {
  const text = `Hello Craftoo, I need help with my order ${orderNumber(order)}.`
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
}

/** Placed → Confirmed → Shipped → Delivered, with the current stage highlighted. */
function OrderProgress({ status }: { status: string }) {
  const current = STAGE_INDEX[status] ?? 0
  return (
    <ol className="grid grid-cols-4" aria-label="Order progress">
      {STAGES.map((stage, i) => {
        const done = i <= current
        return (
          <li key={stage.key} className="relative flex flex-col items-center text-center" aria-current={i === current ? 'step' : undefined}>
            {/* connecting line to the previous stage */}
            {i > 0 && (
              <span aria-hidden="true" className={`absolute right-1/2 top-[9px] h-0.5 w-full ${i <= current ? 'bg-[#7565a5]' : 'bg-[#e9e1ed]'}`} />
            )}
            <span
              className={`relative z-10 grid h-5 w-5 place-items-center rounded-full border-2 ${
                done ? 'border-[#7565a5] bg-[#7565a5] text-white' : 'border-[#dccff0] bg-white text-transparent'
              }`}
            >
              <Check size={10} strokeWidth={3.5} aria-hidden="true" />
            </span>
            <span className={`mt-1.5 font-syndicatgrotesk text-[10px] leading-tight ${i === current ? 'font-bold text-warm-black' : done ? 'text-warm-black' : 'text-text-muted'}`}>
              {stage.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** The signed-in customer's orders. There is no cancel option; the team handles that on WhatsApp. */
export function CustomerOrders({ limit }: { limit?: number }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch('/api/user/orders', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Your orders couldn’t be loaded.')
        setOrders(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Your orders couldn’t be loaded.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading your orders">
        {[0, 1].map(i => (
          <div key={i} className="h-44 animate-pulse border border-border-light bg-white/70" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p role="alert" className="px-4 py-3 border border-red-300 bg-red-50 text-red-700 font-syndicatgrotesk text-xs">{error}</p>
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white border border-border-light shadow-sm px-8 py-14 text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#f4eefb] text-[#7565a5]">
          <ShoppingBag size={22} aria-hidden="true" />
        </span>
        <p className="font-brandon text-base font-black uppercase tracking-wide text-warm-black">No orders yet</p>
        <p className="mt-1 font-syndicatgrotesk text-xs text-text-muted">When you place an order, you can follow it here.</p>
        <Link
          href="/"
          className="mt-6 inline-block px-8 py-3 bg-warm-black text-ivory font-syndicatgrotesk text-[10px] font-bold tracking-[0.22em] uppercase hover:bg-deep-gold transition-colors"
        >
          Start shopping
        </Link>
      </div>
    )
  }

  const shown = limit ? orders.slice(0, limit) : orders

  return (
    <div className="space-y-4">
      {shown.map(order => {
        const status = (order.status || 'pending').toLowerCase()
        const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pending
        const items = order.order_items ?? []
        const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
        const total = Number(order.total || 0) + Number(order.charges_total || 0)
        const customized = items.some(item => (item.gift_extras ?? []).length > 0)
        const thumbs = items.slice(0, 4)
        const names = items.map(item => `${item.products?.name || 'Item'}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`)

        return (
          <article key={order.id} className="bg-white border border-border-light shadow-sm transition-shadow hover:shadow-md" aria-labelledby={`order-${order.id}`}>
            {/* Header: number, date, status */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-light px-5 py-4">
              <div>
                <p id={`order-${order.id}`} className="font-mono text-base font-semibold text-warm-black">#{orderNumber(order)}</p>
                <p className="mt-0.5 font-syndicatgrotesk text-[11px] text-text-muted">
                  Placed {formatDateIST(order.created_at)}
                  {' · '}{itemCount} item{itemCount === 1 ? '' : 's'}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-syndicatgrotesk text-[10px] font-semibold uppercase tracking-[0.12em] ${badge.cls}`}>
                {status === 'cancelled' ? <XCircle size={12} aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                {badge.label}
              </span>
            </div>

            {/* Progress, or a note for cancelled orders */}
            <div className="px-5 pt-4">
              {status === 'cancelled' ? (
                <p className="font-syndicatgrotesk text-xs text-red-700">This order was cancelled.</p>
              ) : (
                <OrderProgress status={status} />
              )}
            </div>

            {/* Items */}
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex shrink-0 -space-x-3">
                {thumbs.map((item, i) => {
                  const img = getFirstImage(item.products?.image)
                  const extra = i === 3 && items.length > 4 ? items.length - 3 : 0
                  return (
                    <span key={item.id} className="relative h-14 w-14 overflow-hidden border-2 border-white bg-soft-cream shadow-sm" style={{ zIndex: 10 - i }}>
                      {img && <img src={img} alt="" className="h-full w-full object-cover" />}
                      {extra > 0 && (
                        <span className="absolute inset-0 grid place-items-center bg-warm-black/70 font-syndicatgrotesk text-xs font-bold text-white">+{extra}</span>
                      )}
                    </span>
                  )
                })}
              </div>
              <div className="min-w-0 flex-1 font-syndicatgrotesk">
                <p className="line-clamp-2 text-sm leading-5 text-warm-black">{names.join(', ')}</p>
                {customized && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#7565a5]">
                    <Sparkles size={12} aria-hidden="true" />
                    {items.filter(i => (i.gift_extras ?? []).length > 0).map(i => describeGiftExtraKeys(i.gift_extras)).filter((v, idx, all) => all.indexOf(v) === idx).join(' · ')}
                  </p>
                )}
              </div>
            </div>

            {/* Footer: total and actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-light bg-soft-cream px-5 py-3">
              <div className="font-syndicatgrotesk">
                <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Total</p>
                <p className="font-brandon text-lg font-black leading-tight text-warm-black">{rupees(total)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {status !== 'cancelled' && (
                  <a
                    href={whatsappAbout(order)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 border border-border-light bg-white px-3.5 py-2.5 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.16em] text-warm-black transition-colors hover:border-[#7565a5]"
                  >
                    <MessageCircle size={13} aria-hidden="true" /> Need help?
                  </a>
                )}
                <Link
                  href={`/orders/${order.id}`}
                  className="inline-flex items-center gap-1.5 bg-warm-black px-4 py-2.5 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.16em] text-ivory transition-colors hover:bg-deep-gold"
                >
                  View details <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </article>
        )
      })}
      {limit && orders.length > limit && (
        <Link href="/orders" className="inline-flex items-center gap-1 font-syndicatgrotesk text-[11px] font-semibold uppercase tracking-[0.18em] text-deep-gold hover:underline">
          View all {orders.length} orders <ArrowRight size={13} aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}
