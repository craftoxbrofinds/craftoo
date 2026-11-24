'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { OrderCouponCheck } from '@/lib/flower-quest/coupon'

/** Shared bits for the admin order list and order detail pages. */

export const STATUS_OPTIONS = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']

export const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export const rupees = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0)
  const paise = Math.round(amount * 100) % 100 !== 0
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: 2 })}`
}

export const orderNumber = (order: { id: string; order_number?: string | null }) =>
  order.order_number || order.id.slice(0, 8).toUpperCase()

export async function adminHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token ?? ''}` }
}

/**
 * The coupon on an order with a Verify button. Verifying checks the coupon against the order:
 * owner, expiry on the order date, minimum, discount, and that no other order uses it.
 */
export function CouponVerify({
  orderId,
  coupon,
  discountAmount,
  expanded = false,
}: {
  orderId: string
  coupon: { code: string; status: string } | null
  discountAmount?: number | string | null
  /** Show every check, not only the failed ones. */
  expanded?: boolean
}) {
  const [result, setResult] = useState<OrderCouponCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  if (!coupon) return <span className="font-syndicatgrotesk text-[10px] text-[#C4B49A]">No coupon</span>

  const verify = async () => {
    setChecking(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/verify-coupon`, { headers: await adminHeaders() })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'The coupon could not be checked.')
      setResult(body as OrderCouponCheck)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'The coupon could not be checked.')
    } finally {
      setChecking(false)
    }
  }

  const shown = result ? (expanded ? result.checks : result.checks.filter(check => !check.ok)) : []

  return (
    <div className="space-y-1.5 font-syndicatgrotesk">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-[11px] font-semibold text-[#1A1A1A]">{coupon.code}</span>
        <span className="text-[10px] capitalize text-[#8A7A6A]">{coupon.status}</span>
        {Number(discountAmount) > 0 && <span className="text-[10px] text-green-700">−{rupees(discountAmount)}</span>}
      </div>
      <button
        type="button"
        onClick={() => void verify()}
        disabled={checking}
        className="border border-[#1A1A1A] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#1A1A1A] transition-colors hover:bg-[#1A1A1A] hover:text-white disabled:opacity-40"
      >
        {checking ? 'Checking…' : result ? 'Verify again' : 'Verify'}
      </button>
      {error && <p role="alert" className="text-[10px] text-red-700">{error}</p>}
      {result && (
        <div role="status" className={`border px-2 py-1.5 text-[10px] leading-4 ${result.valid ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-800'}`}>
          <p className="font-semibold">{result.valid ? '✓ ' : '✕ '}{result.summary}</p>
          {shown.length > 0 && (
            <ul className="mt-1 space-y-1">
              {shown.map(check => (
                <li key={check.key}>
                  <span className={check.ok ? 'text-green-700' : 'text-red-700'}>{check.ok ? '✓' : '✕'}</span>{' '}
                  <span className="font-semibold">{check.label}.</span> <span className="text-[#5A4E42]">{check.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
