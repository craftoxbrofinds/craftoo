import { supabase } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

type OrderClient = SupabaseClient

export const OrderRepo = {
    getAll: (client: OrderClient = supabase) =>
        client
            .from('orders')
            .select('*, order_items(*, products(*))'),

    updateStatus: (id: string, status: string, client: OrderClient = supabase) =>
        client.from('orders').update({ status }).eq('id', id),
}