import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CartService } from './cart.service'

type Row = Record<string, any>
type Tables = { carts: Row[]; cart_items: Row[]; products: Row[] }

/**
 * A small in-memory stand-in for the Supabase query builder: enough of from/select/insert/update/
 * delete/eq/order/limit/single/maybeSingle for the cart service. Like the service-role client the
 * cart API uses, it ignores RLS, so any ownership check has to come from the service itself.
 */
function fakeClient(tables: Tables) {
  let nextId = 1
  class Query {
    private op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    private filters: [string, unknown][] = []
    private payload: Row[] | Row | null = null
    private max: number | null = null
    private mode: 'many' | 'single' | 'maybe' = 'many'
    constructor(private table: keyof Tables) {}
    select() { return this }
    insert(rows: Row[]) { this.op = 'insert'; this.payload = rows; return this }
    update(values: Row) { this.op = 'update'; this.payload = values; return this }
    delete() { this.op = 'delete'; return this }
    eq(column: string, value: unknown) { this.filters.push([column, value]); return this }
    order() { return this }
    limit(n: number) { this.max = n; return this }
    single() { this.mode = 'single'; return this }
    maybeSingle() { this.mode = 'maybe'; return this }

    private matches(row: Row) { return this.filters.every(([c, v]) => row[c] === v) }
    private view(row: Row): Row {
      if (this.table !== 'carts') return { ...row }
      return {
        ...row,
        cart_items: tables.cart_items
          .filter(item => item.cart_id === row.id)
          .map(item => ({ id: item.id, quantity: item.quantity, products: tables.products.find(p => p.id === item.product_id) ?? null })),
      }
    }
    private run(): Row[] {
      const rows = tables[this.table]
      if (this.op === 'insert') {
        const added = (this.payload as Row[]).map(r => ({ id: `gen-${nextId++}`, ...r }))
        rows.push(...added)
        return added
      }
      const hit = rows.filter(r => this.matches(r))
      if (this.op === 'update') { hit.forEach(r => Object.assign(r, this.payload)); return hit }
      if (this.op === 'delete') { tables[this.table] = rows.filter(r => !hit.includes(r)) as any; return hit }
      return (this.max === null ? hit : hit.slice(0, this.max)).map(r => this.view(r))
    }
    then(resolve: (value: { data: any; error: any }) => unknown) {
      const rows = this.run()
      if (this.mode === 'many') return resolve({ data: rows, error: null })
      if (rows.length > 1 || (this.mode === 'single' && rows.length === 0)) {
        return resolve({ data: null, error: { message: 'expected one row' } })
      }
      return resolve({ data: rows[0] ?? null, error: null })
    }
  }
  return { from: (table: keyof Tables) => new Query(table) } as unknown as SupabaseClient
}

function seed(): Tables {
  return {
    products: [
      { id: 'p-live', name: 'Rose', price: 100, image: null, stock: 5, is_active: true },
      { id: 'p-hidden', name: 'Retired', price: 50, image: null, stock: 10, is_active: false },
    ],
    carts: [
      { id: 'cart-a', user_id: 'user-a' },
      { id: 'cart-b', user_id: 'user-b' },
    ],
    cart_items: [
      { id: 'item-a', cart_id: 'cart-a', product_id: 'p-live', quantity: 1 },
      { id: 'item-b', cart_id: 'cart-b', product_id: 'p-live', quantity: 2 },
    ],
  }
}

test('a shopper can change and remove their own cart item', async () => {
  const tables = seed()
  const client = fakeClient(tables)
  await CartService.updateItemQuantity('user-a', 'item-a', 3, client)
  assert.equal(tables.cart_items.find(i => i.id === 'item-a')?.quantity, 3)
  await CartService.removeItem('user-a', 'item-a', client)
  assert.equal(tables.cart_items.some(i => i.id === 'item-a'), false)
})

test("a shopper cannot change another shopper's cart item quantity", async () => {
  const tables = seed()
  await assert.rejects(CartService.updateItemQuantity('user-a', 'item-b', 4, fakeClient(tables)), /not found/)
  assert.equal(tables.cart_items.find(i => i.id === 'item-b')?.quantity, 2)
})

test("a shopper cannot remove another shopper's cart item", async () => {
  const tables = seed()
  const client = fakeClient(tables)
  await assert.rejects(CartService.removeItem('user-a', 'item-b', client), /not found/)
  await assert.rejects(CartService.updateItemQuantity('user-a', 'item-b', 0, client), /not found/)
  assert.equal(tables.cart_items.some(i => i.id === 'item-b'), true)
})

test('a hidden product cannot be added to a cart', async () => {
  const tables = seed()
  await assert.rejects(CartService.addToCart('user-a', 'p-hidden', 1, fakeClient(tables)), /no longer available/)
  assert.equal(tables.cart_items.some(i => i.product_id === 'p-hidden'), false)
})

test('an unknown product cannot be added to a cart', async () => {
  const tables = seed()
  await assert.rejects(CartService.addToCart('user-a', 'p-missing', 1, fakeClient(tables)), /no longer available/)
})

test('a hidden product already in a cart cannot have its quantity raised', async () => {
  const tables = seed()
  tables.cart_items.push({ id: 'item-h', cart_id: 'cart-a', product_id: 'p-hidden', quantity: 1 })
  await assert.rejects(CartService.updateItemQuantity('user-a', 'item-h', 2, fakeClient(tables)), /no longer available/)
})

test('quantities above stock are refused', async () => {
  const tables = seed()
  const client = fakeClient(tables)
  await assert.rejects(CartService.addToCart('user-a', 'p-live', 5, client), /not available/)
  await assert.rejects(CartService.updateItemQuantity('user-a', 'item-a', 6, client), /not available/)
  assert.equal(tables.cart_items.find(i => i.id === 'item-a')?.quantity, 1)
})
