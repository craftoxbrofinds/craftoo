'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useGiftExtras } from '@/store/gift-extras'
import { GIFT_PHOTO_TYPES, MAX_GIFT_PHOTOS, MAX_GIFT_PHOTO_BYTES, MAX_UPLOAD_MB } from '@/lib/gift-extras'

const EMPTY: string[] = []

/**
 * Lets the shopper upload the photos for the "Your photo" gift extra (several at once, up to
 * MAX_GIFT_PHOTOS per product). The photos are saved with the order, so there's nothing to
 * send on WhatsApp.
 */
export function GiftPhotoUploader({ productId, compact = false }: { productId: string; compact?: boolean }) {
  const photos = useGiftExtras(state => state.photos[productId] ?? EMPTY)
  const addPhoto = useGiftExtras(state => state.addPhoto)
  const removePhoto = useGiftExtras(state => state.removePhoto)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState('')

  const remaining = MAX_GIFT_PHOTOS - photos.length - uploading

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError('')
    const chosen = Array.from(files)
    const problems: string[] = []
    const accepted = chosen.filter(file => {
      if (!(GIFT_PHOTO_TYPES as readonly string[]).includes(file.type)) { problems.push(`${file.name} isn’t a JPG, PNG or WebP photo.`); return false }
      if (file.size > MAX_GIFT_PHOTO_BYTES) { problems.push(`${file.name} is over ${MAX_UPLOAD_MB} MB. Please choose a smaller photo.`); return false }
      return true
    })
    if (accepted.length > remaining) problems.push(`You can add ${MAX_GIFT_PHOTOS} photos in all, so only the first ${Math.max(remaining, 0)} were added.`)
    const batch = accepted.slice(0, Math.max(remaining, 0))

    if (batch.length > 0) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Sign in to upload photos.')
        return
      }
      setUploading(count => count + batch.length)
      await Promise.all(batch.map(async file => {
        try {
          const formData = new FormData()
          formData.append('file', file, file.name)
          const res = await fetch('/api/uploads/gift-photos', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: formData,
          })
          const body = await res.json().catch(() => ({}))
          if (!res.ok || typeof body.url !== 'string') throw new Error(body.error || 'Upload failed.')
          addPhoto(productId, body.url)
        } catch (err) {
          problems.push(`${file.name}: ${err instanceof Error ? err.message : 'upload failed.'}`)
        } finally {
          setUploading(count => count - 1)
        }
      }))
    }
    if (problems.length > 0) setError(problems.join(' '))
    if (inputRef.current) inputRef.current.value = ''
  }

  const thumb = compact ? 'h-10 w-10' : 'h-14 w-14'

  return (
    <div className={compact ? 'mt-1.5' : 'mt-2'}>
      <div className="flex flex-wrap items-center gap-1.5">
        {photos.map((url, i) => (
          <div key={url} className={`group relative ${thumb} shrink-0 overflow-hidden border border-[#cbbde4] bg-soft-cream`}>
            <img src={url} alt={`Your photo ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(productId, url)}
              className="absolute right-0 top-0 grid h-4 w-4 place-items-center bg-warm-black/80 text-white hover:bg-red-600"
              aria-label={`Remove photo ${i + 1}`}
            >
              <X size={10} strokeWidth={3} />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`up-${i}`} className={`grid ${thumb} shrink-0 place-items-center border border-dashed border-[#cbbde4] bg-white`}>
            <Loader2 size={14} className="animate-spin text-[#7565a5]" aria-label="Uploading" />
          </div>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`inline-flex ${compact ? 'h-10 px-2.5' : 'h-14 px-3'} items-center gap-1.5 border border-dashed border-[#7565a5] bg-[#f4eefb] font-syndicatgrotesk text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5b4d8a] hover:bg-[#ebe2f7]`}
          >
            <ImagePlus size={compact ? 13 : 15} aria-hidden="true" />
            {photos.length === 0 ? 'Upload photos' : 'Add more'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={GIFT_PHOTO_TYPES.join(',')}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => void upload(e.target.files)}
      />
      <p className="mt-1 font-syndicatgrotesk text-[10px] leading-4 text-text-muted">
        {photos.length === 0 && uploading === 0
          ? `Upload up to ${MAX_GIFT_PHOTOS} photos (JPG, PNG or WebP, up to ${MAX_UPLOAD_MB} MB each).`
          : `${photos.length} of ${MAX_GIFT_PHOTOS} photos added.`}
      </p>
      {error && <p role="alert" className="mt-1 font-syndicatgrotesk text-[10px] leading-4 text-red-700">{error}</p>}
    </div>
  )
}
