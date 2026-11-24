import { OrderService } from '@/services/order.service'
import { isAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { parseDbTime } from '@/lib/flower-quest/coupon-orders'
import { parseOrderAddress } from '@/lib/order-address'
import { loadOrderCharges } from '@/lib/order-charges-server'
import { chargesTotal } from '@/lib/order-charges'

export async function GET(req: Request) {
    if (!(await isAdmin(req))) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = createAdminClient()
    const orders = (await OrderService.getOrders(client)) ?? []

    // Attach the Flower Quest coupon code and status, so staff can see which orders use one.
    const couponIds = [...new Set(orders.map((order: any) => order.game_coupon_id).filter(Boolean))]
    let coupons = new Map<string, { code: string; status: string }>()
    if (couponIds.length > 0) {
        const { data, error } = await client.from('discount_coupons').select('id, code, status').in('id', couponIds)
        if (error) console.error('Could not load order coupons', error)
        coupons = new Map((data ?? []).map(c => [c.id, { code: c.code, status: c.status }]))
    }
    const charges = await loadOrderCharges(client, orders.map((order: any) => order.id))
    const data = orders
        .map((order: any) => ({
            ...order,
            charges_total: chargesTotal(charges.get(order.id)),
            created_at: order.created_at ? new Date(parseDbTime(order.created_at)).toISOString() : order.created_at,
            contact: parseOrderAddress(order.address),
            coupon: order.game_coupon_id ? coupons.get(order.game_coupon_id) ?? null : null,
        }))
        .sort((a: any, b: any) => Date.parse(b.created_at ?? 0) - Date.parse(a.created_at ?? 0))

    return Response.json({ data })
}
