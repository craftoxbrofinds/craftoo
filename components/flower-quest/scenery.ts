import * as Phaser from 'phaser'
import {
  CHECKPOINTS,
  GAME_HEIGHT,
  GROUND,
  LEVEL_END,
  PLATFORMS,
  PLAYER_WIDTH,
  SECTION_MARKERS,
  THORNS,
} from '@/lib/flower-quest/simulation'

/**
 * Procedural scenery for the Flower Quest: per-biome ground textures, ledge edges, ground
 * decorations, clouds, light rays and the foreground grass. Everything is drawn once into
 * textures at scene start, so nothing here costs per-frame work beyond moving sprites.
 */

type Terrain = {
  grassLight: string
  grass: string
  grassDark: string
  soilTop: string
  soilBottom: string
  speck: string
  stone: string
  stoneLight: string
  edge: number
  vine: number
  leaf: number
  bricks?: { mortar: string; colors: string[] }
}

export const TERRAIN: Terrain[] = [
  {
    grassLight: '#c4e69e',
    grass: '#8cc47f',
    grassDark: '#679f6c',
    soilTop: '#a27c5f',
    soilBottom: '#735548',
    speck: '#d8b98f',
    stone: '#b69c86',
    stoneLight: '#d6c2ad',
    edge: 0x5c4338,
    vine: 0x5f9a63,
    leaf: 0x86c27a,
  },
  {
    grassLight: '#9ed08d',
    grass: '#5f9f73',
    grassDark: '#447f5c',
    soilTop: '#7e604d',
    soilBottom: '#4e3c34',
    speck: '#a88b70',
    stone: '#8f7d70',
    stoneLight: '#b3a294',
    edge: 0x3a2b25,
    vine: 0x3f7354,
    leaf: 0x6fae7a,
  },
  {
    grassLight: '#d2e6a8',
    grass: '#9cc58b',
    grassDark: '#7aa67b',
    soilTop: '#8f8199',
    soilBottom: '#6a5e78',
    speck: '#b8aac6',
    stone: '#a497b2',
    stoneLight: '#cbc0d6',
    edge: 0x4f4560,
    vine: 0x6f9a72,
    leaf: 0x9cc58b,
    bricks: { mortar: '#776b86', colors: ['#b3a6c4', '#a698b9', '#bdb1cc', '#9f92b3'] },
  },
]

export const SOIL_FILL = [0x735548, 0x4e3c34, 0x6a5e78]
const TILE_W = 256
export const TOP_TILE_H = 152
const TAU = Math.PI * 2

function random(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
) {
  if (scene.textures.exists(key)) return
  const texture = scene.textures.createCanvas(key, width, height)
  if (!texture) return
  draw(texture.getContext())
  texture.refresh()
}

/** `CanvasRenderingContext2D.roundRect` is missing before iOS 16, so build the path by hand. */
function roundRectPath(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  context.moveTo(x + r, y)
  context.arcTo(x + width, y, x + width, y + height, r)
  context.arcTo(x + width, y + height, x, y + height, r)
  context.arcTo(x, y + height, x, y, r)
  context.arcTo(x, y, x + width, y, r)
  context.closePath()
}

/** Draws a shape at x and, near the tile edges, again one tile over, so the texture tiles. */
function wrapped(x: number, reach: number, draw: (x: number) => void) {
  draw(x)
  if (x - reach < 0) draw(x + TILE_W)
  if (x + reach > TILE_W) draw(x - TILE_W)
}

export function biomeAt(x: number): number {
  if (x < SECTION_MARKERS[0]) return 0
  if (x < SECTION_MARKERS[1]) return 1
  return 2
}

// ---- Textures ----------------------------------------------------------------------------------

