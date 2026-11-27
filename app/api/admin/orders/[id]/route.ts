import { OrderService } from '@/services/order.service'
import { isAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { parseDbTime, syncCouponWithOrder } from '@/lib/flower-quest/coupon-orders'
import { parseOrderAddress } from '@/lib/order-address'
import { loadOrderCharges } from '@/lib/order-charges-server'
import { logger } from '@/lib/logger'

const log = logger.child({ route: 'admin/orders/[id]' })

type RouteContext = { params: Promise<{ id: string }> }

/** One order with its items (and their gift extras), coupon and parsed delivery details. */
export async function GET(req: Request, { params }: RouteContext) {
    if (!(await isAdmin(req))) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Order not found.' }, { status: 404 })

    const client = createAdminClient()
    const { data: order, error } = await client
        .from('orders')
        .select('id, order_number, user_id, status, created_at, subtotal, discount_amount, total, address, game_coupon_id, razorpay_order_id, payment_id, order_items(id, quantity, price, gift_extras, gift_photos, products(id, name, image))')
        .eq('id', id)
        .maybeSingle()
    if (error) {
        log.error('Admin order lookup failed', { orderId: id, error })
        return Response.json({ error: 'The order could not be loaded.' }, { status: 500 })
    }
    if (!order) return Response.json({ error: 'Order not found.' }, { status: 404 })

    let coupon: { code: string; status: string; discount_percent: number } | null = null
    if (order.game_coupon_id) {
        const { data } = await client.from('discount_coupons').select('code, status, discount_percent').eq('id', order.game_coupon_id).maybeSingle()
        coupon = data ?? null
    }

    const charges = (await loadOrderCharges(client, [order.id])).get(order.id) ?? []

    return Response.json({
        data: {
            ...order,
            created_at: new Date(parseDbTime(order.created_at)).toISOString(),
            contact: parseOrderAddress(order.address),
            coupon,
            charges,
        },
    }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req: Request, { params }: RouteContext) {
    if (!(await isAdmin(req))) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { status } = await req.json()

    const client = createAdminClient()
    await OrderService.updateOrderStatus(id, status, client)
    log.info('Order status changed', { orderId: id, status })

    // Confirming an order redeems its Flower Quest coupon; cancelling it makes the coupon usable again.
    try {
        await syncCouponWithOrder(client, id, String(status))
    } catch (error) {
        log.error('Order status saved, but its coupon could not be updated', { orderId: id, status, error })
        return Response.json({ success: true, warning: 'Order updated, but its coupon could not be updated. Check it on the Coupons page.' })
    }

    return Response.json({ success: true })
}
