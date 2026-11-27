import { createClient } from '@supabase/supabase-js'
import { CartService } from '@/services/cart.service'
import { createAdminClient } from '@/lib/supabase-admin'
import Razorpay from 'razorpay'
import { logger } from '@/lib/logger'

const log = logger.child({ route: 'checkout' })

class CheckoutError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

type CheckoutCartItem = {
  quantity: number
  products: { id: string; price: string | number }
}

function isCheckoutCartItem(value: unknown): value is CheckoutCartItem {
  if (!value || typeof value !== 'object') return false
  const item = value as { quantity?: unknown; products?: unknown }
  if (!Number.isInteger(item.quantity) || Number(item.quantity) < 1 || !item.products || typeof item.products !== 'object') {
    return false
  }
  const product = item.products as { id?: unknown; price?: unknown }
  return typeof product.id === 'string' &&
    (typeof product.price === 'string' || typeof product.price === 'number')
}

const getAuthClient = (token: string) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new CheckoutError('Authentication service is not configured', 503)
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

export async function POST(req: Request) {
  const token = /^Bearer\s+([^\s]+)$/i.exec(req.headers.get('authorization') ?? '')?.[1]
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data: { user }, error: authError } = await getAuthClient(token).auth.getUser(token)
    if (authError || !user) throw new CheckoutError('Unauthorized', 401)

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new CheckoutError('Online payments are not configured', 503)
    }

    const body = await req.json() as {
      name?: unknown
      email?: unknown
      phone?: unknown
      address?: unknown
      couponCode?: unknown
    }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const address = typeof body.address === 'string' ? body.address.trim() : ''
    const couponCode = typeof body.couponCode === 'string' ? body.couponCode.trim().toUpperCase() : ''

    if (!name || name.length > 120 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^[6-9][0-9]{9}$/.test(phone) || !address || address.length > 2000) {
      throw new CheckoutError('Enter valid delivery details and try again', 400)
    }
    if (couponCode && !/^[A-Z0-9-]{6,48}$/i.test(couponCode)) {
      throw new CheckoutError('Coupon code is invalid', 400)
    }

    const supabase = createAdminClient()
    const cartValue: unknown = await CartService.getCart(user.id, supabase)
    const cartItems = cartValue && typeof cartValue === 'object' &&
      Array.isArray((cartValue as { cart_items?: unknown }).cart_items)
      ? (cartValue as { cart_items: unknown[] }).cart_items
      : []
    if (cartItems.length === 0) throw new CheckoutError('Cart is empty', 400)
    if (!cartItems.every(isCheckoutCartItem)) throw new CheckoutError('Cart contains an invalid item', 400)

    const cart = cartItems as CheckoutCartItem[]
    const subtotalPaise = cart.reduce((sum, item) => {
      const price = Number(item.products.price)
      if (!Number.isFinite(price) || price < 0) {
        throw new CheckoutError('Cart contains an invalid item', 400)
      }
      return sum + Math.round(price * 100) * item.quantity
    }, 0)
    const subtotal = subtotalPaise / 100
    if (!Number.isFinite(subtotal) || subtotal < 1) {
      throw new CheckoutError('Order amount must be at least ₹1', 400)
    }

    const formattedAddress = `Name: ${name} | Email: ${email} | Phone: ${phone} | Address: ${address}`
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        user_id: user.id,
        subtotal,
        discount_amount: 0,
        total: subtotal,
        address: formattedAddress,
        status: 'pending',
      }])
      .select('id')
      .single()
    if (orderError || !order) throw orderError ?? new Error('Could not create order')

    let couponReserved = false
    try {
      const orderItems = cart.map(item => ({
        order_id: order.id,
        product_id: item.products.id,
        quantity: item.quantity,
        price: Number(item.products.price),
      }))
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
      if (itemsError) throw itemsError

      let total = subtotal
      let discountAmount = 0
      if (couponCode) {
        const { data, error } = await supabase.rpc('reserve_flower_quest_coupon', {
          p_code: couponCode,
          p_user_id: user.id,
          p_order_id: order.id,
          p_subtotal: subtotal,
        })
        if (error) throw new CheckoutError('Coupon is invalid, expired, or not eligible for this order', 400)
        const reservation = Array.isArray(data) ? data[0] : data
        if (!reservation) throw new Error('Coupon reservation returned no result')
        discountAmount = Number(reservation.discount_amount)
        total = Number(reservation.final_total)
        if (!Number.isFinite(total) || !Number.isFinite(discountAmount) || total < 1) {
          throw new Error('Coupon calculation returned an invalid total')
        }
        couponReserved = true
      }

      const amountPaise = Math.round(total * 100)
      if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
        throw new CheckoutError('Order amount must be at least ₹1', 400)
      }

      const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
      const razorpayOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `receipt_${order.id}`.slice(0, 40),
      })

      const { error: updateError } = await supabase
        .from('orders')
        .update({ razorpay_order_id: razorpayOrder.id })
        .eq('id', order.id)
        .eq('user_id', user.id)
        .eq('status', 'pending')
      if (updateError) throw updateError

      log.info('Checkout order created', { orderId: order.id, userId: user.id, subtotal, discountAmount, total, couponUsed: couponReserved })
      return Response.json({
        success: true,
        orderId: order.id,
        razorpayOrderId: razorpayOrder.id,
        razorpayKeyId,
        subtotal,
        discountAmount,
        amount: total,
        currency: 'INR',
        name,
        email,
        phone,
      }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      if (couponReserved) {
        const { error: releaseError } = await supabase.rpc('release_flower_quest_coupon', {
          p_order_id: order.id,
          p_user_id: user.id,
        })
        if (releaseError) log.error('Could not release coupon after checkout failure', { orderId: order.id, error: releaseError })
      }
      const { error: cancelError } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id)
        .eq('user_id', user.id)
        .eq('status', 'pending')
      if (cancelError) log.error('Could not cancel incomplete checkout order', { orderId: order.id, error: cancelError })
      throw error
    }
  } catch (error) {
    if (error instanceof CheckoutError) {
      if (error.status >= 500) log.warn('Checkout unavailable', { status: error.status, reason: error.message })
      return Response.json({ error: error.message }, { status: error.status })
    }
    log.error('Checkout failed', { error })
    return Response.json({ error: 'Checkout could not be completed' }, { status: 500 })
  }
}