function drawGroundTile(context: CanvasRenderingContext2D, terrain: Terrain, seed: number) {
  const rand = random(seed)
  const top = (x: number) => 15 + 2.4 * Math.sin((x / TILE_W) * TAU * 4 + seed) + 1.3 * Math.sin((x / TILE_W) * TAU * 9 + seed * 2)
  const lower = (x: number) => 34 + 2.6 * Math.sin((x / TILE_W) * TAU * 3 + seed * 1.3)
  const height = TOP_TILE_H

  // Soil body.
  context.save()
  context.beginPath()
  context.moveTo(0, height - 1)
  for (let x = 0; x <= TILE_W; x += 4) context.lineTo(x, top(x) + 8)
  context.lineTo(TILE_W, height - 1)
  context.closePath()
  context.clip()
  if (terrain.bricks) {
    context.fillStyle = terrain.bricks.mortar
    context.fillRect(0, 0, TILE_W, height)
    const brickHeight = 22
    for (let row = 0; row * brickHeight < height; row += 1) {
      const y = 26 + row * brickHeight
      const offset = row % 2 === 0 ? 0 : 32
      for (let x = -64 + offset; x < TILE_W; x += 64) {
        context.fillStyle = terrain.bricks.colors[Math.floor(rand() * terrain.bricks.colors.length)]
        context.beginPath()
        roundRectPath(context, x + 2, y + 2, 60, brickHeight - 4, 5)
        context.fill()
        context.fillStyle = 'rgba(255,255,255,0.18)'
        context.fillRect(x + 6, y + 4, 50, 2)
      }
    }
    const shade = context.createLinearGradient(0, 30, 0, height)
    shade.addColorStop(0, 'rgba(40,30,55,0)')
    shade.addColorStop(1, 'rgba(40,30,55,0.35)')
    context.fillStyle = shade
    context.fillRect(0, 0, TILE_W, height)
  } else {
    const soil = context.createLinearGradient(0, 20, 0, 115)
    soil.addColorStop(0, terrain.soilTop)
    soil.addColorStop(1, terrain.soilBottom)
    context.fillStyle = soil
    context.fillRect(0, 0, TILE_W, height)

    for (let i = 0; i < 9; i += 1) {
      const x = rand() * TILE_W
      const y = 48 + rand() * 85
      const rx = 4 + rand() * 6
      const ry = 2.5 + rand() * 3
      wrapped(x, rx + 2, wx => {
        context.fillStyle = terrain.stone
        context.beginPath()
        context.ellipse(wx, y, rx, ry, 0, 0, TAU)
        context.fill()
        context.fillStyle = terrain.stoneLight
        context.beginPath()
        context.ellipse(wx - rx * 0.3, y - ry * 0.35, rx * 0.45, ry * 0.35, 0, 0, TAU)
        context.fill()
      })
    }
    context.globalAlpha = 0.55
    for (let i = 0; i < 46; i += 1) {
      const x = rand() * TILE_W
      const y = 42 + rand() * 100
      context.fillStyle = terrain.speck
      context.beginPath()
      context.arc(x, y, 0.8 + rand() * 1.2, 0, TAU)
      context.fill()
    }
    context.globalAlpha = 1
    // A few roots creeping down from the grass.
    context.strokeStyle = 'rgba(40,26,20,0.28)'
    context.lineCap = 'round'
    for (let i = 0; i < 4; i += 1) {
      const x = 20 + rand() * (TILE_W - 40)
      let y = 38
      context.lineWidth = 2.2
      context.beginPath()
      context.moveTo(x, y)
      let cx = x
      for (let s = 0; s < 4; s += 1) {
        cx += (rand() - 0.5) * 10
        y += 6 + rand() * 6
        context.lineTo(cx, y)
        context.lineWidth = Math.max(0.8, context.lineWidth - 0.4)
      }
      context.stroke()
    }
  }
  context.restore()

  // Shadow under the grass.
  context.fillStyle = 'rgba(30,20,20,0.22)'
  context.beginPath()
  context.moveTo(0, lower(0))
  for (let x = 0; x <= TILE_W; x += 4) context.lineTo(x, lower(x) + 7)
  for (let x = TILE_W; x >= 0; x -= 4) context.lineTo(x, lower(x) - 2)
  context.closePath()
  context.fill()

  // Grass band with a scalloped lower edge.
  const grass = context.createLinearGradient(0, 8, 0, 38)
  grass.addColorStop(0, terrain.grassLight)
  grass.addColorStop(0.45, terrain.grass)
  grass.addColorStop(1, terrain.grassDark)
  context.fillStyle = grass
  context.beginPath()
  context.moveTo(0, top(0))
  for (let x = 0; x <= TILE_W; x += 4) context.lineTo(x, top(x))
  for (let x = TILE_W; x >= 0; x -= 4) context.lineTo(x, lower(x))
  context.closePath()
  context.fill()
  for (let x = 4; x < TILE_W; x += 13 + rand() * 6) {
    const r = 4.5 + rand() * 3
    const cx = x
    wrapped(cx, r, wx => {
      context.fillStyle = terrain.grassDark
      context.beginPath()
      context.arc(wx, lower(wx) + 1, r, 0, TAU)
      context.fill()
    })
  }

  // Blades poking above the edge, and a light rim.
  for (let i = 0; i < 70; i += 1) {
    const x = rand() * TILE_W
    const base = top(x) + 4
    const bladeHeight = 4 + rand() * 7
    const lean = (rand() - 0.5) * 5
    context.fillStyle = rand() < 0.5 ? terrain.grass : terrain.grassLight
    wrapped(x, 4, wx => {
      context.beginPath()
      context.moveTo(wx - 1.8, base)
      context.lineTo(wx + 1.8, base)
      context.lineTo(wx + lean, base - bladeHeight)
      context.closePath()
      context.fill()
    })
  }
  context.strokeStyle = terrain.grassLight
  context.globalAlpha = 0.75
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(0, top(0) + 2)
  for (let x = 0; x <= TILE_W; x += 4) context.lineTo(x, top(x) + 2)
  context.stroke()
  context.globalAlpha = 1

  // Keep the first and last rows transparent so texture wrapping never bleeds a seam.
  context.clearRect(0, 0, TILE_W, 1)
  context.clearRect(0, height - 1, TILE_W, 1)
}

