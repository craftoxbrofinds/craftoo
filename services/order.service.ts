import { OrderRepo } from '@/repositories/order.repo'
import type { SupabaseClient } from '@supabase/supabase-js'

export const OrderService = {
    async getOrders(client?: SupabaseClient) {
        const { data, error } = await OrderRepo.getAll(client)
        if (error) throw error
        return data
    },

    async updateOrderStatus(id: string, status: string, client?: SupabaseClient) {
        const { error } = await OrderRepo.updateStatus(id, status, client)
        if (error) throw error
    },
}