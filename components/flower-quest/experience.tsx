'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Copy,
  Crown,
  Download,
  Heart,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Share2,
  ShoppingBag,
  Smartphone,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { COINS, FLOWERS, Input, LEVEL_END, MAX_RUN_FRAMES, SECTION_MARKERS, type GameState } from '@/lib/flower-quest/simulation'
import type { ControlState, GameEvent } from '@/components/flower-quest/game-stage'
import { formatDateIST } from '@/lib/datetime'

const GameStage = dynamic(() => import('@/components/flower-quest/game-stage'), {
  ssr: false,
  loading: () => null,
})

type Screen = 'intro' | 'playing' | 'paused' | 'game-over' | 'victory'
type GameSession = { runId: string; token: string; expiresAt: number }
type Config = {
  enabled: boolean
  minimumOrderValue: number
  maximumDiscountAmount: number
  couponExpiryDays: number
  rewardTiers: { minimum_score: number; discount_percent: number }[]
}
type LeaderboardEntry = { rank: number; displayName: string; score: number; completedAt: string }
type PendingClaim = { runId: string; token: string }
type RunResult = { score: number; flowers: number; coins: number; seconds: number; lives: number; reason: 'won' | 'hearts' | 'time' }
type Toast = { id: number; text: string; priority: number; shownAt: number; duration: number }

const TOTAL_FLOWERS = FLOWERS.length
const TOTAL_COINS = COINS.length
/** Colours for the control panel under the game in portrait, matching each area's ground. */
const DECK_COLORS = [
  ['#6b4f44', '#3a2b28'],
  ['#4e3c34', '#241b18'],
  ['#6a5e78', '#342d40'],
]
const SECTION_TOASTS = ['Into the whispering forest', 'The castle gardens', 'The Queen is just ahead!']
const STAGES = [
  { number: '01', name: 'The meadow', color: '#78a875' },
  { number: '02', name: 'The forest', color: '#70849a' },
  { number: '03', name: 'The castle', color: '#c88c88' },
]

function achievementFor(score: number): string {
  if (score > 350) return 'Queen’s favourite'
  if (score >= 201) return 'Garden keeper'
  return 'Flower friend'
}

function challengeText(score: number, reward: number | null): string {
  const prize = reward ? ` I earned ${reward}% off at Craftoo!` : ''
  return `I delivered the magical flower to the Queen with ${score} points.${prize} Can you beat my score?`
}

function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

async function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${source}`))
    image.src = source
  })
}

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
  context.closePath()
}

/** Draws an image so it covers the box without stretching, anchored to the bottom edge. */
function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  context.drawImage(
    image,
    (image.naturalWidth - sourceWidth) / 2,
    image.naturalHeight - sourceHeight,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  )
}

async function makeAchievementCard(result: RunResult, reward: number | null): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not create the achievement image')

  const [sky, hero, queen, flower, logo] = await Promise.all([
    loadImage('/games/garden-sky.svg'),
    loadImage('/games/quest-hero.svg'),
    loadImage('/games/garden-queen.svg'),
    loadImage('/games/quest-flower.svg'),
    loadImage('/images/logo/craftoo-logo-round.png'),
  ])
  drawCover(context, sky, 0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(255, 250, 245, 0.86)'
  drawRoundedRect(context, 66, 68, 948, 1214, 42)
  context.fill()

  const logoHeight = 100
  const logoWidth = Math.min(330, logo.naturalWidth * (logoHeight / logo.naturalHeight))
  context.drawImage(logo, 540 - logoWidth / 2, 112, logoWidth, logoHeight)
  context.fillStyle = '#403a46'
  context.textAlign = 'center'
  context.font = '700 58px system-ui, sans-serif'
  context.fillText('The Flower Quest', 540, 323)
  context.font = '400 30px system-ui, sans-serif'
  context.fillStyle = '#6f687b'
  context.fillText('A very important delivery', 540, 374)

  context.fillStyle = 'rgba(120, 168, 117, 0.35)'
  context.beginPath()
  context.ellipse(540, 712, 300, 26, 0, 0, Math.PI * 2)
  context.fill()
  context.drawImage(hero, 280, 430, 250, 277)
  context.drawImage(queen, 575, 410, 240, 285)
  context.drawImage(flower, 512, 520, 64, 78)

  context.fillStyle = '#7665a4'
  context.font = '700 112px system-ui, sans-serif'
  context.fillText(result.score.toLocaleString('en-IN'), 540, 870)
  context.fillStyle = '#403a46'
  context.font = '600 34px system-ui, sans-serif'
  context.fillText(achievementFor(result.score), 540, 924)
  context.fillStyle = '#6f687b'
  context.font = '500 27px system-ui, sans-serif'
  context.fillText(`${result.flowers}/${TOTAL_FLOWERS} flowers  ·  ${result.coins}/${TOTAL_COINS} coins  ·  ${formatClock(result.seconds)}`, 540, 976)

  if (reward) {
    context.fillStyle = '#fff2c8'
    drawRoundedRect(context, 305, 1024, 470, 104, 52)
    context.fill()
    context.fillStyle = '#59496e'
    context.font = '700 38px system-ui, sans-serif'
    context.fillText(`${reward}% off at Craftoo`, 540, 1090)
  } else {
    context.fillStyle = '#59496e'
    context.font = '600 27px system-ui, sans-serif'
    context.fillText('A garden full of flowers is waiting for you', 540, 1080)
  }

  context.fillStyle = '#514b5d'
  context.font = '400 27px system-ui, sans-serif'
  context.fillText('Can you beat my score?', 540, 1190)
  context.font = '600 24px system-ui, sans-serif'
  context.fillText(window.location.host, 540, 1236)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Your browser could not export the achievement image'))
    }, 'image/png')
  })
}

/**
 * Copies text to the clipboard. The async Clipboard API only exists on secure (https) pages,
 * so fall back to a hidden textarea and execCommand when it is missing or refused.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      // Some browsers leave the promise pending instead of rejecting; don't wait forever.
      const copied = await Promise.race([
        navigator.clipboard.writeText(text).then(() => true),
        new Promise<boolean>(resolve => window.setTimeout(() => resolve(false), 1200)),
      ])
      if (copied) return true
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    field.style.top = '0'
    document.body.appendChild(field)
    field.select()
    field.setSelectionRange(0, text.length)
    const copied = document.execCommand('copy')
    field.remove()
    return copied
  } catch {
    return false
  }
}

type Coupon = { code: string; discountPercent: number; expiresAt: string; status?: string; orderRef?: string | null }

/** Badge for a coupon that can't be used right now. */
const COUPON_STATUS_LABEL: Record<string, string> = {
  reserved: 'On an order',
  redeemed: 'Already used',
  expired: 'Expired',
}

function CouponCard({
  coupon,
  minimumOrderValue,
  maximumDiscountAmount,
  tone,
}: {
  coupon: Coupon
  minimumOrderValue: number
  maximumDiscountAmount: number | null
  tone: 'light' | 'dark'
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const codeRef = useRef<HTMLSpanElement>(null)
  const dark = tone === 'dark'

  const copy = async () => {
    const copied = await copyText(coupon.code)
    setCopyState(copied ? 'copied' : 'failed')
    if (!copied && codeRef.current) {
      // Select the code so the player can copy it by hand.
      const range = document.createRange()
      range.selectNodeContents(codeRef.current)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
    window.setTimeout(() => setCopyState('idle'), 2400)
  }

  return (
    <div className={`w-full min-w-0 max-w-md rounded-2xl border px-4 py-4 text-left sm:px-5 ${dark ? 'border-[#e4c27d]/60 bg-[#304a3b] text-[#f4efdf]' : 'border-[#d9c99b] bg-[#fff2ce] text-[#514637]'}`}>
      <p className={`flex items-center gap-2 text-sm font-semibold ${dark ? 'text-[#f1d796]' : 'text-[#7a5f2e]'}`}>
        {coupon.discountPercent}% off your products
        {coupon.status && coupon.status !== 'available' && (
          <span className="rounded-full bg-[#c0394a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            {COUPON_STATUS_LABEL[coupon.status] ?? 'Not available'}
          </span>
        )}
      </p>
      <div className={`mt-2 flex min-w-0 items-center gap-2 rounded-xl border border-dashed p-1.5 pl-3 ${dark ? 'border-[#e4c27d]/70 bg-[#263d32]' : 'border-[#c9b27a] bg-white/70'}`}>
        <span
          ref={codeRef}
          className="min-w-0 flex-1 select-all break-all font-mono text-base font-bold leading-snug tracking-wide sm:text-lg"
          aria-label={`Coupon code ${coupon.code}`}
        >
          {coupon.code}
        </span>
        <button
          type="button"
          onClick={copy}
          className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition active:scale-95 ${dark ? 'bg-[#e4c27d] text-[#263d32] hover:bg-[#f1d796]' : 'bg-[#7665a4] text-white hover:bg-[#65548e]'}`}
          aria-label="Copy coupon code"
        >
          {copyState === 'copied' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copyState === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p role="status" aria-live="polite" className={`mt-1.5 min-h-4 text-xs ${dark ? 'text-[#f1d796]' : 'text-[#8a6d35]'}`}>
        {copyState === 'failed' ? 'Copy isn’t available here. The code is selected, so long-press it to copy.' : ''}
      </p>
      <ul className={`mt-1 space-y-1 text-xs leading-5 ${dark ? 'text-[#d9e4c9]' : 'text-[#746b5a]'}`}>
        {coupon.status === 'reserved' && (
          <li className={dark ? 'text-[#f1d796]' : 'text-[#7a5f2e]'}>
            This code is on your order{coupon.orderRef ? ` ${coupon.orderRef}` : ''}. If that order is cancelled, you can use it again.
          </li>
        )}
        {coupon.status === 'redeemed' && (
          <li className={dark ? 'text-[#f1d796]' : 'text-[#7a5f2e]'}>
            You used this code{coupon.orderRef ? ` on order ${coupon.orderRef}` : ''}.
          </li>
        )}
        <li>The discount applies to product prices only. Delivery charges are not discounted.</li>
        <li>
          Minimum order ₹{minimumOrderValue.toLocaleString('en-IN')}
          {maximumDiscountAmount ? ` · Up to ₹${maximumDiscountAmount.toLocaleString('en-IN')} off` : ''}
          {' · '}Expires {formatDateIST(coupon.expiresAt)}
        </li>
      </ul>
    </div>
  )
}