function drawDecor(scene: Phaser.Scene) {
  canvasTexture(scene, 'fq-daisy', 18, 24, context => {
    context.strokeStyle = '#5f9a63'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(9, 24)
    context.quadraticCurveTo(7, 16, 9, 9)
    context.stroke()
    context.fillStyle = '#ffffff'
    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * TAU
      context.beginPath()
      context.ellipse(9 + Math.cos(angle) * 4, 8 + Math.sin(angle) * 4, 3.2, 2, angle, 0, TAU)
      context.fill()
    }
    context.fillStyle = '#f3c74f'
    context.beginPath()
    context.arc(9, 8, 2.6, 0, TAU)
    context.fill()
  })
  canvasTexture(scene, 'fq-tulip', 14, 26, context => {
    context.strokeStyle = '#5f9a63'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(7, 26)
    context.lineTo(7, 11)
    context.stroke()
    context.fillStyle = '#7fb27f'
    context.beginPath()
    context.ellipse(4, 19, 2.5, 6, -0.5, 0, TAU)
    context.fill()
    context.fillStyle = '#e88aa9'
    context.beginPath()
    context.moveTo(1.5, 5)
    context.lineTo(4.5, 8)
    context.lineTo(7, 3)
    context.lineTo(9.5, 8)
    context.lineTo(12.5, 5)
    context.quadraticCurveTo(13, 13, 7, 13.5)
    context.quadraticCurveTo(1, 13, 1.5, 5)
    context.fill()
  })
  canvasTexture(scene, 'fq-mushroom', 20, 20, context => {
    context.fillStyle = '#f2e6d4'
    context.beginPath()
    roundRectPath(context, 7, 9, 6, 11, 3)
    context.fill()
    context.fillStyle = '#d8605f'
    context.beginPath()
    context.ellipse(10, 9, 9, 6.5, 0, Math.PI, 0)
    context.closePath()
    context.fill()
    context.fillStyle = '#ffffff'
    for (const [x, y, r] of [[6, 6, 1.6], [11, 4, 1.4], [14.5, 7.5, 1.2]]) {
      context.beginPath()
      context.arc(x, y, r, 0, TAU)
      context.fill()
    }
  })
  canvasTexture(scene, 'fq-pebble', 22, 12, context => {
    context.fillStyle = '#9d9089'
    context.beginPath()
    context.ellipse(11, 7, 10, 5, 0, 0, TAU)
    context.fill()
    context.fillStyle = '#c4b8b0'
    context.beginPath()
    context.ellipse(8, 5, 5, 2.2, -0.2, 0, TAU)
    context.fill()
  })
  canvasTexture(scene, 'fq-rosebush', 36, 26, context => {
    context.fillStyle = '#5f8f64'
    for (const [x, y, r] of [[9, 17, 8], [18, 12, 10], [28, 17, 8], [18, 20, 8]]) {
      context.beginPath()
      context.arc(x, y, r, 0, TAU)
      context.fill()
    }
    for (const [x, y] of [[10, 12], [20, 8], [27, 14], [16, 17]]) {
      context.fillStyle = '#e07a96'
      context.beginPath()
      context.arc(x, y, 3.4, 0, TAU)
      context.fill()
      context.fillStyle = '#f6b3c6'
      context.beginPath()
      context.arc(x - 0.8, y - 0.8, 1.5, 0, TAU)
      context.fill()
    }
  })
  canvasTexture(scene, 'fq-fern', 34, 26, context => {
    context.strokeStyle = '#3f7354'
    context.fillStyle = '#5c9a6d'
    context.lineWidth = 1.6
    for (const [angle, length] of [[-2.2, 18], [-1.75, 22], [-1.35, 22], [-0.95, 18]]) {
      const ex = 17 + Math.cos(angle) * length
      const ey = 26 + Math.sin(angle) * length
      context.beginPath()
      context.moveTo(17, 26)
      context.lineTo(ex, ey)
      context.stroke()
      for (let t = 0.3; t < 1; t += 0.17) {
        const px = 17 + (ex - 17) * t
        const py = 26 + (ey - 26) * t
        const size = 4.5 * (1.1 - t)
        context.beginPath()
        context.ellipse(px, py, size, size * 0.45, angle + 1.2, 0, TAU)
        context.fill()
        context.beginPath()
        context.ellipse(px, py, size, size * 0.45, angle - 1.2, 0, TAU)
        context.fill()
      }
    }
  })
  TERRAIN.forEach((terrain, index) => {
    canvasTexture(scene, `fq-tuft-${index}`, 30, 20, context => {
      for (let i = 0; i < 6; i += 1) {
        const x = 6 + i * 3.6
        const lean = (i - 2.5) * 2.2
        context.fillStyle = i % 2 === 0 ? terrain.grass : terrain.grassLight
        context.beginPath()
        context.moveTo(x - 2, 20)
        context.lineTo(x + 2, 20)
        context.lineTo(x + lean, 20 - (9 + ((i * 7) % 5) * 2))
        context.closePath()
        context.fill()
      }
    })
  })
}

