'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { describeGiftExtraKeys } from '@/lib/gift-extras'
import { whatsappNumber, type OrderContact } from '@/lib/order-address'
import { hasFreeShipping } from '@/lib/shipping'
import { CouponVerify, STATUS_BADGE, STATUS_OPTIONS, adminHeaders, orderNumber, rupees } from '@/components/admin/order-ui'
import { OrderPhotos } from '@/components/order-photos'
import { Images, Printer, Receipt } from 'lucide-react'
import { OrderChargesEditor } from '@/components/admin/order-charges-editor'
import { BillButtons } from '@/components/bill-buttons'
import { chargesTotal, type OrderCharge } from '@/lib/order-charges'
import { formatDateTimeIST } from '@/lib/datetime'

type OrderItem = {
  id: string
  quantity: number
  price: number | string
  gift_extras: string[] | null
  gift_photos: string[] | null
  products: { id: string; name: string; image?: string | null } | null
}

type AdminOrder = {
  id: string
  order_number: string | null
  status: string | null
  created_at: string
  subtotal: number | string | null
  discount_amount: number | string | null
  total: number | string
  address: string | null
  razorpay_order_id: string | null
  payment_id: string | null
  contact: OrderContact
  coupon: { code: string; status: string; discount_percent: number } | null
  order_items: OrderItem[]
  charges: OrderCharge[]
}

const labelCls = 'font-syndicatgrotesk text-[9px] tracking-[0.2em] uppercase text-[#8A7A6A]'
const cardCls = 'bg-white border border-[#E8E0D5]'

function firstImage(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0]
  } catch {}
  return raw
}

const formatDate = (value: string) =>
  formatDateTimeIST(value)

/** A WhatsApp message to the customer about the gift extras they asked for. */
function customizationMessage(order: AdminOrder, customized: OrderItem[]): string {
  return [
    `Hi ${order.contact.name || 'there'}, this is Craftoo about your order ${orderNumber(order)}.`,
    '',
    'You asked for these gift extras:',
    ...customized.map(item => `• ${item.products?.name || 'Item'} × ${item.quantity}: ${describeGiftExtraKeys(item.gift_extras)}`),
    '',
    'We’ll confirm any extra charge for these before we start on your order.',
  ].join('\n')
}

/** Short message sent with the PDF bill. */
function billShareText(order: AdminOrder, finalTotal: number): string {
  return `Hi ${order.contact.name || 'there'}, here is the bill for your Craftoo order ${orderNumber(order)}. Total to pay: ${rupees(finalTotal)}. Please pay by UPI and share the payment screenshot here. Thank you!`
}

