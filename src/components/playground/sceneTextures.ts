import * as THREE from 'three'
import type { RoomState } from './mcpTools'

export interface DynamicTextures {
  screenTexture: THREE.CanvasTexture
  sideScreenTexture: THREE.CanvasTexture
  arcadeTexture: THREE.CanvasTexture
  windowTexture: THREE.CanvasTexture
  neonSignTexture: THREE.CanvasTexture
  posterTexture: THREE.CanvasTexture
  deskMatTexture: THREE.CanvasTexture
  rugTexture: THREE.CanvasTexture
  arcadeMarqueeTexture: THREE.CanvasTexture
  arcadeSideArtTexture: THREE.CanvasTexture
  updateAll: (state: RoomState, terminalLines: string[], timeMs: number) => void
  dispose: () => void
}

function createCanvasTexture(width: number, height: number): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D | null
  texture: THREE.CanvasTexture
} {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return { canvas, ctx, texture }
}

export function createDynamicTextures(): DynamicTextures {
  // 1. Primary Ultrawide Curved Monitor (768x320)
  const main = createCanvasTexture(768, 320)
  const matrixCols = Math.floor(768 / 16)
  const matrixDrops = Array.from({ length: matrixCols }, () => Math.floor(Math.random() * -25))
  const eqHeights = Array.from({ length: 28 }, () => Math.random() * 140 + 20)
  const cpuHistory = Array.from({ length: 36 }, () => 30 + Math.random() * 25)
  const gpuHistory = Array.from({ length: 36 }, () => 40 + Math.random() * 25)
  let lastStatsTick = 0

  // 2. Secondary Portrait Monitor (384x576)
  const side = createCanvasTexture(384, 576)

  // 3. Arcade CRT (256x256)
  const arcade = createCanvasTexture(256, 256)
  let invaderX = 48
  let invaderDir = 1
  let snakeTick = 0
  const snakeHead = { x: 4, y: 6 }
  const snakeTrail: Array<{ x: number; y: number }> = [
    { x: 3, y: 6 },
    { x: 2, y: 6 },
    { x: 1, y: 6 }
  ]
  let snakeFood = { x: 9, y: 6 }
  let tetrisY = 40

  // 4. City Window (512x384)
  const win = createCanvasTexture(512, 384)
  const raindrops = Array.from({ length: 55 }, () => ({
    x: Math.random() * 512,
    y: Math.random() * 384,
    len: 10 + Math.random() * 16,
    speed: 4 + Math.random() * 5
  }))
  const buildings = Array.from({ length: 14 }, (_, i) => ({
    x: i * 38,
    w: 28 + (i % 3) * 8,
    h: 110 + ((i * 53) % 165),
    litSeed: i * 17
  }))

  // 5. Static Branded & Artwork Textures
  const neonSign = createCanvasTexture(512, 128)
  if (neonSign.ctx) {
    const c = neonSign.ctx
    c.fillStyle = '#070910'
    c.fillRect(0, 0, 512, 128)
    c.strokeStyle = '#ff1e42'
    c.lineWidth = 4
    c.strokeRect(8, 8, 496, 112)
    c.strokeStyle = '#00f0ff'
    c.lineWidth = 2
    c.strokeRect(16, 16, 480, 96)

    c.shadowColor = '#ff1e42'
    c.shadowBlur = 14
    c.fillStyle = '#ffffff'
    c.font = 'bold 42px monospace'
    c.textAlign = 'center'
    c.fillText('TEXTOOLS // LAB', 256, 68)

    c.shadowColor = '#00f0ff'
    c.shadowBlur = 8
    c.fillStyle = '#00f0ff'
    c.font = 'bold 14px monospace'
    c.fillText('WEBMCP 3D DIGITAL TWIN WORKSTATION', 256, 98)
    c.shadowBlur = 0
    c.textAlign = 'start'
    neonSign.texture.needsUpdate = true
  }

  const poster = createCanvasTexture(256, 360)
  if (poster.ctx) {
    const c = poster.ctx
    const bg = c.createLinearGradient(0, 0, 0, 360)
    bg.addColorStop(0, '#140826')
    bg.addColorStop(0.55, '#3b0764')
    bg.addColorStop(1, '#090c14')
    c.fillStyle = bg
    c.fillRect(0, 0, 256, 360)

    // Synthwave sun
    const sunGrad = c.createLinearGradient(0, 80, 0, 210)
    sunGrad.addColorStop(0, '#fde047')
    sunGrad.addColorStop(0.5, '#f97316')
    sunGrad.addColorStop(1, '#ff1e42')
    c.fillStyle = sunGrad
    c.beginPath()
    c.arc(128, 150, 62, 0, Math.PI * 2)
    c.fill()

    // Horizontal sun cutouts
    c.fillStyle = '#25093e'
    for (let y = 140; y < 210; y += 12) {
      c.fillRect(60, y, 136, 4)
    }

    // Horizon grid
    c.strokeStyle = '#00f0ff'
    c.lineWidth = 1.5
    c.beginPath()
    c.moveTo(0, 230)
    c.lineTo(256, 230)
    for (let x = -60; x <= 316; x += 28) {
      c.moveTo(128 + (x - 128) * 0.25, 230)
      c.lineTo(x, 360)
    }
    for (let y = 245; y < 360; y += 18) {
      c.moveTo(0, y)
      c.lineTo(256, y)
    }
    c.stroke()

    c.fillStyle = '#ffffff'
    c.font = 'bold 16px monospace'
    c.textAlign = 'center'
    c.fillText('CYBER // HORIZON', 128, 42)
    c.textAlign = 'start'
    poster.texture.needsUpdate = true
  }

  const deskMat = createCanvasTexture(512, 256)
  if (deskMat.ctx) {
    const c = deskMat.ctx
    c.fillStyle = '#0d1320'
    c.fillRect(0, 0, 512, 256)

    c.strokeStyle = 'rgba(255, 30, 66, 0.22)'
    c.lineWidth = 1
    for (let x = 0; x < 512; x += 32) {
      c.beginPath()
      c.moveTo(x, 0)
      c.lineTo(x, 256)
      c.stroke()
    }
    for (let y = 0; y < 256; y += 32) {
      c.beginPath()
      c.moveTo(0, y)
      c.lineTo(512, y)
      c.stroke()
    }

    // Corner cyber lines
    c.strokeStyle = '#ff1e42'
    c.lineWidth = 3
    c.strokeRect(8, 8, 496, 240)
    c.fillStyle = 'rgba(0, 240, 255, 0.5)'
    c.font = 'bold 11px monospace'
    c.fillText('TEXTOOLS // BATTLESTATION MAT', 20, 234)
    deskMat.texture.needsUpdate = true
  }

  const rug = createCanvasTexture(512, 512)
  if (rug.ctx) {
    const c = rug.ctx
    c.fillStyle = '#121725'
    c.fillRect(0, 0, 512, 512)

    c.strokeStyle = 'rgba(255, 255, 255, 0.04)'
    c.lineWidth = 2
    for (let i = 24; i < 512; i += 24) {
      c.beginPath()
      c.moveTo(i, 0)
      c.lineTo(i, 512)
      c.stroke()
    }

    c.strokeStyle = '#ff1e42'
    c.lineWidth = 6
    c.strokeRect(18, 18, 476, 476)
    c.strokeStyle = 'rgba(0, 240, 255, 0.45)'
    c.lineWidth = 2
    c.strokeRect(32, 32, 448, 448)
    rug.texture.needsUpdate = true
  }

  const arcadeMarquee = createCanvasTexture(512, 128)
  if (arcadeMarquee.ctx) {
    const c = arcadeMarquee.ctx
    const g = c.createLinearGradient(0, 0, 512, 128)
    g.addColorStop(0, '#1d0636')
    g.addColorStop(0.5, '#3b0764')
    g.addColorStop(1, '#1d0636')
    c.fillStyle = g
    c.fillRect(0, 0, 512, 128)
    c.strokeStyle = '#00f0ff'
    c.lineWidth = 6
    c.strokeRect(8, 8, 496, 112)
    c.fillStyle = '#ff1e8a'
    c.font = 'bold 54px monospace'
    c.textAlign = 'center'
    c.fillText('★ TEX-ARCADE ★', 256, 82)
    c.textAlign = 'start'
    arcadeMarquee.texture.needsUpdate = true
  }

  const arcadeSideArt = createCanvasTexture(256, 512)
  if (arcadeSideArt.ctx) {
    const c = arcadeSideArt.ctx
    c.fillStyle = '#191330'
    c.fillRect(0, 0, 256, 512)
    c.fillStyle = '#ff007f'
    c.beginPath()
    c.moveTo(0, 180)
    c.lineTo(256, 80)
    c.lineTo(256, 130)
    c.lineTo(0, 230)
    c.fill()
    c.fillStyle = '#00f0ff'
    c.beginPath()
    c.moveTo(0, 245)
    c.lineTo(256, 145)
    c.lineTo(256, 175)
    c.lineTo(0, 275)
    c.fill()
    c.fillStyle = '#ffaa00'
    c.beginPath()
    c.arc(170, 340, 48, 0, Math.PI * 2)
    c.fill()
    arcadeSideArt.texture.needsUpdate = true
  }

  const updateMainScreen = (state: RoomState, terminalLines: string[], timeMs: number) => {
    const c = main.ctx
    if (!c) return
    const W = 768
    const H = 320

    if (!state.pcOn || state.screenMode === 'off') {
      c.fillStyle = '#05070b'
      c.fillRect(0, 0, W, H)
      main.texture.needsUpdate = true
      return
    }

    if (state.screenMode === 'matrix') {
      c.fillStyle = 'rgba(4, 9, 8, 0.22)'
      c.fillRect(0, 0, W, H)
      c.fillStyle = state.isOverclocked ? '#ff1e42' : '#00ff88'
      c.font = '15px monospace'
      const chars = '01ABCDEFGHJKLMNPQRSTUVWXYZ$#@%&*+-/='
      for (let i = 0; i < matrixDrops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)] ?? '0'
        const dropY = matrixDrops[i] ?? 0
        c.fillText(ch, i * 16, dropY * 16)
        if (dropY * 16 > H && Math.random() > 0.965) {
          matrixDrops[i] = 0
        } else {
          matrixDrops[i] = dropY + 1
        }
      }
    } else if (state.screenMode === 'terminal') {
      c.fillStyle = '#070b13'
      c.fillRect(0, 0, W, H)
      c.fillStyle = '#00f0ff'
      c.font = 'bold 15px monospace'
      c.fillText('// WEBMCP AGENT TERMINAL • JSON-RPC 2.0', 22, 30)
      c.strokeStyle = '#1e293b'
      c.lineWidth = 1.5
      c.beginPath()
      c.moveTo(20, 42)
      c.lineTo(W - 20, 42)
      c.stroke()

      c.font = '14px monospace'
      c.fillStyle = '#e2e8f0'
      let y = 70
      for (const line of terminalLines.slice(-10)) {
        c.fillStyle = line.includes('[ERR') ? '#ef4444' : line.includes('[MCP]') ? '#34d399' : '#e2e8f0'
        c.fillText(line.slice(0, 74), 24, y)
        y += 23
      }
      if (Math.floor(timeMs / 400) % 2 === 0) {
        c.fillStyle = '#ff1e42'
        c.fillRect(24, y - 12, 10, 16)
      }
    } else if (state.screenMode === 'stats') {
      c.fillStyle = '#080c15'
      c.fillRect(0, 0, W, H)

      if (timeMs - lastStatsTick > 220) {
        lastStatsTick = timeMs
        const baseCpu = state.isOverclocked ? 82 : 28
        const baseGpu = state.isOverclocked ? 91 : 38
        cpuHistory.shift()
        cpuHistory.push(Math.min(99, baseCpu + Math.random() * 16))
        gpuHistory.shift()
        gpuHistory.push(Math.min(99, baseGpu + Math.random() * 8))
      }

      // Header
      c.fillStyle = '#ff1e42'
      c.font = 'bold 16px monospace'
      c.fillText(
        state.isOverclocked ? '⚠ HARDWARE TELEMETRY // OVERCLOCK ENGAGED' : '⚡ HARDWARE TELEMETRY // NOMINAL',
        24,
        32
      )

      const cpuVal = Math.round(cpuHistory[cpuHistory.length - 1] ?? 32)
      const gpuVal = Math.round(gpuHistory[gpuHistory.length - 1] ?? 42)
      const rpm = Math.round((state.isOverclocked ? 3150 : 1120) + Math.sin(timeMs * 0.01) * 40)
      const temp = state.isOverclocked ? 81 : 47

      c.fillStyle = '#e2e8f0'
      c.font = 'bold 20px monospace'
      c.fillText(`CPU: ${cpuVal}%   GPU: ${gpuVal}%   TEMP: ${temp}°C   FAN: ${rpm} RPM`, 24, 68)

      // Graph box
      c.strokeStyle = '#1e293b'
      c.lineWidth = 2
      c.strokeRect(24, 92, W - 48, 196)

      // CPU curve (cyan)
      c.strokeStyle = '#00f0ff'
      c.lineWidth = 3
      c.beginPath()
      cpuHistory.forEach((v, idx) => {
        const px = 30 + (idx / (cpuHistory.length - 1)) * (W - 60)
        const py = 280 - (v / 100) * 176
        if (idx === 0) c.moveTo(px, py)
        else c.lineTo(px, py)
      })
      c.stroke()

      // GPU curve (crimson)
      c.strokeStyle = '#ff1e42'
      c.lineWidth = 3
      c.beginPath()
      gpuHistory.forEach((v, idx) => {
        const px = 30 + (idx / (gpuHistory.length - 1)) * (W - 60)
        const py = 280 - (v / 100) * 176
        if (idx === 0) c.moveTo(px, py)
        else c.lineTo(px, py)
      })
      c.stroke()
    } else if (state.screenMode === 'eq') {
      c.fillStyle = '#060912'
      c.fillRect(0, 0, W, H)

      c.fillStyle = '#94a3b8'
      c.font = 'bold 14px monospace'
      c.fillText(
        state.speakersOn ? '♪ STUDIO MONITORS // SYNTHWAVE SPECTRUM ANALYZER' : '🔇 SPEAKERS MUTED // AUDIO STANDBY',
        24,
        30
      )

      const barW = 20
      const gap = 6
      const startX = 24
      for (let i = 0; i < eqHeights.length; i++) {
        const target = state.speakersOn
          ? (Math.sin(timeMs * (state.isOverclocked ? 0.012 : 0.006) + i * 0.55) * 0.5 + 0.5) * 200 + 25
          : 10
        const cur = eqHeights[i] ?? 20
        const next = cur + (target - cur) * 0.25
        eqHeights[i] = next

        const grad = c.createLinearGradient(0, 290 - next, 0, 290)
        grad.addColorStop(0, '#00f0ff')
        grad.addColorStop(0.55, state.lightColor)
        grad.addColorStop(1, '#ff1e42')
        c.fillStyle = grad
        c.fillRect(startX + i * (barW + gap), 290 - next, barW, next)
      }
    } else if (state.screenMode === 'textools') {
      c.fillStyle = '#090d16'
      c.fillRect(0, 0, W, H)
      c.strokeStyle = state.lightColor
      c.lineWidth = 5
      c.strokeRect(10, 10, W - 20, H - 20)

      c.textAlign = 'center'
      c.fillStyle = '#ffffff'
      c.font = 'bold 54px sans-serif'
      c.fillText('TexTools', W / 2, 130)

      c.fillStyle = state.lightColor
      c.font = 'bold 20px monospace'
      c.fillText('DEVELOPER BATTLESTATION 3D // WEBMCP', W / 2, 174)

      c.fillStyle = '#00f0ff'
      c.font = '15px monospace'
      c.fillText(
        `THEME: ${state.currentTheme.toUpperCase()}  •  DESK: ${Math.round(74 + state.deskHeight * 44)}CM  •  HOLO: ${state.hologramMode.toUpperCase()}`,
        W / 2,
        226
      )
      c.textAlign = 'start'
    }

    main.texture.needsUpdate = true
  }

  const updateSideScreen = (state: RoomState, terminalLines: string[], timeMs: number) => {
    const c = side.ctx
    if (!c) return
    const W = 384
    const H = 576

    if (!state.pcOn || state.sideScreenMode === 'off') {
      c.fillStyle = '#05070b'
      c.fillRect(0, 0, W, H)
      side.texture.needsUpdate = true
      return
    }

    c.fillStyle = '#090d16'
    c.fillRect(0, 0, W, H)

    // Top IDE header
    c.fillStyle = '#111827'
    c.fillRect(0, 0, W, 38)
    c.fillStyle = state.lightColor
    c.font = 'bold 13px monospace'
    c.fillText(`● ${state.sideScreenMode.toUpperCase()}.TS — WEBMCP`, 14, 24)

    if (state.sideScreenMode === 'code') {
      const codeLines = [
        { num: '01', text: 'import { WebGPURenderer } from "three/webgpu"', color: '#c084fc' },
        { num: '02', text: 'import { MCP_TOOLS } from "./mcpTools"', color: '#c084fc' },
        { num: '03', text: '', color: '#94a3b8' },
        { num: '04', text: 'export async function registerContext() {', color: '#38bdf8' },
        { num: '05', text: '  const gpu = new WebGPURenderer()', color: '#e2e8f0' },
        { num: '06', text: '  await gpu.init()', color: '#34d399' },
        { num: '07', text: `  const theme = "${state.currentTheme}"`, color: '#fbbf24' },
        { num: '08', text: `  const oc = ${state.isOverclocked}`, color: '#fb7185' },
        { num: '09', text: `  const height = ${Math.round(74 + state.deskHeight * 44)}`, color: '#34d399' },
        { num: '10', text: '', color: '#94a3b8' },
        { num: '11', text: '  for (const tool of MCP_TOOLS) {', color: '#38bdf8' },
        { num: '12', text: '    bridge.bindTool(tool.name, exec)', color: '#e2e8f0' },
        { num: '13', text: '  }', color: '#38bdf8' },
        { num: '14', text: '  return { status: "READY", gpu }', color: '#34d399' },
        { num: '15', text: '}', color: '#38bdf8' },
        { num: '16', text: '', color: '#94a3b8' },
        { num: '17', text: '// Active Digital Twin Telemetry', color: '#64748b' },
        { num: '18', text: `// Holo Core: ${state.hologramMode.toUpperCase()}`, color: '#00f0ff' },
        { num: '19', text: `// City Weather: ${state.weatherMode}`, color: '#00f0ff' },
        { num: '20', text: `// Arcade Mode: ${state.arcadeMode}`, color: '#ff1e42' }
      ]

      c.font = '12px monospace'
      codeLines.forEach((line, i) => {
        const y = 66 + i * 24
        c.fillStyle = '#475569'
        c.fillText(line.num, 12, y)
        c.fillStyle = line.color
        c.fillText(line.text, 40, y)
      })
    } else if (state.sideScreenMode === 'logs') {
      c.font = '12px monospace'
      const lines = terminalLines.slice(-18)
      lines.forEach((line, i) => {
        c.fillStyle = line.includes('[MCP]') ? '#00f0ff' : '#cbd5e1'
        c.fillText(line.slice(0, 44), 14, 66 + i * 26)
      })
    } else if (state.sideScreenMode === 'git') {
      const commits = [
        'feat(3d): curved ultrawide monitor',
        'feat(mcp): standing desk actuator',
        'feat(3d): holo-core & server rack',
        'feat(3d): city rain shader window',
        'fix(cam): non-fighting orbit lerp'
      ]
      c.strokeStyle = '#ff1e42'
      c.lineWidth = 3
      c.beginPath()
      c.moveTo(40, 75)
      c.lineTo(40, 460)
      c.stroke()

      commits.forEach((msg, i) => {
        const y = 85 + i * 85
        c.fillStyle = i === 0 ? '#00f0ff' : '#ff1e42'
        c.beginPath()
        c.arc(40, y, 8, 0, Math.PI * 2)
        c.fill()
        c.fillStyle = '#f8fafc'
        c.font = 'bold 13px monospace'
        c.fillText(msg, 64, y + 4)
        c.fillStyle = '#64748b'
        c.font = '11px monospace'
        c.fillText(`main • verified • #0${5 - i}`, 64, y + 24)
      })
    }

    // Bottom status bar
    c.fillStyle = state.lightColor
    c.fillRect(0, H - 24, W, 24)
    c.fillStyle = '#090d16'
    c.font = 'bold 11px monospace'
    c.fillText(`UTF-8  •  TypeScript  •  ${Math.floor(timeMs / 1000) % 60}s`, 12, H - 8)
    side.texture.needsUpdate = true
  }

  const updateArcadeScreen = (state: RoomState, timeMs: number) => {
    const c = arcade.ctx
    if (!c) return

    if (!state.arcadeOn || state.arcadeMode === 'off') {
      c.fillStyle = '#05070a'
      c.fillRect(0, 0, 256, 256)
      arcade.texture.needsUpdate = true
      return
    }

    c.fillStyle = '#100826'
    c.fillRect(0, 0, 256, 256)

    c.fillStyle = '#ff007f'
    c.font = 'bold 20px monospace'
    c.textAlign = 'center'
    c.fillText('TEX-ARCADE', 128, 36)

    c.fillStyle = '#00f0ff'
    c.font = 'bold 12px monospace'
    c.fillText(`MODE: ${state.arcadeMode.toUpperCase()}  HI 99990`, 128, 58)

    if (state.arcadeMode === 'invaders') {
      invaderX += invaderDir * 1.5
      if (invaderX > 180 || invaderX < 36) invaderDir *= -1

      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const ax = invaderX - 20 + col * 36
          const ay = 86 + row * 32
          c.fillStyle = row === 0 ? '#00ff88' : '#ffaa00'
          c.fillRect(ax, ay, 24, 16)
          c.fillStyle = '#100826'
          c.fillRect(ax + 4, ay + 4, 5, 5)
          c.fillRect(ax + 15, ay + 4, 5, 5)
        }
      }
      // Player cannon
      const px = 128 + Math.sin(timeMs * 0.003) * 60
      c.fillStyle = '#00f0ff'
      c.fillRect(px - 14, 186, 28, 10)
      c.fillRect(px - 3, 178, 6, 8)
    } else if (state.arcadeMode === 'snake') {
      if (timeMs - snakeTick > 140) {
        snakeTick = timeMs
        snakeTrail.unshift({ ...snakeHead })
        if (snakeHead.x < snakeFood.x) snakeHead.x++
        else if (snakeHead.x > snakeFood.x) snakeHead.x--
        else if (snakeHead.y < snakeFood.y) snakeHead.y++
        else if (snakeHead.y > snakeFood.y) snakeHead.y--

        if (snakeHead.x === snakeFood.x && snakeHead.y === snakeFood.y) {
          snakeFood = {
            x: 1 + Math.floor(Math.random() * 10),
            y: 4 + Math.floor(Math.random() * 8)
          }
        } else {
          snakeTrail.pop()
        }
      }
      c.strokeStyle = 'rgba(0, 240, 255, 0.15)'
      c.strokeRect(24, 72, 208, 136)

      c.fillStyle = '#ff1e42'
      c.fillRect(24 + snakeFood.x * 16, 72 + snakeFood.y * 12, 12, 10)

      c.fillStyle = '#00ff88'
      c.fillRect(24 + snakeHead.x * 16, 72 + snakeHead.y * 12, 14, 11)
      snakeTrail.forEach(seg => {
        c.fillRect(24 + seg.x * 16, 72 + seg.y * 12, 13, 10)
      })
    } else if (state.arcadeMode === 'tetris') {
      tetrisY += 1.4
      if (tetrisY > 175) tetrisY = 76
      c.strokeStyle = '#38bdf8'
      c.strokeRect(64, 72, 128, 132)
      c.fillStyle = '#f59e0b'
      c.fillRect(108, tetrisY, 32, 16)
      c.fillRect(124, tetrisY - 16, 16, 16)
      // Bottom settled blocks
      c.fillStyle = '#ff1e42'
      c.fillRect(68, 184, 48, 16)
      c.fillStyle = '#a855f7'
      c.fillRect(132, 184, 56, 16)
    } else {
      c.fillStyle = '#ffaa00'
      c.font = 'bold 18px monospace'
      c.fillText('PRESS START', 128, 124)
      c.fillStyle = '#00ff88'
      c.font = '13px monospace'
      c.fillText('3 GAMES INSTALLED', 128, 154)
    }

    if (Math.floor(timeMs / 450) % 2 === 0) {
      c.fillStyle = '#ffaa00'
      c.font = 'bold 13px monospace'
      c.fillText('★ INSERT COIN ★', 128, 230)
    }

    c.fillStyle = 'rgba(0, 0, 0, 0.25)'
    for (let y = 0; y < 256; y += 4) {
      c.fillRect(0, y, 256, 2)
    }
    c.textAlign = 'start'
    arcade.texture.needsUpdate = true
  }

  const updateCityWindow = (state: RoomState, timeMs: number) => {
    const c = win.ctx
    if (!c) return
    const W = 512
    const H = 384

    if (state.weatherMode === 'blinds_closed') {
      c.fillStyle = '#0b0f1a'
      c.fillRect(0, 0, W, H)
      for (let y = 8; y < H; y += 20) {
        c.fillStyle = '#1b2436'
        c.fillRect(6, y, W - 12, 14)
        c.fillStyle = 'rgba(0, 240, 255, 0.14)'
        c.fillRect(6, y + 14, W - 12, 2)
      }
      win.texture.needsUpdate = true
      return
    }

    // Sky gradient
    const sky = c.createLinearGradient(0, 0, 0, H)
    if (state.weatherMode === 'sunset_grid') {
      sky.addColorStop(0, '#1e1b4b')
      sky.addColorStop(0.55, '#9d174d')
      sky.addColorStop(1, '#f97316')
    } else {
      sky.addColorStop(0, '#050814')
      sky.addColorStop(0.65, '#111936')
      sky.addColorStop(1, '#1e1233')
    }
    c.fillStyle = sky
    c.fillRect(0, 0, W, H)

    // Moon or Synthwave Sun
    if (state.weatherMode === 'sunset_grid') {
      c.fillStyle = '#fde047'
      c.beginPath()
      c.arc(256, 180, 68, 0, Math.PI * 2)
      c.fill()
    } else {
      c.fillStyle = '#e2e8f0'
      c.beginPath()
      c.arc(390, 74, 24, 0, Math.PI * 2)
      c.fill()
    }

    // Distant traffic glow orbs
    const carX = ((timeMs * 0.08) % (W + 80)) - 40
    c.fillStyle = '#ff1e42'
    c.fillRect(carX, 155, 16, 4)
    c.fillStyle = '#00f0ff'
    c.fillRect(W - carX, 125, 18, 4)

    // Skyscraper silhouettes + lit windows
    buildings.forEach((b) => {
      const topY = H - b.h
      c.fillStyle = '#070a14'
      c.fillRect(b.x, topY, b.w, b.h)

      for (let wy = topY + 12; wy < H - 16; wy += 16) {
        for (let wx = b.x + 5; wx < b.x + b.w - 8; wx += 10) {
          const hash = (wx * 13 + wy * 7 + b.litSeed) % 11
          if (hash < 4) {
            c.fillStyle = hash === 0 ? '#00f0ff' : hash === 1 ? '#ff1e42' : '#fde047'
            c.fillRect(wx, wy, 5, 7)
          }
        }
      }
    })

    // Rain streaks if cyber_rain
    if (state.weatherMode === 'cyber_rain') {
      c.strokeStyle = 'rgba(125, 211, 252, 0.55)'
      c.lineWidth = 1.5
      c.beginPath()
      raindrops.forEach((r) => {
        r.y += r.speed
        r.x -= r.speed * 0.25
        if (r.y > H) {
          r.y = -20
          r.x = Math.random() * W
        }
        c.moveTo(r.x, r.y)
        c.lineTo(r.x - 4, r.y + r.len)
      })
      c.stroke()
    }

    win.texture.needsUpdate = true
  }

  return {
    screenTexture: main.texture,
    sideScreenTexture: side.texture,
    arcadeTexture: arcade.texture,
    windowTexture: win.texture,
    neonSignTexture: neonSign.texture,
    posterTexture: poster.texture,
    deskMatTexture: deskMat.texture,
    rugTexture: rug.texture,
    arcadeMarqueeTexture: arcadeMarquee.texture,
    arcadeSideArtTexture: arcadeSideArt.texture,
    updateAll: (state, terminalLines, timeMs) => {
      updateMainScreen(state, terminalLines, timeMs)
      updateSideScreen(state, terminalLines, timeMs)
      updateArcadeScreen(state, timeMs)
      updateCityWindow(state, timeMs)
    },
    dispose: () => {
      main.texture.dispose()
      side.texture.dispose()
      arcade.texture.dispose()
      win.texture.dispose()
      neonSign.texture.dispose()
      poster.texture.dispose()
      deskMat.texture.dispose()
      rug.texture.dispose()
      arcadeMarquee.texture.dispose()
      arcadeSideArt.texture.dispose()
    }
  }
}