export function makeSceneryTextures(scene: Phaser.Scene) {
  TERRAIN.forEach((terrain, index) => {
    canvasTexture(scene, `fq-top-${index}`, TILE_W, TOP_TILE_H, context => drawGroundTile(context, terrain, 3 + index * 7))
  })
  drawDecor(scene)

  canvasTexture(scene, 'fq-cloud', 240, 110, context => {
    const puffs: [number, number, number][] = [[60, 70, 34], [100, 52, 42], [148, 58, 38], [186, 74, 28], [126, 80, 36], [82, 84, 26]]
    for (const [x, y, r] of puffs) {
      const gradient = context.createRadialGradient(x, y - r * 0.3, r * 0.2, x, y, r)
      gradient.addColorStop(0, 'rgba(255,255,255,1)')
      gradient.addColorStop(0.75, 'rgba(255,255,255,0.95)')
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      context.fillStyle = gradient
      context.beginPath()
      context.arc(x, y, r, 0, TAU)
      context.fill()
    }
    const shade = context.createLinearGradient(0, 60, 0, 110)
    shade.addColorStop(0, 'rgba(190,200,225,0)')
    shade.addColorStop(1, 'rgba(190,200,225,0.35)')
    context.globalCompositeOperation = 'source-atop'
    context.fillStyle = shade
    context.fillRect(0, 0, 240, 110)
  })

  canvasTexture(scene, 'fq-ray', 96, 512, context => {
    const across = context.createLinearGradient(0, 0, 96, 0)
    across.addColorStop(0, 'rgba(255,255,255,0)')
    across.addColorStop(0.5, 'rgba(255,255,255,1)')
    across.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = across
    context.fillRect(0, 0, 96, 512)
    context.globalCompositeOperation = 'destination-in'
    const down = context.createLinearGradient(0, 0, 0, 512)
    down.addColorStop(0, 'rgba(0,0,0,0.9)')
    down.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = down
    context.fillRect(0, 0, 96, 512)
  })

  canvasTexture(scene, 'fq-star', 24, 24, context => {
    context.fillStyle = '#ffffff'
    context.beginPath()
    context.moveTo(12, 0)
    context.quadraticCurveTo(13.2, 10.8, 24, 12)
    context.quadraticCurveTo(13.2, 13.2, 12, 24)
    context.quadraticCurveTo(10.8, 13.2, 0, 12)
    context.quadraticCurveTo(10.8, 10.8, 12, 0)
    context.fill()
  })

  // Foreground grass, drawn in white and tinted per biome.
  canvasTexture(scene, 'fq-fore', 1024, 130, context => {
    const rand = random(91)
    context.fillStyle = '#ffffff'
    for (let i = 0; i < 26; i += 1) {
      const x = rand() * 1024
      const clump = 3 + Math.floor(rand() * 5)
      const tall = rand() < 0.25 ? 70 + rand() * 50 : 26 + rand() * 34
      for (let b = 0; b < clump; b += 1) {
        const bx = x + (b - clump / 2) * 7
        const h = tall * (0.6 + rand() * 0.4)
        const lean = (rand() - 0.5) * 26
        const draw = (ox: number) => {
          context.beginPath()
          context.moveTo(ox - 4, 130)
          context.quadraticCurveTo(ox - 2 + lean * 0.4, 130 - h * 0.6, ox + lean, 130 - h)
          context.quadraticCurveTo(ox + 2 + lean * 0.4, 130 - h * 0.6, ox + 4, 130)
          context.fill()
        }
        draw(bx)
        if (bx < 40) draw(bx + 1024)
        if (bx > 984) draw(bx - 1024)
      }
    }
    for (let i = 0; i < 9; i += 1) {
      const x = rand() * 1024
      const r = 16 + rand() * 18
      const draw = (ox: number) => {
        context.beginPath()
        context.ellipse(ox, 130, r * 1.6, r, 0, Math.PI, 0)
        context.fill()
      }
      draw(x)
      if (x < r * 2) draw(x + 1024)
      if (x > 1024 - r * 2) draw(x - 1024)
    }
  })
}

