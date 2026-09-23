import { ProductRepo } from '@/repositories/product.repo'
import type { SupabaseClient } from '@supabase/supabase-js'

export const ProductService = {
    async getProducts() {
        const { data, error } = await ProductRepo.getAll()
        if (error) throw error
        return data
    },

    async getProductById(id: string, client?: SupabaseClient) {
        const { data, error } = await ProductRepo.getById(id, client)
        return { data, error }
    },

    async createProduct(body: any, client?: SupabaseClient) {
        if (!body.name || !body.price) {
            throw new Error('Missing fields')
        }

        const { error } = await ProductRepo.create(body, client)
        if (error) throw error
    },

    async updateProduct(id: string, body: any, client?: SupabaseClient) {
        const { error } = await ProductRepo.update(id, body, client)
        if (error) throw error
    },

    async deleteProduct(id: string, client?: SupabaseClient) {
        const { error } = await ProductRepo.delete(id, client)
        if (error) throw error
    },
}