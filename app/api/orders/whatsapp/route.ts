import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError, getOptionalUser, getServiceClient, handleApiError } from '@/lib/flower-quest/server'
import { COUPON_CODE_PATTERN, normalizeCouponCode, quoteCoupon, type CouponRecord } from '@/lib/flower-quest/coupon'
import { getCartSummary } from '@/lib/flower-quest/coupon-server'
import { findActiveCouponOrder, orderRef, type LinkedOrder } from '@/lib/flower-quest/coupon-orders'
import type { PlacedOrder } from '@/lib/whatsapp-order'
import { MAX_GIFT_PHOTOS, giftExtraKeys, type GiftExtraKey } from '@/lib/gift-extras'
import { checkCustomerDetails } from '@/lib/customer-details'
import { saveCustomerDetails } from '@/lib/customer-details-server'
import { CartService } from '@/services/cart.service'
import { FILE_STORAGE_URL as fileServiceUrl } from '@/lib/file-storage'


/** A photo uploaded through /api/uploads/gift-photos (a plain file name on our file storage). */
function isGiftPhotoUrl(url: string): boolean {
  if (!url.startsWith(`${fileServiceUrl}/`)) return false
  try {
    return /^[A-Za-z0-9._-]+$/.test(decodeURIComponent(url.slice(fileServiceUrl.length + 1)))
  } catch {
    return false
  }
}

/**
 * Records a WhatsApp order just before the shopper's WhatsApp opens, using the server-side cart.
 *
 * Duplicates are refused:
 * - A coupon already on an order that is not cancelled can't be used for another order.
 * - Sending the same items again while that order is still pending (for example because WhatsApp
 *   didn't open the first time) returns the existing order instead of creating a second one.
 *
 * The shopper's reviewed total is sent as `expectedTotal`; if the server's figure differs, nothing
 * is created and the new figures are returned so the shopper can check them first.
 */

type CouponRow = CouponRecord & { id: string }

const noStore = { 'Cache-Control': 'no-store' }
/** A pending order with the same items within this window counts as the same order. */
const SAME_ORDER_WINDOW_MS = 24 * 60 * 60 * 1000

const toPaise = (value: number) => Math.round(value * 100)

const signatureOf = (lines: { productId: string; quantity: number }[]) =>
  lines.map(line => `${line.productId}:${line.quantity}`).sort().join('|')

function conflict(reason: string, error: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error, reason, ...extra }, { status: 409, headers: noStore })
}

function placedResponse(order: LinkedOrder, coupon: CouponRow | null) {
  return { id: order.id, ref: order.ref, status: order.status, createdAt: order.createdAt, couponCode: coupon?.code ?? null }
}

async function loadCouponRow(supabase: SupabaseClient, code: string): Promise<CouponRow | null> {
  const { data, error } = await supabase
    .from('discount_coupons')
    .select('id, code, user_id, status, discount_percent, minimum_order_value, maximum_discount_amount, expires_at')
    .eq('code', code)
    .maybeSingle()
  if (error) throw error
  return data as CouponRow | null
}

