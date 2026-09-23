'use client'

import { motion } from 'framer-motion'

export function Hero() {
  return (
    <section className="relative isolate w-full overflow-hidden bg-[#f8f0e8]">
      <div className="hidden sm:block relative min-h-[520px] lg:min-h-[620px] xl:min-h-[680px]">
        <img src="/images/craftoo-bouquet-hero.png" alt="Handmade chenille flower bouquet" className="absolute inset-0 h-full w-full object-cover object-center" fetchPriority="high" />
        <div className="absolute inset-y-0 left-0 w-[58%] bg-gradient-to-r from-[#fffaf5]/75 via-[#fffaf5]/32 to-transparent" />
        <HeroCopy />
      </div>
      <div className="sm:hidden relative min-h-[680px]">
        <img src="/images/craftoo-bouquet-hero.png" alt="Handmade chenille flower bouquet" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" fetchPriority="high" />
        <div className="absolute inset-x-0 top-0 h-[52%] bg-gradient-to-b from-[#fffaf5]/95 via-[#fffaf5]/75 to-transparent" />
        <HeroCopy mobile />
      </div>
    </section>
  )
}

function HeroCopy({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className={`absolute z-10 ${mobile ? 'inset-x-0 top-0 px-6 pt-14 text-center' : 'inset-y-0 left-0 flex max-w-[670px] items-center px-10 lg:px-20 xl:px-28'}`}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: 'easeOut' }} className={mobile ? 'mx-auto max-w-sm' : 'max-w-[480px]'}>
        <p className="mb-5 flex items-center justify-center gap-3 font-syndicatgrotesk text-[10px] font-semibold tracking-[0.28em] text-[#7e6aa8] uppercase sm:justify-start">
          <span className="h-px w-8 bg-[#b5a1d2]" /> Handmade with love
        </p>
        <h1 className="font-brandon text-[2.8rem] font-bold leading-[0.94] tracking-[-0.04em] text-[#403a38] sm:text-5xl lg:text-6xl xl:text-7xl">
          Flowers That Last Beyond The Moment
        </h1>
        <p className="mt-6 max-w-md font-syndicatgrotesk text-sm leading-7 text-[#756e6b] sm:text-[15px] sm:text-left">
          Beautiful handmade flowers and thoughtful gifts, crafted to make every occasion a little more special.
        </p>
        <div className="mt-8 flex justify-center sm:justify-start">
          <motion.a href="#collections" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="inline-flex items-center justify-center rounded-full bg-[#7e6aa8] px-7 py-3.5 font-syndicatgrotesk text-[10px] font-bold tracking-[0.2em] text-white uppercase shadow-[0_8px_20px_rgba(126,106,168,0.22)] transition-colors hover:bg-[#67548e]">
            Shop Collection
          </motion.a>
        </div>
      </motion.div>
    </div>
  )
}
