'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { CustomerOrders } from '@/components/customer-orders'

export default function OrdersPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/signin?returnTo=/orders')
      else setReady(true)
    })
  }, [router])

  return (
    <div className="min-h-screen bg-warm-beige">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="font-syndicatgrotesk text-[9px] tracking-[0.35em] uppercase text-deep-gold">Account</span>
            <div className="flex-1 h-px bg-deep-gold/60" />
          </div>
          <h1 className="font-brandon text-3xl sm:text-4xl font-black uppercase tracking-tight text-warm-black">My Orders</h1>
          <p className="font-syndicatgrotesk text-xs text-muted-taupe mt-1">
            Your details and delivery address are on <Link href="/profile" className="text-deep-gold hover:underline">your profile</Link>.
          </p>
        </div>

        {ready && <CustomerOrders />}
      </div>

      <Footer />
    </div>
  )
}
