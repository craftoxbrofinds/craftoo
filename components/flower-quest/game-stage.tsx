'use client'

import * as Phaser from 'phaser'
import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import {
  CHECKPOINTS,
  COINS,
  ENEMIES,
  FLOWERS,
  GAME_HEIGHT,
  GROUND,
  GROUND_Y,
  Input,
  LEVEL_END,
  PLATFORMS,
  PLAYER_WIDTH,
  SECTION_MARKERS,
  THORNS,
  createGameState,
  encodeInputs,
  enemyPosition,
  stepGame,
  type GameState,
} from '@/lib/flower-quest/simulation'
import { biomeAt, drawTerrain, makeSceneryTextures } from '@/components/flower-quest/scenery'

export type GameEvent =
  | { type: 'jump' }
  | { type: 'land' }
  | { type: 'coin' }
  | { type: 'flower' }
  | { type: 'damage'; livesLeft: number }
  | { type: 'checkpoint' }
  | { type: 'section'; index: number }
  | { type: 'victory' }

/** Shared with the on-screen controls. `jumpQueued` latches taps shorter than one frame. */
export type ControlState = { held: number; jumpQueued: boolean }

type GameCallbacks = {
  onSnapshot: (state: GameState) => void
  onVictory: (state: GameState, replay: number[]) => void
  onGameOver: (state: GameState) => void
  onPause: () => void
  onLoadError: (message: string) => void
  onLoadProgress: (progress: number) => void
  onEvent: (event: GameEvent) => void
}

type Props = GameCallbacks & {
  paused: boolean
  runKey: number
  controls: MutableRefObject<ControlState>
}

const SCENE_KEY = 'FlowerQuestScene'
const FRAME_MS = 1000 / 60
const MIN_VIEW_WIDTH = 760
/** Portrait screens trade some look-ahead for characters that are big enough to read. */
const MIN_VIEW_WIDTH_PORTRAIT = 600
/** World height that must stay visible: from above the highest jump down to the bottom of the soil. */
const MIN_VIEW_HEIGHT = 600
const QUEEN_X = LEVEL_END + 120
/** The ground is drawn well past the finish so the camera can centre the Queen on any screen width. */
const GROUND_RIGHT = LEVEL_END + 2400
const HERO_FOOT_OFFSET = 7
const SURFACES = [...PLATFORMS, ...GROUND]

const BIOMES = [
  { sky: 'garden-sky', far: 0x9fcb9b, near: 0x78ad7c, shape: 'bush', ambient: 0xffc9df, cloud: 0xffffff, ray: 0xfff3d1, rays: 0.55, fore: 0x3e6b4a },
  { sky: 'forest-sky', far: 0x6d8f8f, near: 0x4d715f, shape: 'pine', ambient: 0xfff1a0, cloud: 0xe6edf5, ray: 0xfff0a8, rays: 1, fore: 0x23412f },
  { sky: 'castle-sky', far: 0xb8a6cf, near: 0x9380b5, shape: 'tower', ambient: 0xffffff, cloud: 0xffe6f0, ray: 0xffdcec, rays: 0.45, fore: 0x4b3f62 },
] as const

function surfaceBelow(centerX: number, feetY: number): number | null {
  let best: number | null = null
  for (const surface of SURFACES) {
    if (centerX < surface.start || centerX > surface.end) continue
    if (surface.top < feetY - 1) continue
    if (best === null || surface.top < best) best = surface.top
  }
  return best
}

class QuestScene extends Phaser.Scene {
  private readonly callbacks: RefObject<GameCallbacks>
  private readonly controls: MutableRefObject<ControlState>
  private readonly pixelRatio: number

  private state = createGameState()
  private inputs: number[] = []
  private lastInput = 0
  private accumulator = 0
  private lastHudTick = -20
  private finished = false
  private deliveryStarted = false
  private flowerFollowsHero = true
  private afterTicks = 0
  private biome = 0
  private facing = 1
  private runPhase = 0
  private squash = 1
  private lookAhead = 0
  private collectedFlowers: boolean[] = []
  private collectedCoins: boolean[] = []
  private viewTop = 0

  private skies: Phaser.GameObjects.Image[] = []
  private farHills: Phaser.GameObjects.TileSprite[] = []
  private nearHills: Phaser.GameObjects.TileSprite[] = []
  private hero!: Phaser.GameObjects.Image
  private heroShadow!: Phaser.GameObjects.Image
  private carriedFlower!: Phaser.GameObjects.Image
  private queen!: Phaser.GameObjects.Image
  private flowerSprites: Phaser.GameObjects.Image[] = []
  private flowerGlows: Phaser.GameObjects.Image[] = []
  private coinSprites: Phaser.GameObjects.Image[] = []
  private enemySprites: Phaser.GameObjects.Image[] = []
  private thornSprites: Phaser.GameObjects.Image[] = []
  private flags: { pennant: Phaser.GameObjects.Triangle; glow: Phaser.GameObjects.Image; active: boolean }[] = []
  private clouds: { image: Phaser.GameObjects.Image; base: number; speed: number; height: number }[] = []
  private rays: Phaser.GameObjects.Image[] = []
  private foregrounds: Phaser.GameObjects.TileSprite[] = []
  private coinStars: Phaser.GameObjects.Image[] = []
  private mothShadows: Phaser.GameObjects.Image[] = []
  private rayStrength: number = BIOMES[0].rays
  private screenArea = { left: 0, top: 0, width: 1, skyHeight: 1 }
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter
  private petals!: Phaser.GameObjects.Particles.ParticleEmitter
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter
  private ambient!: Phaser.GameObjects.Particles.ParticleEmitter
  private ambientZone = new Phaser.Geom.Rectangle(0, 0, 1, 1)
  private heroScaleX = 1
  private heroScaleY = 1
  private coinScale = 1

