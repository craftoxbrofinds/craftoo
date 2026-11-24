export const GAME_VERSION = 'flower-quest-v3'
export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 720
export const LEVEL_END = 10800
export const MAX_RUN_FRAMES = 60 * 120
export const PLAYER_WIDTH = 48
export const PLAYER_HEIGHT = 68
export const GROUND_Y = 570

export const Input = {
  left: 1,
  right: 2,
  jump: 4,
} as const

export type GameInput = number
export type RunStatus = 'playing' | 'game-over' | 'won'

export type GameState = {
  tick: number
  x: number
  y: number
  vx: number
  vy: number
  grounded: boolean
  coyoteFrames: number
  jumpBufferFrames: number
  previousInput: number
  invulnerableFrames: number
  lives: number
  score: number
  flowers: boolean[]
  coins: boolean[]
  sections: boolean[]
  checkpointX: number
  status: RunStatus
}

export type Segment = { start: number; end: number; top: number }
export type Collectible = { x: number; y: number }
export type Enemy = { start: number; end: number; y: number; period: number }

export const GROUND: Segment[] = [
  { start: 0, end: 1120, top: GROUND_Y },
  { start: 1200, end: 2480, top: GROUND_Y },
  { start: 2570, end: 3920, top: GROUND_Y },
  { start: 4010, end: 5320, top: GROUND_Y },
  { start: 5410, end: 6740, top: GROUND_Y },
  { start: 6830, end: 8160, top: GROUND_Y },
  { start: 8250, end: 9560, top: GROUND_Y },
  { start: 9650, end: LEVEL_END + 200, top: GROUND_Y },
]

export const PLATFORMS: Segment[] = [
  { start: 450, end: 740, top: 455 },
  { start: 1440, end: 1740, top: 455 },
  { start: 2860, end: 3180, top: 455 },
  { start: 4300, end: 4610, top: 455 },
  { start: 5740, end: 6060, top: 455 },
  { start: 7180, end: 7500, top: 455 },
  { start: 8600, end: 8920, top: 455 },
  { start: 10000, end: 10340, top: 455 },
]

export const FLOWERS: Collectible[] = [
  { x: 550, y: 410 }, { x: 900, y: 500 }, { x: 1560, y: 410 },
  { x: 1880, y: 500 }, { x: 2980, y: 410 }, { x: 3430, y: 500 },
  { x: 4440, y: 410 }, { x: 4880, y: 500 }, { x: 5880, y: 410 },
  { x: 6300, y: 500 }, { x: 7320, y: 410 }, { x: 7760, y: 500 },
  { x: 8740, y: 410 }, { x: 9160, y: 500 }, { x: 10170, y: 410 },
]

export const COINS: Collectible[] = [
  { x: 370, y: 510 }, { x: 680, y: 405 }, { x: 1040, y: 505 },
  { x: 1370, y: 510 }, { x: 1670, y: 405 }, { x: 2220, y: 505 },
  { x: 2740, y: 510 }, { x: 3060, y: 405 }, { x: 3650, y: 505 },
  { x: 4180, y: 510 }, { x: 4520, y: 405 }, { x: 5080, y: 505 },
  { x: 5600, y: 510 }, { x: 5920, y: 405 }, { x: 6510, y: 505 },
  { x: 7020, y: 510 }, { x: 7350, y: 405 }, { x: 7950, y: 505 },
  { x: 8430, y: 510 }, { x: 8760, y: 405 }, { x: 9350, y: 505 },
  { x: 9850, y: 510 }, { x: 10170, y: 405 }, { x: 10520, y: 505 },
]

export const THORNS = [
  { x: 1000, y: GROUND_Y - 10 },
  { x: 2050, y: GROUND_Y - 10 },
  { x: 3500, y: GROUND_Y - 10 },
  { x: 4780, y: GROUND_Y - 10 },
  { x: 6200, y: GROUND_Y - 10 },
  { x: 7620, y: GROUND_Y - 10 },
  { x: 9040, y: GROUND_Y - 10 },
  // Room to land after the last rock, and room to land again before the finish.
  { x: 10560, y: GROUND_Y - 10 },
]

