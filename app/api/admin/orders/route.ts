import { OrderService } from '@/services/order.service'
import { isAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'

export async function GET(req: Request) {
    if (!(await isAdmin(req))) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }


    const data = await OrderService.getOrders(createAdminClient())
    return Response.json({ data })
}