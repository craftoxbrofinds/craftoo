'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { COUPON_CODE_PATTERN, normalizeCouponCode, type StaffCouponLookup, type StaffCouponState } from '@/lib/flower-quest/coupon'
import { formatDateTimeIST } from '@/lib/datetime'

const rupees = (value: number) => {
  const paise = Math.round(value * 100) % 100 !== 0
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: 2 })}`
}

const formatDate = (value: string | null) =>
  value ? formatDateTimeIST(value) : '—'

const STATE_STYLE: Record<StaffCouponState, { label: string; badge: string; panel: string }> = {
  available: { label: 'Valid', badge: 'bg-green-100 text-green-700', panel: 'border-green-300 bg-green-50 text-green-800' },
  redeemed: { label: 'Redeemed', badge: 'bg-red-100 text-red-700', panel: 'border-red-300 bg-red-50 text-red-800' },
  reserved: { label: 'Order placed', badge: 'bg-amber-100 text-amber-700', panel: 'border-amber-300 bg-amber-50 text-amber-800' },
  expired: { label: 'Expired', badge: 'bg-gray-200 text-gray-700', panel: 'border-gray-300 bg-gray-50 text-gray-700' },
}

const labelCls = 'font-syndicatgrotesk text-[9px] tracking-[0.2em] uppercase text-[#8A7A6A]'

export default function AdminCoupons() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<StaffCouponLookup | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)

  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}` }
  }

  const check = async (raw: string = code) => {
    const normalized = normalizeCouponCode(raw)
    setError('')
    setNotice('')
    if (!COUPON_CODE_PATTERN.test(normalized)) {
      setResult(null)
      setError('Enter a valid coupon code. It uses letters, numbers and dashes only.')
      return
    }
    setCode(normalized)
    setChecking(true)
    try {
      const res = await fetch(`/api/admin/coupons?code=${encodeURIComponent(normalized)}`, { headers: await authHeaders() })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResult(null)
        setError(body.error || 'The coupon could not be looked up.')
        return
      }
      setResult(body as StaffCouponLookup)
    } catch {
      setResult(null)
      setError('The coupon could not be looked up. Check your connection and try again.')
    } finally {
      setChecking(false)
    }
  }

  const update = async (action: 'redeem' | 'restore') => {
    if (!result) return
    const question = action === 'redeem'
      ? `Mark ${result.coupon.code} as redeemed? Do this only after you confirm the customer's order. It can't be used again afterwards.`
      : `Make ${result.coupon.code} usable again? The customer will be able to place a new order with it.`
    if (!window.confirm(question)) return

    setUpdating(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'PATCH',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: result.coupon.code, action }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (body.lookup) setResult(body.lookup as StaffCouponLookup)
        setError(body.error || 'The coupon could not be updated.')
        return
      }
      setResult(body as StaffCouponLookup)
      setNotice(action === 'redeem' ? 'Coupon marked as redeemed.' : 'Coupon is usable again.')
    } catch {
      setError('The coupon could not be updated. Check your connection and try again.')
    } finally {
      setUpdating(false)
    }
  }

  const style = result ? STATE_STYLE[result.coupon.state] : null

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="font-brandon text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">Coupons</h1>
        <p className="font-syndicatgrotesk text-[11px] tracking-[0.1em] text-[#8A7A6A] mt-0.5">
          Check a Flower Quest coupon from a WhatsApp order, then mark it redeemed once you confirm the order.
        </p>
      </div>

      <form
        onSubmit={e => { e.preventDefault(); void check() }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <label htmlFor="coupon-code" className="sr-only">Coupon code</label>
        <input
          id="coupon-code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={48}
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Coupon code, e.g. FQ7K2MQ9XR"
          className="flex-1 min-w-0 px-4 py-3 bg-white border border-[#E8E0D5] font-mono text-sm tracking-wide text-[#1A1A1A] outline-none focus:border-[#D4A017]"
        />
        <button
          type="submit"
          disabled={checking || !code.trim()}
          className="px-6 py-3 bg-[#1A1A1A] text-white font-syndicatgrotesk text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-[#D4A017] disabled:opacity-40 transition-colors"
        >
          {checking ? 'Checking…' : 'Check coupon'}
        </button>
      </form>

      {error && (
        <p role="alert" className="px-4 py-3 border border-red-300 bg-red-50 text-red-700 font-syndicatgrotesk text-xs">{error}</p>
      )}
      {notice && (
        <p role="status" className="px-4 py-3 border border-green-300 bg-green-50 text-green-700 font-syndicatgrotesk text-xs">{notice}</p>
      )}

      {result && style && (
        <div className="bg-white border border-[#E8E0D5]">
          {/* Verdict */}
          <div className={`px-5 py-4 border-b ${style.panel}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-lg font-semibold break-all">{result.coupon.code}</span>
              <span className={`px-2 py-0.5 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.15em] ${style.badge}`}>
                {style.label}
              </span>
            </div>
            <p className="mt-1 font-syndicatgrotesk text-xs">{result.message}</p>
          </div>

          {/* Details */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 px-5 py-5">
            <div>
              <dt className={labelCls}>Belongs to</dt>
              <dd className="mt-1 font-syndicatgrotesk text-sm text-[#1A1A1A]">
                {result.owner.name || 'No name'}
                <span className="block text-xs text-[#8A7A6A] break-all">{result.owner.email || 'No email'}</span>
              </dd>
            </div>
            <div>
              <dt className={labelCls}>Discount</dt>
              <dd className="mt-1 font-syndicatgrotesk text-sm text-[#1A1A1A]">
                {result.coupon.discountPercent}% off products, up to {rupees(result.coupon.maximumDiscountAmount)}
                <span className="block text-xs text-[#8A7A6A]">Minimum order {rupees(result.coupon.minimumOrderValue)}</span>
              </dd>
            </div>
            <div>
              <dt className={labelCls}>Expires</dt>
              <dd className="mt-1 font-syndicatgrotesk text-sm text-[#1A1A1A]">{formatDate(result.coupon.expiresAt)}</dd>
            </div>
            <div>
              <dt className={labelCls}>Redeemed</dt>
              <dd className="mt-1 font-syndicatgrotesk text-sm text-[#1A1A1A]">{formatDate(result.coupon.redeemedAt)}</dd>
            </div>
          </dl>

          {/* The order that uses this coupon */}
          <div className="border-t border-[#E8E0D5] px-5 py-5">
            <p className={labelCls}>Order with this coupon</p>
            {result.order ? (
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3 font-syndicatgrotesk text-sm text-[#1A1A1A]">
                <span>
                  <span className="font-mono font-semibold">{result.order.ref}</span>
                  <span className="ml-2 text-xs text-[#8A7A6A]">placed {formatDate(result.order.createdAt)}</span>
                </span>
                <span className="text-xs">
                  <span className="capitalize">{result.order.status}</span> · {rupees(result.order.total)}
                </span>
                <p className="w-full text-[11px] leading-4 text-[#8A7A6A]">
                  Moving this order past “pending” on the Orders page redeems the coupon. Cancelling it makes the coupon usable again.
                </p>
              </div>
            ) : (
              <p className="mt-2 font-syndicatgrotesk text-xs text-[#8A7A6A]">No order uses this coupon.</p>
            )}
          </div>

          {/* Owner's cart estimate */}
          <div className="border-t border-[#E8E0D5] px-5 py-5">
            <p className={labelCls}>Customer’s cart right now</p>
            {result.cart.lines.length > 0 && (
              <ul className="mt-3 divide-y divide-[#F0EAE0] border-y border-[#F0EAE0]">
                {result.cart.lines.map((line, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2 font-syndicatgrotesk text-xs text-[#1A1A1A]">
                    <span className="min-w-0">{line.name} × {line.quantity}</span>
                    <span className="shrink-0">{rupees(line.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 space-y-1.5 font-syndicatgrotesk text-xs text-[#8A7A6A]">
              {result.cart.lines.length > 0 && (
                <div className="flex justify-between"><span>Subtotal</span><span className="text-[#1A1A1A]">{rupees(result.cart.subtotal)}</span></div>
              )}
              {result.cart.estimate && (
                <>
                  <div className="flex justify-between text-green-700">
                    <span>Coupon ({result.cart.estimate.discountPercent}%)</span>
                    <span className="font-semibold">−{rupees(result.cart.estimate.discountAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#F0EAE0] pt-1.5">
                    <span className="font-brandon text-sm font-black uppercase text-[#1A1A1A]">Estimated total</span>
                    <span className="font-brandon text-base font-black text-[#1A1A1A]">{rupees(result.cart.estimate.total)}</span>
                  </div>
                </>
              )}
              {result.cart.note && <p className="pt-1 text-[#1A1A1A]">{result.cart.note}</p>}
              <p className="pt-1 text-[10px] leading-4">
                Compare this with the WhatsApp message. Delivery and gift extras are not included.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 border-t border-[#E8E0D5] px-5 py-4">
            {result.canRedeem && (
              <button
                type="button"
                onClick={() => void update('redeem')}
                disabled={updating}
                className="px-5 py-3 bg-[#1A1A1A] text-white font-syndicatgrotesk text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-[#D4A017] disabled:opacity-40 transition-colors"
              >
                {updating ? 'Saving…' : 'Mark as redeemed'}
              </button>
            )}
            {result.canRestore && (
              <button
                type="button"
                onClick={() => void update('restore')}
                disabled={updating}
                className="px-5 py-3 border border-[#E8E0D5] bg-white text-[#1A1A1A] font-syndicatgrotesk text-[10px] font-bold tracking-[0.2em] uppercase hover:border-[#1A1A1A] disabled:opacity-40 transition-colors"
              >
                {updating ? 'Saving…' : 'Make usable again'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void check(result.coupon.code)}
              disabled={checking || updating}
              className="px-5 py-3 font-syndicatgrotesk text-[10px] font-bold tracking-[0.2em] uppercase text-[#8A7A6A] hover:text-[#1A1A1A] disabled:opacity-40 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