  constructor(callbacks: RefObject<GameCallbacks>, controls: MutableRefObject<ControlState>, pixelRatio: number) {
    super({ key: SCENE_KEY })
    this.callbacks = callbacks
    this.controls = controls
    this.pixelRatio = pixelRatio
  }

  init() {
    this.state = createGameState()
    this.inputs = []
    this.lastInput = 0
    this.accumulator = 0
    this.lastHudTick = -20
    this.finished = false
    this.deliveryStarted = false
    this.flowerFollowsHero = true
    this.afterTicks = 0
    this.biome = 0
    this.facing = 1
    this.runPhase = 0
    this.squash = 1
    this.lookAhead = 0
    this.collectedFlowers = FLOWERS.map(() => false)
    this.collectedCoins = COINS.map(() => false)
    this.skies = []
    this.farHills = []
    this.nearHills = []
    this.flowerSprites = []
    this.flowerGlows = []
    this.coinSprites = []
    this.enemySprites = []
    this.thornSprites = []
    this.flags = []
    this.clouds = []
    this.rays = []
    this.foregrounds = []
    this.coinStars = []
    this.mothShadows = []
    this.rayStrength = BIOMES[0].rays
    this.controls.current.held = 0
    this.controls.current.jumpQueued = false
  }

  preload() {
    const svg = (key: string, width: number, height: number) => {
      if (!this.textures.exists(key)) this.load.svg(key, `/games/${key}.svg`, { width, height })
    }
    svg('garden-sky', 1920, 1080)
    svg('forest-sky', 1920, 1080)
    svg('castle-sky', 1920, 1080)
    svg('quest-hero', 224, 248)
    svg('garden-queen', 300, 356)
    svg('quest-flower', 144, 176)
    svg('garden-coin', 128, 128)
    svg('thorn-bush', 192, 152)
    svg('garden-moth', 184, 152)
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.callbacks.current?.onLoadError(`Could not load game artwork: ${file.key}`)
    })
    this.load.on('progress', (progress: number) => {
      this.callbacks.current?.onLoadProgress(Math.min(99, Math.round(progress * 100)))
    })
  }

  create() {
    this.makeTextures()

    this.skies = BIOMES.map((biome, index) =>
      this.add.image(0, 0, biome.sky).setOrigin(0.5, 1).setScrollFactor(0).setDepth(-20).setAlpha(index === 0 ? 1 : 0)
    )
    this.farHills = BIOMES.map((_, index) =>
      this.add.tileSprite(0, GROUND_Y + 20, 1024, 300, `fq-far-${index}`)
        .setOrigin(0.5, 1).setScrollFactor(0, 1).setDepth(-12).setAlpha(index === 0 ? 0.75 : 0)
    )
    this.nearHills = BIOMES.map((_, index) =>
      this.add.tileSprite(0, GROUND_Y + 20, 1024, 300, `fq-near-${index}`)
        .setOrigin(0.5, 1).setScrollFactor(0, 1).setDepth(-11).setAlpha(index === 0 ? 1 : 0)
    )

    const cloudRandom = new Phaser.Math.RandomDataGenerator(['clouds'])
    this.clouds = Array.from({ length: 7 }, (_, index) => ({
      image: this.add.image(0, 0, 'fq-cloud')
        .setScrollFactor(0)
        .setDepth(-15)
        .setAlpha(cloudRandom.realInRange(0.5, 0.88))
        .setScale(cloudRandom.realInRange(0.5, 1.1)),
      base: index * 250 + cloudRandom.between(0, 150),
      speed: cloudRandom.realInRange(4, 11),
      height: cloudRandom.realInRange(0.03, 0.4),
    }))
    this.rays = [0.14, 0.36, 0.6, 0.83].map(() =>
      this.add.image(0, 0, 'fq-ray')
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(-9)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(BIOMES[0].ray)
        .setAlpha(0)
    )

    this.ambient = this.add.particles(0, 0, 'fq-petal', {
      lifespan: 7000,
      frequency: 260,
      speedX: { min: -28, max: -8 },
      speedY: { min: 14, max: 34 },
      rotate: { min: 0, max: 360 },
      scale: { min: 0.5, max: 1.1 },
      alpha: { start: 0.85, end: 0 },
      tint: BIOMES[0].ambient,
      emitZone: { type: 'random', source: this.ambientZone } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    }).setScrollFactor(0).setDepth(-5)

    this.drawPits()
    drawTerrain(this, GROUND_RIGHT)
    this.drawCheckpoints()
    this.drawFinish()

    this.flowerGlows = FLOWERS.map(flower =>
      this.add.image(flower.x, flower.y, 'fq-glow').setDisplaySize(78, 78).setDepth(2.5).setAlpha(0.6)
    )
    this.flowerSprites = FLOWERS.map(flower =>
      this.add.image(flower.x, flower.y, 'quest-flower').setDisplaySize(39, 48).setDepth(3)
    )
    this.coinSprites = COINS.map(coin =>
      this.add.image(coin.x, coin.y, 'garden-coin').setDisplaySize(31, 31).setDepth(3)
    )
    this.coinScale = this.coinSprites[0]?.scaleY ?? 1
    this.coinStars = COINS.map(coin =>
      this.add.image(coin.x, coin.y, 'fq-star').setDepth(3.2).setTint(0xfffbe8).setVisible(false)
    )
    this.thornSprites = THORNS.map(thorn =>
      this.add.image(thorn.x, GROUND_Y + 6, 'thorn-bush').setOrigin(0.5, 1).setDisplaySize(68, 54).setDepth(3)
    )
    this.mothShadows = ENEMIES.map(enemy =>
      this.add.image(enemy.start, GROUND_Y + 3, 'fq-shadow').setDisplaySize(44, 10).setDepth(2.9).setAlpha(0.3)
    )
    this.enemySprites = ENEMIES.map(enemy =>
      this.add.image(enemy.start, enemy.y - 30, 'garden-moth').setDisplaySize(60, 50).setDepth(3.5)
    )

    this.queen = this.add.image(QUEEN_X, GROUND_Y + 8, 'garden-queen')
      .setOrigin(0.5, 1)
      .setDisplaySize(112, 134)
      .setDepth(4)
    this.tweens.add({
      targets: this.queen,
      scaleY: this.queen.scaleY * 1.025,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.heroShadow = this.add.image(0, GROUND_Y, 'fq-shadow').setDisplaySize(56, 14).setDepth(4.5).setAlpha(0.5)
    this.hero = this.add.image(this.state.x + PLAYER_WIDTH / 2, this.state.y + HERO_FOOT_OFFSET, 'quest-hero')
      .setOrigin(0.5, 1)
      .setDisplaySize(74, 82)
      .setDepth(5)
    this.heroScaleX = this.hero.scaleX
    this.heroScaleY = this.hero.scaleY
    this.carriedFlower = this.add.image(0, 0, 'quest-flower').setDisplaySize(24, 29).setDepth(5.5)

    this.sparkles = this.add.particles(0, 0, 'fq-dot', {
      lifespan: 650,
      speed: { min: 70, max: 230 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 260,
      tint: [0xffe08a, 0xfff6d6, 0xf7c35f],
      emitting: false,
    }).setDepth(8)
    this.petals = this.add.particles(0, 0, 'fq-petal', {
      lifespan: 900,
      speed: { min: 60, max: 210 },
      rotate: { min: 0, max: 360 },
      scale: { start: 1.3, end: 0.2 },
      alpha: { start: 1, end: 0 },
      gravityY: 180,
      tint: [0xf3a9c8, 0xffd6e8, 0xd98bb5, 0xfff2c8],
      emitting: false,
    }).setDepth(8)
    this.dust = this.add.particles(0, 0, 'fq-dot', {
      lifespan: 420,
      speedX: { min: -70, max: 70 },
      speedY: { min: -50, max: -10 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.65, end: 0 },
      tint: 0xe6d4b4,
      emitting: false,
    }).setDepth(4.6)
    this.confetti = this.add.particles(0, 0, 'fq-confetti', {
      lifespan: 2200,
      speed: { min: 220, max: 520 },
      angle: { min: 235, max: 305 },
      rotate: { start: 0, end: 720 },
      gravityY: 420,
      scale: { min: 0.8, max: 1.4 },
      tint: [0xdf8c8d, 0xe8bd67, 0x7665a4, 0x78a875, 0xf0d7e7],
      emitting: false,
    }).setDepth(9)

    // Foreground grass that scrolls faster than the action, for a sense of depth.
    this.foregrounds = BIOMES.map((biome, index) =>
      this.add.tileSprite(0, 0, 1024, 130, 'fq-fore')
        .setOrigin(0.5, 1)
        .setScrollFactor(0, 1)
        .setDepth(9.5)
        .setTint(biome.fore)
        .setAlpha(index === 0 ? 0.92 : 0)
    )

    const camera = this.cameras.main
    camera.setBackgroundColor('#cfe3e8')
    camera.startFollow(this.hero, false, 0.12, 0)
    this.layout()
    this.scale.on('resize', this.layout, this)
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this))

    this.game.canvas.tabIndex = -1
    this.game.canvas.setAttribute('aria-label', 'Flower Quest game. Use the on-screen controls to move and jump.')
    this.callbacks.current?.onLoadProgress(100)
    this.callbacks.current?.onSnapshot({ ...this.state })
  }

  update(time: number, delta: number) {
    // Advance the simulation by the real time since the last frame. Phaser's smoothed delta is
    // capped at 1/60 s for the first 120 frames, which made the game run at half speed for its
    // first seconds on 30 fps screens (e.g. iPhones in Low Power Mode). Long hitches are still
    // capped so a stall never turns into a burst of catch-up frames.
    const elapsed = this.game.loop.rawDelta || delta
    this.accumulator += Math.min(elapsed, 100)

    while (this.accumulator >= FRAME_MS && this.state.status === 'playing') {
      this.accumulator -= FRAME_MS
      this.simulateFrame()
    }

    if (this.state.status !== 'playing') {
      this.afterTicks += Math.min(elapsed, 100) / FRAME_MS
      this.accumulator = 0
    }

    this.drawWorld(time)
  }

  private simulateFrame() {
    const state = this.state
    const input = this.readInput()
    this.inputs.push(input)

    const before = {
      score: state.score,
      lives: state.lives,
      vy: state.vy,
      grounded: state.grounded,
      checkpointX: state.checkpointX,
      sections: [...state.sections],
      x: state.x,
      y: state.y,
    }
    stepGame(state, input)

    const events: GameEvent[] = []
    if (state.vy < 0 && before.vy >= 0 && state.lives === before.lives) {
      events.push({ type: 'jump' })
      this.squash = 1.16
      this.dust.explode(6, state.x + PLAYER_WIDTH / 2, before.y)
    }
    if (!before.grounded && state.grounded && before.vy > 5) {
      events.push({ type: 'land' })
      this.squash = 0.8
      this.dust.explode(8, state.x + PLAYER_WIDTH / 2, state.y)
    }

    for (let i = 0; i < FLOWERS.length; i += 1) {
      if (state.flowers[i] && !this.collectedFlowers[i]) {
        this.collectedFlowers[i] = true
        events.push({ type: 'flower' })
        this.petals.explode(16, FLOWERS[i].x, FLOWERS[i].y)
        this.sparkles.explode(8, FLOWERS[i].x, FLOWERS[i].y)
        this.floatText(FLOWERS[i].x, FLOWERS[i].y - 26, '+10', '#c0587e')
      }
    }
    for (let i = 0; i < COINS.length; i += 1) {
      if (state.coins[i] && !this.collectedCoins[i]) {
        this.collectedCoins[i] = true
        events.push({ type: 'coin' })
        this.sparkles.explode(10, COINS[i].x, COINS[i].y)
        this.floatText(COINS[i].x, COINS[i].y - 22, '+5', '#b0802c')
      }
    }
    for (let i = 0; i < state.sections.length; i += 1) {
      if (state.sections[i] && !before.sections[i]) {
        events.push({ type: 'section', index: i })
        this.floatText(state.x + PLAYER_WIDTH / 2, state.y - 96, '+50', '#7665a4', 30)
      }
    }
    if (state.checkpointX > before.checkpointX) {
      events.push({ type: 'checkpoint' })
      this.activateFlag(CHECKPOINTS.indexOf(state.checkpointX))
    }
    if (state.lives < before.lives) {
      events.push({ type: 'damage', livesLeft: state.lives })
      this.petals.explode(18, before.x + PLAYER_WIDTH / 2, before.y - 34)
      this.cameras.main.shake(220, 0.006)
      this.cameras.main.flash(180, 255, 214, 222)
      this.squash = 1
      this.hero.setTintFill(0xffffff)
      this.time.delayedCall(110, () => this.hero.clearTint())
      if (state.status === 'playing') {
        this.sparkles.explode(18, state.x + PLAYER_WIDTH / 2, state.y - 40)
        this.petals.explode(10, state.x + PLAYER_WIDTH / 2, state.y - 30)
      }
    }

    for (const event of events) this.callbacks.current?.onEvent(event)

    if (events.length > 0 || state.tick - this.lastHudTick >= 6) {
      this.lastHudTick = state.tick
      this.callbacks.current?.onSnapshot({ ...state })
    }

    if (state.status === 'won' && !this.finished) {
      this.finished = true
      this.callbacks.current?.onSnapshot({ ...state })
      this.beginDelivery({ ...state, flowers: [...state.flowers], coins: [...state.coins] }, encodeInputs(this.inputs))
    } else if (state.status === 'game-over' && !this.finished) {
      this.finished = true
      this.callbacks.current?.onSnapshot({ ...state })
      this.beginGameOver({ ...state })
    }
  }

  private readInput(): number {
    const controls = this.controls.current
    let input = controls.held & (Input.left | Input.right | Input.jump)
    if (controls.jumpQueued) {
      if ((this.lastInput & Input.jump) !== 0 && (input & Input.jump) !== 0) {
        // Jump was re-pressed before the previous press was seen as released. Emit one released
        // frame first so the simulation registers a fresh press on the next frame.
        input &= ~Input.jump
      } else {
        input |= Input.jump
        controls.jumpQueued = false
      }
    }
    this.lastInput = input
    return input
  }

  private beginDelivery(state: GameState, replay: number[]) {
    this.deliveryStarted = true
    this.facing = 1
    this.hero.setFlipX(false).setAlpha(1).setAngle(0)
    const targetX = QUEEN_X - 76
    const walk = Math.max(300, (targetX - this.hero.x) * 5)
    this.floatText(this.hero.x, this.hero.y - 110, 'Finish!', '#7665a4', 34)
    this.tweens.add({
      targets: this.hero,
      x: targetX,
      duration: walk,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        this.runPhase += 0.35
        this.hero.y = GROUND_Y + HERO_FOOT_OFFSET - Math.abs(Math.sin(this.runPhase)) * 4
      },
      onComplete: () => {
        this.hero.y = GROUND_Y + HERO_FOOT_OFFSET
        this.flowerFollowsHero = false
        this.tweens.add({
          targets: this.carriedFlower,
          x: QUEEN_X - 14,
          y: GROUND_Y - 66,
          angle: -10,
          scale: this.carriedFlower.scale * 1.5,
          duration: 620,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.callbacks.current?.onEvent({ type: 'victory' })
            this.confetti.explode(70, QUEEN_X, GROUND_Y - 150)
            this.petals.explode(30, QUEEN_X - 14, GROUND_Y - 70)
            this.tweens.add({ targets: this.queen, y: GROUND_Y - 8, duration: 180, yoyo: true, repeat: 1, ease: 'Quad.easeOut' })
            this.tweens.add({ targets: this.hero, y: GROUND_Y - 10, duration: 200, yoyo: true, delay: 120, ease: 'Quad.easeOut' })
            this.time.delayedCall(1100, () => this.callbacks.current?.onVictory(state, replay))
          },
        })
      },
    })
  }

  private beginGameOver(state: GameState) {
    this.hero.setAlpha(1)
    this.tweens.add({
      targets: this.hero,
      alpha: 0.45,
      angle: this.facing * -8,
      duration: 500,
      ease: 'Sine.easeOut',
    })
    this.carriedFlower.setVisible(false)
    this.petals.explode(20, this.hero.x, this.hero.y - 40)
    this.time.delayedCall(750, () => this.callbacks.current?.onGameOver(state))
  }

  private drawWorld(time: number) {
    const state = this.state
    const camera = this.cameras.main
    const tick = state.tick + this.afterTicks

    const nextBiome = biomeAt(state.x)
    if (nextBiome !== this.biome) {
      this.biome = nextBiome
      this.crossfadeBiome(nextBiome)
    }

    for (const hills of this.farHills) hills.tilePositionX = camera.scrollX * 0.18
    for (const hills of this.nearHills) hills.tilePositionX = camera.scrollX * 0.38
    for (const fore of this.foregrounds) fore.tilePositionX = camera.scrollX * 1.35

    const { left, top, width, skyHeight } = this.screenArea
    const span = width + 520
    for (const cloud of this.clouds) {
      const travel = cloud.base - camera.scrollX * 0.06 - (time / 1000) * cloud.speed
      const offset = ((travel % span) + span) % span
      cloud.image.setPosition(left - 260 + offset, top + skyHeight * cloud.height)
    }
    this.rayStrength += (BIOMES[this.biome].rays - this.rayStrength) * 0.02
    this.rays.forEach((ray, index) => {
      ray.setAlpha(this.rayStrength * (0.09 + 0.05 * Math.sin(time / 1700 + index * 1.9)))
      ray.setAngle(22 + Math.sin(time / 4000 + index) * 2)
    })

    for (let i = 0; i < this.flowerSprites.length; i += 1) {
      const collected = state.flowers[i]
      this.flowerSprites[i].setVisible(!collected)
      this.flowerGlows[i].setVisible(!collected)
      if (!collected) {
        const bob = Math.sin(time / 300 + i) * 5
        this.flowerSprites[i].y = FLOWERS[i].y + bob
        this.flowerSprites[i].angle = Math.sin(time / 420 + i) * 6
        this.flowerGlows[i].y = FLOWERS[i].y + bob
        this.flowerGlows[i].alpha = 0.45 + Math.sin(time / 260 + i) * 0.2
      }
    }

    for (let i = 0; i < this.coinSprites.length; i += 1) {
      const collected = state.coins[i]
      this.coinSprites[i].setVisible(!collected)
      if (!collected) {
        this.coinSprites[i].scaleX = this.coinScale * (0.15 + Math.abs(Math.sin(time / 260 + i)) * 0.85)
        this.coinSprites[i].y = COINS[i].y + Math.sin(time / 380 + i * 1.7) * 2
      }
      const star = this.coinStars[i]
      const phase = (time / 1000 + i * 0.61) % 2.6
      if (collected || phase > 0.45) {
        star.setVisible(false)
      } else {
        const glint = Math.sin((phase / 0.45) * Math.PI)
        star
          .setVisible(true)
          .setPosition(COINS[i].x + 7, this.coinSprites[i].y - 8)
          .setScale(glint * 0.75)
          .setAlpha(glint)
          .setAngle(phase * 120)
      }
    }

    for (let i = 0; i < this.enemySprites.length; i += 1) {
      const enemy = ENEMIES[i]
      const x = enemyPosition(enemy, Math.floor(tick))
      const ahead = enemyPosition(enemy, Math.floor(tick) + 1)
      const sprite = this.enemySprites[i]
      sprite.x = x
      sprite.y = enemy.y - 30 + Math.sin(time / 190 + i) * 4
      if (ahead !== x) sprite.setFlipX(ahead < x)
      sprite.angle = Math.sin(time / 140 + i) * 4
      const hover = Math.sin(time / 190 + i)
      this.mothShadows[i].setPosition(x, GROUND_Y + 3).setDisplaySize(44 - hover * 4, 10 - hover).setAlpha(0.3 - hover * 0.05)
    }

    for (let i = 0; i < this.thornSprites.length; i += 1) {
      this.thornSprites[i].angle = Math.sin(time / 700 + i * 2) * 2.2
    }

    for (const flag of this.flags) {
      if (!flag.active) continue
      flag.pennant.scaleX = 0.88 + Math.sin(time / 160) * 0.12
      flag.glow.setAlpha(0.55 + Math.sin(time / 300) * 0.25)
    }

    if (state.status === 'playing') this.drawHero(time)
    else this.drawShadow(this.hero.x, this.hero.y - HERO_FOOT_OFFSET, surfaceBelow(this.hero.x, this.hero.y - HERO_FOOT_OFFSET))

    if (this.flowerFollowsHero) {
      const bob = Math.sin(time / 180) * 1.5
      this.carriedFlower
        .setPosition(this.hero.x + this.facing * 24, this.hero.y - 38 * this.squash + bob)
        .setAngle(this.facing * 12 + Math.sin(time / 260) * 4)
        .setFlipX(this.facing < 0)
    }

    const targetLookAhead = this.deliveryStarted ? 0 : this.facing * Math.min(220, camera.width / camera.zoom * 0.16)
    this.lookAhead += (targetLookAhead - this.lookAhead) * 0.04
    camera.setFollowOffset(-this.lookAhead, 0)
  }

  private drawHero(time: number) {
    const state = this.state
    if (state.vx > 0.3) this.facing = 1
    else if (state.vx < -0.3) this.facing = -1

    const running = state.grounded && Math.abs(state.vx) > 0.5
    if (running) this.runPhase += Math.abs(state.vx) * 0.075
    const bob = running ? Math.abs(Math.sin(this.runPhase)) * 4 : 0
    this.squash += (1 - this.squash) * 0.2
    const squashY = this.squash
    const airStretch = state.grounded ? 1 : 1 + Math.min(0.08, Math.abs(state.vy) * 0.006)

    const x = state.x + PLAYER_WIDTH / 2
    const y = state.y + HERO_FOOT_OFFSET - bob
    this.hero
      .setPosition(x, y)
      .setFlipX(this.facing < 0)
      .setScale(this.heroScaleX / Math.sqrt(squashY * airStretch), this.heroScaleY * squashY * airStretch)
    this.hero.angle = state.grounded
      ? (running ? this.facing * (2 + Math.sin(this.runPhase * 2) * 2) : Math.sin(time / 600) * 1.2)
      : this.facing * Phaser.Math.Clamp(state.vy * 0.5, -6, 8)

    if (state.invulnerableFrames > 0 && state.status === 'playing') {
      this.hero.setAlpha(Math.floor(time / 80) % 2 === 0 ? 0.35 : 1)
    } else if (state.status === 'playing') {
      this.hero.setAlpha(1)
    }

    if (running && Math.floor(this.runPhase / Math.PI) !== Math.floor((this.runPhase - Math.abs(state.vx) * 0.075) / Math.PI)) {
      this.dust.explode(2, x - this.facing * 14, state.y + 2)
    }

    this.drawShadow(x, state.y, surfaceBelow(x, state.y))
  }

  private drawShadow(x: number, feetY: number, surfaceTop: number | null) {
    if (surfaceTop === null) {
      this.heroShadow.setVisible(false)
      return
    }
    const height = Math.max(0, surfaceTop - feetY)
    const fade = 1 - Math.min(1, height / 260)
    this.heroShadow
      .setVisible(true)
      .setPosition(x, surfaceTop + 4)
      .setDisplaySize(58 * (0.5 + fade * 0.5), 14 * (0.5 + fade * 0.5))
      .setAlpha(0.45 * fade + 0.1)
  }

  private crossfadeBiome(index: number) {
    BIOMES.forEach((_, i) => {
      const visible = i === index
      this.tweens.add({ targets: this.skies[i], alpha: visible ? 1 : 0, duration: 1100, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: this.farHills[i], alpha: visible ? 0.75 : 0, duration: 1100, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: this.nearHills[i], alpha: visible ? 1 : 0, duration: 1100, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: this.foregrounds[i], alpha: visible ? 0.92 : 0, duration: 1100, ease: 'Sine.easeInOut' })
    })
    const biome = BIOMES[index]
    this.ambient.setParticleTint(biome.ambient)
    // Petals drift through the meadow and the castle gardens; fireflies glow in the forest.
    const forest = index === 1
    this.ambient.setTexture(forest ? 'fq-dot' : 'fq-petal')
    this.ambient.setBlendMode(forest ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
    for (const cloud of this.clouds) cloud.image.setTint(biome.cloud)
    for (const ray of this.rays) ray.setTint(biome.ray)
  }

  private floatText(x: number, y: number, text: string, color: string, size = 24) {
    const label = this.add.text(x, y, text, {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      fontSize: `${size}px`,
      fontStyle: '800',
      color: '#ffffff',
      stroke: color,
      strokeThickness: Math.round(size / 4),
    })
      .setOrigin(0.5)
      .setDepth(10)
      .setResolution(Math.max(1, Math.ceil(this.cameras.main.zoom)))
      .setScale(0.6)
    this.tweens.add({ targets: label, scale: 1, duration: 140, ease: 'Back.easeOut' })
    this.tweens.add({
      targets: label,
      y: y - 46,
      alpha: 0,
      delay: 220,
      duration: 650,
      ease: 'Sine.easeIn',
      onComplete: () => label.destroy(),
    })
  }

  private activateFlag(index: number) {
    const flag = this.flags[index]
    if (!flag || flag.active) return
    flag.active = true
    flag.pennant.setFillStyle(0xdf8c8d)
    flag.glow.setVisible(true)
    const x = CHECKPOINTS[index] + PLAYER_WIDTH / 2
    this.sparkles.explode(14, x, GROUND_Y - 90)
    this.floatText(x, GROUND_Y - 124, 'Checkpoint', '#78a875', 22)
  }

  private drawPits() {
    const pits = this.add.graphics().setDepth(0.5)
    for (let i = 0; i < GROUND.length - 1; i += 1) {
      const start = GROUND[i].end
      const width = GROUND[i + 1].start - start
      pits.fillStyle(0x4a3632, 1)
      pits.fillRect(start, GROUND_Y + 14, width, GAME_HEIGHT + 1400)
      pits.fillStyle(0x2e2226, 1)
      pits.fillRect(start + 10, GROUND_Y + 40, width - 20, GAME_HEIGHT + 1400)
      pits.fillStyle(0x1f171b, 1)
      pits.fillRect(start + 22, GROUND_Y + 90, width - 44, GAME_HEIGHT + 1400)
    }
  }

  private drawCheckpoints() {
    this.flags = CHECKPOINTS.map(checkpoint => {
      const x = checkpoint + PLAYER_WIDTH / 2
      this.add.rectangle(x, GROUND_Y + 6, 5, 104, 0x8a7563).setOrigin(0.5, 1).setDepth(2)
      const glow = this.add.image(x, GROUND_Y - 100, 'fq-glow').setDisplaySize(84, 84).setDepth(2.05).setVisible(false)
      this.add.circle(x, GROUND_Y - 100, 6, 0xe8bd67).setDepth(2.1)
      const pennant = this.add.triangle(x + 2, GROUND_Y - 84, 0, 0, 46, 13, 0, 26, 0xcfc6d6)
        .setOrigin(0, 0.5)
        .setDepth(2)
      return { pennant, glow, active: false }
    })
  }

  private drawFinish() {
    const centerX = LEVEL_END + PLAYER_WIDTH / 2
    const halfWidth = 96
    const archTop = GROUND_Y - 196
    const arch = this.add.graphics().setDepth(2)
    arch.fillStyle(0x6f8f62, 1)
    arch.fillRoundedRect(centerX - halfWidth - 9, archTop + 60, 18, GROUND_Y - archTop - 54, 8)
    arch.fillRoundedRect(centerX + halfWidth - 9, archTop + 60, 18, GROUND_Y - archTop - 54, 8)
    arch.lineStyle(16, 0x78ad7c, 1)
    arch.beginPath()
    arch.arc(centerX, archTop + 66, halfWidth, Math.PI, 0, false)
    arch.strokePath()
    arch.lineStyle(6, 0xa9d492, 1)
    arch.beginPath()
    arch.arc(centerX, archTop + 66, halfWidth - 2, Math.PI * 1.05, Math.PI * 1.95, false)
    arch.strokePath()
    for (let i = 0; i <= 8; i += 1) {
      const angle = Math.PI + (Math.PI * i) / 8
      this.add.image(
        centerX + Math.cos(angle) * halfWidth,
        archTop + 66 + Math.sin(angle) * halfWidth,
        'quest-flower'
      ).setDisplaySize(26, 32).setDepth(2.2).setAngle((i - 4) * 12)
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        this.add.image(centerX + side * halfWidth, archTop + 98 + i * 46, 'quest-flower')
          .setDisplaySize(20, 25)
          .setDepth(2.2)
          .setAngle(side * 10)
      }
    }
    const carpet = this.add.graphics().setDepth(1.4)
    carpet.fillStyle(0xd98b9a, 0.9)
    carpet.fillRoundedRect(centerX - 30, GROUND_Y - 6, QUEEN_X - centerX + 50, 12, 6)

    // The Queen's own flower bed beyond the finish.
    const random = new Phaser.Math.RandomDataGenerator(['queen-garden'])
    for (let x = QUEEN_X + 110; x < GROUND_RIGHT - 40; x += random.between(70, 140)) {
      this.add.image(x, GROUND_Y + 4, 'quest-flower')
        .setOrigin(0.5, 1)
        .setDisplaySize(30, 37)
        .setDepth(1.5)
        .setAngle(random.between(-8, 8))
    }
    for (let x = QUEEN_X + 220; x < GROUND_RIGHT - 80; x += random.between(260, 420)) {
      this.add.image(x, GROUND_Y + 8, 'fq-rosebush').setOrigin(0.5, 1).setDisplaySize(72, 52).setDepth(1.45)
    }
  }

  private makeTextures() {
    const canvasTexture = (key: string, width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) => {
      if (this.textures.exists(key)) return
      const texture = this.textures.createCanvas(key, width, height)
      if (!texture) return
      draw(texture.getContext())
      texture.refresh()
    }

    canvasTexture('fq-dot', 16, 16, context => {
      const gradient = context.createRadialGradient(8, 8, 0, 8, 8, 8)
      gradient.addColorStop(0, 'rgba(255,255,255,1)')
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.8)')
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, 16, 16)
    })
    canvasTexture('fq-glow', 64, 64, context => {
      const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
      gradient.addColorStop(0, 'rgba(255,248,214,0.95)')
      gradient.addColorStop(0.45, 'rgba(255,230,240,0.45)')
      gradient.addColorStop(1, 'rgba(255,230,240,0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, 64, 64)
    })
    canvasTexture('fq-shadow', 64, 20, context => {
      const gradient = context.createRadialGradient(32, 10, 0, 32, 10, 32)
      gradient.addColorStop(0, 'rgba(45,38,52,0.75)')
      gradient.addColorStop(1, 'rgba(45,38,52,0)')
      context.setTransform(1, 0, 0, 0.32, 0, 6.8)
      context.fillStyle = gradient
      context.fillRect(0, -32, 64, 64)
    })
    canvasTexture('fq-petal', 14, 10, context => {
      context.fillStyle = '#ffffff'
      context.beginPath()
      context.ellipse(7, 5, 6.5, 3.6, 0.4, 0, Math.PI * 2)
      context.fill()
    })
    canvasTexture('fq-confetti', 10, 6, context => {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, 10, 6)
    })

    makeSceneryTextures(this)

    BIOMES.forEach((biome, index) => {
      this.makeHills(`fq-far-${index}`, biome.far, 'hill', index * 1.7, 150, 34)
      this.makeHills(`fq-near-${index}`, biome.near, biome.shape, index * 2.3 + 1, 210, 22)
    })
  }

  private makeHills(key: string, color: number, shape: string, seed: number, baseline: number, amplitude: number) {
    if (this.textures.exists(key)) return
    const width = 1024
    const height = 300
    const graphics = this.make.graphics({ x: 0, y: 0 }, false)
    const points: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(0, height)]
    for (let x = 0; x <= width; x += 8) {
      const t = (x / width) * Math.PI * 2
      const y = baseline + Math.sin(t * 2 + seed) * amplitude + Math.sin(t * 5 + seed * 2) * amplitude * 0.4
      points.push(new Phaser.Math.Vector2(x, y))
    }
    points.push(new Phaser.Math.Vector2(width, height))
    graphics.fillStyle(color, 1)
    graphics.fillPoints(points, true)

    const random = new Phaser.Math.RandomDataGenerator([key])
    const count = shape === 'tower' ? 4 : shape === 'pine' ? 14 : 9
    for (let i = 0; i < count; i += 1) {
      const x = (i + 0.5) * (width / count) + random.between(-20, 20)
      const t = (x / width) * Math.PI * 2
      const ground = baseline + Math.sin(t * 2 + seed) * amplitude + Math.sin(t * 5 + seed * 2) * amplitude * 0.4
      if (shape === 'bush') {
        const r = random.between(16, 28)
        graphics.fillCircle(x, ground + 4, r)
        graphics.fillCircle(x - r * 0.8, ground + 10, r * 0.7)
        graphics.fillCircle(x + r * 0.8, ground + 10, r * 0.75)
      } else if (shape === 'pine') {
        const h = random.between(60, 110)
        const w = h * 0.42
        graphics.fillTriangle(x - w, ground + 6, x + w, ground + 6, x, ground - h)
        graphics.fillTriangle(x - w * 0.8, ground - h * 0.35, x + w * 0.8, ground - h * 0.35, x, ground - h * 1.15)
        graphics.fillRect(x - 3, ground - 2, 6, 14)
      } else if (shape === 'tower') {
        const h = random.between(70, 120)
        const w = random.between(26, 38)
        graphics.fillRect(x - w / 2, ground - h, w, h + 10)
        for (let c = 0; c < 3; c += 1) graphics.fillRect(x - w / 2 + c * (w / 2.5), ground - h - 9, w / 5, 10)
        graphics.fillTriangle(x - w / 2 - 4, ground - h - 8, x + w / 2 + 4, ground - h - 8, x, ground - h - 44)
        graphics.fillRect(x + w / 2, ground - h * 0.45, 60, h * 0.45 + 10)
        for (let c = 0; c < 5; c += 1) graphics.fillRect(x + w / 2 + c * 13, ground - h * 0.45 - 7, 7, 8)
      }
    }
    graphics.generateTexture(key, width, height)
    graphics.destroy()
  }

  private layout() {
    const camera = this.cameras.main
    if (!camera || this.skies.length === 0) return
    const width = this.scale.width
    const height = this.scale.height
    const minViewWidth = width < height ? MIN_VIEW_WIDTH_PORTRAIT : MIN_VIEW_WIDTH
    const zoom = Math.min(height / MIN_VIEW_HEIGHT, width / minViewWidth, 1.3 * this.pixelRatio)
    camera.setViewport(0, 0, width, height)
    camera.setZoom(zoom)

    const viewWidth = width / zoom
    const viewHeight = height / zoom
    // Short screens crop sky from the top; tall (portrait) screens add sky above and soil below.
    this.viewTop = viewHeight >= GAME_HEIGHT
      ? -(viewHeight - GAME_HEIGHT) * 0.62
      : GAME_HEIGHT - viewHeight
    // Wide enough that the delivery scene at the Queen can sit in the middle of the screen.
    const worldRight = Math.min(GROUND_RIGHT, Math.max(LEVEL_END + 280, QUEEN_X + viewWidth / 2 + 40))
    camera.setBounds(0, this.viewTop, worldRight, viewHeight)

    // Objects with a zero scroll factor live in "screen" space around the viewport centre.
    const scrollY = this.viewTop + viewHeight / 2 - height / 2
    const screenTop = height / 2 - viewHeight / 2
    const horizon = GROUND_Y + 60 - scrollY
    const skyHeight = horizon - screenTop
    for (const sky of this.skies) {
      const scale = Math.max(viewWidth / sky.width, skyHeight / sky.height)
      sky.setPosition(width / 2, horizon).setScale(scale)
    }
    for (const hills of [...this.farHills, ...this.nearHills]) {
      hills.setPosition(width / 2, GROUND_Y + 20)
      hills.setSize(viewWidth + 8, 300)
      hills.updateDisplayOrigin()
    }
    this.ambientZone.setTo(width / 2 - viewWidth / 2, screenTop - 20, viewWidth + 80, skyHeight * 0.9)
    this.screenArea = { left: width / 2 - viewWidth / 2, top: screenTop, width: viewWidth, skyHeight }
    this.rays.forEach((ray, index) => {
      ray.setPosition(width / 2 - viewWidth / 2 + viewWidth * [0.14, 0.36, 0.6, 0.83][index], screenTop - 40)
      ray.setDisplaySize(90 + index * 14, skyHeight * 1.3)
    })
    for (const fore of this.foregrounds) {
      fore.setPosition(width / 2, this.viewTop + viewHeight + 4)
      fore.setSize(viewWidth + 8, 130)
      fore.updateDisplayOrigin()
    }
  }
}

