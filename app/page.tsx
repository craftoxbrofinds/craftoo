export const revalidate = 300

// import { AnnouncementBar } from '@/components/announcement-bar'
import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { CategoryGrid } from '@/components/category-grid'
import { TrustSignals } from '@/components/trust-signals'
import { Footer } from '@/components/footer'
import { categoryService } from '@/services/category.service'
import { FlowerQuestPromo } from '@/components/flower-quest/promo'
import { OrderPlacedBanner } from '@/components/order-placed-banner'

export default async function Home() {
  const categories = await categoryService.getAll()

  return (
    <main className="w-full overflow-hidden bg-site-black">
      {/* Temporarily hidden: top announcement marquee. */}
      {/* <AnnouncementBar /> */}
      <Navbar />
      <OrderPlacedBanner />
      <Hero />
      <FlowerQuestPromo />
      <CategoryGrid categories={categories.map(c => ({ ...c, slug: c.slug ?? '' }))} />
      <TrustSignals />
      <Footer />
    </main>
  )
}
