import { OrderService } from '@/services/order.service'
import { isAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: RouteContext) {
    if (!(await isAdmin(req))) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { status } = await req.json()

    await OrderService.updateOrderStatus(id, status, createAdminClient())

    return Response.json({ success: true })
}