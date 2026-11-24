import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CartService } from '@/services/cart.service'
import { ApiError } from '@/lib/flower-quest/server'
import type { CartSummary, CouponRecord } from '@/lib/flower-quest/coupon'

type CartLine = { quantity: number; products: { id?: unknown; name?: unknown; price: string | number } }

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== 'object') return false
  const line = value as { quantity?: unknown; products?: unknown }
  if (!Number.isInteger(line.quantity) || Number(line.quantity) < 1 || !line.products || typeof line.products !== 'object') return false
  const price = (line.products as { price?: unknown }).price
  return typeof price === 'string' || typeof price === 'number'
}

/** The shopper's saved cart, priced on the server. An empty cart has no lines and a zero subtotal. */
export async function getCartSummary(supabase: SupabaseClient, userId: string): Promise<CartSummary> {
  const cart: unknown = await CartService.getCart(userId, supabase)
  const raw = cart && typeof cart === 'object' && Array.isArray((cart as { cart_items?: unknown }).cart_items)
    ? (cart as { cart_items: unknown[] }).cart_items
    : []
  if (!raw.every(isCartLine)) throw new ApiError('Your cart contains an item that could not be priced.', 400)

  let subtotalPaise = 0
  const lines = (raw as CartLine[]).map(line => {
    const price = Number(line.products.price)
    if (!Number.isFinite(price) || price < 0) throw new ApiError('Your cart contains an item that could not be priced.', 400)
    const linePaise = Math.round(price * 100) * line.quantity
    subtotalPaise += linePaise
    return {
      productId: typeof line.products.id === 'string' ? line.products.id : '',
      name: typeof line.products.name === 'string' ? line.products.name : 'Product',
      quantity: line.quantity,
      price,
      lineTotal: linePaise / 100,
    }
  })
  return { lines, subtotal: subtotalPaise / 100 }
}

/** The product subtotal of the shopper's saved cart, priced on the server. */
export async function getCartSubtotal(supabase: SupabaseClient, userId: string): Promise<number> {
  const { lines, subtotal } = await getCartSummary(supabase, userId)
  if (lines.length === 0) throw new ApiError('Your cart is empty.', 400)
  return subtotal
}

export async function loadCoupon(supabase: SupabaseClient, code: string): Promise<CouponRecord | null> {
  const { data, error } = await supabase
    .from('discount_coupons')
    .select('code, user_id, status, discount_percent, minimum_order_value, maximum_discount_amount, expires_at')
    .eq('code', code)
    .maybeSingle()
  if (error) throw error
  return data as CouponRecord | null
}