async function couponById(supabase: SupabaseClient, id: string): Promise<{ code: string; discount_percent: number } | null> {
  const { data, error } = await supabase.from('discount_coupons').select('code, discount_percent').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function POST(req: Request) {
  try {
    const user = await getOptionalUser(req)
    if (!user) throw new ApiError('Sign in to place your order.', 401)

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const checked = checkCustomerDetails(body)
    if (!checked.ok) throw new ApiError(checked.error, 400)
    const { name, email, phone, address } = checked.details
    const couponCode = normalizeCouponCode(body.couponCode)
    const expectedTotal = Number(body.expectedTotal)

    // Remember these details on the profile for next time. A failure here never blocks the order.
    const rememberDetails = () => saveCustomerDetails(user.id, checked.details)
      .catch(error => console.error('Could not save checkout details to the profile', error))
    // The order now holds the items, so the cart is emptied. A failure here never blocks the order.
    const emptyCart = () => CartService.clearUserCart(user.id, supabase)
      .catch(error => console.error('Could not empty the cart after a WhatsApp order', error))
    if (couponCode && !COUPON_CODE_PATTERN.test(couponCode)) {
      throw new ApiError('Enter a valid coupon code. It uses letters, numbers and dashes only.', 400)
    }
    if (!Number.isFinite(expectedTotal)) throw new ApiError('Your order total is missing. Reload the page and try again.', 400)

    const supabase = getServiceClient()
    const cart = await getCartSummary(supabase, user.id)
    if (cart.lines.length === 0) throw new ApiError('Your cart is empty.', 400)
    if (cart.lines.some(line => !line.productId)) throw new ApiError('Your cart contains an item that could not be priced.', 400)

    // Gift extras the shopper ticked, by product id. Only known extras for products in the cart count.
    const rawExtras = body.giftExtras && typeof body.giftExtras === 'object' ? body.giftExtras as Record<string, unknown> : {}
    const extrasFor = (productId: string): GiftExtraKey[] => {
      const value = rawExtras[productId]
      return Array.isArray(value) ? giftExtraKeys(value.filter((v): v is string => typeof v === 'string')) : []
    }
    // Uploaded photos for the "Your photo" extra: only links to our own file storage count.
    const rawPhotos = body.giftPhotos && typeof body.giftPhotos === 'object' ? body.giftPhotos as Record<string, unknown> : {}
    const photosFor = (productId: string): string[] => {
      if (!extrasFor(productId).includes('photo')) return []
      const value = rawPhotos[productId]
      if (!Array.isArray(value)) return []
      const urls = value.filter((url): url is string => typeof url === 'string' && isGiftPhotoUrl(url))
      return [...new Set(urls)].slice(0, MAX_GIFT_PHOTOS)
    }
    const missingPhoto = cart.lines.find(line => extrasFor(line.productId).includes('photo') && photosFor(line.productId).length === 0)
    if (missingPhoto) {
      throw new ApiError(`Upload at least one photo for ${missingPhoto.name}, or untick “Your photo”.`, 400)
    }

    const formattedAddress = `Name: ${name} | Email: ${email} | Phone: ${phone} | Address: ${address}`
    const coupon = couponCode ? await loadCouponRow(supabase, couponCode) : null
    if (couponCode && (!coupon || coupon.user_id !== user.id)) {
      return Response.json({ error: 'This coupon code isn’t valid for your account. Check the code and try again.', reason: 'not-found' }, { status: 422, headers: noStore })
    }

    // 1. The same items sent again while the first order is pending: reuse that order.
    const since = new Date(Date.now() - SAME_ORDER_WINDOW_MS).toISOString()
    const { data: recent, error: recentError } = await supabase
      .from('orders')
      .select('id, order_number, status, created_at, subtotal, discount_amount, total, game_coupon_id, order_items(id, product_id, quantity)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .is('razorpay_order_id', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    if (recentError) throw recentError

    const signature = signatureOf(cart.lines)
    const same = (recent ?? []).find(order =>
      signatureOf((order.order_items ?? []).map((item: { product_id: string; quantity: number }) => ({ productId: item.product_id, quantity: item.quantity }))) === signature)
    if (same) {
      const sameCouponId: string | null = same.game_coupon_id ?? null
      if ((coupon?.id ?? null) !== sameCouponId) {
        return conflict('duplicate', `You’ve already placed an order for these items (order ${orderRef(same)}). Our team will contact you to confirm it. To change it, contact us about that order.`, {
          order: { id: same.id, ref: orderRef(same), status: same.status, createdAt: same.created_at, couponCode: null },
        })
      }
      // Keep the latest delivery details on the existing order.
      const { error: addressError } = await supabase.from('orders').update({ address: formattedAddress }).eq('id', same.id).eq('status', 'pending')
      if (addressError) throw addressError
      // ...and the latest gift extras on its items.
      for (const item of (same.order_items ?? []) as { id: string; product_id: string }[]) {
        const { error: extrasError } = await supabase.from('order_items').update({ gift_extras: extrasFor(item.product_id), gift_photos: photosFor(item.product_id) }).eq('id', item.id)
        if (extrasError) throw extrasError
      }
      const linked = sameCouponId ? await couponById(supabase, sameCouponId) : null
      const placed: PlacedOrder = {
        orderId: same.id,
        ref: orderRef(same),
        existing: true,
        subtotal: Number(same.subtotal ?? same.total),
        discountAmount: Number(same.discount_amount ?? 0),
        total: Number(same.total),
        coupon: linked ? { code: linked.code, discountPercent: linked.discount_percent } : null,
      }
      await Promise.all([rememberDetails(), emptyCart()])
      return Response.json(placed, { headers: noStore })
    }

    // 2. A coupon already on another order can't be used again.
    let discountAmount = 0
    let discountPercent = 0
    if (coupon) {
      if (coupon.status === 'reserved' || coupon.status === 'redeemed') {
        const active = await findActiveCouponOrder(supabase, coupon.id)
        if (active) {
          return conflict('already-placed', `You’ve already placed order ${active.ref} with this coupon, so it can’t be used for another order.`, {
            order: placedResponse(active, coupon),
          })
        }
      }
      const quote = quoteCoupon(coupon, user.id, cart.subtotal)
      if (!quote.ok) {
        return Response.json({ error: quote.error.message, reason: quote.error.reason }, { status: 422, headers: noStore })
      }
      discountAmount = quote.quote.discountAmount
      discountPercent = quote.quote.discountPercent
    }
    const total = (toPaise(cart.subtotal) - toPaise(discountAmount)) / 100

    // 3. The shopper must have seen these figures.
    if (toPaise(total) !== toPaise(expectedTotal)) {
      return conflict('changed', 'Your cart changed, so your total was updated. Check the new total and tap send again.', {
        subtotal: cart.subtotal,
        discountAmount,
        total,
      })
    }

    // 4. Hold the coupon. Only an available coupon changes, so two orders sent at once can't both use it.
    if (coupon) {
      const { data: held, error: holdError } = await supabase
        .from('discount_coupons')
        .update({ status: 'reserved' })
        .eq('id', coupon.id)
        .eq('status', 'available')
        .gt('expires_at', new Date().toISOString())
        .select('id')
      if (holdError) throw holdError
      if (!held || held.length === 0) {
        const active = await findActiveCouponOrder(supabase, coupon.id)
        return conflict('already-placed', active
          ? `You’ve already placed order ${active.ref} with this coupon, so it can’t be used for another order.`
          : 'This coupon has already been used.', active ? { order: placedResponse(active, coupon) } : {})
      }
    }

    // 5. Record the order and its items.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        user_id: user.id,
        subtotal: cart.subtotal,
        discount_amount: discountAmount,
        total,
        address: formattedAddress,
        status: 'pending',
        game_coupon_id: coupon?.id ?? null,
      }])
      .select('id, order_number')
      .single()
    try {
      if (orderError || !order) throw orderError ?? new Error('Could not create order')
      const { error: itemsError } = await supabase.from('order_items').insert(cart.lines.map(line => ({
        order_id: order.id,
        product_id: line.productId,
        quantity: line.quantity,
        price: line.price,
        gift_extras: extrasFor(line.productId),
        gift_photos: photosFor(line.productId),
      })))
      if (itemsError) throw itemsError
    } catch (error) {
      if (order) {
        const { error: cancelError } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
        if (cancelError) console.error('Could not cancel incomplete WhatsApp order', cancelError)
      }
      if (coupon) {
        const { error: releaseError } = await supabase
          .from('discount_coupons').update({ status: 'available' }).eq('id', coupon.id).eq('status', 'reserved')
        if (releaseError) console.error('Could not release coupon after WhatsApp order failure', releaseError)
      }
      throw error
    }

    const placed: PlacedOrder = {
      orderId: order.id,
      ref: orderRef(order),
      existing: false,
      subtotal: cart.subtotal,
      discountAmount,
      total,
      coupon: coupon ? { code: coupon.code, discountPercent } : null,
    }
    await Promise.all([rememberDetails(), emptyCart()])
    return Response.json(placed, { headers: noStore })
  } catch (error) {
    return handleApiError(error, 'WhatsApp order failed', 'We couldn’t place your order just now. Please try again in a moment.')
  }
}