export const ENEMIES: Enemy[] = [
  { start: 1780, end: 1960, y: GROUND_Y, period: 150 },
  { start: 3220, end: 3440, y: GROUND_Y, period: 180 },
  { start: 4650, end: 4860, y: GROUND_Y, period: 160 },
  { start: 6100, end: 6320, y: GROUND_Y, period: 190 },
  { start: 7540, end: 7760, y: GROUND_Y, period: 170 },
  { start: 8990, end: 9210, y: GROUND_Y, period: 180 },
]

export const SECTION_MARKERS = [3600, 7200, 10500]
// Respawn points. Each must sit on open ground, clear of hazards and raised platforms.
export const CHECKPOINTS = [3600, 7050]
const SURFACES = [...PLATFORMS, ...GROUND]
// Raised platforms are solid down to the ground; ground segments are solid all the way down,
// so a player who drops into a gap cannot slide sideways through the next segment.
const SOLIDS = [
  ...PLATFORMS.map(platform => ({ ...platform, bottom: GROUND_Y })),
  ...GROUND.map(segment => ({ ...segment, bottom: Number.POSITIVE_INFINITY })),
]
const GRAVITY = 0.48
const MAX_SPEED = 4.5
const ACCELERATION = 0.42
const FRICTION = 0.78
export const JUMP_SPEED = -12.4
const JUMP_BUFFER = 9
const COYOTE_TIME = 8
const INVULNERABILITY_TIME = 75

export function createGameState(): GameState {
  return {
    tick: 0,
    x: 100,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    grounded: true,
    coyoteFrames: COYOTE_TIME,
    jumpBufferFrames: 0,
    previousInput: 0,
    invulnerableFrames: 0,
    lives: 3,
    score: 0,
    flowers: FLOWERS.map(() => false),
    coins: COINS.map(() => false),
    sections: SECTION_MARKERS.map(() => false),
    checkpointX: 100,
    status: 'playing',
  }
}

export function enemyPosition(enemy: Enemy, tick: number): number {
  const period = Math.max(2, Math.floor(enemy.period))
  const phase = tick % period
  const half = period / 2
  const progress = phase <= half ? phase / half : (period - phase) / half
  return enemy.start + (enemy.end - enemy.start) * progress
}

function overlapsPlayer(state: GameState, x: number, y: number, width: number, height: number): boolean {
  return state.x < x + width &&
    state.x + PLAYER_WIDTH > x &&
    state.y - PLAYER_HEIGHT < y + height &&
    state.y > y
}

function respawn(state: GameState): void {
  if (state.status !== 'playing') return
  state.lives -= 1
  if (state.lives <= 0) {
    state.status = 'game-over'
    return
  }

  state.x = state.checkpointX
  state.y = GROUND_Y
  state.vx = 0
  state.vy = 0
  state.grounded = true
  state.coyoteFrames = COYOTE_TIME
  state.invulnerableFrames = INVULNERABILITY_TIME
}

