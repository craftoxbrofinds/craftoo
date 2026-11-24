/**
 * The visitor's cookie choice. Essential storage (sign-in, cart, game play limit) is always used
 * because the site doesn't work without it; "all" also turns on anonymous page-view analytics.
 * The choice is kept in this browser only.
 */
export type CookieChoice = 'all' | 'essential'

export const COOKIE_CONSENT_KEY = 'craftoo-cookie-consent'
const CHANGE_EVENT = 'craftoo:cookie-consent-change'
const OPEN_EVENT = 'craftoo:open-cookie-settings'

export function getCookieChoice(): CookieChoice | null {
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_KEY)
    return value === 'all' || value === 'essential' ? value : null
  } catch {
    return null
  }
}

export function setCookieChoice(choice: CookieChoice): void {
  try { localStorage.setItem(COOKIE_CONSENT_KEY, choice) } catch { /* storage unavailable: asked again next visit */ }
  window.dispatchEvent(new CustomEvent<CookieChoice>(CHANGE_EVENT, { detail: choice }))
}

export function onCookieChoiceChange(listener: (choice: CookieChoice) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<CookieChoice>).detail)
  window.addEventListener(CHANGE_EVENT, handler)
  return () => window.removeEventListener(CHANGE_EVENT, handler)
}

/** Reopens the cookie banner (footer "Cookie settings"). */
export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function onOpenCookieSettings(listener: () => void): () => void {
  window.addEventListener(OPEN_EVENT, listener)
  return () => window.removeEventListener(OPEN_EVENT, listener)
}