// ---- Terrain -----------------------------------------------------------------------------------

type Piece = { start: number; end: number; biome: number }

/**
 * A stretch of ground takes the look of the area most of it belongs to, so the ground style
 * changes at a gap rather than with a hard seam in the middle of solid ground.
 */
function terrainBiome(start: number, end: number): number {
  return biomeAt((start + Math.min(end, LEVEL_END)) / 2)
}

function drawLedge(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  inward: 1 | -1,
  top: number,
  bottom: number,
  terrain: Terrain,
  rand: () => number,
  vines: boolean,
) {
  // Darker soil just inside the cliff face.
  const strip: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(x, top + 16)]
  for (let y = top + 16; y <= Math.min(bottom, top + 900); y += 14) {
    strip.push(new Phaser.Math.Vector2(x + inward * (5 + rand() * 6), y))
  }
  strip.push(new Phaser.Math.Vector2(x, Math.min(bottom, top + 900)))
  graphics.fillStyle(terrain.edge, 0.5)
  graphics.fillPoints(strip, true)

  // A soft grass overhang on the lip.
  const color = (value: string) => Phaser.Display.Color.HexStringToColor(value).color
  graphics.fillStyle(color(terrain.grassDark), 1)
  graphics.fillEllipse(x + inward * 4, top + 14, 30, 16)
  graphics.fillStyle(color(terrain.grass), 1)
  graphics.fillEllipse(x + inward * 6, top + 9, 30, 14)
  graphics.fillStyle(color(terrain.grassLight), 1)
  graphics.fillEllipse(x + inward * 9, top + 4, 18, 6)
  graphics.fillStyle(color(terrain.grassDark), 1)
  graphics.fillCircle(x - inward * 4, top + 19, 3)
  graphics.fillCircle(x + inward * 3, top + 22, 2.4)

  if (!vines) return
  const count = 1 + Math.floor(rand() * 3)
  for (let v = 0; v < count; v += 1) {
    const vx = x - inward * 2 + inward * v * 9
    const length = 22 + rand() * 46
    let px = vx
    let py = top + 14
    graphics.lineStyle(2, terrain.vine, 1)
    graphics.beginPath()
    graphics.moveTo(px, py)
    for (let s = 1; s <= 6; s += 1) {
      const nx = vx - inward * 3 + Math.sin(s * 1.3 + v) * 3
      const ny = top + 14 + (length * s) / 6
      graphics.lineTo(nx, ny)
      if (s % 2 === 0) {
        graphics.fillStyle(terrain.leaf, 1)
        graphics.fillEllipse(nx + (s % 4 === 0 ? 4 : -4), ny, 7, 4)
      }
      px = nx
      py = ny
    }
    graphics.strokePath()
    graphics.fillStyle(terrain.leaf, 1)
    graphics.fillEllipse(px, py + 2, 6, 5)
  }
}