export default function GameStage({
  paused,
  runKey,
  controls,
  onSnapshot,
  onVictory,
  onGameOver,
  onPause,
  onLoadError,
  onLoadProgress,
  onEvent,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const runKeyRef = useRef(runKey)
  const callbacksRef = useRef<GameCallbacks>({
    onSnapshot,
    onVictory,
    onGameOver,
    onPause,
    onLoadError,
    onLoadProgress,
    onEvent,
  })

  callbacksRef.current = {
    onSnapshot,
    onVictory,
    onGameOver,
    onPause,
    onLoadError,
    onLoadProgress,
    onEvent,
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const measure = () => [
      Math.max(1, Math.round(host.clientWidth * pixelRatio)),
      Math.max(1, Math.round(host.clientHeight * pixelRatio)),
    ] as const
    const [width, height] = measure()

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width,
      height,
      parent: host,
      backgroundColor: '#cfe3e8',
      banner: false,
      antialias: true,
      render: { pixelArt: false, roundPixels: false, powerPreference: 'low-power' },
      // The page owns the AudioContext so it can be unlocked inside the tap that starts a run.
      audio: { noAudio: true },
      // Animations and particles also follow real frame time from the first frame (see update()).
      fps: { smoothStep: false },
      // Controls are HTML buttons, so Phaser does not need its own input listeners.
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      scale: { mode: Phaser.Scale.NONE },
      scene: [new QuestScene(callbacksRef, controls, pixelRatio)],
    })
    gameRef.current = game

    const observer = new ResizeObserver(() => {
      if (!game.isBooted) return
      const [nextWidth, nextHeight] = measure()
      if (nextWidth !== game.scale.width || nextHeight !== game.scale.height) game.scale.resize(nextWidth, nextHeight)
    })
    observer.observe(host)
    game.events.once(Phaser.Core.Events.READY, () => {
      const [nextWidth, nextHeight] = measure()
      if (nextWidth !== game.scale.width || nextHeight !== game.scale.height) game.scale.resize(nextWidth, nextHeight)
    })

    const releaseControls = () => {
      controls.current.held = 0
      controls.current.jumpQueued = false
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        releaseControls()
        callbacksRef.current.onPause()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', releaseControls)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', releaseControls)
      game.destroy(true)
      gameRef.current = null
    }
  }, [controls])

  useEffect(() => {
    if (runKeyRef.current === runKey) return
    runKeyRef.current = runKey
    const scene = gameRef.current?.scene.getScene(SCENE_KEY)
    scene?.scene.restart()
  }, [runKey])

  useEffect(() => {
    const game = gameRef.current
    if (!game) return
    if (paused) game.scene.pause(SCENE_KEY)
    else game.scene.resume(SCENE_KEY)
  }, [paused])

  return <div ref={hostRef} className="flower-quest-canvas" />
}
