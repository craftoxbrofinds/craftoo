import assert from 'node:assert/strict'
import test from 'node:test'
import { COUPON_CODE_PATTERN, normalizeCouponCode, quoteCoupon, type CouponRecord } from './coupon'

const USER = 'user-1'
const NOW = new Date('2026-11-22T10:00:00Z')

function coupon(overrides: Partial<CouponRecord> = {}): CouponRecord {
  return {
    code: 'FQ-ABCD-1234',
    user_id: USER,
    status: 'available',
    discount_percent: 10,
    minimum_order_value: '599.00',
    maximum_discount_amount: '500.00',
    expires_at: '2026-11-29T10:00:00Z',
    ...overrides,
  }
}

test('a valid coupon takes its percentage off the product subtotal', () => {
  const result = quoteCoupon(coupon(), USER, 1200, NOW)
  assert.ok(result.ok)
  assert.equal(result.quote.discountAmount, 120)
  assert.equal(result.quote.total, 1080)
  assert.equal(result.quote.subtotal, 1200)
})

test('the discount is capped at the coupon maximum', () => {
  const result = quoteCoupon(coupon({ discount_percent: 15 }), USER, 10000, NOW)
  assert.ok(result.ok)
  assert.equal(result.quote.discountAmount, 500)
  assert.equal(result.quote.total, 9500)
})

test('discounts are rounded to whole paise', () => {
  const result = quoteCoupon(coupon({ discount_percent: 15 }), USER, 999.99, NOW)
  assert.ok(result.ok)
  assert.equal(result.quote.discountAmount, 150)
  assert.equal(result.quote.total, 849.99)
})

test('orders below the minimum say how much more is needed', () => {
  const result = quoteCoupon(coupon(), USER, 450, NOW)
  assert.ok(!result.ok)
  assert.equal(result.error.reason, 'minimum')
  assert.match(result.error.message, /₹149 more/)
})

test('used, expired, missing and other people’s coupons are rejected', () => {
  const used = quoteCoupon(coupon({ status: 'redeemed' }), USER, 1200, NOW)
  assert.ok(!used.ok && used.error.reason === 'used')

  const reserved = quoteCoupon(coupon({ status: 'reserved' }), USER, 1200, NOW)
  assert.ok(!reserved.ok && reserved.error.reason === 'placed')

  const expired = quoteCoupon(coupon({ expires_at: '2026-11-21T10:00:00Z' }), USER, 1200, NOW)
  assert.ok(!expired.ok && expired.error.reason === 'expired')

  const missing = quoteCoupon(null, USER, 1200, NOW)
  assert.ok(!missing.ok && missing.error.reason === 'not-found')

  // Someone else's code looks exactly like a code that does not exist.
  const foreign = quoteCoupon(coupon({ user_id: 'user-2' }), USER, 1200, NOW)
  assert.ok(!foreign.ok)
  assert.deepEqual(foreign.error, missing.ok ? null : missing.error)
})

test('codes are normalised and checked for a safe format', () => {
  assert.equal(normalizeCouponCode('  fq-abcd-1234 '), 'FQ-ABCD-1234')
  assert.equal(normalizeCouponCode(42), '')
  assert.ok(COUPON_CODE_PATTERN.test('FQ-ABCD-1234'))
  // The current 10-character format, and the longer format of codes issued before it.
  assert.ok(COUPON_CODE_PATTERN.test('FQ7K2MQ9XR'))
  assert.ok(COUPON_CODE_PATTERN.test('FLOWER-0123456789ABCDEF0123456789ABCDEF'))
  assert.ok(!COUPON_CODE_PATTERN.test('FQ ABCD'))
  assert.ok(!COUPON_CODE_PATTERN.test("FQ';--"))
})