function decorKeys(biome: number): string[] {
  if (biome === 0) return [`fq-tuft-0`, `fq-tuft-0`, 'fq-daisy', 'fq-daisy', 'fq-tulip', 'fq-pebble']
  if (biome === 1) return [`fq-tuft-1`, `fq-tuft-1`, 'fq-fern', 'fq-fern', 'fq-mushroom', 'fq-pebble']
  return [`fq-tuft-2`, `fq-tuft-2`, 'fq-rosebush', 'fq-tulip', 'fq-daisy', 'fq-pebble']
}

function scatterDecor(scene: Phaser.Scene, piece: Piece, top: number, skipPlatforms: boolean, rand: () => number) {
  const keys = decorKeys(piece.biome)
  for (let x = piece.start + 22 + rand() * 30; x < piece.end - 22; x += 30 + rand() * 62) {
    if (x > LEVEL_END - 120) break
    if (THORNS.some(thorn => Math.abs(thorn.x - x) < 48)) continue
    if (CHECKPOINTS.some(checkpoint => Math.abs(checkpoint + PLAYER_WIDTH / 2 - x) < 22)) continue
    if (skipPlatforms && PLATFORMS.some(platform => x > platform.start - 16 && x < platform.end + 16)) continue
    const key = keys[Math.floor(rand() * keys.length)]
    scene.add.image(x, top + 7, key)
      .setOrigin(0.5, 1)
      .setScale(0.95 + rand() * 0.4)
      .setFlipX(rand() < 0.5)
      .setDepth(1.6)
  }
}

/** Ground, raised platforms, ledges and decorations. */
export function drawTerrain(scene: Phaser.Scene, groundRight: number) {
  const rand = random(7)
  const ledges = scene.add.graphics().setDepth(1.3)
  const bottom = GAME_HEIGHT + 1400

  GROUND.forEach((segment, index) => {
    const end = index === GROUND.length - 1 ? groundRight : segment.end
    const piece = { start: segment.start, end, biome: terrainBiome(segment.start, end) }
    const width = piece.end - piece.start
    scene.add.rectangle(piece.start, segment.top + 120, width, bottom, SOIL_FILL[piece.biome]).setOrigin(0, 0).setDepth(1)
    scene.add.tileSprite(piece.start, segment.top - 15, width, TOP_TILE_H, `fq-top-${piece.biome}`)
      .setOrigin(0, 0)
      .setDepth(1.1)
      .setTilePosition(piece.start % TILE_W, 0)
    scatterDecor(scene, piece, segment.top, true, rand)
    const terrain = TERRAIN[piece.biome]
    if (index > 0) drawLedge(ledges, segment.start, 1, segment.top, bottom, terrain, rand, false)
    if (index < GROUND.length - 1) drawLedge(ledges, end, -1, segment.top, bottom, terrain, rand, false)
  })

  for (const platform of PLATFORMS) {
    const biome = terrainBiome(platform.start, platform.end)
    const width = platform.end - platform.start
    scene.add.ellipse(platform.start + width / 2, platform.top + 120, width + 24, 22, 0x2a2020, 0.16).setDepth(1.15)
    scene.add.tileSprite(platform.start, platform.top - 15, width, TOP_TILE_H, `fq-top-${biome}`)
      .setOrigin(0, 0)
      .setDepth(1.2)
      .setTilePosition((platform.start * 1.7) % TILE_W, 0)
    drawLedge(ledges, platform.start, 1, platform.top, platform.top + 118, TERRAIN[biome], rand, true)
    drawLedge(ledges, platform.end, -1, platform.top, platform.top + 118, TERRAIN[biome], rand, true)
    scatterDecor(scene, { start: platform.start, end: platform.end, biome }, platform.top, false, rand)
  }
}