/** The customer's uploaded photos; each opens full size in a new tab. */
function PhotoStrip({ photos, small = false }: { photos: string[] | null; small?: boolean }) {
  if (!photos || photos.length === 0) {
    return <p className="mt-1 text-xs text-[#B45309]">No photo was uploaded for this item.</p>
  }
  const size = small ? 'h-10 w-10' : 'h-20 w-20'
  return (
    <div className="mt-2 flex flex-wrap gap-2 print:hidden">
      {photos.map((url, i) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`block ${size} overflow-hidden border border-[#cbbde4] bg-[#FAF7F2] hover:border-[#7565a5]`}
          title={`Open photo ${i + 1}`}
        >
          <img src={url} alt={`Customer photo ${i + 1}`} className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  )
}

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<AdminOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [updating, setUpdating] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { headers: await adminHeaders() })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'The order could not be loaded.')
      setOrder(body.data as AdminOrder)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The order could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const changeStatus = async (status: string) => {
    setUpdating(true)
    setNotice('')
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PUT',
        headers: { ...(await adminHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) setNotice(body.error || 'The order could not be updated.')
      else setNotice(body.warning || `Order marked ${status}.`)
      await load()
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3">
        {[0, 150, 300].map(d => (
          <span key={d} className="w-2 h-2 bg-[#D4A017] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
        <span className="font-syndicatgrotesk text-[11px] tracking-widest uppercase text-[#C4B49A] ml-2">Loading order…</span>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <Link href="/admin/orders" className="font-syndicatgrotesk text-[10px] tracking-[0.2em] uppercase text-[#8A7A6A] hover:text-[#1A1A1A]">← All orders</Link>
        <p role="alert" className="px-4 py-3 border border-red-300 bg-red-50 text-red-700 font-syndicatgrotesk text-xs">{error || 'Order not found.'}</p>
      </div>
    )
  }

  const items = order.order_items ?? []
  const customized = items.filter(item => (item.gift_extras ?? []).length > 0)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = Number(order.subtotal ?? order.total)
  const discount = Number(order.discount_amount ?? 0)
  const customerWa = whatsappNumber(order.contact.phone)
  const status = order.status?.toLowerCase() || 'pending'
  const photoCount = items.reduce((sum, item) => sum + (item.gift_photos?.length ?? 0), 0)
  const charges = order.charges ?? []
  const extraTotal = chargesTotal(charges)
  const finalTotal = Number(order.total) + extraTotal
  const hasShippingCharge = charges.some(c => c.kind === 'shipping')
  const setCharges = (next: OrderCharge[]) => setOrder(current => (current ? { ...current, charges: next } : current))

  /** Prints only the "Photos to print" section. */
  const printPhotos = () => {
    document.body.dataset.print = 'photos'
    const reset = () => { delete document.body.dataset.print; window.removeEventListener('afterprint', reset) }
    window.addEventListener('afterprint', reset)
    window.print()
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl print:p-0 print:max-w-none">
      {/* "Print photos only" hides everything except the photos section. */}
      <style>{`@media print { body[data-print="photos"] .order-details-only { display: none !important; } }`}</style>

      <Link href="/admin/orders" className="print:hidden font-syndicatgrotesk text-[10px] tracking-[0.2em] uppercase text-[#8A7A6A] hover:text-[#1A1A1A]">
        ← All orders
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 order-details-only">
        <div>
          <p className={labelCls}>Order</p>
          <h1 className="font-mono text-3xl font-semibold text-[#1A1A1A]">{orderNumber(order)}</h1>
          <p className="mt-1 font-syndicatgrotesk text-xs text-[#8A7A6A]">
            Placed {formatDate(order.created_at)} · {itemCount} item{itemCount === 1 ? '' : 's'} · {order.razorpay_order_id ? 'Online payment' : 'WhatsApp order'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-syndicatgrotesk text-[10px] font-semibold px-2 py-1 capitalize ${STATUS_BADGE[status] || 'bg-gray-100 text-gray-600'}`}>
            {status}
          </span>
          <label className="sr-only" htmlFor="order-status">Order status</label>
          <select
            id="order-status"
            value={status}
            onChange={e => void changeStatus(e.target.value)}
            disabled={updating}
            className="print:hidden border border-[#E8E0D5] bg-white px-3 py-2 font-syndicatgrotesk text-xs text-[#1A1A1A] outline-none focus:border-[#D4A017] disabled:opacity-50 capitalize"
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>

      {/* Print */}
      <div className="print:hidden flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 border border-[#1A1A1A] px-4 py-2.5 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.18em] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors"
        >
          <Printer size={14} aria-hidden="true" /> Print order
        </button>
        {photoCount > 0 && (
          <button
            type="button"
            onClick={printPhotos}
            className="inline-flex items-center gap-2 border border-[#7565a5] px-4 py-2.5 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.18em] text-[#5b4d8a] hover:bg-[#7565a5] hover:text-white transition-colors"
          >
            <Images size={14} aria-hidden="true" /> Print photos only ({photoCount})
          </button>
        )}
      </div>

      {notice && (
        <p role="status" className="print:hidden px-4 py-3 border border-amber-300 bg-amber-50 text-amber-800 font-syndicatgrotesk text-xs">{notice}</p>
      )}

      {/* Customization */}
      <section className={`${cardCls} order-details-only break-inside-avoid ${customized.length > 0 ? 'border-[#cbbde4]' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#E8E0D5] bg-[#FAF7F2]">
          <h2 className="font-brandon text-sm font-black uppercase tracking-[0.12em] text-[#1A1A1A]">Customization</h2>
          {customized.length > 0 && (
            <div className="print:hidden flex flex-wrap items-center gap-2">
            {order.contact.phone && (
              <a
                href={`tel:${order.contact.phone}`}
                className="inline-flex items-center gap-2 bg-[#1A1A1A] px-4 py-2.5 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.18em] text-white hover:bg-[#D4A017] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                Call customer
              </a>
            )}
            {customerWa ? (
              <a
                href={`https://wa.me/${customerWa}?text=${encodeURIComponent(customizationMessage(order, customized))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#1f8f4e] px-4 py-2.5 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.18em] text-white hover:bg-[#177a41] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                Message customer on WhatsApp
              </a>
            ) : (
              <span className="font-syndicatgrotesk text-[11px] text-red-700">No valid phone number to message.</span>
            )}
            </div>
          )}
        </div>
        <div className="px-5 py-4 font-syndicatgrotesk text-sm">
          {customized.length === 0 ? (
            <p className="text-[#8A7A6A]">No customization was asked for.</p>
          ) : (
            <ul className="space-y-2">
              {customized.map(item => (
                <li key={item.id}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-[#1A1A1A]">{item.products?.name || 'Item'} × {item.quantity}</span>
                    <span className="font-semibold text-[#7565a5]">{describeGiftExtraKeys(item.gift_extras)}</span>
                  </div>
                  {item.gift_extras?.includes('photo') && <PhotoStrip photos={item.gift_photos} />}
                </li>
              ))}
              <li className="pt-1 text-xs font-semibold text-[#B45309]">
                The customer was told our team will call them to confirm this customization.
              </li>
            </ul>
          )}
        </div>
      </section>

      {/* Photos to print */}
      {photoCount > 0 && (
        <section id="photos" className={`${cardCls} border-[#cbbde4] print:border-0`}>
          <div className="px-5 py-4 border-b border-[#E8E0D5] bg-[#FAF7F2] print:bg-white">
            <h2 className="font-brandon text-sm font-black uppercase tracking-[0.12em] text-[#1A1A1A]">
              Photos to print <span className="font-mono normal-case tracking-normal">· {orderNumber(order)}</span>
            </h2>
            <p className="mt-0.5 font-syndicatgrotesk text-[11px] text-[#8A7A6A] print:hidden">
              The customer’s photos for their customized items. Download them, or print them with the order number on each.
            </p>
          </div>
          <div className="px-5 py-5 text-[#1A1A1A]">
            <OrderPhotos orderNumber={orderNumber(order)} items={items} />
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start order-details-only print:grid-cols-1">
        {/* Products */}
        <section className={cardCls}>
          <h2 className="px-5 py-4 border-b border-[#E8E0D5] bg-[#FAF7F2] font-brandon text-sm font-black uppercase tracking-[0.12em] text-[#1A1A1A]">
            Products ordered
          </h2>
          <ul className="divide-y divide-[#F0EBE1]">
            {items.map(item => {
              const img = firstImage(item.products?.image)
              const extras = describeGiftExtraKeys(item.gift_extras)
              const price = Number(item.price)
              return (
                <li key={item.id} className="flex gap-4 px-5 py-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden border border-[#E8E0D5] bg-[#FAF7F2]">
                    {img && <img src={img} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1 font-syndicatgrotesk">
                    {item.products?.id ? (
                      <Link href={`/products/${item.products.id}`} target="_blank" className="font-brandon text-sm font-black uppercase tracking-wide text-[#1A1A1A] hover:text-[#D4A017]">
                        {item.products.name}
                      </Link>
                    ) : (
                      <p className="font-brandon text-sm font-black uppercase tracking-wide text-[#1A1A1A]">Item</p>
                    )}
                    <p className="mt-0.5 text-xs text-[#8A7A6A]">Qty {item.quantity} × {rupees(price)}</p>
                    {extras && <p className="mt-1 text-xs font-semibold text-[#7565a5]">+ {extras}</p>}
                    {item.gift_extras?.includes('photo') && <PhotoStrip photos={item.gift_photos} small />}
                  </div>
                  <p className="whitespace-nowrap font-brandon text-sm font-black text-[#1A1A1A]">{rupees(price * item.quantity)}</p>
                </li>
              )
            })}
          </ul>
          <div className="space-y-1.5 border-t border-[#E8E0D5] bg-[#FAF7F2] px-5 py-4 font-syndicatgrotesk text-xs text-[#8A7A6A]">
            <div className="flex justify-between"><span>Subtotal</span><span className="text-[#1A1A1A]">{rupees(subtotal)}</span></div>
            {discount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Coupon {order.coupon ? `${order.coupon.code} (${order.coupon.discount_percent}%)` : ''}</span>
                <span className="font-semibold">−{rupees(discount)}</span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span>Delivery</span>
              {hasShippingCharge
                ? <span className="text-[#1A1A1A]">See charges below</span>
                : hasFreeShipping(subtotal)
                  ? <span className="text-[#1A1A1A]">Free</span>
                  : <span className="text-right font-semibold text-[#B45309]">Add a delivery charge below</span>}
            </div>
            <div className="flex justify-between border-t border-[#E8E0D5] pt-1.5">
              <span>Products after coupon</span>
              <span className="text-[#1A1A1A]">{rupees(order.total)}</span>
            </div>

            {/* Extra charges */}
            <div className="border-t border-[#E8E0D5] pt-2">
              <p className="mb-1.5 font-syndicatgrotesk text-[9px] font-semibold uppercase tracking-[0.2em] text-[#8A7A6A]">Extra charges</p>
              <OrderChargesEditor orderId={order.id} charges={charges} photoCount={photoCount} onChange={setCharges} />
              {charges.length === 0 && customized.length > 0 && (
                <p className="mt-1.5 text-[11px] text-[#B45309] print:hidden">This order has gift extras. Add their charges once confirmed with the customer.</p>
              )}
            </div>

            <div className="flex items-end justify-between border-t border-[#E8E0D5] pt-2">
              <span className="font-brandon text-sm font-black uppercase text-[#1A1A1A]">Final total</span>
              <span className="font-brandon text-lg font-black text-[#1A1A1A]">{rupees(finalTotal)}</span>
            </div>
            {extraTotal > 0 && (
              <p className="text-right text-[10px]">{rupees(order.total)} + {rupees(extraTotal)} extra charges</p>
            )}
            {/* Final bill as a PDF: download it, or on a phone share it straight to the customer's WhatsApp. */}
            <div className="print:hidden mt-3 space-y-2 border-t border-[#E8E0D5] pt-3">
              <p className="flex items-center gap-1.5 font-syndicatgrotesk text-[9px] font-semibold uppercase tracking-[0.2em] text-[#8A7A6A]">
                <Receipt size={12} aria-hidden="true" /> Final bill
              </p>
              <BillButtons endpoint={`/api/admin/orders/${order.id}/bill`} shareText={billShareText(order, finalTotal)} />
              {customerWa && (
                <a
                  href={`https://wa.me/${customerWa}?text=${encodeURIComponent(billShareText(order, finalTotal))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-syndicatgrotesk text-[11px] font-semibold text-[#1f8f4e] underline underline-offset-2"
                >
                  Open customer’s WhatsApp chat (attach the PDF there)
                </a>
              )}
            </div>
          </div>
        </section>

        <div className="space-y-6">
          {/* Customer and address */}
          <section className={cardCls}>
            <h2 className="px-5 py-4 border-b border-[#E8E0D5] bg-[#FAF7F2] font-brandon text-sm font-black uppercase tracking-[0.12em] text-[#1A1A1A]">
              Deliver to
            </h2>
            <div className="space-y-3 px-5 py-4 font-syndicatgrotesk text-sm text-[#1A1A1A]">
              <div>
                <p className={labelCls}>Name</p>
                <p className="mt-0.5 font-semibold">{order.contact.name || '—'}</p>
              </div>
              <div>
                <p className={labelCls}>Phone</p>
                {order.contact.phone ? (
                  <p className="mt-0.5 flex flex-wrap gap-x-3">
                    <a href={`tel:${order.contact.phone}`} className="hover:text-[#D4A017]">{order.contact.phone}</a>
                    {customerWa && (
                      <a href={`https://wa.me/${customerWa}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#1f8f4e] underline underline-offset-2">
                        WhatsApp
                      </a>
                    )}
                  </p>
                ) : <p className="mt-0.5">—</p>}
              </div>
              <div>
                <p className={labelCls}>Email</p>
                {order.contact.email
                  ? <a href={`mailto:${order.contact.email}`} className="mt-0.5 block break-all hover:text-[#D4A017]">{order.contact.email}</a>
                  : <p className="mt-0.5">—</p>}
              </div>
              <div>
                <p className={labelCls}>Address</p>
                <p className="mt-0.5 whitespace-pre-line break-words leading-5">{order.contact.address || '—'}</p>
              </div>
            </div>
          </section>

          {/* Coupon */}
          <section className={`${cardCls} print:hidden`}>
            <h2 className="px-5 py-4 border-b border-[#E8E0D5] bg-[#FAF7F2] font-brandon text-sm font-black uppercase tracking-[0.12em] text-[#1A1A1A]">
              Coupon
            </h2>
            <div className="px-5 py-4">
              <CouponVerify orderId={order.id} coupon={order.coupon} discountAmount={order.discount_amount} expanded />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