type ControlsRef = { current: ControlState }

/**
 * Releases every held control when no finger is left on the screen, the window loses focus,
 * or the page is hidden. iOS Safari can drop the "touch ended" event for a finger (long-press
 * gestures, multi-touch, system swipes), which used to leave a direction stuck on.
 */
function useReleaseWhenNoTouches(release: () => void) {
  useEffect(() => {
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length === 0) release()
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') release()
    }
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    window.addEventListener('blur', release)
    window.addEventListener('pagehide', release)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('blur', release)
      window.removeEventListener('pagehide', release)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [release])
}

function DirectionPad({ controls }: { controls: ControlsRef }) {
  const padRef = useRef<HTMLDivElement>(null)
  const mousePointer = useRef<number | null>(null)
  const [active, setActive] = useState(0)

  const apply = useCallback((bits: number) => {
    controls.current.held = (controls.current.held & ~(Input.left | Input.right)) | bits
    setActive(current => (current === bits ? current : bits))
  }, [controls])
  const release = useCallback(() => {
    mousePointer.current = null
    apply(0)
  }, [apply])

  const directionAt = useCallback((clientX: number) => {
    const rect = padRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return clientX < rect.left + rect.width / 2 ? Input.left : Input.right
  }, [])

  // Touch: work out the held directions from the fingers that are on the pad right now, on every
  // touch event. Nothing is remembered between events, so a lost "touch ended" cannot leave a
  // direction stuck. (Child elements ignore pointer events, so every touch targets the pad itself.)
  useEffect(() => {
    const pad = padRef.current
    if (!pad) return
    const update = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault()
      let bits = 0
      for (let i = 0; i < event.targetTouches.length; i += 1) bits |= directionAt(event.targetTouches[i].clientX)
      apply(bits)
    }
    const options = { passive: false } as const
    pad.addEventListener('touchstart', update, options)
    pad.addEventListener('touchmove', update, options)
    pad.addEventListener('touchend', update, options)
    pad.addEventListener('touchcancel', update, options)
    return () => {
      pad.removeEventListener('touchstart', update)
      pad.removeEventListener('touchmove', update)
      pad.removeEventListener('touchend', update)
      pad.removeEventListener('touchcancel', update)
    }
  }, [apply, directionAt])

  useReleaseWhenNoTouches(release)
  useEffect(() => () => {
    controls.current.held &= ~(Input.left | Input.right)
  }, [controls])

  return (
    <div
      ref={padRef}
      role="group"
      aria-label="Move left or right. Slide your thumb to change direction."
      // A mouse or pen (for example an iPad with a trackpad). Touch is handled above.
      onPointerDown={event => {
        if (event.pointerType === 'touch') return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        mousePointer.current = event.pointerId
        apply(directionAt(event.clientX))
      }}
      onPointerMove={event => {
        if (event.pointerType === 'touch' || mousePointer.current !== event.pointerId) return
        apply(directionAt(event.clientX))
      }}
      onPointerUp={event => { if (event.pointerType !== 'touch') release() }}
      onPointerCancel={event => { if (event.pointerType !== 'touch') release() }}
      onLostPointerCapture={event => { if (event.pointerType !== 'touch') release() }}
      onContextMenu={event => event.preventDefault()}
      className="fq-control relative flex h-[76px] w-[164px] touch-none select-none items-stretch overflow-hidden rounded-full border border-white/70 bg-white/75 shadow-[0_10px_30px_rgba(38,40,52,.22)] backdrop-blur-md sm:h-[84px] sm:w-[184px]"
    >
      {[
        { bit: Input.left, label: 'Move left', Icon: ArrowLeft },
        { bit: Input.right, label: 'Move right', Icon: ArrowRight },
      ].map(({ bit, label, Icon }) => (
        <span
          key={label}
          aria-hidden="true"
          className={`pointer-events-none flex flex-1 items-center justify-center text-[#51486c] transition-[background-color,transform] duration-75 ${active & bit ? 'scale-[.97] bg-[#e9def5]' : ''}`}
        >
          <Icon size={30} strokeWidth={2.6} />
        </span>
      ))}
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-4 left-1/2 w-px bg-[#51486c]/15" />
    </div>
  )
}

function JumpButton({ controls }: { controls: ControlsRef }) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [pressed, setPressed] = useState(false)

  const press = useCallback(() => {
    controls.current.held |= Input.jump
    controls.current.jumpQueued = true
    setPressed(true)
  }, [controls])
  const release = useCallback(() => {
    controls.current.held &= ~Input.jump
    setPressed(false)
  }, [controls])

  // Touch, decided from the fingers currently on the button (see DirectionPad).
  useEffect(() => {
    const button = buttonRef.current
    if (!button) return
    const onStart = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault()
      press()
    }
    const onEnd = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault()
      if (event.targetTouches.length === 0) release()
    }
    const options = { passive: false } as const
    button.addEventListener('touchstart', onStart, options)
    button.addEventListener('touchend', onEnd, options)
    button.addEventListener('touchcancel', onEnd, options)
    return () => {
      button.removeEventListener('touchstart', onStart)
      button.removeEventListener('touchend', onEnd)
      button.removeEventListener('touchcancel', onEnd)
    }
  }, [press, release])

  useReleaseWhenNoTouches(release)
  useEffect(() => () => {
    controls.current.held &= ~Input.jump
  }, [controls])

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="Jump"
      onPointerDown={event => {
        if (event.pointerType === 'touch') return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        press()
      }}
      onPointerUp={event => { if (event.pointerType !== 'touch') release() }}
      onPointerCancel={event => { if (event.pointerType !== 'touch') release() }}
      onLostPointerCapture={event => { if (event.pointerType !== 'touch') release() }}
      onContextMenu={event => event.preventDefault()}
      className={`fq-control flex h-[84px] w-[84px] touch-none select-none flex-col items-center justify-center rounded-full border border-white/80 bg-[#f3d9ea]/90 text-[#5e496a] shadow-[0_10px_30px_rgba(38,40,52,.24)] backdrop-blur-md transition-transform duration-75 sm:h-[94px] sm:w-[94px] ${pressed ? 'scale-[.93] bg-white' : ''}`}
    >
      <ArrowUp size={32} strokeWidth={2.8} aria-hidden="true" className="pointer-events-none" />
      <span className="pointer-events-none -mt-0.5 font-syndicatgrotesk text-[10px] font-semibold tracking-[.14em]">JUMP</span>
    </button>
  )
}

