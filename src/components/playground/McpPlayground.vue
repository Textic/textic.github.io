<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import * as THREE from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  MCP_TOOLS,
  THEME_CONFIGS,
  SCENE_PRESETS,
  interpretNaturalLanguagePrompt,
  type RoomState,
  type ThemeName,
  type ScreenMode,
  type SideScreenMode,
  type CameraPreset,
  type HologramMode,
  type WeatherMode,
  type ArcadeGameMode,
  type DeviceTarget,
  type ScenePresetName
} from './mcpTools'
import { createDynamicTextures, type DynamicTextures } from './sceneTextures'
import { buildPlaygroundScene, type SceneRefs, type InteractiveHit } from './sceneBuilders'

// --- State ---
interface JsonRpcLog {
  id: number
  timestamp: string
  direction: 'call' | 'result' | 'error'
  method?: string
  data: unknown
}

const promptInput = ref('')
const isProcessing = ref(false)
const rpcLogs = ref<JsonRpcLog[]>([])
const isInspectorOpen = ref(true)
const isBridgeModalOpen = ref(false)
const activeTab = ref<'hud' | 'tools' | 'logs'>('hud')
const hoveredLabel = ref<string | null>(null)
const currentFps = ref(60)

// Scene Reactive State
const roomState = reactive<RoomState>({
  lightsOn: true,
  currentTheme: 'crimson',
  lightColor: '#ff1e42',
  lightIntensity: 1.8,
  rgbCycle: false,
  pcOn: true,
  arcadeOn: true,
  arcadeMode: 'invaders',
  serverRackOn: true,
  deskLampOn: true,
  speakersOn: true,
  screenMode: 'matrix',
  sideScreenMode: 'code',
  cameraPreset: 'isometric',
  autoOrbit: false,
  isOverclocked: false,
  fanSpeedMultiplier: 1.0,
  deskHeight: 0.0,
  keyboardRgb: true,
  hologramMode: 'orbit',
  weatherMode: 'cyber_rain',
  chairSpin: false
})

// Optional WebSocket Bridge
const wsStatus = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
const wsUrl = ref('ws://localhost:8765')
let wsClient: WebSocket | null = null

// Three.js References
const canvasContainer = ref<HTMLDivElement | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renderer: any = null
const isWebGpuActive = ref(false)
const gpuEngineName = ref('WebGPU')
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let animFrameId: number | null = null
let resizeObserver: ResizeObserver | null = null
let textures: DynamicTextures | null = null
let refs: SceneRefs | null = null

const terminalLines: string[] = [
  '[SYSTEM] TexTools OS 3.0.0 WebGPU Kernel',
  '[OK] Memory Matrix 64GB DDR5 Allocated',
  '[OK] WebMCP Daemon listening on channel 0',
  '[OK] Homelab 12U Rack & Holo-Core Synced',
  '[SYS] Workstation online. Ready for agent prompt.'
]

// Camera Transition State (never fights user drag!)
const targetCamPos = new THREE.Vector3(8.6, 7.0, 8.8)
const targetCamLook = new THREE.Vector3(-0.4, 1.8, -1.0)
let isCameraTransitioning = false

// Raycaster & Pointer Click Tracking
const raycaster = new THREE.Raycaster()
const pointerNdc = new THREE.Vector2()
let pointerDownPos = { x: 0, y: 0 }

const deskHeightCm = computed(() => Math.round(74 + roomState.deskHeight * 44))

const activeDevicesCount = computed(() => {
  let count = 0
  if (roomState.lightsOn) count++
  if (roomState.pcOn) count++
  if (roomState.arcadeOn) count++
  if (roomState.serverRackOn) count++
  if (roomState.deskLampOn) count++
  if (roomState.hologramMode !== 'off') count++
  if (roomState.speakersOn) count++
  return count
})

