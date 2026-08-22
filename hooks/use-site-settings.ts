'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { SETTING_DEFAULTS, type SettingsMap } from '@/lib/site-settings'

const _cache = new Map<string, any>()
const _pending = new Map<string, Promise<any>>()

function loadSetting<K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> {
  if (_cache.has(key)) return Promise.resolve(_cache.get(key))
  if (!_pending.has(key)) {
    const p = supabase
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .single()
      .then(({ data }) => {
        const val = data?.value
          ? { ...SETTING_DEFAULTS[key], ...(data.value as SettingsMap[K]) }
          : SETTING_DEFAULTS[key]
        _cache.set(key, val)
        _pending.delete(key)
        return val
      })
      .catch(() => {
        _pending.delete(key)
        return SETTING_DEFAULTS[key]
      })
    _pending.set(key, p)
  }
  return _pending.get(key) as Promise<SettingsMap[K]>
}

export function useSiteSettings<K extends keyof SettingsMap>(key: K): SettingsMap[K] {
  const [value, setValue] = useState<SettingsMap[K]>(
    _cache.has(key) ? _cache.get(key) : SETTING_DEFAULTS[key]
  )

  useEffect(() => {
    if (_cache.has(key)) {
      setValue(_cache.get(key))
      return
    }
    loadSetting(key).then(setValue)
  }, [key])

  return value
}

export function bustSettingsCache(key?: keyof SettingsMap) {
  if (key) {
    _cache.delete(key)
    _pending.delete(key)
  } else {
    _cache.clear()
    _pending.clear()
  }
}
