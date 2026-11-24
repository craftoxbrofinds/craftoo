'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { MapPin, MessageCircle, Phone, ShoppingBag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { OrderPhotos } from '@/components/order-photos'
import { CUSTOMIZATION_CALL_NOTE, describeGiftExtraKeys } from '@/lib/gift-extras'
import { hasFreeShipping } from '@/lib/shipping'
import { WHATSAPP_NUMBER } from '@/lib/whatsapp-order'
import type { OrderContact } from '@/lib/order-address'
import { chargesTotal, describeCharge, type OrderCharge } from '@/lib/order-charges'
import { formatDateTimeIST } from '@/lib/datetime'

type OrderItem = {
  id: string
  quantity: number
  price: number | string
  gift_extras: string[] | null
  gift_photos: string[] | null
  products: { id: string; name: string; image?: string | null } | null
}

type CustomerOrder = {
  id: string
  order_number: string | null
  status: string | null
  created_at: string
  subtotal: number | string | null
  discount_amount: number | string | null
  total: number | string
  contact: OrderContact
  coupon: { code: string; discount_percent: number } | null
  order_items: OrderItem[]
  charges: OrderCharge[]
}

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-amber-50 border-amber-300 text-amber-700',
  processing: 'bg-blue-50 border-blue-300 text-blue-700',
  shipped:    'bg-indigo-50 border-indigo-300 text-indigo-700',
  delivered:  'bg-green-50 border-green-300 text-green-700',
  paid:       'bg-green-50 border-green-300 text-green-700',
  cancelled:  'bg-red-50 border-red-300 text-red-700',
}

const STATUS_NOTE: Record<string, string> = {
  pending: 'We’ve received your order. Our team will confirm it on WhatsApp.',
  processing: 'Your order is confirmed and being prepared.',
  paid: 'Payment received. Your order is being prepared.',
  shipped: 'Your order is on its way.',
  delivered: 'Your order has been delivered.',
  cancelled: 'This order was cancelled.',
}

