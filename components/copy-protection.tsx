'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/** Form fields stay usable: people still need to select, paste and edit what they type. */
function isEditable(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'))
}

/**
 * Stops shoppers from selecting, copying, right-clicking or dragging content on the storefront.
 * Admin pages are left alone. This is a deterrent only: anyone determined can still use dev tools
 * or take a screenshot.
 */
export function CopyProtection() {
  const pathname = usePathname()
  const enabled = !pathname?.startsWith('/admin')

  useEffect(() => {
    if (!enabled) return
    const root = document.documentElement
    root.classList.add('copy-protected')

    const block = (event: Event) => {
      if (!isEditable(event.target)) event.preventDefault()
    }
    const blockShortcuts = (event: KeyboardEvent) => {
      if (isEditable(event.target)) return
      const key = event.key.toLowerCase()
      // Ctrl/Cmd + C, X, A (select all), S (save page), U (view source), P (print)
      if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'a', 's', 'u', 'p'].includes(key)) {
        event.preventDefault()
      }
    }

    const events = ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart'] as const
    events.forEach(name => document.addEventListener(name, block))
    document.addEventListener('keydown', blockShortcuts)

    return () => {
      root.classList.remove('copy-protected')
      events.forEach(name => document.removeEventListener(name, block))
      document.removeEventListener('keydown', blockShortcuts)
    }
  }, [enabled])

  return null
}
