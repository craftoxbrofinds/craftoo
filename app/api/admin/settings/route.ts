import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { SETTING_DEFAULTS, type SettingsMap } from '@/lib/site-settings'

/** Saves one store setting from /admin/settings. Only the keys in SETTING_DEFAULTS can be written. */
export async function PUT(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { key?: unknown; value?: unknown }
  const key = body.key
  if (typeof key !== 'string' || !(key in SETTING_DEFAULTS)) {
    return NextResponse.json({ error: 'Unknown setting' }, { status: 400 })
  }
  if (!body.value || typeof body.value !== 'object' || Array.isArray(body.value)) {
    return NextResponse.json({ error: 'Setting value must be an object' }, { status: 400 })
  }

  // Keep only the fields this setting has, so stray data can't be stored.
  const defaults = SETTING_DEFAULTS[key as keyof SettingsMap] as Record<string, unknown>
  const input = body.value as Record<string, unknown>
  const value = Object.fromEntries(
    Object.keys(defaults).filter(field => field in input).map(field => [field, input[field]]),
  )
  if (key === 'orders') value.whatsapp_checkout = input.whatsapp_checkout !== false

  const { error } = await createAdminClient()
    .from('site_settings')
    .upsert({ key, value }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
