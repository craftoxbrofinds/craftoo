import { SupabaseClient } from '@supabase/supabase-js'
import { CartRepo } from '@/repositories/cart.repo'

export const CartService = {
    async getCart(userId: string, client: SupabaseClient) {
        const { data: cart, error } = await CartRepo.getCartByUserId(userId, client)
        if (error) throw new Error(`Could not load cart: ${error.message}`)

        if (!cart) {
            const { data: newCart, error: createError } = await CartRepo.createCart(userId, client)
            if (createError || !newCart) throw new Error('Could not create cart')
            return { id: newCart.id, user_id: userId, cart_items: [] }
        }

        return cart
    },

    async addToCart(userId: string, productId: string, quantity: number = 1, client: SupabaseClient) {
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
            throw new Error('Quantity must be a whole number between 1 and 99')
        }
        const cart = await this.getCart(userId, client)
        if (!cart) throw new Error('Cart not found')
        const cartId = cart.id

        const { data: product, error: productError } = await CartRepo.getProductStock(productId, client)
        if (productError) throw new Error(`Could not load product: ${productError.message}`)
        // The cart API uses the service role, so hidden products must be refused here, not by RLS.
        if (!product || product.is_active === false) throw new Error('This item is no longer available')
        const stock: number | null = product.stock ?? null

        const { data: existingItem } = await CartRepo.getCartItem(cartId, productId, client)
        const currentQty = existingItem?.quantity ?? 0
        const newQty = currentQty + quantity
        if (newQty > 99 || (stock !== null && newQty > stock)) {
            throw new Error(stock === 0 ? 'This item is out of stock' : 'Requested quantity is not available')
        }

        if (existingItem) {
            const { data: updatedItem, error: updateErr } = await CartRepo.updateCartItemQuantity(existingItem.id, cartId, newQty, client)
            if (updateErr || !updatedItem) throw new Error(`Failed to update cart item: ${updateErr?.message ?? 'Cart item was not found'}`)
        } else {
            const { error: insertErr } = await CartRepo.addCartItem(cartId, productId, quantity, client)
            if (insertErr) throw new Error(`Failed to add cart item: ${insertErr.message}`)
        }

        return await this.getCart(userId, client)
    },

    async updateItemQuantity(userId: string, cartItemId: string, quantity: number, client: SupabaseClient) {
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
            throw new Error('Quantity must be a whole number between 0 and 99')
        }
        const cart = await this.getCart(userId, client)

        if (quantity <= 0) {
            const { data: removedItem, error } = await CartRepo.removeCartItem(cartItemId, cart.id, client)
            if (error || !removedItem) throw new Error(`Failed to remove cart item: ${error?.message ?? 'Cart item was not found'}`)
            return await this.getCart(userId, client)
        }

        const { data: itemRow, error: itemError } = await CartRepo.getCartItemById(cartItemId, cart.id, client)
        if (itemError || !itemRow) throw new Error('Cart item was not found')
        if (itemRow?.product_id) {
            const { data: product } = await CartRepo.getProductStock(itemRow.product_id, client)
            if (!product || product.is_active === false) throw new Error('This item is no longer available')
            const stock: number | null = product.stock ?? null
            if (stock !== null && quantity > stock) {
                throw new Error(stock === 0 ? 'This item is out of stock' : 'Requested quantity is not available')
            }
        }

        const { data: updatedItem, error } = await CartRepo.updateCartItemQuantity(cartItemId, cart.id, quantity, client)
        if (error || !updatedItem) throw new Error(`Failed to update cart item: ${error?.message ?? 'Cart item was not found'}`)
        return await this.getCart(userId, client)
    },

    async removeItem(userId: string, cartItemId: string, client: SupabaseClient) {
        const cart = await this.getCart(userId, client)
        const { data: removedItem, error } = await CartRepo.removeCartItem(cartItemId, cart.id, client)
        if (error || !removedItem) throw new Error(`Failed to remove cart item: ${error?.message ?? 'Cart item was not found'}`)
        return await this.getCart(userId, client)
    },

    async clearUserCart(userId: string, client: SupabaseClient) {
        const cart = await this.getCart(userId, client)
        if (cart) {
            await CartRepo.clearCart(cart.id, client)
        }
    }
}
