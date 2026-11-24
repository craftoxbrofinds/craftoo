'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { downloadPhoto, photoFileName } from '@/lib/photo-download'

type PhotoItem = { id: string; quantity: number; gift_photos: string[] | null; products: { name: string } | null }

/**
 * The customer's uploaded photos for each customized item, shown large so they can be checked
 * and printed. Each photo can be downloaded; "Download all" saves every photo in the order.
 * Download buttons are hidden when printing.
 */
export function OrderPhotos({ orderNumber, items, tone = 'admin' }: { orderNumber: string; items: PhotoItem[]; tone?: 'admin' | 'shop' }) {
  const [busy, setBusy] = useState<string | null>(null)
  const withPhotos = items.filter(item => (item.gift_photos ?? []).length > 0)
  if (withPhotos.length === 0) return null

  const all = withPhotos.flatMap(item =>
    (item.gift_photos ?? []).map((url, i) => ({ url, name: photoFileName(orderNumber, item.products?.name || 'item', i, url) })),
  )

  const download = async (url: string, name: string) => {
    setBusy(url)
    await downloadPhoto(url, name)
    setBusy(null)
  }

  const downloadAll = async () => {
    setBusy('all')
    for (const photo of all) {
      await downloadPhoto(photo.url, photo.name)
      // A short pause, so the browser doesn't treat several downloads at once as unwanted.
      await new Promise(resolve => setTimeout(resolve, 400))
    }
    setBusy(null)
  }

  const buttonCls = tone === 'admin'
    ? 'border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
    : 'border border-warm-black text-warm-black hover:bg-warm-black hover:text-white'

  return (
    <div className="space-y-5">
      {all.length > 1 && (
        <button
          type="button"
          onClick={() => void downloadAll()}
          disabled={busy !== null}
          className={`print:hidden inline-flex items-center gap-2 px-4 py-2.5 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.18em] transition-colors disabled:opacity-50 ${buttonCls}`}
        >
          {busy === 'all' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
          Download all {all.length} photos
        </button>
      )}

      {withPhotos.map(item => {
        const photos = item.gift_photos ?? []
        const name = item.products?.name || 'Item'
        return (
          <div key={item.id} className="break-inside-avoid">
            <p className="font-brandon text-sm font-black uppercase tracking-wide">
              {name} × {item.quantity}
              <span className="ml-2 font-syndicatgrotesk text-xs font-normal normal-case tracking-normal opacity-70">
                {photos.length} photo{photos.length === 1 ? '' : 's'}
              </span>
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-2">
              {photos.map((url, i) => {
                const fileName = photoFileName(orderNumber, name, i, url)
                return (
                  <figure key={url} className="break-inside-avoid border border-[#cbbde4] bg-white">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block bg-[#FAF7F2]">
                      <img
                        src={url}
                        alt={`${name}, photo ${i + 1}`}
                        className="mx-auto h-48 w-full object-contain print:h-[9cm]"
                      />
                    </a>
                    <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5 font-syndicatgrotesk text-[10px]">
                      <span className="font-mono">{orderNumber} · photo {i + 1} of {photos.length}</span>
                      <button
                        type="button"
                        onClick={() => void download(url, fileName)}
                        disabled={busy !== null}
                        className="print:hidden inline-flex items-center gap-1 font-semibold uppercase tracking-[0.12em] text-[#5b4d8a] hover:underline disabled:opacity-50"
                        aria-label={`Download photo ${i + 1} for ${name}`}
                      >
                        {busy === url ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <Download size={11} aria-hidden="true" />}
                        Download
                      </button>
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
