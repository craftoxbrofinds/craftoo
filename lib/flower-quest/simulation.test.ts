import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CHECKPOINTS,
  ENEMIES,
  GROUND,
  Input,
  GROUND_Y,
  LEVEL_END,
  MAX_RUN_FRAMES,
  PLAYER_WIDTH,
  PLATFORMS,
  PLAYER_HEIGHT,
  THORNS,
  createGameState,
  encodeInputs,
  replayInputs,
  rewardPercent,
  stepGame,
  type GameState,
} from './simulation'

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

test('encoded input replay reproduces the same deterministic state', () => {
  const inputs = Array.from({ length: 120 }, (_, frame) =>
    Input.right | (frame % 36 < 2 ? Input.jump : 0),
  )
  const expected = inputs.reduce((state, input) => stepGame(state, input), createGameState())

  assert.deepEqual(replayInputs(encodeInputs(inputs)), expected)
})

test('collectibles score once and hazard hits consume a life', () => {
  const state = createGameState()
  state.x = 540
  state.y = 432

  stepGame(state, 0)
  stepGame(state, 0)
  assert.equal(state.score, 10)

  state.x = 972
  state.y = 570
  stepGame(state, 0)
  assert.equal(state.lives, 2)
  assert.equal(state.x, state.checkpointX)
})

test('raised platforms block walking, but can be cleared with a jump', () => {
  const platform = PLATFORMS[0]
  const state = createGameState()
  state.x = platform.start - PLAYER_WIDTH - 10

  for (let frame = 0; frame < 30; frame += 1) stepGame(state, Input.right)
  assert.equal(state.x, platform.start - PLAYER_WIDTH)
  assert.equal(state.y, GROUND_Y)

  stepGame(state, Input.right | Input.jump)
  for (let frame = 0; frame < 24; frame += 1) stepGame(state, Input.right)
  assert.ok(state.x > platform.start - PLAYER_WIDTH)
})

test('a no-jump replay cannot walk through the first raised platform to win', () => {
  const state = replayInputs([Input.right, MAX_RUN_FRAMES])

  assert.equal(state.status, 'game-over')
  assert.equal(state.x, PLATFORMS[0].start - PLAYER_WIDTH)
  assert.ok(state.x < LEVEL_END)
})

test('jump input launches the player and invalid replay masks are rejected', () => {
  const state = stepGame(createGameState(), Input.jump)

  assert.ok(state.vy < 0)
  assert.ok(state.y < 570)
  assert.throws(() => replayInputs([8, 1]), /Invalid replay input/)
})

test('reward tiers match score boundaries', () => {
  assert.equal(rewardPercent(200), 5)
  assert.equal(rewardPercent(201), 10)
  assert.equal(rewardPercent(350), 10)
  assert.equal(rewardPercent(351), 15)
})

test('every checkpoint respawns the player on open ground, clear of thorns and platforms', () => {
  for (const checkpoint of CHECKPOINTS) {
    const top = GROUND_Y - PLAYER_HEIGHT
    const onGround = GROUND.some(segment => checkpoint >= segment.start && checkpoint + PLAYER_WIDTH <= segment.end)
    assert.ok(onGround, `checkpoint ${checkpoint} is over a gap`)
    for (const thorn of THORNS) {
      assert.ok(!overlaps(checkpoint, top, PLAYER_WIDTH, PLAYER_HEIGHT, thorn.x - 26, thorn.y - 28, 52, 48),
        `checkpoint ${checkpoint} overlaps the thorn at ${thorn.x}`)
    }
    for (const platform of PLATFORMS) {
      assert.ok(checkpoint + PLAYER_WIDTH <= platform.start || checkpoint >= platform.end,
        `checkpoint ${checkpoint} is inside the platform at ${platform.start}`)
    }
    for (const enemy of ENEMIES) {
      assert.ok(checkpoint + PLAYER_WIDTH <= enemy.start - 27 || checkpoint >= enemy.end + 27,
        `checkpoint ${checkpoint} is on the patrol at ${enemy.start}`)
    }
  }
})