export default function FlowerQuestExperience() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('intro')
  const [session, setSession] = useState<GameSession | null>(null)
  const [score, setScore] = useState(0)
  const [flowers, setFlowers] = useState(0)
  const [lives, setLives] = useState(3)
  const [progress, setProgress] = useState(0)
  const [area, setArea] = useState(0)
  const [timeLeft, setTimeLeft] = useState(MAX_RUN_FRAMES / 60)
  const [result, setResult] = useState<RunResult | null>(null)
  const [runVerified, setRunVerified] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState('')
  const [startError, setStartError] = useState('')
  const [starting, setStarting] = useState(false)
  const [config, setConfig] = useState<Config | null>(null)
  const [configMessage, setConfigMessage] = useState('')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardMessage, setLeaderboardMessage] = useState('')
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [claimLoading, setClaimLoading] = useState(false)
  const [claimedCoupon, setClaimedCoupon] = useState<Coupon | null>(null)
  // The coupon this signed-in player already earned in an earlier game (one per account).
  const [earnedCoupon, setEarnedCoupon] = useState<(Coupon & { minimumOrderValue: number; maximumDiscountAmount: number }) | null>(null)
  const [claimMessage, setClaimMessage] = useState('')
  const [shareMessage, setShareMessage] = useState('')
  const [achievementBlob, setAchievementBlob] = useState<Blob | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [runKey, setRunKey] = useState(0)
  const [stageKey, setStageKey] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [gameLoadError, setGameLoadError] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [canFullscreen, setCanFullscreen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [heartsPulse, setHeartsPulse] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const musicTimerRef = useRef<number | null>(null)
  const musicNoteRef = useRef(0)
  const screenRef = useRef<Screen>(screen)
  const soundEnabledRef = useRef(soundEnabled)
  const startingRef = useRef(false)
  const toastRef = useRef<Toast | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const playRootRef = useRef<HTMLElement>(null)
  const controlsRef = useRef<ControlState>({ held: 0, jumpQueued: false })

  screenRef.current = screen
  soundEnabledRef.current = soundEnabled

  useEffect(() => {
    const coarsePointer = window.matchMedia('(pointer: coarse)')
    const updateTouchSupport = () => {
      setIsTouchDevice(navigator.maxTouchPoints > 0 && coarsePointer.matches)
    }
    updateTouchSupport()
    setCanFullscreen(Boolean(document.fullscreenEnabled))
    const handleFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement))
    coarsePointer.addEventListener('change', updateTouchSupport)
    document.addEventListener('fullscreenchange', handleFullscreen)
    return () => {
      coarsePointer.removeEventListener('change', updateTouchSupport)
      document.removeEventListener('fullscreenchange', handleFullscreen)
    }
  }, [])

  const showToast = useCallback((text: string, priority = 1, duration = 2200) => {
    const current = toastRef.current
    const now = performance.now()
    if (current && current.priority > priority && now - current.shownAt < 700) return
    const next = { id: now, text, priority, shownAt: now, duration }
    toastRef.current = next
    setToast(next)
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => {
      toastRef.current = null
      setToast(null)
    }, duration)
  }, [])

  // ---- Audio ---------------------------------------------------------------------------------

  /** Must run synchronously inside a tap, or iOS Safari keeps the AudioContext suspended. */
  const unlockAudio = useCallback(() => {
    if (!soundEnabledRef.current) return
    try {
      const AudioContextClass = window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      let context = audioContextRef.current
      if (!context || context.state === 'closed') {
        context = new AudioContextClass()
        const master = context.createGain()
        master.gain.value = 0.9
        master.connect(context.destination)
        audioContextRef.current = context
        masterGainRef.current = master
      }
      if (context.state !== 'running') void context.resume().catch(() => undefined)
    } catch (error) {
      console.error('Flower Quest audio could not start', error)
    }
  }, [])

  const playNote = useCallback((
    frequency: number,
    duration: number,
    options: { type?: OscillatorType; volume?: number; delay?: number; slideTo?: number } = {},
  ) => {
    const context = audioContextRef.current
    const master = masterGainRef.current
    if (!context || !master || !soundEnabledRef.current || context.state !== 'running') return
    const { type = 'sine', volume = 0.05, delay = 0, slideTo } = options
    const start = context.currentTime + delay
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(master)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.05)
  }, [])

  const stopMusic = useCallback(() => {
    if (musicTimerRef.current !== null) window.clearInterval(musicTimerRef.current)
    musicTimerRef.current = null
  }, [])

  const startMusic = useCallback(() => {
    stopMusic()
    if (!soundEnabledRef.current) return
    const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 523.25, 659.25, 783.99, 1046.5, 987.77, 783.99, 659.25, 587.33]
    const bass = [130.81, 174.61, 130.81, 196]
    musicTimerRef.current = window.setInterval(() => {
      if (screenRef.current !== 'playing') return
      const step = musicNoteRef.current
      musicNoteRef.current += 1
      playNote(melody[step % melody.length], 0.3, { type: 'triangle', volume: 0.018 })
      if (step % 4 === 0) playNote(bass[(step / 4) % bass.length], 0.9, { type: 'sine', volume: 0.03 })
    }, 300)
  }, [playNote, stopMusic])

  useEffect(() => () => {
    stopMusic()
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    void audioContextRef.current?.close().catch(() => undefined)
  }, [stopMusic])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') void audioContextRef.current?.suspend().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // ---- Page setup ----------------------------------------------------------------------------

  const sendClaim = useCallback(async (pending: PendingClaim, accessToken: string) => {
    setClaimLoading(true)
    setClaimMessage('')
    try {
      const response = await fetch('/api/game/rewards/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(pending),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Reward could not be claimed')
      setClaimedCoupon(body)
      try { sessionStorage.removeItem('flowerQuestClaim') } catch { /* storage unavailable */ }
      setClaimMessage(body.status && body.status !== 'available'
        ? 'Your account’s Flower Quest coupon has already been used, so this round can’t earn another one.'
        : 'Your reward is ready. Save the code and enter it at checkout.')
      return true
    } catch (error) {
      setClaimMessage(error instanceof Error ? error.message : 'Reward could not be claimed')
      return false
    } finally {
      setClaimLoading(false)
    }
  }, [])

  // Signed-in players see the coupon they already earned on the start screen.
  useEffect(() => {
    let active = true
    const load = async (token: string | undefined) => {
      if (!token) { if (active) setEarnedCoupon(null); return }
      try {
        const res = await fetch('/api/game/my-coupon', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const body = await res.json().catch(() => ({}))
        if (active) setEarnedCoupon(res.ok && body.coupon ? body.coupon : null)
      } catch {
        if (active) setEarnedCoupon(null)
      }
    }
    supabase.auth.getSession().then(({ data }) => load(data.session?.access_token))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, authSession) => { void load(authSession?.access_token) })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [claimedCoupon])

  useEffect(() => {
    fetch('/api/game/config', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Game rewards could not be loaded')
        setConfig(body as Config)
      })
      .catch(error => {
        console.error('Flower Quest rewards could not be loaded', error)
        setConfigMessage('Rewards and weekly scores are unavailable right now. You can still play in practice mode.')
      })

    const params = new URLSearchParams(window.location.search)
    const claimId = params.get('claim')
    if (!claimId) return
    // Drop the query so a reload does not try to resume the claim again.
    window.history.replaceState(null, '', window.location.pathname)

    let rawClaim: string | null
    try {
      rawClaim = sessionStorage.getItem('flowerQuestClaim')
    } catch (error) {
      console.error('Pending Flower Quest claim is unavailable', error)
      setClaimMessage('This browser could not restore the pending claim. Contact Craftoo support if you already signed in.')
      return
    }
    if (!rawClaim) return
    try {
      const pending = JSON.parse(rawClaim) as PendingClaim
      if (pending.runId !== claimId) return
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) void sendClaim(pending, data.session.access_token)
        else setClaimMessage('Sign in to finish claiming your reward.')
      }).catch(error => {
        console.error('Could not resume Flower Quest reward claim', error)
        setClaimMessage('Sign in again to continue claiming your reward.')
      })
    } catch (error) {
      console.error('Saved Flower Quest claim is invalid', error)
      try { sessionStorage.removeItem('flowerQuestClaim') } catch { /* storage unavailable */ }
      setClaimMessage('The saved reward claim could not be restored. Play a new round to earn another score.')
    }
  }, [sendClaim])

  const showGame = screen !== 'intro'

  // Lock page scrolling and keep the screen awake while the game is on screen.
  useEffect(() => {
    if (!showGame) return
    const { body, documentElement } = document
    const previousOverflow = body.style.overflow
    const previousOverscroll = documentElement.style.overscrollBehavior
    body.style.overflow = 'hidden'
    documentElement.style.overscrollBehavior = 'none'
    return () => {
      body.style.overflow = previousOverflow
      documentElement.style.overscrollBehavior = previousOverscroll
    }
  }, [showGame])

  useEffect(() => {
    if (screen !== 'playing' || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    navigator.wakeLock.request('screen')
      .then(sentinel => {
        if (cancelled) void sentinel.release().catch(() => undefined)
        else lock = sentinel
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      void lock?.release().catch(() => undefined)
    }
  }, [screen])

  useEffect(() => {
    if (screen === 'playing') return
    controlsRef.current.held = 0
    controlsRef.current.jumpQueued = false
  }, [screen])

  useEffect(() => {
    if (screen === 'victory' && result) {
      makeAchievementCard(result, claimedCoupon?.discountPercent ?? null)
        .then(setAchievementBlob)
        .catch(error => {
          console.error('Achievement card generation failed', error)
          setShareMessage(error instanceof Error ? error.message : 'Achievement image could not be created')
        })
    } else {
      setAchievementBlob(null)
    }
  }, [screen, result, claimedCoupon?.discountPercent])

  // ---- Runs ----------------------------------------------------------------------------------

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true)
    setLeaderboardMessage('')
    try {
      const response = await fetch('/api/game/leaderboard', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Leaderboard could not be loaded')
      setLeaderboard(body.entries ?? [])
    } catch (error) {
      console.error('Flower Quest leaderboard could not be loaded', error)
      setLeaderboardMessage('Weekly scores are unavailable right now. Try again later.')
    } finally {
      setLeaderboardLoading(false)
    }
  }, [])

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }
      await playRootRef.current?.requestFullscreen({ navigationUI: 'hide' })
      const orientation = window.screen.orientation as ScreenOrientation & { lock?: (value: string) => Promise<void> }
      await orientation?.lock?.('landscape').catch(() => undefined)
    } catch (error) {
      console.error('Flower Quest full screen is unavailable', error)
    }
  }, [])

  const leaveGame = useCallback(() => {
    exitFullscreen()
    stopMusic()
    setScreen('intro')
  }, [exitFullscreen, stopMusic])

  const beginRun = useCallback(async () => {
    if (!isTouchDevice) {
      setStartError('The Flower Quest is made for phones and tablets. Open this page on a touch-screen device to play.')
      return
    }
    // A second tap while the first request is in flight would spend another daily play.
    if (startingRef.current) return
    startingRef.current = true
    setStarting(true)
    unlockAudio()

    setStartError('')
    setVerificationMessage('')
    setClaimMessage('')
    setShareMessage('')
    setClaimedCoupon(null)
    setRunVerified(false)
    setResult(null)
    setScore(0)
    setFlowers(0)
    setLives(3)
    setProgress(0)
    setArea(0)
    setTimeLeft(MAX_RUN_FRAMES / 60)
    setGameLoadError('')
    controlsRef.current.held = 0
    controlsRef.current.jumpQueued = false
    let nextSession: GameSession | null = null
    let notice = ''

    try {
      const requestRun = async (accessToken?: string) => {
        const headers = new Headers({ 'Content-Type': 'application/json' })
        if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
        return fetch('/api/game/runs', { method: 'POST', headers, body: '{}' })
      }
      const { data: { session: authSession } } = await supabase.auth.getSession()
      let response = await requestRun(authSession?.access_token)
      // A stale sign-in should not block play: fall back to a guest run.
      if (response.status === 401 && authSession?.access_token) response = await requestRun()
      const body = await response.json().catch(() => ({}))
      if (response.ok) {
        nextSession = body as GameSession
      } else if (response.status === 429) {
        setStartError(body.error || 'You have reached today’s play limit.')
        return
      } else if (response.status < 500) {
        setStartError(body.error || 'A game session could not be started.')
        return
      } else {
        notice = 'Practice run: scores can’t be verified right now'
      }
    } catch (error) {
      console.error('Flower Quest session could not be started', error)
      notice = 'Practice run: scores can’t be verified right now'
    } finally {
      startingRef.current = false
      setStarting(false)
    }

    setSession(nextSession)
    if (screenRef.current === 'intro') setLoadingProgress(0)
    setScreen('playing')
    setRunKey(value => value + 1)
    startMusic()
    if (notice) showToast(notice, 3, 4200)
  }, [isTouchDevice, showToast, startMusic, unlockAudio])

  const handleSnapshot = useCallback((state: GameState) => {
    setScore(state.score)
    setFlowers(state.flowers.filter(Boolean).length)
    setLives(state.lives)
    setProgress(Math.min(1, state.x / LEVEL_END))
    setTimeLeft(Math.ceil((MAX_RUN_FRAMES - state.tick) / 60))
    setArea(state.x < SECTION_MARKERS[0] ? 0 : state.x < SECTION_MARKERS[1] ? 1 : 2)
  }, [])

  const handleVictory = useCallback(async (state: GameState, replay: number[]) => {
    const runResult: RunResult = {
      score: state.score,
      flowers: state.flowers.filter(Boolean).length,
      coins: state.coins.filter(Boolean).length,
      seconds: state.tick / 60,
      lives: state.lives,
      reason: 'won',
    }
    setResult(runResult)
    setScreen('victory')
    setScore(state.score)
    setProgress(1)
    stopMusic()

    if (!session) {
      setVerificationMessage('Practice score only. This run could not be verified, so it cannot earn a reward or leaderboard place.')
      return
    }

    setVerificationMessage('Checking your delivery…')
    try {
      const response = await fetch(`/api/game/runs/${session.runId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.token, replay }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Your score could not be verified')
      setScore(body.score)
      setResult(current => current ? { ...current, score: body.score } : current)
      setRunVerified(true)
      setVerificationMessage('Your score has been verified.')
      setConfig(current => current
        ? { ...current, enabled: Boolean(body.campaignEnabled) }
        : {
            enabled: Boolean(body.campaignEnabled),
            minimumOrderValue: 599,
            maximumDiscountAmount: 500,
            couponExpiryDays: 7,
            rewardTiers: [],
          })
    } catch (error) {
      console.error('Flower Quest score verification failed', error)
      setVerificationMessage(error instanceof Error
        ? `${error.message}. Your local score is still shareable, but no reward was issued.`
        : 'Your score could not be verified. No reward was issued.')
    }
  }, [session, stopMusic])

  const handleGameOver = useCallback((state: GameState) => {
    setResult({
      score: state.score,
      flowers: state.flowers.filter(Boolean).length,
      coins: state.coins.filter(Boolean).length,
      seconds: state.tick / 60,
      lives: state.lives,
      reason: state.lives <= 0 ? 'hearts' : 'time',
    })
    setScore(state.score)
    setLives(state.lives)
    setProgress(Math.min(1, state.x / LEVEL_END))
    setScreen('game-over')
    stopMusic()
  }, [stopMusic])

  const handlePause = useCallback(() => {
    if (screenRef.current === 'playing') setScreen('paused')
  }, [])

  const resumeGame = useCallback(() => {
    unlockAudio()
    setScreen('playing')
  }, [unlockAudio])

  const handleEvent = useCallback((event: GameEvent) => {
    switch (event.type) {
      case 'jump':
        playNote(392, 0.16, { type: 'triangle', volume: 0.05, slideTo: 659 })
        break
      case 'land':
        playNote(150, 0.08, { type: 'sine', volume: 0.04, slideTo: 90 })
        break
      case 'coin':
        playNote(987.77, 0.07, { type: 'square', volume: 0.018 })
        playNote(1318.5, 0.16, { type: 'square', volume: 0.018, delay: 0.06 })
        break
      case 'flower':
        playNote(783.99, 0.12, { type: 'sine', volume: 0.05 })
        playNote(987.77, 0.12, { type: 'sine', volume: 0.05, delay: 0.07 })
        playNote(1174.66, 0.22, { type: 'sine', volume: 0.05, delay: 0.14 })
        break
      case 'damage':
        playNote(330, 0.32, { type: 'triangle', volume: 0.07, slideTo: 110 })
        if ('vibrate' in navigator) navigator.vibrate?.(40)
        setHeartsPulse(value => value + 1)
        if (event.livesLeft === 1) showToast('One heart left. Careful!', 2)
        break
      case 'checkpoint':
        playNote(659.25, 0.14, { type: 'sine', volume: 0.05 })
        playNote(880, 0.26, { type: 'sine', volume: 0.05, delay: 0.1 })
        showToast('Checkpoint saved', 1)
        break
      case 'section':
        playNote(523.25, 0.14, { type: 'triangle', volume: 0.04 })
        playNote(659.25, 0.14, { type: 'triangle', volume: 0.04, delay: 0.1 })
        playNote(783.99, 0.3, { type: 'triangle', volume: 0.04, delay: 0.2 })
        showToast(SECTION_TOASTS[event.index] ?? 'Onward!', 2)
        break
      case 'victory':
        ;[523.25, 659.25, 783.99, 1046.5].forEach((note, index) =>
          playNote(note, index === 3 ? 0.7 : 0.16, { type: 'triangle', volume: 0.06, delay: index * 0.12 }))
        playNote(659.25, 0.8, { type: 'sine', volume: 0.035, delay: 0.36 })
        playNote(783.99, 0.8, { type: 'sine', volume: 0.035, delay: 0.36 })
        break
    }
  }, [playNote, showToast])

  const handleClaim = useCallback(async () => {
    if (!runVerified || !session) {
      setClaimMessage('Only a server-verified completed run can claim a reward.')
      return
    }
    if (config && !config.enabled) {
      setClaimMessage('Rewards are not active yet. Your verified score is saved.')
      return
    }

    const pending = { runId: session.runId, token: session.token }
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (authSession) {
        await sendClaim(pending, authSession.access_token)
        return
      }

      sessionStorage.setItem('flowerQuestClaim', JSON.stringify(pending))
      exitFullscreen()
      const returnTo = `/play?claim=${encodeURIComponent(session.runId)}`
      router.push(`/signin?returnTo=${encodeURIComponent(returnTo)}`)
    } catch (error) {
      console.error('Flower Quest claim could not be resumed', error)
      setClaimMessage('This browser could not save the pending claim. Sign in, then try claiming again before the run expires.')
    }
  }, [config, exitFullscreen, router, runVerified, sendClaim, session])

  const toggleSound = useCallback(() => {
    const next = !soundEnabledRef.current
    soundEnabledRef.current = next
    setSoundEnabled(next)
    if (!next) {
      stopMusic()
      return
    }
    unlockAudio()
    startMusic()
  }, [startMusic, stopMusic, unlockAudio])

  const shareAchievement = useCallback(async () => {
    const text = challengeText(score, claimedCoupon?.discountPercent ?? null)
    const shareUrl = `${window.location.origin}/play`
    setShareMessage('')
    try {
      if (achievementBlob && typeof File !== 'undefined') {
        const file = new File([achievementBlob], 'flower-quest-achievement.png', { type: 'image/png' })
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'The Flower Quest', text })
          return
        }
      }
      if (navigator.share) {
        await navigator.share({ title: 'The Flower Quest', text, url: shareUrl })
        return
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`, '_blank', 'noopener,noreferrer')
      setShareMessage('WhatsApp opened with your challenge. Add the downloaded image in the chat if you want to share it.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error('Flower Quest share failed', error)
      setShareMessage('Sharing is unavailable here. Download the image or copy the challenge link instead.')
    }
  }, [achievementBlob, claimedCoupon?.discountPercent, score])

  const downloadAchievement = useCallback(() => {
    if (!achievementBlob) return
    const url = URL.createObjectURL(achievementBlob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'flower-quest-achievement.png'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [achievementBlob])

  const copyChallenge = useCallback(async () => {
    const copied = await copyText(`${challengeText(score, claimedCoupon?.discountPercent ?? null)} ${window.location.origin}/play`)
    setShareMessage(copied
      ? 'Challenge copied. Send it to a friend.'
      : 'Copy is unavailable in this browser. Use WhatsApp sharing or download the achievement image.')
  }, [claimedCoupon?.discountPercent, score])

  const gamePaused = screen === 'paused' || screen === 'victory' || screen === 'game-over'
  const lowTime = timeLeft <= 20

  const iconButton = 'pointer-events-auto grid h-9 w-9 shrink-0 place-items-center sm:h-10 sm:w-10 rounded-full border border-white/70 bg-white/80 text-[#51486c] shadow-sm backdrop-blur-md transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7665a4]'
  const primaryButton = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#7665a4] px-5 font-semibold text-white transition hover:bg-[#65548e] active:scale-[.98] disabled:opacity-60'
  const secondaryButton = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#d8cee1] px-5 font-medium text-[#5f576e] transition hover:bg-[#f4eef8] active:scale-[.98]'

  return (
    <main className="min-h-screen bg-[#f3efe3] text-[#263a31]">
      <header className="border-b border-[#d8d8ca] px-4 sm:px-8">
        <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between">
          <Link href="/" className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d88286]" aria-label="Craftoo home">
            <img src="/images/logo/craftoo-logo-round-256.png" alt="Craftoo" width={48} height={48} className="h-12 w-12 object-contain" />
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-[#cbd0c2] px-4 py-2 font-syndicatgrotesk text-sm text-[#405247] transition hover:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d88286]">
            <ShoppingBag size={16} aria-hidden="true" />
            <span>Back to shopping</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-6 sm:px-8 sm:pb-20 sm:pt-10" aria-hidden={showGame}>
        <section className="relative grid overflow-hidden rounded-[1.75rem] bg-[#263d32] text-[#f4efdf] lg:min-h-[530px] lg:grid-cols-[1fr_.96fr]">
          <div className="relative z-10 flex flex-col items-start justify-center px-6 py-10 sm:px-12 sm:py-14 lg:px-14">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 font-syndicatgrotesk text-xs text-[#d9e4c9]">
              <span className="h-2 w-2 rounded-full bg-[#e8bd67]" />
              A Craftoo original
            </p>
            <h1 className="mt-6 max-w-xl font-brandon text-[3.4rem] font-bold leading-[.92] tracking-[-.035em] sm:text-7xl">
              One flower.<br />A royal delivery.
            </h1>
            <p className="mt-5 max-w-md font-syndicatgrotesk text-base leading-7 text-[#d3dfd1] sm:text-lg">
              Leap over garden walls, gather keepsakes, and bring a bloom to the Queen.
            </p>
            <button
              type="button"
              onClick={beginRun}
              disabled={!isTouchDevice || starting}
              className="mt-7 inline-flex min-h-14 items-center gap-3 rounded-full bg-[#df8c8d] px-7 font-syndicatgrotesk text-base font-semibold text-[#2c332c] shadow-[0_10px_28px_rgba(12,23,17,.24)] transition hover:bg-[#ed9fa0] active:scale-[.98] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#f1cf82] disabled:cursor-not-allowed disabled:bg-[#d0d1c4] disabled:text-[#586357] disabled:shadow-none"
            >
              {isTouchDevice ? <Play size={17} fill="currentColor" aria-hidden="true" /> : <Smartphone size={17} aria-hidden="true" />}
              {!isTouchDevice ? 'Mobile play only' : starting ? 'Opening the garden…' : 'Begin the quest'}
              {isTouchDevice && !starting && <ArrowRight size={17} aria-hidden="true" />}
            </button>
            {!isTouchDevice && (
              <p className="mt-3 max-w-sm font-syndicatgrotesk text-sm leading-6 text-[#d3dfd1]">
                Open this page on a phone or tablet to play with touch controls.
              </p>
            )}
            {startError && <p role="status" className="mt-4 max-w-md text-sm leading-6 text-[#f0d7b0]">{startError}</p>}
            {claimLoading && <p role="status" className="mt-4 text-sm text-[#d9e4c9]">Securing your garden reward…</p>}
            {claimMessage && !showGame && <p role="status" className="mt-4 text-sm text-[#d9e4c9]">{claimMessage}</p>}
            {claimedCoupon && (
              <div className="mt-4 w-full">
                <CouponCard
                  coupon={claimedCoupon}
                  minimumOrderValue={config?.minimumOrderValue ?? 599}
                  maximumDiscountAmount={config?.maximumDiscountAmount ?? null}
                  tone="dark"
                />
              </div>
            )}
            {earnedCoupon && !claimedCoupon && (
              <div className="mt-5 w-full">
                <p className="mb-2 font-syndicatgrotesk text-xs font-semibold uppercase tracking-[0.18em] text-[#f1d796]">Your Flower Quest coupon</p>
                <CouponCard
                  coupon={earnedCoupon}
                  minimumOrderValue={earnedCoupon.minimumOrderValue}
                  maximumDiscountAmount={earnedCoupon.maximumDiscountAmount}
                  tone="dark"
                />
                {earnedCoupon.status === 'available' && (
                  <p className="mt-2 max-w-md font-syndicatgrotesk text-xs leading-5 text-[#d3dfd1]">
                    Play again for a higher score and, while it’s unused, this coupon is upgraded to the bigger discount.
                  </p>
                )}
              </div>
            )}
            {config?.enabled && config.rewardTiers.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#f4efdf]">
                {config.rewardTiers.map(tier => (
                  <span key={tier.minimum_score} className="rounded-full border border-white/20 px-3 py-1.5">
                    {tier.minimum_score === 0 ? 'Finish' : `${tier.minimum_score}+ points`} · {tier.discount_percent}% off
                  </span>
                ))}
              </div>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/15 pt-5 font-syndicatgrotesk text-xs text-[#d3dfd1]">
              <span>Slide your thumb on the pad to run</span>
              <span>Tap jump to clear obstacles</span>
              <span>Two minutes, three hearts</span>
            </div>
          </div>

          <div className="relative flex min-h-[310px] items-end justify-center overflow-hidden bg-[#cbdcc3] sm:min-h-[390px] lg:min-h-[530px]">
            <img src="/games/garden-sky.svg" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-[24%] rounded-t-[50%] bg-[#7eaa76]/80" />
            <img src="/games/quest-hero.svg" alt="The adventurer ready to carry a flower" className="fq-float relative z-10 mb-[-2px] ml-5 h-[245px] w-[210px] object-contain sm:h-[330px] sm:w-[280px] lg:ml-0" />
            <img src="/games/garden-queen.svg" alt="The Queen waiting at the end of the garden" className="relative z-10 mb-[-2px] -ml-9 h-[190px] w-[155px] object-contain sm:-ml-14 sm:h-[260px] sm:w-[215px]" />
            <div className="fq-float-slow absolute right-[14%] top-[17%] grid h-16 w-16 place-items-center rounded-full border border-white/65 bg-[#f3ead4]/80 shadow-lg backdrop-blur-sm sm:h-20 sm:w-20">
              <img src="/games/quest-flower.svg" alt="" className="h-12 w-10 object-contain sm:h-14 sm:w-12" />
            </div>
            <p className="absolute left-5 top-5 rounded-full bg-[#263d32]/85 px-3 py-2 font-syndicatgrotesk text-xs text-[#f4efdf] sm:left-8 sm:top-8">
              The meadow is waiting
            </p>
          </div>
        </section>

        <section className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_.8fr] lg:items-start">
          <div>
            <p className="font-syndicatgrotesk text-xs font-semibold tracking-[.14em] text-[#71836b]">THE ROUTE</p>
            <h2 className="mt-2 font-brandon text-3xl font-semibold text-[#263a31] sm:text-4xl">Three gardens. One important delivery.</h2>
            <p className="mt-3 max-w-xl leading-7 text-[#657267]">
              Watch your step, time your jumps, and keep moving. The garden moths and thorn patches are in your way, and lantern flags save your place along the path.
            </p>
            <ol className="mt-7 grid grid-cols-3 border-y border-[#d4d8c9]">
              {STAGES.map(stage => (
                <li key={stage.number} className="border-r border-[#d4d8c9] py-4 pr-2 last:border-r-0 last:pl-3 sm:py-5 sm:pr-4 sm:last:pl-5 [&:nth-child(2)]:pl-3 sm:[&:nth-child(2)]:pl-5">
                  <span className="flex items-center gap-2 text-xs text-[#748074]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />{stage.number}</span>
                  <p className="mt-2 font-brandon text-lg font-semibold text-[#33483a] sm:text-xl">{stage.name}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="border-t border-[#d4d8c9] pt-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-syndicatgrotesk text-xs font-semibold tracking-[.14em] text-[#71836b]">THE SCOREBOARD</p>
                <h2 className="mt-2 font-brandon text-2xl font-semibold text-[#263a31]">This week in the garden</h2>
                <p className="mt-1 text-sm text-[#657267]">Best verified scores from signed-in players</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !showLeaderboard
                  setShowLeaderboard(next)
                  if (next) void loadLeaderboard()
                }}
                className="shrink-0 rounded-full border border-[#71836b] px-4 py-2 text-sm font-semibold text-[#405247] transition hover:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d88286]"
              >
                {showLeaderboard ? 'Hide' : 'View scores'}
              </button>
            </div>
            {configMessage && <p role="status" className="mt-4 text-sm leading-6 text-[#657267]">{configMessage}</p>}
            {config && !config.enabled && (
              <p className="mt-4 border-l-2 border-[#df8c8d] bg-[#e8e8d9] px-4 py-3 text-sm leading-6 text-[#485a4c]">
                Rewards are paused for now. You can still play in practice mode and share your score.
              </p>
            )}
            {showLeaderboard && (
              <div className="mt-4">
                {leaderboardLoading ? <p className="py-4 text-sm text-[#657267]">Gathering this week’s scores…</p> : null}
                {leaderboardMessage ? <p role="status" className="py-4 text-sm text-[#657267]">{leaderboardMessage}</p> : null}
                {!leaderboardLoading && !leaderboardMessage && leaderboard.length === 0 ? (
                  <p className="py-4 text-sm text-[#657267]">No verified scores yet this week. Be the first.</p>
                ) : null}
                {leaderboard.length > 0 && (
                  <ol className="divide-y divide-[#d4d8c9]">
                    {leaderboard.map(entry => (
                      <li key={`${entry.rank}-${entry.displayName}`} className="flex items-center justify-between py-3 text-sm">
                        <span className="flex items-center gap-3"><span className="w-7 font-brandon text-lg text-[#9a7563]">{entry.rank}</span><span className="text-[#405247]">{entry.displayName}</span></span>
                        <span className="font-semibold tabular-nums text-[#263a31]">{entry.score.toLocaleString('en-IN')}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="mt-3 text-xs leading-5 text-[#748074]">Weeks run Monday to Monday in UTC. Names are pseudonymous.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {showGame && (
        <section
          ref={playRootRef}
          data-flower-quest-root
          aria-label="The Flower Quest"
          className="fixed inset-0 z-50 flex select-none flex-col overflow-hidden bg-[var(--fq-deck-bottom)] transition-colors duration-700 [touch-action:none] portrait:pb-[env(safe-area-inset-bottom)]"
          style={{ '--fq-deck-top': DECK_COLORS[area][0], '--fq-deck-bottom': DECK_COLORS[area][1] } as CSSProperties}
        >
          <div className="relative min-h-0 flex-1 portrait:max-h-[min(64svh,128vw)] portrait:flex-none portrait:basis-[min(64svh,128vw)]">
            <GameStage
              key={stageKey}
              paused={gamePaused}
              runKey={runKey}
              controls={controlsRef}
              onSnapshot={handleSnapshot}
              onVictory={handleVictory}
              onGameOver={handleGameOver}
              onPause={handlePause}
              onLoadError={message => {
                setGameLoadError(message)
                setLoadingProgress(100)
              }}
              onLoadProgress={setLoadingProgress}
              onEvent={handleEvent}
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(38,28,48,.32)_100%)]" />

            {/* HUD */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-2.5 pt-[max(.6rem,env(safe-area-inset-top))] [padding-left:max(.65rem,env(safe-area-inset-left))] [padding-right:max(.65rem,env(safe-area-inset-right))] sm:px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/70 bg-white/80 py-1.5 pl-2.5 pr-3 text-[#403a46] shadow-sm backdrop-blur-md sm:gap-2.5 sm:pl-3 sm:pr-3.5">
                  <span key={`hearts-${heartsPulse}`} className={`flex items-center gap-0.5 ${heartsPulse ? 'fq-hearts-hit' : ''}`} aria-label={`${lives} of 3 hearts left`}>
                    {[0, 1, 2].map(index => (
                      <Heart
                        key={index}
                        size={17}
                        aria-hidden="true"
                        className={index < lives ? 'text-[#d76c8f]' : 'text-[#bdb4c6]'}
                        fill={index < lives ? 'currentColor' : 'none'}
                        strokeWidth={2.4}
                      />
                    ))}
                  </span>
                  <span className="h-4 w-px bg-[#403a46]/15" aria-hidden="true" />
                  <span className="flex items-center gap-1 text-sm font-semibold tabular-nums" aria-label={`${flowers} of ${TOTAL_FLOWERS} flowers`}>
                    <img src="/games/quest-flower.svg" alt="" className="h-[18px] w-[15px] object-contain" />
                    <span>{flowers}<span className="font-normal text-[#817a88]">/{TOTAL_FLOWERS}</span></span>
                  </span>
                  <span className="h-4 w-px bg-[#403a46]/15" aria-hidden="true" />
                  <span key={`score-${score}`} className={`text-sm font-bold tabular-nums text-[#7665a4] ${score > 0 ? 'fq-bump' : ''}`} aria-label={`Score ${score}`}>
                    {score.toLocaleString('en-IN')}
                  </span>
                  {!session && <span className="hidden rounded-full bg-[#f1eaf8] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#7665a4] min-[480px]:inline">PRACTICE</span>}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`flex h-9 items-center gap-1 rounded-full border border-white/70 px-2.5 text-sm sm:h-10 sm:px-3 font-semibold tabular-nums shadow-sm backdrop-blur-md transition-colors ${lowTime ? 'bg-[#fde3e6]/90 text-[#b54762]' : 'bg-white/80 text-[#403a46]'}`}
                    aria-label={`${timeLeft} seconds left`}
                  >
                    <Timer size={15} aria-hidden="true" className={lowTime ? 'fq-tick' : ''} />
                    {formatClock(timeLeft)}
                  </span>
                  <button type="button" onClick={toggleSound} className={iconButton} aria-label={soundEnabled ? 'Mute sound' : 'Turn sound on'}>
                    {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>
                  {canFullscreen && (
                    <button type="button" onClick={toggleFullscreen} className={`${iconButton} portrait:hidden`} aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}>
                      {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setScreen('paused')}
                    disabled={screen !== 'playing'}
                    className={`${iconButton} disabled:opacity-50`}
                    aria-label="Pause"
                  >
                    <Pause size={18} fill="currentColor" />
                  </button>
                </div>
              </div>

              <div className="mx-auto mt-2 flex max-w-[420px] items-center gap-2 px-1" aria-label={`${Math.round(progress * 100)}% of the way to the Queen`}>
                <div className="relative h-2 flex-1 rounded-full bg-white/60 shadow-inner backdrop-blur-sm">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#78a875] via-[#70849a] to-[#c88c88] transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
                  {SECTION_MARKERS.slice(0, 2).map((marker, index) => (
                    <span
                      key={marker}
                      className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${progress * LEVEL_END >= marker ? 'bg-[#e8bd67]' : 'bg-[#cfc6d6]'}`}
                      style={{ left: `${(marker / LEVEL_END) * 100}%` }}
                      aria-hidden="true"
                      title={STAGES[index + 1].name}
                    />
                  ))}
                  <span
                    className="absolute top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#fff6ea] shadow transition-[left] duration-200"
                    style={{ left: `${progress * 100}%` }}
                    aria-hidden="true"
                  >
                    <img src="/games/quest-flower.svg" alt="" className="h-4 w-3.5 object-contain" />
                  </span>
                </div>
                <Crown size={18} className="shrink-0 text-[#bd9152] drop-shadow-[0_1px_1px_rgba(255,255,255,.9)]" aria-hidden="true" />
              </div>
            </div>

            {toast && (
              <div
                key={toast.id}
                role="status"
                aria-live="polite"
                className="fq-toast pointer-events-none absolute left-1/2 top-[calc(max(.6rem,env(safe-area-inset-top))_+_4.75rem)] z-10 w-max max-w-[min(26rem,calc(100%-2rem))] rounded-full bg-[#2f2940]/85 px-4 py-1.5 text-center font-syndicatgrotesk text-[13px] font-semibold leading-5 text-white shadow-lg backdrop-blur-md"
                style={{ '--fq-toast-ms': `${toast.duration}ms` } as CSSProperties}
              >
                {toast.text}
              </div>
            )}

            {gameLoadError ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#e6edf2]/95 p-6 text-center" role="alert">
                <div className="max-w-sm">
                  <p className="font-brandon text-xl font-semibold text-[#51486c]">The garden could not open</p>
                  <p className="mt-2 text-sm leading-6 text-[#625b6e]">{gameLoadError}</p>
                  <div className="mt-4 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Remount the stage so Phaser retries the artwork; the current run is kept.
                        setGameLoadError('')
                        setLoadingProgress(0)
                        setStageKey(value => value + 1)
                      }}
                      className="rounded-full bg-[#7665a4] px-5 py-2.5 text-sm font-semibold text-white"
                    >
                      Try again
                    </button>
                    <button type="button" onClick={leaveGame} className="rounded-full border border-[#d8cee1] px-5 py-2.5 text-sm font-semibold text-[#5f576e]">
                      Back
                    </button>
                  </div>
                </div>
              </div>
            ) : loadingProgress < 100 ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#263d32] p-6" role="status" aria-live="polite">
                <div className="w-full max-w-xs text-center text-[#f4efdf]">
                  <img src="/games/quest-flower.svg" alt="" className="fq-float mx-auto h-16 w-14 object-contain" />
                  <p className="mt-3 font-brandon text-xl font-semibold">Waking the garden</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-[#df8c8d] transition-[width]" style={{ width: `${loadingProgress}%` }} />
                  </div>
                  <p className="mt-2 text-sm tabular-nums text-[#d3dfd1]">{loadingProgress}%</p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Controls: below the game in portrait, floating over it in landscape. */}
          <div className="pointer-events-none z-10 flex items-end justify-between px-4 pb-[max(1rem,env(safe-area-inset-bottom))] landscape:absolute landscape:inset-x-0 landscape:bottom-0 landscape:[padding-left:max(1rem,env(safe-area-inset-left))] landscape:[padding-right:max(1rem,env(safe-area-inset-right))] portrait:relative portrait:flex-1 portrait:items-center portrait:bg-[linear-gradient(var(--fq-deck-top),var(--fq-deck-bottom))] portrait:px-6 portrait:pb-0 portrait:shadow-[inset_0_10px_18px_-12px_rgba(0,0,0,.55)]">
            <div className="pointer-events-auto">
              <DirectionPad controls={controlsRef} />
            </div>
            <p className="pointer-events-none hidden max-w-[9rem] text-center font-syndicatgrotesk text-[11px] leading-4 text-[#f1e3d6]/75 portrait:block">
              Turn your phone sideways for a wider view
            </p>
            <div className="pointer-events-auto">
              <JumpButton controls={controlsRef} />
            </div>
          </div>

          {screen === 'paused' && (
            <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-[#322b3d]/55 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="pause-title">
              <div className="fq-pop fq-dialog w-full max-w-sm rounded-[1.75rem] bg-[#fffaf4] p-7 text-center shadow-2xl">
                <h2 id="pause-title" className="font-brandon text-3xl font-semibold text-[#403a46]">Take a breath</h2>
                <p className="fq-hide-short mt-2 text-[#716a79]">The garden will wait right here.</p>
                <div className="fq-stats mt-5 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-2xl bg-[#f4eef8] px-2 py-3"><p className="font-bold tabular-nums text-[#7665a4]">{score}</p><p className="text-xs text-[#817a88]">points</p></div>
                  <div className="rounded-2xl bg-[#f4eef8] px-2 py-3"><p className="font-bold tabular-nums text-[#7665a4]">{flowers}/{TOTAL_FLOWERS}</p><p className="text-xs text-[#817a88]">flowers</p></div>
                  <div className="rounded-2xl bg-[#f4eef8] px-2 py-3"><p className="font-bold tabular-nums text-[#7665a4]">{formatClock(timeLeft)}</p><p className="text-xs text-[#817a88]">left</p></div>
                </div>
                <div className="fq-buttons mt-6 grid gap-3">
                  <button type="button" onClick={resumeGame} className={primaryButton}>
                    <Play size={17} fill="currentColor" /> Keep playing
                  </button>
                  <button type="button" onClick={toggleSound} className={secondaryButton}>
                    {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />} Sound {soundEnabled ? 'on' : 'off'}
                  </button>
                  <button type="button" onClick={leaveGame} className={secondaryButton}>
                    Leave the garden
                  </button>
                </div>
              </div>
            </div>
          )}

          {screen === 'game-over' && result && (
            <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-[#322b3d]/55 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
              <div className="fq-pop fq-dialog w-full max-w-md rounded-[1.75rem] bg-[#fffaf4] p-7 text-center shadow-2xl">
                <span className="fq-hide-short block">
                  {result.reason === 'time'
                    ? <Timer className="mx-auto text-[#c77ca4]" size={34} aria-hidden="true" />
                    : <Heart className="mx-auto text-[#c77ca4]" size={34} aria-hidden="true" />}
                </span>
                <h2 id="game-over-title" className="mt-3 font-brandon text-3xl font-semibold text-[#403a46]">
                  {result.reason === 'time' ? 'The sun is setting' : 'The garden is still cheering'}
                </h2>
                <p className="mt-2 text-[#716a79]">
                  {result.reason === 'time'
                    ? `Time ran out ${Math.round(progress * 100)}% of the way to the Queen. Try a quicker path.`
                    : `You gathered ${result.score.toLocaleString('en-IN')} points and made it ${Math.round(progress * 100)}% of the way.`}
                </p>
                <div className="fq-buttons fq-buttons-2 mt-6 grid gap-3">
                  <button type="button" onClick={beginRun} disabled={starting} className={primaryButton}>
                    <RotateCcw size={17} /> {starting ? 'Preparing…' : 'Try again'}
                  </button>
                  <button type="button" onClick={leaveGame} className={secondaryButton}>Back to the story</button>
                </div>
                {startError && <p role="status" className="mt-3 text-sm text-[#65548e]">{startError}</p>}
              </div>
            </div>
          )}

          {screen === 'victory' && result && (
            <div className="absolute inset-0 z-30 overflow-y-auto overscroll-contain bg-[#322b3d]/60 p-4 backdrop-blur-[2px] [touch-action:pan-y]" role="dialog" aria-modal="true" aria-labelledby="victory-title">
              <div className="fq-pop fq-victory mx-auto my-[max(1rem,env(safe-area-inset-top))] w-full max-w-xl rounded-[1.75rem] bg-[#fffaf4] px-6 py-7 text-center shadow-2xl sm:px-10">
                <div className="fq-victory-grid">
                <div>
                <Crown className="fq-hide-short mx-auto text-[#bd9152]" size={37} aria-hidden="true" />
                <h2 id="victory-title" className="mt-2 font-brandon text-4xl font-semibold text-[#403a46]">The flower found its Queen</h2>
                <p className="fq-hide-short mt-2 text-[#716a79]">She smiles, takes the bloom, and the whole garden celebrates.</p>
                <p className="fq-score mt-4 font-brandon text-6xl font-bold tabular-nums text-[#7665a4]">{score.toLocaleString('en-IN')}</p>
                <p className="mt-1 font-semibold text-[#514b5d]">{achievementFor(score)}</p>
                <div className="mx-auto mt-4 grid max-w-sm grid-cols-3 gap-2 text-sm">
                  <div className="rounded-2xl bg-[#f4eef8] px-2 py-2.5"><p className="font-bold tabular-nums text-[#7665a4]">{result.flowers}/{TOTAL_FLOWERS}</p><p className="text-xs text-[#817a88]">flowers</p></div>
                  <div className="rounded-2xl bg-[#f4eef8] px-2 py-2.5"><p className="font-bold tabular-nums text-[#7665a4]">{result.coins}/{TOTAL_COINS}</p><p className="text-xs text-[#817a88]">coins</p></div>
                  <div className="rounded-2xl bg-[#f4eef8] px-2 py-2.5"><p className="font-bold tabular-nums text-[#7665a4]">{formatClock(result.seconds)}</p><p className="text-xs text-[#817a88]">time</p></div>
                </div>
                <p role="status" className="mt-3 min-h-6 text-sm text-[#716a79]">{verificationMessage}</p>
                </div>
                <div>

                {runVerified && (config?.enabled || config === null) && !claimedCoupon && (
                  <button type="button" onClick={handleClaim} disabled={claimLoading} className={`${primaryButton} mt-3`}>
                    {claimLoading ? 'Preparing your reward…' : 'Claim your reward'}
                  </button>
                )}
                {runVerified && config && !config.enabled && (
                  <p className="mt-3 rounded-xl bg-[#f1eaf8] px-4 py-3 text-sm text-[#625b6e]">Your score is saved. Reward codes are not active yet.</p>
                )}
                {claimedCoupon && (
                  <div className="mt-4 flex justify-center">
                    <CouponCard
                      coupon={claimedCoupon}
                      minimumOrderValue={config?.minimumOrderValue ?? 599}
                      maximumDiscountAmount={config?.maximumDiscountAmount ?? null}
                      tone="light"
                    />
                  </div>
                )}
                {claimMessage && <p role="status" className="mt-3 text-sm text-[#65548e]">{claimMessage}</p>}

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button type="button" onClick={shareAchievement} className={secondaryButton}>
                    <Share2 size={16} /> Share
                  </button>
                  <button type="button" onClick={downloadAchievement} disabled={!achievementBlob} className={`${secondaryButton} disabled:opacity-50`}>
                    <Download size={16} /> Card
                  </button>
                </div>
                <button type="button" onClick={copyChallenge} className="mt-2 w-full rounded-full py-2 text-sm text-[#65548e] underline underline-offset-4">Copy challenge link</button>
                {shareMessage && <p role="status" className="mt-2 text-sm text-[#65548e]">{shareMessage}</p>}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={beginRun} disabled={starting} className={primaryButton}>
                    <RotateCcw size={16} /> {starting ? 'Preparing…' : 'Play again'}
                  </button>
                  <Link href="/" onClick={exitFullscreen} className={secondaryButton}>
                    <ShoppingBag size={16} /> Shop Craftoo
                  </Link>
                </div>
                {startError && <p role="status" className="mt-3 text-sm text-[#65548e]">{startError}</p>}
                <p className="mt-5 text-xs leading-5 text-[#817a88]">The share card shows your score and reward percentage, never your private coupon code.</p>
                </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <style jsx global>{`
        .flower-quest-canvas {
          position: absolute;
          inset: 0;
          touch-action: none;
        }
        .flower-quest-canvas canvas {
          display: block;
          width: 100% !important;
          height: 100% !important;
          outline: none;
        }
        .fq-control {
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
        }
        @keyframes fq-toast {
          0% { opacity: 0; transform: translate(-50%, -8px) scale(.96); }
          10% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          85% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -6px) scale(.98); }
        }
        .fq-toast {
          transform: translateX(-50%);
          animation: fq-toast var(--fq-toast-ms, 2200ms) ease forwards;
        }
        @keyframes fq-hearts-hit {
          0%, 100% { transform: translateX(0) scale(1); }
          20% { transform: translateX(-3px) scale(1.12); }
          40% { transform: translateX(3px) scale(1.08); }
          60% { transform: translateX(-2px) scale(1.04); }
        }
        .fq-hearts-hit { animation: fq-hearts-hit 480ms ease; }
        @keyframes fq-bump {
          0% { transform: scale(1); }
          35% { transform: scale(1.28); color: #c0587e; }
          100% { transform: scale(1); }
        }
        .fq-bump { display: inline-block; animation: fq-bump 320ms ease-out; }
        @keyframes fq-pop {
          from { opacity: 0; transform: translateY(10px) scale(.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .fq-pop { animation: fq-pop 260ms cubic-bezier(.2, .9, .3, 1.2) both; }
        @keyframes fq-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .fq-float { animation: fq-float 3.2s ease-in-out infinite; }
        .fq-float-slow { animation: fq-float 4.6s ease-in-out infinite; }
        @keyframes fq-tick {
          0%, 100% { transform: rotate(0); }
          50% { transform: rotate(-14deg); }
        }
        .fq-tick { animation: fq-tick 1s ease-in-out infinite; }
        @media (max-height: 520px) {
          .fq-dialog { padding: 1rem 1.25rem; border-radius: 1.25rem; }
          .fq-dialog h2 { margin-top: 0; font-size: 1.6rem; line-height: 1.1; }
          .fq-dialog .fq-hide-short { display: none; }
          .fq-dialog .fq-stats { margin-top: .75rem; }
          .fq-dialog .fq-buttons { margin-top: .9rem; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .5rem; }
          .fq-dialog .fq-buttons-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .fq-dialog .fq-buttons > * { min-height: 2.75rem; padding-left: .5rem; padding-right: .5rem; font-size: .875rem; }
          .fq-dialog.max-w-sm { max-width: 34rem; }
          .fq-victory { padding: 1rem 1.25rem; border-radius: 1.25rem; }
          .fq-victory .fq-hide-short { display: none; }
          .fq-victory h2 { margin-top: 0; font-size: 1.75rem; line-height: 1.1; }
          .fq-victory .fq-score { margin-top: .4rem; font-size: 2.75rem; line-height: 1; }
        }
        @media (max-height: 520px) and (min-width: 640px) {
          .fq-victory { max-width: 54rem; }
          .fq-victory-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: center; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fq-float, .fq-float-slow, .fq-tick, .fq-hearts-hit, .fq-bump { animation: none; }
          .fq-pop { animation-duration: 1ms; }
        }
      `}</style>
    </main>
  )
}