const rupees = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0)
  const paise = Math.round(amount * 100) % 100 !== 0
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: 2 })}`
}

function firstImage(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0]
  } catch {}
  return raw
}

export default function CustomerOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<CustomerOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push(`/signin?returnTo=/orders/${id}`); return }
      try {
        const res = await fetch(`/api/user/orders/${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || 'Your order couldn’t be loaded.')
        setOrder(body.data as CustomerOrder)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Your order couldn’t be loaded.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id, router])

  const ref = order ? order.order_number || order.id.slice(0, 8).toUpperCase() : ''
  const items = order?.order_items ?? []
  const customized = items.filter(item => (item.gift_extras ?? []).length > 0)
  const subtotal = Number(order?.subtotal ?? order?.total ?? 0)
  const discount = Number(order?.discount_amount ?? 0)
  const status = (order?.status || 'pending').toLowerCase()
  const charges = order?.charges ?? []
  const finalTotal = Number(order?.total ?? 0) + chargesTotal(charges)
  const hasShippingCharge = charges.some(c => c.kind === 'shipping')
  // Once the team has added charges (or nothing is pending), the total is final.
  const isFinal = charges.length > 0 || (hasFreeShipping(subtotal) && customized.length === 0)
  const helpUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello Craftoo, I need help with my order ${ref}.`)}`

  return (
    <div className="min-h-screen bg-warm-beige">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-6">
        <Link href="/orders" className="font-syndicatgrotesk text-[10px] tracking-[0.2em] uppercase text-muted-taupe hover:text-warm-black">
          ← My orders
        </Link>

        {loading ? (
          <div className="flex items-center gap-2 py-8">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-2 h-2 bg-deep-gold rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        ) : !order ? (
          <p role="alert" className="px-4 py-3 border border-red-300 bg-red-50 text-red-700 font-syndicatgrotesk text-xs">{error || 'Order not found.'}</p>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-syndicatgrotesk text-[9px] tracking-[0.35em] uppercase text-deep-gold">Order</p>
                <h1 className="font-mono text-3xl font-semibold text-warm-black">#{ref}</h1>
                <p className="mt-1 font-syndicatgrotesk text-xs text-muted-taupe">
                  Placed {formatDateTimeIST(order.created_at)}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 border font-syndicatgrotesk text-[10px] tracking-[0.15em] uppercase ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" /> {status}
              </span>
            </div>
            {STATUS_NOTE[status] && <p className="font-syndicatgrotesk text-sm text-warm-black">{STATUS_NOTE[status]}</p>}

            {/* Items */}
            <section className="bg-white border border-border-light shadow-sm">
              <h2 className="flex items-center gap-2 px-5 py-4 border-b border-border-light bg-soft-cream font-brandon text-sm font-black uppercase tracking-[0.15em] text-warm-black">
                <ShoppingBag size={14} className="text-deep-gold" aria-hidden="true" /> Items
              </h2>
              <ul className="divide-y divide-border-light">
                {items.map(item => {
                  const img = firstImage(item.products?.image)
                  const extras = describeGiftExtraKeys(item.gift_extras)
                  const price = Number(item.price)
                  return (
                    <li key={item.id} className="flex gap-4 px-5 py-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden border border-border-light bg-soft-cream">
                        {img && <img src={img} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1 font-syndicatgrotesk">
                        {item.products?.id ? (
                          <Link href={`/products/${item.products.id}`} className="font-brandon text-sm font-black uppercase tracking-wide text-warm-black hover:text-deep-gold">
                            {item.products.name}
                          </Link>
                        ) : (
                          <p className="font-brandon text-sm font-black uppercase tracking-wide text-warm-black">Item</p>
                        )}
                        <p className="mt-0.5 text-xs text-text-muted">Qty {item.quantity} × {rupees(price)}</p>
                        {extras && <p className="mt-1 text-xs font-semibold text-[#7565a5]">+ {extras}</p>}
                      </div>
                      <p className="whitespace-nowrap font-brandon text-sm font-black text-warm-black">{rupees(price * item.quantity)}</p>
                    </li>
                  )
                })}
              </ul>
              <div className="space-y-1.5 border-t border-border-light bg-soft-cream px-5 py-4 font-syndicatgrotesk text-xs text-text-muted">
                <div className="flex justify-between"><span>Subtotal</span><span className="text-warm-black">{rupees(subtotal)}</span></div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Coupon {order.coupon ? `${order.coupon.code} (${order.coupon.discount_percent}%)` : ''}</span>
                    <span className="font-semibold">−{rupees(discount)}</span>
                  </div>
                )}
                {!hasShippingCharge && (
                  <div className="flex justify-between gap-3">
                    <span>Delivery</span>
                    {hasFreeShipping(subtotal)
                      ? <span className="font-semibold text-deep-gold">Free</span>
                      : <span className="text-right text-warm-black">Added to your final bill</span>}
                  </div>
                )}
                {charges.map(charge => (
                  <div key={charge.id} className="flex justify-between gap-3">
                    <span>{describeCharge(charge, rupees)}</span>
                    <span className="text-warm-black">+{rupees(charge.amount)}</span>
                  </div>
                ))}
                <div className="flex items-end justify-between border-t border-border-light pt-2">
                  <span className="font-brandon text-sm font-black uppercase text-warm-black">
                    {isFinal ? 'Total to pay' : 'Estimated total'}
                  </span>
                  <span className="font-brandon text-lg font-black text-warm-black">{rupees(finalTotal)}</span>
                </div>
                <p className="text-[10px] leading-4">
                  {charges.length > 0
                    ? 'This includes the charges our team added for your order. Pay by UPI once our team confirms on WhatsApp.'
                    : 'Our team sends the final bill on WhatsApp before you pay.'}
                </p>
              </div>
            </section>

            {/* Customization */}
            {customized.length > 0 && (
              <section className="bg-white border border-[#cbbde4] shadow-sm">
                <h2 className="px-5 py-4 border-b border-border-light bg-[#f4eefb] font-brandon text-sm font-black uppercase tracking-[0.15em] text-warm-black">
                  Your customization
                </h2>
                <div className="space-y-4 px-5 py-4 font-syndicatgrotesk text-sm text-warm-black">
                  <ul className="space-y-1.5">
                    {customized.map(item => (
                      <li key={item.id} className="flex flex-wrap justify-between gap-2">
                        <span>{item.products?.name || 'Item'} × {item.quantity}</span>
                        <span className="font-semibold text-[#7565a5]">{describeGiftExtraKeys(item.gift_extras)}</span>
                      </li>
                    ))}
                  </ul>
                  <OrderPhotos orderNumber={ref} items={items} tone="shop" />
                  <p className="flex items-start gap-1.5 text-xs text-[#5b4d8a]">
                    <Phone size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> {CUSTOMIZATION_CALL_NOTE}
                  </p>
                </div>
              </section>
            )}

            {/* Delivery */}
            <section className="bg-white border border-border-light shadow-sm">
              <h2 className="flex items-center gap-2 px-5 py-4 border-b border-border-light bg-soft-cream font-brandon text-sm font-black uppercase tracking-[0.15em] text-warm-black">
                <MapPin size={14} className="text-deep-gold" aria-hidden="true" /> Delivery details
              </h2>
              <div className="px-5 py-4 font-syndicatgrotesk text-sm leading-6 text-warm-black">
                <p className="font-semibold">{order.contact.name || '—'}</p>
                <p className="text-text-muted">
                  {[order.contact.phone, order.contact.email].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 whitespace-pre-line break-words">{order.contact.address || '—'}</p>
              </div>
            </section>

            {status !== 'cancelled' && (
              <a
                href={helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-syndicatgrotesk text-xs font-semibold text-warm-black underline underline-offset-2 hover:text-deep-gold"
              >
                <MessageCircle size={14} aria-hidden="true" /> Need help with this order? Message us on WhatsApp
              </a>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}
