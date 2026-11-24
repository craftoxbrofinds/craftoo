/**
 * Saves a photo from our file storage to the device with a readable name. The photos are on
 * another domain, where a plain download link only opens them, so the file is fetched first.
 * If that fails, the photo opens in a new tab so it can still be saved from there.
 */
export async function downloadPhoto(url: string, fileName: string): Promise<void> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
  } catch {
    window.open(url, '_blank', 'noopener')
  }
}

/** "K7M2QX-photo-frame-2.jpg": order number, product and photo number, with the file's own extension. */
export function photoFileName(orderNumber: string, productName: string, index: number, url: string): string {
  const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item'
  const extension = /\.([a-z0-9]{3,4})(?:$|\?)/i.exec(url)?.[1]?.toLowerCase() || 'jpg'
  return `${orderNumber}-${slug}-${index + 1}.${extension}`
}
