'use client'

import { useEffect, useState } from 'react'
import { Download, Eye, Loader2, Share2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Variant = 'admin' | 'shop'

/** Fetches the bill PDF with the signed-in user's token (the API needs it). */
async function fetchBill(endpoint: string): Promise<File> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in again to get the bill.')
  const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${session.access_token}` } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'The bill couldn’t be created.')
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] || 'Craftoo-bill.pdf'
  return new File([await res.blob()], name, { type: 'application/pdf' })
}

function saveFile(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Bill PDF actions: view, download, and (where the device supports sharing files, e.g. phones)
 * share straight to WhatsApp or any other app.
 */
export function BillButtons({ endpoint, variant = 'admin', shareText }: { endpoint: string; variant?: Variant; shareText?: string }) {
  const [busy, setBusy] = useState<'view' | 'download' | 'share' | null>(null)
  const [error, setError] = useState('')
  const [canShareFiles, setCanShareFiles] = useState(false)

  useEffect(() => {
    try {
      const probe = new File(['x'], 'bill.pdf', { type: 'application/pdf' })
      setCanShareFiles(typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }))
    } catch {
      setCanShareFiles(false)
    }
  }, [])

  const run = async (action: 'view' | 'download' | 'share') => {
    setBusy(action)
    setError('')
    // Opened now, during the tap, so the browser doesn't block it as a popup.
    const viewer = action === 'view' ? window.open('', '_blank') : null
    try {
      const file = await fetchBill(endpoint)
      if (action === 'download') saveFile(file)
      if (action === 'view') {
        const url = URL.createObjectURL(file)
        if (viewer && !viewer.closed) viewer.location.href = url
        else window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
      if (action === 'share') {
        try {
          await navigator.share({ files: [file], title: file.name, text: shareText })
        } catch (err) {
          if ((err as DOMException)?.name !== 'AbortError') saveFile(file) // sharing failed: save it instead
        }
      }
    } catch (err) {
      viewer?.close()
      setError(err instanceof Error ? err.message : 'The bill couldn’t be created.')
    } finally {
      setBusy(null)
    }
  }

  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.18em] transition-colors disabled:opacity-50'
  const primary = variant === 'admin' ? 'bg-[#1A1A1A] text-white hover:bg-[#D4A017]' : 'bg-warm-black text-ivory hover:bg-deep-gold'
  const secondary = variant === 'admin'
    ? 'border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
    : 'border border-warm-black text-warm-black hover:bg-warm-black hover:text-white'
  const icon = (action: 'view' | 'download' | 'share', Icon: typeof Download) =>
    busy === action ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Icon size={14} aria-hidden="true" />

  return (
    <div className="print:hidden space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void run('download')} disabled={busy !== null} className={`${base} ${primary}`}>
          {icon('download', Download)} Download bill (PDF)
        </button>
        {canShareFiles && (
          <button type="button" onClick={() => void run('share')} disabled={busy !== null} className={`${base} bg-[#1f8f4e] text-white hover:bg-[#177a41]`}>
            {icon('share', Share2)} Share bill
          </button>
        )}
        <button type="button" onClick={() => void run('view')} disabled={busy !== null} className={`${base} ${secondary}`}>
          {icon('view', Eye)} View
        </button>
      </div>
      {error && <p role="alert" className="font-syndicatgrotesk text-[11px] text-red-700">{error}</p>}
    </div>
  )
}