export function stepGame(state: GameState, input: GameInput): GameState {
  if (state.status !== 'playing') return state

  state.tick += 1
  const pressedJump = (input & Input.jump) !== 0 && (state.previousInput & Input.jump) === 0
  if (pressedJump) state.jumpBufferFrames = JUMP_BUFFER
  else state.jumpBufferFrames = Math.max(0, state.jumpBufferFrames - 1)

  const direction = ((input & Input.right) !== 0 ? 1 : 0) - ((input & Input.left) !== 0 ? 1 : 0)
  if (direction !== 0) {
    state.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, state.vx + direction * ACCELERATION))
  } else {
    state.vx *= FRICTION
    if (Math.abs(state.vx) < 0.08) state.vx = 0
  }

  if (state.grounded) state.coyoteFrames = COYOTE_TIME
  else state.coyoteFrames = Math.max(0, state.coyoteFrames - 1)

  if (state.jumpBufferFrames > 0 && state.coyoteFrames > 0) {
    state.vy = JUMP_SPEED
    state.grounded = false
    state.coyoteFrames = 0
    state.jumpBufferFrames = 0
  }

  const previousX = state.x
  const previousBottom = state.y
  state.x = Math.max(0, Math.min(LEVEL_END, state.x + state.vx))
  state.vy = Math.min(15, state.vy + GRAVITY)
  state.y += state.vy
  state.grounded = false

  // Land first, so a jump that reaches a ledge's top corner settles onto it instead of being
  // pushed back off the side.
  if (state.vy >= 0) {
    for (const surface of SURFACES) {
      const overlapsX = state.x + PLAYER_WIDTH > surface.start && state.x < surface.end
      if (overlapsX && previousBottom <= surface.top && state.y >= surface.top) {
        state.y = surface.top
        state.vy = 0
        state.grounded = true
        break
      }
    }
  }

  for (const solid of SOLIDS) {
    const overlapsHeight = state.y > solid.top && state.y - PLAYER_HEIGHT < solid.bottom
    if (!overlapsHeight) continue

    if (previousX + PLAYER_WIDTH <= solid.start && state.x + PLAYER_WIDTH > solid.start) {
      state.x = solid.start - PLAYER_WIDTH
      state.vx = 0
    } else if (previousX >= solid.end && state.x < solid.end) {
      state.x = solid.end
      state.vx = 0
    }
  }

  for (const checkpoint of CHECKPOINTS) {
    if (state.x >= checkpoint && state.checkpointX < checkpoint) state.checkpointX = checkpoint
  }

  for (let i = 0; i < FLOWERS.length; i += 1) {
    if (!state.flowers[i] && overlapsPlayer(state, FLOWERS[i].x - 16, FLOWERS[i].y - 18, 32, 36)) {
      state.flowers[i] = true
      state.score += 10
    }
  }

  for (let i = 0; i < COINS.length; i += 1) {
    if (!state.coins[i] && overlapsPlayer(state, COINS[i].x - 13, COINS[i].y - 13, 26, 26)) {
      state.coins[i] = true
      state.score += 5
    }
  }

  for (let i = 0; i < SECTION_MARKERS.length; i += 1) {
    if (!state.sections[i] && state.x >= SECTION_MARKERS[i]) {
      state.sections[i] = true
      state.score += 50
    }
  }

  if (state.invulnerableFrames > 0) state.invulnerableFrames -= 1
  else {
    const hitThorn = THORNS.some(thorn => overlapsPlayer(state, thorn.x - 26, thorn.y - 28, 52, 48))
    const hitEnemy = ENEMIES.some(enemy => {
      const x = enemyPosition(enemy, state.tick)
      return overlapsPlayer(state, x - 27, enemy.y - 54, 54, 54)
    })
    if (hitThorn || hitEnemy) respawn(state)
  }

  if (state.y > GAME_HEIGHT + 80) respawn(state)

  if (state.x >= LEVEL_END && state.status === 'playing') {
    state.score += 100 + Math.max(0, 60 - Math.floor(state.tick / 60)) + state.lives * 20
    state.status = 'won'
  }

  if (state.tick >= MAX_RUN_FRAMES && state.status === 'playing') {
    state.status = 'game-over'
  }

  state.previousInput = input
  return state
}

export function replayInputs(encoded: number[]): GameState {
  if (!Array.isArray(encoded) || encoded.length === 0 || encoded.length % 2 !== 0) {
    throw new Error('Invalid replay format')
  }

  const state = createGameState()
  let totalFrames = 0
  for (let i = 0; i < encoded.length; i += 2) {
    const input = encoded[i]
    const frames = encoded[i + 1]
    if (!Number.isInteger(input) || input < 0 || input > (Input.left | Input.right | Input.jump)) {
      throw new Error('Invalid replay input')
    }
    if (!Number.isInteger(frames) || frames < 1 || frames > MAX_RUN_FRAMES) {
      throw new Error('Invalid replay duration')
    }

    totalFrames += frames
    if (totalFrames > MAX_RUN_FRAMES) throw new Error('Replay exceeds the time limit')
    for (let frame = 0; frame < frames && state.status === 'playing'; frame += 1) {
      stepGame(state, input)
    }
  }

  if (state.status !== 'playing' && totalFrames !== state.tick) {
    throw new Error('Replay contains inputs after the game ended')
  }

  return state
}

export function encodeInputs(inputs: number[]): number[] {
  const encoded: number[] = []
  for (const input of inputs) {
    const last = encoded.length - 2
    if (last >= 0 && encoded[last] === input) encoded[last + 1] += 1
    else encoded.push(input, 1)
  }
  return encoded
}

export function rewardPercent(score: number): number {
  if (score > 350) return 15
  if (score >= 201) return 10
  return 5
}