test('thorns and moth patrols sit on open ground, never inside a raised platform or over a gap', () => {
  // Half-widths of the drawn sprites, so the artwork never clips into the rock either.
  const mothHalf = 30
  const thornHalf = 34
  const onGround = (left: number, right: number) => GROUND.some(segment => left >= segment.start && right <= segment.end)
  const hitsPlatform = (left: number, right: number) => PLATFORMS.some(platform => left < platform.end && right > platform.start)

  for (const thorn of THORNS) {
    assert.ok(onGround(thorn.x - thornHalf, thorn.x + thornHalf), `thorn at ${thorn.x} hangs over a gap`)
    assert.ok(!hitsPlatform(thorn.x - thornHalf, thorn.x + thornHalf), `thorn at ${thorn.x} is inside a platform`)
  }
  for (const enemy of ENEMIES) {
    assert.ok(onGround(enemy.start - mothHalf, enemy.end + mothHalf), `moth ${enemy.start}-${enemy.end} patrols over a gap`)
    assert.ok(!hitsPlatform(enemy.start - mothHalf, enemy.end + mothHalf), `moth ${enemy.start}-${enemy.end} patrols inside a platform`)
  }
})

test('respawning after a hit at a checkpoint does not land the player on a hazard', () => {
  const state = createGameState()
  state.x = CHECKPOINTS[0] + 1
  stepGame(state, 0)
  assert.equal(state.checkpointX, CHECKPOINTS[0])

  // Stand still through the whole invulnerability window: no further life should be lost.
  state.invulnerableFrames = 0
  state.lives = 3
  for (let frame = 0; frame < 120; frame += 1) stepGame(state, 0)
  assert.equal(state.lives, 3)
})

test('a player who drops into a gap cannot walk through the side of the next ground segment', () => {
  const gapStart = GROUND[0].end
  const nextStart = GROUND[1].start
  const state = createGameState()
  state.x = gapStart + 4
  state.y = GROUND_Y + 30
  state.vx = 4.5
  state.grounded = false
  for (let frame = 0; frame < 20; frame += 1) {
    stepGame(state, Input.right)
    if (state.y > GROUND_Y) assert.ok(state.x + PLAYER_WIDTH <= nextStart, `x ${state.x} entered the ground block`)
  }
})

test('a run that ends in game over cannot also be marked as won', () => {
  const state = createGameState()
  state.x = LEVEL_END - 2
  state.vx = 4.5
  state.lives = 1
  state.y = 900
  state.grounded = false
  stepGame(state, Input.right)
  assert.equal(state.x, LEVEL_END)
  assert.equal(state.status, 'game-over')
})

test('the level can be completed, and the winning replay verifies on the server', () => {
  const B = 8
  const actions = [
    Array<number>(B).fill(Input.right),
    Array<number>(B).fill(Input.right | Input.jump),
    Array<number>(B).fill(0),
    Array<number>(B).fill(Input.left),
  ]
  const advance = (state: GameState, block: number[]) => {
    const next = structuredClone(state)
    for (const input of block) stepGame(next, input)
    return next
  }
  const value = (state: GameState, depth: number, lives: number): number => {
    if (state.status === 'won') return Number.POSITIVE_INFINITY
    if (state.status !== 'playing' || state.lives < lives) return -1
    if (depth === 0) return state.x
    return Math.max(...actions.map(block => value(advance(state, block), depth - 1, lives)))
  }

  const state = createGameState()
  const inputs: number[] = []
  while (state.status === 'playing') {
    let chosen = actions[0]
    let best = -2
    for (const block of actions) {
      const score = value(advance(state, block), 3, state.lives)
      if (score > best) { best = score; chosen = block }
    }
    for (const input of chosen) {
      if (state.status !== 'playing') break
      inputs.push(input)
      stepGame(state, input)
    }
  }

  assert.equal(state.status, 'won')
  const verified = replayInputs(encodeInputs(inputs))
  assert.equal(verified.status, 'won')
  assert.equal(verified.score, state.score)
})
