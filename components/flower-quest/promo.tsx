import Link from 'next/link'

export function FlowerQuestPromo() {
  return (
    <section className="relative isolate mx-auto my-6 flex max-w-7xl flex-col items-start justify-between gap-5 overflow-hidden rounded-[1.6rem] bg-[#e8dff1] px-6 py-7 sm:mx-8 sm:flex-row sm:items-center sm:px-10 lg:mx-auto lg:my-10">
      <img
        src="/games/quest-hero.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 -top-8 -z-10 h-40 w-36 rotate-[-8deg] opacity-70 sm:right-6 sm:top-[-2.5rem] sm:h-52 sm:w-48"
      />
      <div className="max-w-xl">
        <h2 className="font-brandon text-2xl font-semibold text-[#403a46] sm:text-3xl">A little adventure before you go</h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-[#625b6e] sm:text-base">
          Carry a magical bloom through the garden and deliver it to the Queen.
        </p>
      </div>
      <Link
        href="/play"
        prefetch={false}
        className="inline-flex min-h-12 shrink-0 items-center rounded-full bg-[#7665a4] px-6 font-syndicatgrotesk text-sm font-semibold text-white transition-colors hover:bg-[#65548e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#51486c]"
      >
        Play the Flower Quest
      </Link>
    </section>
  )
}
