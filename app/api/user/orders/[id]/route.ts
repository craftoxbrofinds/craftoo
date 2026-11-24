import { ApiError, getOptionalUser, getServiceClient, handleApiError } from '@/lib/flower-quest/server'
import { parseDbTime } from '@/lib/flower-quest/coupon-orders'
import { parseOrderAddress } from '@/lib/order-address'
import { loadOrderCharges } from '@/lib/order-charges-server'

type RouteContext = { params: Promise<{ id: string }> }

/** One of the signed-in customer's own orders, with items, customization, photos and totals. */
export async function GET(req: Request, { params }: RouteContext) {
  try {
    const user = await getOptionalUser(req)
    if (!user) throw new ApiError('Sign in to see your order.', 401)
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError('Order not found.', 404)

    const supabase = getServiceClient()
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, status, created_at, subtotal, discount_amount, total, address, game_coupon_id, order_items(id, quantity, price, gift_extras, gift_photos, products(id, name, image))')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    if (!order) throw new ApiError('Order not found.', 404)

    let coupon: { code: string; discount_percent: number } | null = null
    if (order.game_coupon_id) {
      const { data } = await supabase.from('discount_coupons').select('code, discount_percent').eq('id', order.game_coupon_id).maybeSingle()
      coupon = data ?? null
    }

    // The coupon's internal id stays on the server; the customer gets its code.
    const rest: Record<string, unknown> = { ...order }
    delete rest.game_coupon_id
    return Response.json({
      data: {
        ...rest,
        created_at: new Date(parseDbTime(order.created_at)).toISOString(),
        contact: parseOrderAddress(order.address),
        coupon,
        charges: (await loadOrderCharges(supabase, [order.id])).get(order.id) ?? [],
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error, 'Customer order lookup failed', 'Your order couldn’t be loaded. Please try again.')
  }
}
