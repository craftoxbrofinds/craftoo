import { SupabaseClient } from '@supabase/supabase-js'

export const CartRepo = {
    async getCartByUserId(userId: string, client: SupabaseClient) {
        const result = await client
            .from('carts')
            .select(`
                id,
                user_id,
                cart_items (
                    id,
                    quantity,
                    products (
                        id, name, price, image, stock, is_active
                    )
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(1)
        return { data: result.data?.[0] ?? null, error: result.error }
    },

    async createCart(userId: string, client: SupabaseClient) {
        return client.from('carts').insert([{ user_id: userId }]).select('id').single()
    },

    async getCartItem(cartId: string, productId: string, client: SupabaseClient) {
        return client
            .from('cart_items')
            .select('*')
            .eq('cart_id', cartId)
            .eq('product_id', productId)
            .single()
    },

    async addCartItem(cartId: string, productId: string, quantity: number, client: SupabaseClient) {
        return client.from('cart_items').insert([{ cart_id: cartId, product_id: productId, quantity }])
    },

    async updateCartItemQuantity(cartItemId: string, cartId: string, quantity: number, client: SupabaseClient) {
        return client.from('cart_items').update({ quantity }).eq('id', cartItemId).eq('cart_id', cartId).select('id').maybeSingle()
    },

    async getProductStock(productId: string, client: SupabaseClient) {
        return client
            .from('products')
            .select('stock, is_active')
            .eq('id', productId)
            .maybeSingle()
    },

    async getCartItemById(cartItemId: string, cartId: string, client: SupabaseClient) {
        return client
            .from('cart_items')
            .select('id, product_id, quantity')
            .eq('id', cartItemId)
            .eq('cart_id', cartId)
            .single()
    },

    async removeCartItem(cartItemId: string, cartId: string, client: SupabaseClient) {
        return client.from('cart_items').delete().eq('id', cartItemId).eq('cart_id', cartId).select('id').maybeSingle()
    },

    async clearCart(cartId: string, client: SupabaseClient) {
        return client.from('cart_items').delete().eq('cart_id', cartId)
    }
}