// Helper: Push JSON-RPC Log
const pushRpcLog = (direction: 'call' | 'result' | 'error', method: string, data: unknown) => {
  const d = new Date()
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`
  rpcLogs.value.unshift({
    id: Date.now() + Math.random(),
    timestamp: time,
    direction,
    method,
    data
  })
  if (rpcLogs.value.length > 40) rpcLogs.value.pop()
}

// Helper: Apply a hex color across room accent lights & emissive trims
const applyAccentHex = (hex: number, intensity: number) => {
  if (!refs) return
  const active = roomState.lightsOn
  refs.deskLedLight.color.setHex(hex)
  refs.deskLedLight.intensity = active ? intensity * 1.15 : 0.15
  refs.monitorBackglowLight.color.setHex(hex)
  refs.monitorBackglowLight.intensity = active ? intensity * 1.45 : 0.2

  refs.deskLedMeshes.forEach((m) => {
    ;(m.material as THREE.MeshBasicMaterial).color.setHex(hex)
  })
  refs.wallTrimMeshes.forEach((m) => {
    ;(m.material as THREE.MeshBasicMaterial).color.setHex(hex)
  })
  refs.pcRgbMeshes.forEach((m) => {
    const mat = m.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial
    if ('emissive' in mat && mat.emissive) {
      mat.emissive.setHex(hex)
    }
    mat.color.setHex(hex)
  })
  if (roomState.keyboardRgb) {
    refs.keyboardRgbMeshes.forEach((m) => {
      ;(m.material as THREE.MeshBasicMaterial).color.setHex(hex)
    })
  }
}

const syncLightingFromState = () => {
  if (!refs || !scene) return
  const cfg = THEME_CONFIGS[roomState.currentTheme]
  const hex = parseInt(roomState.lightColor.replace('#', ''), 16) || cfg.hex
  const inten = roomState.lightIntensity
  const on = roomState.lightsOn

  scene.background = new THREE.Color(cfg.bgHex)
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(cfg.bgHex)
  }

  refs.dirLight.intensity = on ? cfg.dirIntensity * Math.max(0.5, inten * 0.6) : 0.38
  refs.hemiLight.intensity = on ? cfg.hemiIntensity : 0.32
  refs.ambientLight.intensity = on ? 0.44 : 0.14

  refs.roomCeilingLight.color.setHex(cfg.ceilingHex)
  refs.roomCeilingLight.intensity = on ? inten * 1.35 : 0.1
  ;(refs.ceilingLightMesh.material as THREE.MeshBasicMaterial).color.setHex(on ? cfg.ceilingHex : 0x1e293b)

  applyAccentHex(hex, inten)
}

// --- WebMCP Tool Execution Engine ---
const executeMcpTool = (name: string, args: Record<string, unknown>) => {
  pushRpcLog('call', name, {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name, arguments: args }
  })

  let resultMessage = ''

  switch (name) {
    case 'set_ambient_lighting': {
      const themeRaw = (args.theme as ThemeName) || 'crimson'
      const theme: ThemeName = themeRaw in THEME_CONFIGS ? themeRaw : 'crimson'
      const cfg = THEME_CONFIGS[theme]

      if (typeof args.intensity === 'number') {
        roomState.lightIntensity = Math.min(3.0, Math.max(0.0, args.intensity))
      }
      if (typeof args.rgbCycle === 'boolean') {
        roomState.rgbCycle = args.rgbCycle
      }

      roomState.currentTheme = theme
      roomState.lightsOn = roomState.lightIntensity > 0.1

      if (args.color && typeof args.color === 'string') {
        const cleanHex = args.color.trim()
        if (/^#[0-9a-fA-F]{6}$/.test(cleanHex)) {
          roomState.lightColor = cleanHex
        } else {
          roomState.lightColor = cfg.css
        }
      } else {
        roomState.lightColor = cfg.css
      }

      syncLightingFromState()
      resultMessage = `Lighting set: theme=${theme}, intensity=${roomState.lightIntensity.toFixed(2)}, rgbCycle=${roomState.rgbCycle}`
      break
    }

    case 'power_device': {
      const target = args.target as DeviceTarget
      const state = Boolean(args.state)

      if (target === 'pc') {
        roomState.pcOn = state
        if (!state) {
          roomState.screenMode = 'off'
          roomState.sideScreenMode = 'off'
        } else {
          if (roomState.screenMode === 'off') roomState.screenMode = 'matrix'
          if (roomState.sideScreenMode === 'off') roomState.sideScreenMode = 'code'
        }
        if (refs) refs.pcRgbLight.intensity = state ? 1.8 : 0
      } else if (target === 'arcade') {
        roomState.arcadeOn = state
        if (state && roomState.arcadeMode === 'off') roomState.arcadeMode = 'invaders'
        if (refs) refs.arcadePointLight.intensity = state ? 2.2 : 0
      } else if (target === 'room') {
        roomState.lightsOn = state
        syncLightingFromState()
      } else if (target === 'server_rack') {
        roomState.serverRackOn = state
        if (refs) refs.serverLight.intensity = state ? 1.2 : 0
      } else if (target === 'desk_lamp') {
        roomState.deskLampOn = state
        if (refs) {
          refs.deskLampLight.intensity = state ? 1.6 : 0
          refs.deskLampBulbMat.color.setHex(state ? 0xfff4d6 : 0x1e293b)
        }
      } else if (target === 'holo_core') {
        roomState.hologramMode = state ? 'orbit' : 'off'
      } else if (target === 'speakers') {
        roomState.speakersOn = state
      }

      resultMessage = `Device '${target}' power -> ${state ? 'ON' : 'OFF'}`
      break
    }

    case 'set_screen_mode': {
      const mode = (args.mode as ScreenMode) || 'matrix'
      roomState.screenMode = mode
      if (args.sideMode) {
        roomState.sideScreenMode = args.sideMode as SideScreenMode
      }
      if (mode !== 'off' || roomState.sideScreenMode !== 'off') {
        roomState.pcOn = true
        if (refs) refs.pcRgbLight.intensity = 1.8
      }
      resultMessage = `Displays -> primary=${roomState.screenMode}, side=${roomState.sideScreenMode}`
      break
    }

    case 'set_camera_view': {
      const preset = (args.preset as CameraPreset) || 'isometric'
      roomState.cameraPreset = preset
      if (typeof args.autoOrbit === 'boolean') {
        roomState.autoOrbit = args.autoOrbit
        if (controls) controls.autoRotate = args.autoOrbit
      }

      if (preset === 'isometric') {
        targetCamPos.set(8.6, 7.0, 8.8)
        targetCamLook.set(-0.4, 1.8, -1.0)
      } else if (preset === 'desk') {
        targetCamPos.set(0.0, 3.75 + roomState.deskHeight * 0.56, 2.25)
        targetCamLook.set(-0.15, 2.2 + roomState.deskHeight * 0.56, -1.95)
      } else if (preset === 'pc') {
        targetCamPos.set(0.25, 2.85 + roomState.deskHeight * 0.56, 0.65)
        targetCamLook.set(2.4, 2.4 + roomState.deskHeight * 0.56, -1.95)
      } else if (preset === 'arcade') {
        targetCamPos.set(-1.45, 2.55, 3.65)
        targetCamLook.set(-3.85, 2.05, 1.3)
      } else if (preset === 'server') {
        targetCamPos.set(-3.55, 2.15, -1.35)
        targetCamLook.set(-4.65, 1.25, -4.45)
      } else if (preset === 'window') {
        targetCamPos.set(-2.85, 3.15, -0.35)
        targetCamLook.set(-5.86, 3.05, -1.8)
      }
      isCameraTransitioning = true
      resultMessage = `Camera moved to '${preset}' (autoOrbit=${roomState.autoOrbit})`
      break
    }

    case 'overclock_system': {
      const enabled = Boolean(args.enabled)
      roomState.isOverclocked = enabled
      roomState.fanSpeedMultiplier = enabled ? 3.8 : 1.0
      if (enabled) {
        roomState.pcOn = true
        roomState.currentTheme = 'crimson'
        roomState.lightColor = '#ff1e42'
        roomState.lightIntensity = 2.2
        roomState.lightsOn = true
        roomState.rgbCycle = false
        syncLightingFromState()
      }
      resultMessage = `Workstation overclock ${enabled ? 'ENGAGED (MAX RPM)' : 'DISENGAGED (NOMINAL)'}`
      break
    }

    case 'control_desk_setup': {
      if (args.posture === 'sit') roomState.deskHeight = 0.0
      else if (args.posture === 'mid') roomState.deskHeight = 0.5
      else if (args.posture === 'stand') roomState.deskHeight = 1.0
      else if (typeof args.height === 'number') {
        roomState.deskHeight = Math.min(1.0, Math.max(0.0, args.height))
      }

      if (typeof args.keyboardRgb === 'boolean') {
        roomState.keyboardRgb = args.keyboardRgb
        if (refs) {
          const kbCol = args.keyboardRgb ? parseInt(roomState.lightColor.replace('#', ''), 16) : 0x0f172a
          refs.keyboardRgbMeshes.forEach((m) => {
            ;(m.material as THREE.MeshBasicMaterial).color.setHex(kbCol)
          })
        }
      }
      resultMessage = `Standing desk height=${deskHeightCm.value}cm, keyboardRgb=${roomState.keyboardRgb}`
      break
    }

    case 'set_hologram_mode': {
      const mode = (args.mode as HologramMode) || 'orbit'
      roomState.hologramMode = mode
      resultMessage = `Holo-Core mode -> '${mode}'`
      break
    }

    case 'set_window_weather': {
      const weather = (args.weather as WeatherMode) || 'cyber_rain'
      roomState.weatherMode = weather
      resultMessage = `City skyline weather -> '${weather}'`
      break
    }

    case 'play_arcade_game': {
      const game = (args.game as ArcadeGameMode) || 'invaders'
      roomState.arcadeMode = game
      roomState.arcadeOn = game !== 'off'
      if (refs) refs.arcadePointLight.intensity = roomState.arcadeOn ? 2.2 : 0
      resultMessage = `Arcade CRT running '${game}'`
      break
    }

    case 'apply_scene_preset': {
      const presetId = (args.preset as ScenePresetName) || 'coding'
      if (typeof args.chairSpin === 'boolean') {
        roomState.chairSpin = args.chairSpin
      }
      const preset = SCENE_PRESETS.find((p) => p.id === presetId)
      if (preset) {
        preset.calls.forEach((c) => executeMcpTool(c.name, c.args))
      }
      resultMessage = `Applied scene preset '${presetId}'`
      break
    }
  }

  pushRpcLog('result', name, {
    jsonrpc: '2.0',
    id: Date.now(),
    result: { content: [{ type: 'text', text: resultMessage }] }
  })
  terminalLines.push(`[MCP] ${resultMessage}`)
  if (terminalLines.length > 40) terminalLines.shift()
}

// --- Natural Language Prompt Runner ---
const handleNaturalLanguagePrompt = () => {
  const raw = promptInput.value.trim()
  if (!raw) return
  isProcessing.value = true

  setTimeout(() => {
    const calls = interpretNaturalLanguagePrompt(raw)
    calls.forEach((c) => executeMcpTool(c.name, c.args))
    promptInput.value = ''
    isProcessing.value = false
  }, 180)
}

const setSamplePrompt = (text: string) => {
  promptInput.value = text
  handleNaturalLanguagePrompt()
}

// Quick Tool Tester from Tools Tab
const invokeDefaultTool = (toolName: string) => {
  switch (toolName) {
    case 'set_ambient_lighting':
      executeMcpTool(toolName, { theme: 'synthwave', intensity: 1.9, rgbCycle: true })
      break
    case 'power_device':
      executeMcpTool(toolName, { target: 'desk_lamp', state: !roomState.deskLampOn })
      break
    case 'set_screen_mode':
      executeMcpTool(toolName, { mode: 'stats', sideMode: 'git' })
      break
    case 'set_camera_view':
      executeMcpTool(toolName, { preset: 'pc', autoOrbit: false })
      break
    case 'overclock_system':
      executeMcpTool(toolName, { enabled: !roomState.isOverclocked })
      break
    case 'control_desk_setup':
      executeMcpTool(toolName, { posture: roomState.deskHeight > 0.5 ? 'sit' : 'stand', keyboardRgb: true })
      break
    case 'set_hologram_mode':
      executeMcpTool(toolName, { mode: roomState.hologramMode === 'helix' ? 'pulse' : 'helix' })
      break
    case 'set_window_weather':
      executeMcpTool(toolName, { weather: roomState.weatherMode === 'cyber_rain' ? 'sunset_grid' : 'cyber_rain' })
      break
    case 'play_arcade_game':
      executeMcpTool(toolName, { game: roomState.arcadeMode === 'invaders' ? 'snake' : 'invaders' })
      break
    case 'apply_scene_preset':
      executeMcpTool(toolName, { preset: 'arcade_night' })
      break
  }
}

// --- Interactive 3D Object Click & Hover Raycasting ---
const updatePointerNdc = (e: PointerEvent) => {
  if (!renderer) return
  const rect = (renderer.domElement as HTMLCanvasElement).getBoundingClientRect()
  pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
}

const raycastHit = (): InteractiveHit | null => {
  if (!camera || !refs) return null
  raycaster.setFromCamera(pointerNdc, camera)
  const hits = raycaster.intersectObjects(refs.interactiveTargets, false)
  const first = hits[0]
  if (!first) return null
  return (first.object.userData.mcpHit as InteractiveHit | undefined) ?? null
}

const onCanvasPointerDown = (e: PointerEvent) => {
  pointerDownPos = { x: e.clientX, y: e.clientY }
}

const onCanvasPointerMove = (e: PointerEvent) => {
  if (!renderer) return
  updatePointerNdc(e)
  const hit = raycastHit()
  hoveredLabel.value = hit ? hit.label : null
  ;(renderer.domElement as HTMLCanvasElement).style.cursor = hit ? 'pointer' : 'grab'
}

const onCanvasPointerUp = (e: PointerEvent) => {
  const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y)
  if (dist > 6) return // Dragging OrbitControls, not a click

  updatePointerNdc(e)
  const hit = raycastHit()
  if (!hit) return

  switch (hit.action) {
    case 'monitor': {
      const order: ScreenMode[] = ['matrix', 'terminal', 'stats', 'eq', 'textools', 'off']
      const next = order[(order.indexOf(roomState.screenMode) + 1) % order.length] ?? 'matrix'
      executeMcpTool('set_screen_mode', { mode: next })
      break
    }
    case 'side_monitor': {
      const order: SideScreenMode[] = ['code', 'logs', 'git', 'off']
      const next = order[(order.indexOf(roomState.sideScreenMode) + 1) % order.length] ?? 'code'
      executeMcpTool('set_screen_mode', { mode: roomState.screenMode, sideMode: next })
      break
    }
    case 'pc':
      executeMcpTool('overclock_system', { enabled: !roomState.isOverclocked })
      break
    case 'arcade': {
      const order: ArcadeGameMode[] = ['invaders', 'snake', 'tetris', 'attract', 'off']
      const next = order[(order.indexOf(roomState.arcadeMode) + 1) % order.length] ?? 'invaders'
      executeMcpTool('play_arcade_game', { game: next })
      break
    }
    case 'server_rack':
      executeMcpTool('power_device', { target: 'server_rack', state: !roomState.serverRackOn })
      break
    case 'desk_lamp':
      executeMcpTool('power_device', { target: 'desk_lamp', state: !roomState.deskLampOn })
      break
    case 'holo_core': {
      const order: HologramMode[] = ['orbit', 'helix', 'pulse', 'off']
      const next = order[(order.indexOf(roomState.hologramMode) + 1) % order.length] ?? 'orbit'
      executeMcpTool('set_hologram_mode', { mode: next })
      break
    }
    case 'window': {
      const order: WeatherMode[] = ['cyber_rain', 'neon_night', 'sunset_grid', 'blinds_closed']
      const next = order[(order.indexOf(roomState.weatherMode) + 1) % order.length] ?? 'cyber_rain'
      executeMcpTool('set_window_weather', { weather: next })
      break
    }
    case 'chair':
      roomState.chairSpin = !roomState.chairSpin
      pushRpcLog('result', 'interaction/chair', { chairSpin: roomState.chairSpin })
      break
  }
}

// --- Build & Mount Three.js Scene ---
const buildScene = async () => {
  if (!canvasContainer.value) return
  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0c1017)
  scene.fog = new THREE.Fog(0x0c1017, 24, 52)

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
  camera.position.copy(targetCamPos)

  // WebGPU Renderer (without powerPreference on Windows, PCFShadowMap for clean shadows)
  try {
    const gpuRenderer = new WebGPURenderer({ antialias: true })
    await gpuRenderer.init()
    renderer = gpuRenderer
    const isWebGPU = Boolean(
      gpuRenderer.backend && 'isWebGPUBackend' in gpuRenderer.backend && gpuRenderer.backend.isWebGPUBackend
    )
    isWebGpuActive.value = isWebGPU
    gpuEngineName.value = isWebGPU ? 'WebGPU' : 'WebGL2'
  } catch (err) {
    console.warn('WebGPURenderer init failed, falling back to WebGLRenderer:', err)
    renderer = new THREE.WebGLRenderer({ antialias: true })
    isWebGpuActive.value = false
    gpuEngineName.value = 'WebGL2'
  }

  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.3

  canvasContainer.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.maxPolarAngle = Math.PI / 2.02
  controls.minDistance = 1.6
  controls.maxDistance = 24
  controls.target.copy(targetCamLook)
  controls.addEventListener('start', () => {
    isCameraTransitioning = false
  })

  const dom = renderer.domElement as HTMLCanvasElement
  dom.addEventListener('pointerdown', onCanvasPointerDown)
  dom.addEventListener('pointermove', onCanvasPointerMove)
  dom.addEventListener('pointerup', onCanvasPointerUp)

  textures = createDynamicTextures()
  refs = buildPlaygroundScene(scene, textures)
  syncLightingFromState()

  let lastTime = performance.now()
  let fpsAccumulator = 0
  let fpsFrames = 0
  let rgbHue = 0
  const tempColor = new THREE.Color()

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    const now = performance.now()
    const delta = Math.min(0.1, (now - lastTime) / 1000)
    lastTime = now

    // FPS counter
    fpsAccumulator += delta
    fpsFrames++
    if (fpsAccumulator >= 0.6) {
      currentFps.value = Math.round(fpsFrames / fpsAccumulator)
      fpsAccumulator = 0
      fpsFrames = 0
    }

    // Smooth camera preset transition (yields immediately when user grabs OrbitControls)
    if (camera && controls) {
      if (isCameraTransitioning) {
        camera.position.lerp(targetCamPos, 0.08)
        controls.target.lerp(targetCamLook, 0.08)
        if (camera.position.distanceTo(targetCamPos) < 0.03 && controls.target.distanceTo(targetCamLook) < 0.03) {
          isCameraTransitioning = false
        }
      }
      controls.autoRotate = roomState.autoOrbit
      controls.update()
    }

    if (refs) {
      // Standing desk smooth elevation
      const targetDeskY = roomState.deskHeight * 0.56
      refs.deskTopGroup.position.y += (targetDeskY - refs.deskTopGroup.position.y) * 0.1

      // Chair spin
      if (roomState.chairSpin) {
        refs.chairUpperGroup.rotation.y += 0.9 * delta
      }

      // Spin PC Fans
      const fanSpeed = roomState.pcOn ? (roomState.isOverclocked ? 22.0 : 5.5) * roomState.fanSpeedMultiplier : 0
      refs.fanMeshes.forEach((fan) => {
        fan.rotation.z += fanSpeed * delta
      })

      // RGB Rainbow Cycle
      if (roomState.rgbCycle && roomState.lightsOn) {
        rgbHue = (rgbHue + delta * 0.16) % 1.0
        tempColor.setHSL(rgbHue, 0.95, 0.55)
        applyAccentHex(tempColor.getHex(), roomState.lightIntensity)
      }

      // Overclock PC RGB pulse
      if (roomState.isOverclocked && roomState.pcOn) {
        refs.pcRgbLight.intensity = (1.1 + Math.sin(now * 0.01) * 0.65) * 1.8
      }

      // Hologram AI Core animations
      const holoOn = roomState.hologramMode !== 'off'
      refs.holoCoreMesh.visible = holoOn
      refs.holoOuterRing.visible = holoOn
      refs.holoInnerRing.visible = holoOn
      refs.holoConeMesh.visible = holoOn
      refs.holoLight.intensity = holoOn ? 1.25 : 0

      if (holoOn) {
        if (roomState.hologramMode === 'orbit') {
          refs.holoCoreMesh.rotation.y += 1.4 * delta
          refs.holoCoreMesh.position.y = 0.36 + Math.sin(now * 0.003) * 0.035
          refs.holoOuterRing.rotation.x += 1.2 * delta
          refs.holoOuterRing.rotation.y += 0.8 * delta
          refs.holoInnerRing.rotation.y -= 1.8 * delta
          refs.holoInnerRing.rotation.z += 0.9 * delta
          refs.holoCoreMesh.scale.setScalar(1)
        } else if (roomState.hologramMode === 'helix') {
          refs.holoCoreMesh.rotation.y += 3.6 * delta
          refs.holoCoreMesh.rotation.x += 1.2 * delta
          refs.holoCoreMesh.position.y = 0.36 + Math.sin(now * 0.006) * 0.07
          refs.holoOuterRing.rotation.set(Math.PI / 2 + Math.sin(now * 0.004) * 0.4, now * 0.002, 0)
          refs.holoInnerRing.rotation.set(Math.PI / 2 - Math.sin(now * 0.004) * 0.4, -now * 0.003, 0)
          refs.holoCoreMesh.scale.setScalar(1.05)
        } else if (roomState.hologramMode === 'pulse') {
          const s = 0.9 + Math.sin(now * 0.007) * 0.25
          refs.holoCoreMesh.scale.setScalar(s)
          refs.holoCoreMesh.rotation.y += 2.2 * delta
          refs.holoOuterRing.rotation.z += 2.0 * delta
          refs.holoInnerRing.rotation.x += 2.0 * delta
          refs.holoLight.intensity = 1.1 + Math.sin(now * 0.007) * 0.65
        }
      }

      // Coffee mug rising steam wisps
      refs.steamMeshes.forEach((steam, idx) => {
        const phase = ((now * 0.0007 + idx * 0.33) % 1)
        steam.position.y = 0.22 + phase * 0.28
        steam.position.x = Math.sin(now * 0.003 + idx * 2) * 0.025
        steam.scale.setScalar(0.6 + phase * 0.9)
        ;(steam.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.35
      })

      // Server rack blinking telemetry LEDs
      refs.serverLedMeshes.forEach((led, idx) => {
        const mat = led.material as THREE.MeshBasicMaterial
        if (!roomState.serverRackOn) {
          mat.color.setHex(0x0f172a)
        } else {
          const blink = Math.sin(now * 0.008 + idx * 1.9) > -0.2
          if (idx % 4 === 0) mat.color.setHex(0x00f0ff)
          else mat.color.setHex(blink ? 0x10b981 : 0x064e3b)
        }
      })
    }

    textures?.updateAll(roomState, terminalLines, now)

    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  animate()
  window.addEventListener('resize', handleResize)
  if (typeof ResizeObserver !== 'undefined' && canvasContainer.value) {
    resizeObserver = new ResizeObserver(() => handleResize())
    resizeObserver.observe(canvasContainer.value)
  }
}

const handleResize = () => {
  if (!canvasContainer.value || !renderer || !camera) return
  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight
  if (width === 0 || height === 0) return
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

// --- WebSocket Bridge ---
const toggleWsConnection = () => {
  if (wsStatus.value === 'connected') {
    wsClient?.close()
    wsClient = null
    wsStatus.value = 'disconnected'
    terminalLines.push('[WS] Disconnected from local bridge.')
    return
  }

  wsStatus.value = 'connecting'
  try {
    wsClient = new WebSocket(wsUrl.value)

    wsClient.onopen = () => {
      wsStatus.value = 'connected'
      terminalLines.push(`[WS] Connected to Bridge: ${wsUrl.value}`)
      pushRpcLog('result', 'bridge/connect', { status: 'connected', tools: MCP_TOOLS.map((t) => t.name) })
    }

    wsClient.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.method === 'tools/list') {
          wsClient?.send(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: { tools: MCP_TOOLS } }))
        } else if (payload.method === 'tools/call') {
          executeMcpTool(payload.params.name, payload.params.arguments || {})
        }
      } catch (err) {
        console.error('Error parsing WS message', err)
      }
    }

    wsClient.onerror = () => {
      wsStatus.value = 'disconnected'
      terminalLines.push('[WS] Bridge unavailable at ' + wsUrl.value)
      pushRpcLog('error', 'bridge/error', { message: 'Local relay not detected at ' + wsUrl.value })
    }

    wsClient.onclose = () => {
      wsStatus.value = 'disconnected'
    }
  } catch {
    wsStatus.value = 'disconnected'
  }
}

const copyRpcLog = (data: unknown) => {
  navigator.clipboard?.writeText(JSON.stringify(data, null, 2))
}

onMounted(async () => {
  await buildScene()
  terminalLines.push(`[OK] 3D Battlestation Mounted (${gpuEngineName.value})`)
  pushRpcLog('result', 'system/init', {
    status: 'ready',
    engine: gpuEngineName.value,
    tools_available: MCP_TOOLS.length
  })
})

onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  window.removeEventListener('resize', handleResize)
  resizeObserver?.disconnect()
  if (renderer?.domElement) {
    const dom = renderer.domElement as HTMLCanvasElement
    dom.removeEventListener('pointerdown', onCanvasPointerDown)
    dom.removeEventListener('pointermove', onCanvasPointerMove)
    dom.removeEventListener('pointerup', onCanvasPointerUp)
  }
  if (wsClient) wsClient.close()
  controls?.dispose()
  textures?.dispose()
  renderer?.dispose()
})
</script>

<template>
  <div class="mcp-playground-container">
    <!-- Top Control Bar (HUD) -->
    <header class="playground-topbar">
      <div class="topbar-left">
        <div class="badge-tag">
          <span class="pulse-dot"></span>
          WEBMCP 3D LAB
        </div>
        <span class="gpu-badge" :class="{ webgpu: isWebGpuActive }">
          ⚡ {{ gpuEngineName.toUpperCase() }} • {{ currentFps }} FPS
        </span>
        <h2 class="playground-title">MCP Playground</h2>
        <span class="theme-chip" :style="{ borderColor: roomState.lightColor, color: roomState.lightColor }">
          {{ roomState.currentTheme.toUpperCase() }}
        </span>
        <span class="telemetry-chip">
          {{ activeDevicesCount }}/7 ONLINE • {{ deskHeightCm }}cm
        </span>
      </div>

      <div class="topbar-right">
        <button
          class="bridge-pill"
          :class="wsStatus"
          title="Configure Local MCP Agent WebSocket Bridge"
          @click="isBridgeModalOpen = true"
        >
          <span class="bridge-indicator"></span>
          <span>Bridge: {{ wsStatus === 'connected' ? 'Connected' : 'Standalone' }}</span>
        </button>

        <button
          class="studio-toggle-btn"
          :class="{ active: isInspectorOpen }"
          title="Toggle MCP Protocol Inspector"
          @click="isInspectorOpen = !isInspectorOpen"
        >
          <span>🎛️</span>
          <span class="btn-label">Studio Controls</span>
        </button>
      </div>
    </header>

    <!-- Main Viewport Layout -->
    <div class="playground-body">
      <!-- 3D WebGPU Canvas Layer -->
      <div ref="canvasContainer" class="canvas-viewport">
        <!-- Floating Camera Presets HUD -->
        <div class="camera-hud">
          <button
            class="cam-btn"
            :class="{ active: roomState.cameraPreset === 'isometric' }"
            @click="executeMcpTool('set_camera_view', { preset: 'isometric', autoOrbit: false })"
          >
            📐 Room
          </button>
          <button
            class="cam-btn"
            :class="{ active: roomState.cameraPreset === 'desk' }"
            @click="executeMcpTool('set_camera_view', { preset: 'desk', autoOrbit: false })"
          >
            🖥️ Desk
          </button>
          <button
            class="cam-btn"
            :class="{ active: roomState.cameraPreset === 'pc' }"
            @click="executeMcpTool('set_camera_view', { preset: 'pc', autoOrbit: false })"
          >
            ⚡ PC Rig
          </button>
          <button
            class="cam-btn"
            :class="{ active: roomState.cameraPreset === 'arcade' }"
            @click="executeMcpTool('set_camera_view', { preset: 'arcade', autoOrbit: false })"
          >
            🕹️ Arcade
          </button>
          <button
            class="cam-btn"
            :class="{ active: roomState.cameraPreset === 'server' }"
            @click="executeMcpTool('set_camera_view', { preset: 'server', autoOrbit: false })"
          >
            🗄️ Server
          </button>
          <button
            class="cam-btn"
            :class="{ active: roomState.cameraPreset === 'window' }"
            @click="executeMcpTool('set_camera_view', { preset: 'window', autoOrbit: false })"
          >
            🌃 City
          </button>
          <button
            class="cam-btn orbit-btn"
            :class="{ active: roomState.autoOrbit }"
            title="Toggle 360° Auto-Orbit"
            @click="executeMcpTool('set_camera_view', { preset: roomState.cameraPreset, autoOrbit: !roomState.autoOrbit })"
          >
            🔄 Orbit
          </button>
        </div>

        <!-- Hover Interactive Object Tooltip -->
        <div v-if="hoveredLabel" class="interact-pill">
          <span>🖱️ {{ hoveredLabel }}</span>
        </div>

        <!-- Floating Prompt Bar (Agent Interface) -->
        <div class="prompt-hud">
          <div class="prompt-bar">
            <span class="prompt-icon">🤖</span>
            <input
              v-model="promptInput"
              type="text"
              placeholder="Ask agent: 'standing desk & stats', 'synthwave rainbow', 'snake on arcade', 'overclock pc'..."
              :disabled="isProcessing"
              @keydown.enter="handleNaturalLanguagePrompt"
            />
            <button
              class="prompt-send-btn"
              :disabled="isProcessing || !promptInput.trim()"
              @click="handleNaturalLanguagePrompt"
            >
              <span>{{ isProcessing ? 'Running...' : 'Execute' }}</span>
              <span>⚡</span>
            </button>
          </div>

          <div class="suggestion-pills">
            <button class="pill" @click="setSamplePrompt('modo coding')">💻 Deep Coding</button>
            <button class="pill" @click="setSamplePrompt('rainbow party mode')">🌈 RGB Cycle</button>
            <button class="pill" @click="setSamplePrompt('stand up & stats')">🧍 Stand + Telemetry</button>
            <button class="pill" @click="setSamplePrompt('snake on arcade')">🐍 Arcade Snake</button>
            <button class="pill" @click="setSamplePrompt('server rack')">🗄️ Inspect Server</button>
            <button class="pill" @click="setSamplePrompt('cyber rain & helix holo')">🌧️ Rain + Helix</button>
            <button class="pill" @click="setSamplePrompt('overclock pc')">🔥 Overclock</button>
          </div>
        </div>
      </div>

      <!-- Side Inspector Panel -->
      <aside v-if="isInspectorOpen" class="inspector-sidebar">
        <div class="inspector-tabs">
          <button :class="{ active: activeTab === 'hud' }" @click="activeTab = 'hud'">
            🎮 Controls
          </button>
          <button :class="{ active: activeTab === 'tools' }" @click="activeTab = 'tools'">
            🛠️ Tools ({{ MCP_TOOLS.length }})
          </button>
          <button :class="{ active: activeTab === 'logs' }" @click="activeTab = 'logs'">
            ⚡ RPC ({{ rpcLogs.length }})
          </button>
        </div>

        <!-- Tab 1: Studio Controls -->
        <div v-if="activeTab === 'hud'" class="tab-content hud-panel">
          <!-- Scene Presets -->
          <div class="control-group">
            <label class="group-label">Scene Presets</label>
            <div class="presets-grid">
              <button
                v-for="preset in SCENE_PRESETS"
                :key="preset.id"
                class="preset-chip"
                @click="executeMcpTool('apply_scene_preset', { preset: preset.id })"
              >
                <span>{{ preset.icon }}</span>
                <span>{{ preset.label }}</span>
              </button>
            </div>
          </div>

          <!-- Ambient Lighting -->
          <div class="control-group">
            <div class="group-header-row">
              <label class="group-label">Ambient Lighting</label>
              <span class="group-val">{{ Math.round(roomState.lightIntensity * 100) }}%</span>
            </div>
            <div class="color-palette">
              <button
                v-for="(cfg, key) in THEME_CONFIGS"
                :key="key"
                class="palette-btn"
                :class="{ active: roomState.currentTheme === key }"
                :style="{ background: cfg.css }"
                :title="cfg.label"
                @click="executeMcpTool('set_ambient_lighting', { theme: key, intensity: key === 'night' ? 0.25 : 1.8, rgbCycle: false })"
              ></button>
              <input
                type="color"
                class="color-picker-mini"
                :value="roomState.lightColor"
                title="Custom Hex Accent Color"
                @input="executeMcpTool('set_ambient_lighting', { theme: roomState.currentTheme, color: ($event.target as HTMLInputElement).value, rgbCycle: false })"
              />
            </div>

            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              :value="roomState.lightIntensity"
              class="cyber-range"
              @input="executeMcpTool('set_ambient_lighting', { theme: roomState.currentTheme, intensity: Number(($event.target as HTMLInputElement).value) })"
            />

            <div class="btn-grid">
              <button
                class="action-btn"
                :class="{ active: roomState.lightsOn }"
                @click="executeMcpTool('power_device', { target: 'room', state: !roomState.lightsOn })"
              >
                💡 Lights: {{ roomState.lightsOn ? 'ON' : 'OFF' }}
              </button>
              <button
                class="action-btn"
                :class="{ active: roomState.rgbCycle }"
                @click="executeMcpTool('set_ambient_lighting', { theme: roomState.currentTheme, rgbCycle: !roomState.rgbCycle })"
              >
                🌈 RGB Cycle: {{ roomState.rgbCycle ? 'ON' : 'OFF' }}
              </button>
            </div>
          </div>

          <!-- Standing Desk & Hardware -->
          <div class="control-group">
            <div class="group-header-row">
              <label class="group-label">Motorized Standing Desk</label>
              <span class="group-val">{{ deskHeightCm }} cm</span>
            </div>
            <div class="btn-three-grid">
              <button
                class="action-btn"
                :class="{ active: roomState.deskHeight < 0.25 }"
                @click="executeMcpTool('control_desk_setup', { posture: 'sit' })"
              >
                🪑 Sit
              </button>
              <button
                class="action-btn"
                :class="{ active: roomState.deskHeight >= 0.25 && roomState.deskHeight <= 0.75 }"
                @click="executeMcpTool('control_desk_setup', { posture: 'mid' })"
              >
                ⚖️ Mid
              </button>
              <button
                class="action-btn"
                :class="{ active: roomState.deskHeight > 0.75 }"
                @click="executeMcpTool('control_desk_setup', { posture: 'stand' })"
              >
                🧍 Stand
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="roomState.deskHeight"
              class="cyber-range"
              @input="executeMcpTool('control_desk_setup', { height: Number(($event.target as HTMLInputElement).value) })"
            />
            <div class="btn-grid">
              <button
                class="action-btn"
                :class="{ active: roomState.keyboardRgb }"
                @click="executeMcpTool('control_desk_setup', { keyboardRgb: !roomState.keyboardRgb })"
              >
                ⌨️ Key RGB: {{ roomState.keyboardRgb ? 'ON' : 'OFF' }}
              </button>
              <button
                class="action-btn"
                :class="{ active: roomState.chairSpin }"
                @click="roomState.chairSpin = !roomState.chairSpin"
              >
                💺 Chair Spin: {{ roomState.chairSpin ? 'ON' : 'OFF' }}
              </button>
            </div>
          </div>

          <!-- Primary & Secondary Displays -->
          <div class="control-group">
            <label class="group-label">Curved Ultrawide Display</label>
            <div class="btn-three-grid">
              <button
                v-for="m in (['matrix', 'terminal', 'stats', 'eq', 'textools', 'off'] as ScreenMode[])"
                :key="m"
                class="action-btn"
                :class="{ active: roomState.screenMode === m }"
                @click="executeMcpTool('set_screen_mode', { mode: m })"
              >
                {{ m.toUpperCase() }}
              </button>
            </div>

            <label class="group-label sub-label">Vertical Coding Monitor</label>
            <div class="btn-four-grid">
              <button
                v-for="sm in (['code', 'logs', 'git', 'off'] as SideScreenMode[])"
                :key="sm"
                class="action-btn"
                :class="{ active: roomState.sideScreenMode === sm }"
                @click="executeMcpTool('set_screen_mode', { mode: roomState.screenMode, sideMode: sm })"
              >
                {{ sm.toUpperCase() }}
              </button>
            </div>

            <button
              class="action-btn oc-btn"
              :class="{ overclocked: roomState.isOverclocked }"
              @click="executeMcpTool('overclock_system', { enabled: !roomState.isOverclocked })"
            >
              ⚡ {{ roomState.isOverclocked ? 'DISENGAGE OVERCLOCK' : 'OVERCLOCK WORKSTATION' }}
            </button>
          </div>

          <!-- Holo-Core & City Window -->
          <div class="control-group">
            <label class="group-label">Holo-Core AI Emitter</label>
            <div class="btn-four-grid">
              <button
                v-for="hm in (['orbit', 'helix', 'pulse', 'off'] as HologramMode[])"
                :key="hm"
                class="action-btn"
                :class="{ active: roomState.hologramMode === hm }"
                @click="executeMcpTool('set_hologram_mode', { mode: hm })"
              >
                {{ hm.toUpperCase() }}
              </button>
            </div>

            <label class="group-label sub-label">City Skyline Window</label>
            <div class="btn-grid">
              <button
                class="action-btn"
                :class="{ active: roomState.weatherMode === 'cyber_rain' }"
                @click="executeMcpTool('set_window_weather', { weather: 'cyber_rain' })"
              >
                🌧️ Cyber Rain
              </button>
              <button
                class="action-btn"
                :class="{ active: roomState.weatherMode === 'neon_night' }"
                @click="executeMcpTool('set_window_weather', { weather: 'neon_night' })"
              >
                🌃 Neon Night
              </button>
              <button
                class="action-btn"
                :class="{ active: roomState.weatherMode === 'sunset_grid' }"
                @click="executeMcpTool('set_window_weather', { weather: 'sunset_grid' })"
              >
                🌆 Synth Sunset
              </button>
              <button
                class="action-btn"
                :class="{ active: roomState.weatherMode === 'blinds_closed' }"
                @click="executeMcpTool('set_window_weather', { weather: 'blinds_closed' })"
              >
                🪟 Blinds Shut
              </button>
            </div>
          </div>

          <!-- Room Devices & Arcade -->
          <div class="control-group">
            <label class="group-label">Room Hardware & Arcade CRT</label>
            <div class="btn-grid">
              <button
                class="action-btn"
                :class="{ active: roomState.deskLampOn }"
                @click="executeMcpTool('power_device', { target: 'desk_lamp', state: !roomState.deskLampOn })"
              >
                🛋️ Lamp: {{ roomState.deskLampOn ? 'ON' : 'OFF' }}
              </button>
              <button
                class="action-btn"
                :class="{ active: roomState.serverRackOn }"
                @click="executeMcpTool('power_device', { target: 'server_rack', state: !roomState.serverRackOn })"
              >
                🗄️ Rack: {{ roomState.serverRackOn ? 'ONLINE' : 'OFF' }}
              </button>
              <button
                class="action-btn"
                :class="{ active: roomState.speakersOn }"
                @click="executeMcpTool('power_device', { target: 'speakers', state: !roomState.speakersOn })"
              >
                🔊 Audio: {{ roomState.speakersOn ? 'ON' : 'MUTE' }}
              </button>
              <button
                class="action-btn"
                :class="{ active: roomState.pcOn }"
                @click="executeMcpTool('power_device', { target: 'pc', state: !roomState.pcOn })"
              >
                🖥️ PC: {{ roomState.pcOn ? 'ON' : 'OFF' }}
              </button>
            </div>

            <label class="group-label sub-label">Arcade Cartridge</label>
            <div class="btn-four-grid">
              <button
                v-for="ag in (['invaders', 'snake', 'tetris', 'off'] as ArcadeGameMode[])"
                :key="ag"
                class="action-btn"
                :class="{ active: roomState.arcadeMode === ag }"
                @click="executeMcpTool('play_arcade_game', { game: ag })"
              >
                {{ ag.toUpperCase() }}
              </button>
            </div>
          </div>
        </div>

        <!-- Tab 2: MCP Tools Schema List -->
        <div v-else-if="activeTab === 'tools'" class="tab-content tools-panel">
          <p class="tab-desc">Registered WebMCP JSON Schema tools ({{ MCP_TOOLS.length }} active):</p>
          <div v-for="tool in MCP_TOOLS" :key="tool.name" class="tool-card">
            <div class="tool-header">
              <span class="tool-name">{{ tool.name }}</span>
              <button class="tool-run-btn" @click="invokeDefaultTool(tool.name)">▶ Test</button>
            </div>
            <p class="tool-desc">{{ tool.description }}</p>
            <div class="tool-params">
              <div v-for="(prop, pName) in tool.parameters.properties" :key="pName" class="param-row">
                <code class="param-name">{{ pName }}</code>
                <span class="param-type">{{ prop.type }}</span>
                <span v-if="prop.enum" class="param-enum">[{{ prop.enum.join(' | ') }}]</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: JSON-RPC Live Log Stream -->
        <div v-else-if="activeTab === 'logs'" class="tab-content logs-panel">
          <div class="logs-header">
            <span class="logs-count">{{ rpcLogs.length }} JSON-RPC events</span>
            <button class="clear-btn" @click="rpcLogs = []">Clear</button>
          </div>

          <div v-if="rpcLogs.length === 0" class="empty-logs">
            No JSON-RPC calls logged yet. Interact with the 3D scene or run a prompt!
          </div>

          <div v-for="log in rpcLogs" :key="log.id" class="log-entry" :class="log.direction">
            <div class="log-meta">
              <span class="log-dir">{{ log.direction.toUpperCase() }}</span>
              <span class="log-method">{{ log.method }}</span>
              <span class="log-time">{{ log.timestamp }}</span>
              <button class="copy-rpc-btn" title="Copy JSON" @click="copyRpcLog(log.data)">📋</button>
            </div>
            <pre class="log-json"><code>{{ JSON.stringify(log.data, null, 2) }}</code></pre>
          </div>
        </div>
      </aside>
    </div>

    <!-- Local WebSocket Bridge Modal -->
    <div v-if="isBridgeModalOpen" class="bridge-modal-backdrop" @click.self="isBridgeModalOpen = false">
      <div class="bridge-modal">
        <div class="modal-header">
          <h3>🔗 Local Agent WebSocket Bridge</h3>
          <button class="close-btn" @click="isBridgeModalOpen = false">&times;</button>
        </div>

        <div class="modal-body">
          <p class="modal-desc">
            Connect an external MCP client or AI agent directly to this 3D Digital Twin over a local WebSocket relay. Supports <code>tools/list</code> and <code>tools/call</code> for all {{ MCP_TOOLS.length }} tools.
          </p>

          <div class="input-row">
            <label>WebSocket Relay Endpoint:</label>
            <div class="ws-input-group">
              <input v-model="wsUrl" type="text" placeholder="ws://localhost:8765" />
              <button class="btn-connect" :class="wsStatus" @click="toggleWsConnection">
                {{ wsStatus === 'connected' ? 'Disconnect' : 'Connect' }}
              </button>
            </div>
          </div>

          <div class="code-snippet-box">
            <div class="snippet-header">
              <span>Quick Node.js Bridge (bridge.js)</span>
            </div>
            <pre><code>import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ port: 8765 });
wss.on('connection', (ws) => {
  console.log('TexTools 3D Room Connected!');
  process.stdin.on('data', (data) => ws.send(data));
});</code></pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mcp-playground-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  min-height: 620px;
  background: #090c12;
  border-radius: 12px;
  border: 1px solid rgba(255, 30, 66, 0.2);
  overflow: hidden;
  position: relative;
}

/* Topbar */
.playground-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #0f1420;
  border-bottom: 1px solid #1c2638;
  gap: 10px;
  flex-wrap: wrap;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.badge-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(255, 30, 66, 0.15);
  border: 1px solid rgba(255, 30, 66, 0.4);
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  color: #ff1e42;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.gpu-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 700;
  font-family: var(--font-mono);
  background: rgba(0, 240, 255, 0.12);
  border: 1px solid rgba(0, 240, 255, 0.35);
  color: #00f0ff;
  white-space: nowrap;
}

.gpu-badge.webgpu {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.4);
  color: #34d399;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background: #ff1e42;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.playground-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #f8fafc;
  white-space: nowrap;
}

.theme-chip {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  border: 1px solid;
  border-radius: 999px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.telemetry-chip {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: #94a3b8;
  background: #141b2b;
  border: 1px solid #23304a;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.bridge-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px;
  background: #141b2b;
  border: 1px solid #23304a;
  border-radius: 20px;
  color: #cbd5e1;
  font-size: 0.75rem;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s;
}

.bridge-pill:hover {
  border-color: #ff1e42;
}

.bridge-indicator {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #64748b;
  flex-shrink: 0;
}

.bridge-pill.connected .bridge-indicator {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.bridge-pill.connecting .bridge-indicator {
  background: #f59e0b;
}

.studio-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  background: #141b2b;
  border: 1px solid #23304a;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 0.76rem;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s;
}

.studio-toggle-btn:hover, .studio-toggle-btn.active {
  background: rgba(255, 30, 66, 0.15);
  border-color: #ff1e42;
  color: #ffffff;
}

/* Body */
.playground-body {
  display: flex;
  flex: 1;
  position: relative;
  overflow: hidden;
}

.canvas-viewport {
  flex: 1;
  position: relative;
  background: #0c1017;
  min-width: 0;
}

.canvas-viewport :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

/* Camera HUD */
.camera-hud {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  z-index: 10;
  pointer-events: none;
}

.cam-btn {
  pointer-events: auto;
  padding: 5px 10px;
  background: rgba(15, 20, 32, 0.86);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #94a3b8;
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.cam-btn:hover, .cam-btn.active {
  background: rgba(255, 30, 66, 0.22);
  border-color: #ff1e42;
  color: #ffffff;
}

.orbit-btn.active {
  background: rgba(0, 240, 255, 0.18);
  border-color: #00f0ff;
  color: #00f0ff;
}

.interact-pill {
  position: absolute;
  top: 52px;
  left: 12px;
  z-index: 10;
  padding: 5px 12px;
  background: rgba(9, 13, 22, 0.92);
  border: 1px solid #00f0ff;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #00f0ff;
  pointer-events: none;
  box-shadow: 0 4px 16px rgba(0, 240, 255, 0.2);
}

/* Prompt HUD */
.prompt-hud {
  position: absolute;
  bottom: 14px;
  left: 14px;
  right: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
  max-width: 820px;
  margin: 0 auto;
}

.prompt-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  background: rgba(15, 20, 32, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 30, 66, 0.4);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.prompt-icon {
  font-size: 1.15rem;
}

.prompt-bar input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #f8fafc;
  font-size: 0.86rem;
}

.prompt-bar input::placeholder {
  color: #64748b;
}

.prompt-send-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: #ff1e42;
  border: none;
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.prompt-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.suggestion-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.pill {
  padding: 4px 10px;
  background: rgba(15, 20, 32, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  color: #cbd5e1;
  font-size: 0.71rem;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}

.pill:hover {
  background: rgba(255, 30, 66, 0.16);
  border-color: #ff1e42;
  color: #ffffff;
}

/* Inspector Sidebar */
.inspector-sidebar {
  width: 325px;
  flex-shrink: 0;
  background: #0f1420;
  border-left: 1px solid #1c2638;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.inspector-tabs {
  display: flex;
  border-bottom: 1px solid #1c2638;
}

.inspector-tabs button {
  flex: 1;
  padding: 10px 6px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
}

.inspector-tabs button.active {
  color: #ff1e42;
  border-bottom-color: #ff1e42;
  background: rgba(255, 30, 66, 0.05);
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px 16px 16px 14px;
}

/* HUD Panel Controls */
.control-group {
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.group-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.group-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}

.group-header-row .group-label {
  margin-bottom: 0;
}

.sub-label {
  margin-top: 10px;
}

.group-val {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: #00f0ff;
  font-weight: 700;
}

.presets-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  background: #141b2b;
  border: 1px solid #23304a;
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.preset-chip:hover {
  border-color: #ff1e42;
  background: rgba(255, 30, 66, 0.12);
}

.color-palette {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.palette-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s;
}

.palette-btn:hover {
  transform: scale(1.1);
}

.palette-btn.active {
  border-color: #ffffff;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.45);
}

.color-picker-mini {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid #334155;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.cyber-range {
  width: 100%;
  margin-bottom: 10px;
  accent-color: #ff1e42;
  cursor: pointer;
}

.action-btn {
  width: 100%;
  padding: 7px 6px;
  background: #141b2b;
  border: 1px solid #23304a;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover, .action-btn.active {
  background: rgba(255, 30, 66, 0.16);
  border-color: #ff1e42;
  color: #ffffff;
}

.btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.btn-three-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 8px;
}

.btn-four-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  margin-bottom: 8px;
}

.oc-btn {
  margin-top: 4px;
  background: rgba(255, 30, 66, 0.1);
  border-color: rgba(255, 30, 66, 0.35);
  color: #ff4d6d;
  font-weight: 700;
}

.oc-btn.overclocked {
  background: #ff1e42;
  color: #ffffff;
  animation: pulse 1s infinite;
}

/* Tools Panel */
.tab-desc {
  font-size: 0.74rem;
  color: #94a3b8;
  margin-bottom: 10px;
}

.tool-card {
  background: #141b2b;
  border: 1px solid #23304a;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 10px;
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.tool-name {
  font-family: var(--font-mono);
  font-weight: 700;
  color: #f8fafc;
  font-size: 0.78rem;
}

.tool-run-btn {
  font-size: 0.66rem;
  background: rgba(0, 240, 255, 0.15);
  border: 1px solid rgba(0, 240, 255, 0.35);
  color: #00f0ff;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 700;
  cursor: pointer;
}

.tool-run-btn:hover {
  background: #00f0ff;
  color: #090c12;
}

.tool-desc {
  font-size: 0.71rem;
  color: #94a3b8;
  margin: 4px 0 8px;
}

.param-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 5px;
  font-size: 0.68rem;
  margin-bottom: 2px;
}

.param-name {
  color: #ff4d6d;
}

.param-type {
  color: #64748b;
}

.param-enum {
  color: #a855f7;
}

/* Logs Panel */
.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.logs-count {
  font-size: 0.72rem;
  color: #64748b;
}

.clear-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.72rem;
  cursor: pointer;
}

.clear-btn:hover {
  color: #ff1e42;
}

.empty-logs {
  font-size: 0.78rem;
  color: #64748b;
  text-align: center;
  padding: 24px 0;
}

.log-entry {
  background: #090c12;
  border-left: 3px solid #64748b;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
}

.log-entry.call { border-left-color: #00f0ff; }
.log-entry.result { border-left-color: #10b981; }
.log-entry.error { border-left-color: #ef4444; }

.log-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.66rem;
  margin-bottom: 4px;
}

.log-dir { font-weight: 700; color: #00f0ff; }
.log-entry.result .log-dir { color: #10b981; }
.log-method { color: #e2e8f0; font-family: var(--font-mono); }
.log-time { margin-left: auto; color: #64748b; }

.copy-rpc-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.72rem;
  opacity: 0.7;
}

.copy-rpc-btn:hover { opacity: 1; }

.log-json {
  margin: 0;
  font-size: 0.66rem;
  color: #cbd5e1;
  max-height: 110px;
  overflow-y: auto;
}

/* Bridge Modal */
.bridge-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.bridge-modal {
  width: 90%;
  max-width: 560px;
  background: #0f1420;
  border: 1px solid #1c2638;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.modal-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 1.05rem;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 1.4rem;
  color: #94a3b8;
  cursor: pointer;
}

.modal-desc {
  font-size: 0.82rem;
  color: #94a3b8;
  line-height: 1.5;
  margin-bottom: 16px;
}

.input-row {
  margin-bottom: 16px;
}

.input-row label {
  display: block;
  font-size: 0.76rem;
  color: #cbd5e1;
  margin-bottom: 6px;
}

.ws-input-group {
  display: flex;
  gap: 8px;
}

.ws-input-group input {
  flex: 1;
  background: #141b2b;
  border: 1px solid #23304a;
  border-radius: 6px;
  padding: 8px 12px;
  color: #ffffff;
  font-family: monospace;
}

.btn-connect {
  padding: 8px 16px;
  background: #ff1e42;
  border: none;
  border-radius: 6px;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
}

.btn-connect.connected {
  background: #10b981;
}

.code-snippet-box {
  background: #090c12;
  border: 1px solid #1c2638;
  border-radius: 6px;
  padding: 10px;
}

.snippet-header {
  font-size: 0.72rem;
  color: #64748b;
  margin-bottom: 6px;
}

.code-snippet-box pre {
  margin: 0;
  font-size: 0.72rem;
  color: #38bdf8;
  overflow-x: auto;
}

@media (max-width: 1024px) {
  .mcp-playground-container {
    height: auto;
    min-height: 760px;
  }

  .playground-body {
    flex-direction: column;
  }

  .canvas-viewport {
    min-height: 460px;
    height: 480px;
  }

  .inspector-sidebar {
    width: 100%;
    max-height: 420px;
    border-left: none;
    border-top: 1px solid #1c2638;
  }
}
</style>
