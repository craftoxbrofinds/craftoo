import type { Metadata, Viewport } from 'next'
import FlowerQuestExperience from '@/components/flower-quest/experience'

export const metadata: Metadata = {
  title: 'The Flower Quest | Craftoo',
  description: 'Carry one special bloom through a winding garden and deliver it to the Queen in Craftoo’s original Flower Quest.',
  openGraph: {
    title: 'The Flower Quest | Craftoo',
    description: 'A little garden adventure from Craftoo.',
    images: ['/games/garden-sky.svg'],
  },
}

// Let the game reach under the notch/home indicator; the page pads with env(safe-area-inset-*).
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: '#263d32',
}

export default function PlayPage() {
  return <FlowerQuestExperience />
}
