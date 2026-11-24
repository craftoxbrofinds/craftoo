/**
 * Flower Quest coupon rules, shared by the checkout validation API and its tests.
 * They mirror `reserve_flower_quest_coupon` in the database: the discount is a percentage of the
 * product subtotal, capped at the coupon's maximum, and never applies to delivery charges.
 */

export const COUPON_CODE_PATTERN = /^[A-Z0-9-]{6,48}$/

export function normalizeCouponCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

export type CouponRecord = {
  code: string
  user_id: string
  status: string
  discount_percent: number
  minimum_order_value: number | string
  maximum_discount_amount: number | string
  expires_at: string
}

export type CouponQuote = {
  code: string
  discountPercent: number
  subtotal: number
  discountAmount: number
  total: number
  minimumOrderValue: number
  maximumDiscountAmount: number
  expiresAt: string
}

export type CouponRejection = { reason: 'not-found' | 'used' | 'placed' | 'expired' | 'minimum'; message: string }

const formatRupees = (value: number) => {
  const paise = Math.round(value * 100) % 100 !== 0
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: 2 })}`
}

/** Rounds to whole paise. */
function toPaise(value: number): number {
  return Math.round(value * 100)
}

export function quoteCoupon(
  coupon: CouponRecord | null,
  userId: string,
  subtotal: number,
  now: Date = new Date(),
): { ok: true; quote: CouponQuote } | { ok: false; error: CouponRejection } {
  // A coupon that belongs to someone else is reported exactly like one that does not exist,
  // so the endpoint cannot be used to discover other people's codes.
  if (!coupon || coupon.user_id !== userId) {
    return { ok: false, error: { reason: 'not-found', message: 'This coupon code isn’t valid for your account. Check the code and try again.' } }
  }
  if (coupon.status === 'redeemed') {
    return { ok: false, error: { reason: 'used', message: 'This coupon has already been used.' } }
  }
  // 'reserved' means an order with this coupon is waiting for the team to confirm it.
  if (coupon.status === 'reserved') {
    return { ok: false, error: { reason: 'placed', message: 'You’ve already placed an order with this coupon. Our team will confirm it on WhatsApp.' } }
  }
  if (coupon.status !== 'available' || Date.parse(coupon.expires_at) <= now.getTime()) {
    return { ok: false, error: { reason: 'expired', message: 'This coupon has expired.' } }
  }

  const minimumOrderValue = Number(coupon.minimum_order_value)
  const maximumDiscountAmount = Number(coupon.maximum_discount_amount)
  if (subtotal < minimumOrderValue) {
    const shortBy = Math.ceil((minimumOrderValue - subtotal) * 100) / 100
    return {
      ok: false,
      error: {
        reason: 'minimum',
        message: `This coupon needs a minimum order of ${formatRupees(minimumOrderValue)}. Add ${formatRupees(shortBy)} more to use it.`,
      },
    }
  }

  const subtotalPaise = toPaise(subtotal)
  const discountPaise = Math.min(
    Math.round((subtotalPaise * coupon.discount_percent) / 100),
    toPaise(maximumDiscountAmount),
  )
  return {
    ok: true,
    quote: {
      code: coupon.code,
      discountPercent: coupon.discount_percent,
      subtotal: subtotalPaise / 100,
      discountAmount: discountPaise / 100,
      total: (subtotalPaise - discountPaise) / 100,
      minimumOrderValue,
      maximumDiscountAmount,
      expiresAt: coupon.expires_at,
    },
  }
}

/** The result of checking an order's coupon against that order (admin Verify button). */
export type OrderCouponCheck = {
  hasCoupon: boolean
  /** True when every check passed. */
  valid: boolean
  summary: string
  coupon: { code: string; status: string; discountPercent: number; expiresAt: string } | null
  checks: { key: string; label: string; ok: boolean; detail: string }[]
}

export type CartSummary = {
  lines: { productId: string; name: string; quantity: number; price: number; lineTotal: number }[]
  subtotal: number
}

/** What staff see for a coupon on the admin coupon page. */
export type StaffCouponState = 'available' | 'redeemed' | 'reserved' | 'expired'

export type StaffCouponLookup = {
  coupon: {
    code: string
    status: string
    state: StaffCouponState
    discountPercent: number
    minimumOrderValue: number
    maximumDiscountAmount: number
    expiresAt: string
    redeemedAt: string | null
    createdAt: string
  }
  owner: { id: string; name: string | null; email: string | null }
  /** The order (not cancelled) that uses this coupon, if any. */
  order: { ref: string; status: string; createdAt: string; total: number } | null
  /** True when no order uses the coupon and it can still be applied. */
  usable: boolean
  canRedeem: boolean
  canRestore: boolean
  message: string
  cart: CartSummary & { estimate: CouponQuote | null; note: string | null }
}
