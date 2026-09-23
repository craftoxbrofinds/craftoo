import { supabase } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

type ProductClient = SupabaseClient

export const ProductRepo = {
    getAll: (client: ProductClient = supabase) => client.from('products').select('*, categories(id, name, slug)').eq('is_active', true).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),

    getAllAdmin: (client: ProductClient = supabase) => client.from('products').select('*, categories(id, name, slug)').order('created_at', { ascending: false }),

    getById: (id: string, client: ProductClient = supabase) =>
        client.from('products').select('*, categories(id, name, slug)').eq('id', id).single(),

    create: (data: any, client: ProductClient = supabase) =>
        client.from('products').insert([data]),

    update: (id: string, data: any, client: ProductClient = supabase) =>
        client.from('products').update(data).eq('id', id),

    delete: (id: string, client: ProductClient = supabase) =>
        client.from('products').update({ is_active: false }).eq('id', id),
}