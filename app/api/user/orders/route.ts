import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadOrderCharges } from '@/lib/order-charges-server'
import { chargesTotal } from '@/lib/order-charges'
import { parseDbTime } from '@/lib/flower-quest/coupon-orders'

const getSupabaseWithAuth = (req: Request) => {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return { supabase: null, token: null }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    return { supabase, token }
}

export async function GET(req: Request) {
    const { supabase, token } = getSupabaseWithAuth(req)
    if (!supabase || !token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id,
                order_number,
                total,
                status,
                address,
                created_at,
                order_items (
                    *,
                    products ( id, name, image )
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)

        // Extra charges staff added (delivery, photo prints...). The ids come from this customer's own orders.
        const charges = await loadOrderCharges(createAdminClient(), (orders ?? []).map(order => order.id))
        const data = (orders ?? []).map(order => ({
            ...order,
            // Stored without a time zone (UTC); send an exact time so phones show the right day.
            created_at: new Date(parseDbTime(order.created_at)).toISOString(),
            charges_total: chargesTotal(charges.get(order.id)),
        }))

        return Response.json({ data })
    } catch (e: any) {
        return Response.json({ error: e.message }, { status: 400 })
    }
}
