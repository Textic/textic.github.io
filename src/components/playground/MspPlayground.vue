<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// --- WebMCP Tool Definitions (JSON Schema Specification) ---
interface McpTool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required: string[]
  }
}

const MCP_TOOLS: McpTool[] = [
  {
    name: 'set_ambient_lighting',
    description: 'Adjust the room ambient lighting color, intensity, and mood theme.',
    parameters: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          description: 'Lighting theme preset',
          enum: ['crimson', 'cyber', 'matrix', 'night', 'day']
        },
        color: { type: 'string', description: 'Hex color string (e.g. #ff1e42)' },
        intensity: { type: 'number', description: 'Light intensity from 0.0 to 2.0' }
      },
      required: ['theme']
    }
  },
  {
    name: 'power_device',
    description: 'Turn on or off devices inside the cyber room (PC, Arcade Cabinet, or Room Lights).',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Device to toggle', enum: ['pc', 'arcade', 'room'] },
        state: { type: 'boolean', description: 'True for on, false for off' }
      },
      required: ['target', 'state']
    }
  },
  {
    name: 'set_screen_mode',
    description: 'Change the display output of the curved battlestation monitor.',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          description: 'Display mode',
          enum: ['matrix', 'terminal', 'textools', 'off']
        }
      },
      required: ['mode']
    }
  },
  {
    name: 'set_camera_view',
    description: 'Move the camera to a specific preset angle with smooth animation.',
    parameters: {
      type: 'object',
      properties: {
        preset: {
          type: 'string',
          description: 'Target camera angle',
          enum: ['isometric', 'desk', 'arcade']
        }
      },
      required: ['preset']
    }
  },
  {
    name: 'overclock_system',
    description: 'Overclock the PC workstation, speeding up cooling fans and pulsing crimson RGB.',
    parameters: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'Enable or disable extreme overclock' }
      },
      required: ['enabled']
    }
  }
]

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

// Scene State Reactive
const roomState = reactive({
  lightsOn: true,
  currentTheme: 'crimson',
  lightColor: '#ff1e42',
  pcOn: true,
  arcadeOn: true,
  screenMode: 'matrix' as 'matrix' | 'terminal' | 'textools' | 'off',
  cameraPreset: 'isometric' as 'isometric' | 'desk' | 'arcade',
  isOverclocked: false,
  fanSpeedMultiplier: 1.0
})

// Optional WebSocket Bridge (Option B)
const wsStatus = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
const wsUrl = ref('ws://localhost:8765')
let wsClient: WebSocket | null = null

// Three.js References
const canvasContainer = ref<HTMLDivElement | null>(null)
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let animFrameId: number | null = null

// Scene Object References
let ambientLight: THREE.AmbientLight
let roomCeilingLight: THREE.PointLight
let deskLedLight: THREE.PointLight
let pcRgbLight: THREE.PointLight
let arcadeMarqueeLight: THREE.PointLight
let deskLedMesh: THREE.Mesh
let fanMeshes: THREE.Mesh[] = []

// Dynamic Monitor Screen Canvas Texture
let screenCanvas: HTMLCanvasElement
let screenCtx: CanvasRenderingContext2D | null
let screenTexture: THREE.CanvasTexture | null
let matrixDrops: number[] = []
let terminalLines: string[] = []

// Camera Animation State
const targetCamPos = new THREE.Vector3(9, 7, 9)
const targetCamLook = new THREE.Vector3(0, 1.2, 0)

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
  if (rpcLogs.value.length > 30) rpcLogs.value.pop()
}

// --- Dynamic Canvas Textures (Monitor Screen) ---
const initScreenCanvas = () => {
  screenCanvas = document.createElement('canvas')
  screenCanvas.width = 512
  screenCanvas.height = 256
  screenCtx = screenCanvas.getContext('2d')

  // Matrix characters
  const cols = Math.floor(screenCanvas.width / 16)
  matrixDrops = Array.from({ length: cols }, () => Math.floor(Math.random() * -30))

  terminalLines = [
    '[SYSTEM] TexTools OS 2.4.0 Bootloader',
    '[OK] Memory Matrix 64GB Allocated',
    '[OK] WebMCP Daemon listening on channel 0',
    '[OK] Three.js Engine WebGL2 initialized',
    '[SYS] Workstation online. Ready for agent prompt.'
  ]

  screenTexture = new THREE.CanvasTexture(screenCanvas)
  screenTexture.generateMipmaps = false
  screenTexture.minFilter = THREE.LinearFilter
}

const updateScreenCanvas = () => {
  if (!screenCtx) return

  if (!roomState.pcOn || roomState.screenMode === 'off') {
    screenCtx.fillStyle = '#05070a'
    screenCtx.fillRect(0, 0, screenCanvas.width, screenCanvas.height)
    if (screenTexture) screenTexture.needsUpdate = true
    return
  }

  if (roomState.screenMode === 'matrix') {
    screenCtx.fillStyle = 'rgba(5, 10, 8, 0.2)'
    screenCtx.fillRect(0, 0, screenCanvas.width, screenCanvas.height)

    screenCtx.fillStyle = roomState.isOverclocked ? '#ff1e42' : '#00ff88'
    screenCtx.font = '14px monospace'

    const chars = '01ABCDEFGHJKLMNOPQRSTUVWXYZ$#@%&*+-/='
    for (let i = 0; i < matrixDrops.length; i++) {
      const char = chars[Math.floor(Math.random() * chars.length)] || '0'
      const dropY = matrixDrops[i] ?? 0
      screenCtx.fillText(char, i * 16, dropY * 16)

      if (dropY * 16 > screenCanvas.height && Math.random() > 0.975) {
        matrixDrops[i] = 0
      } else {
        matrixDrops[i] = dropY + 1
      }
    }
  } else if (roomState.screenMode === 'terminal') {
    screenCtx.fillStyle = '#080c14'
    screenCtx.fillRect(0, 0, screenCanvas.width, screenCanvas.height)

    screenCtx.fillStyle = '#00f0ff'
    screenCtx.font = 'bold 13px monospace'
    screenCtx.fillText('// WEBMCP AGENT TERMINAL', 15, 25)

    screenCtx.strokeStyle = '#1e283d'
    screenCtx.beginPath()
    screenCtx.moveTo(15, 34)
    screenCtx.lineTo(497, 34)
    screenCtx.stroke()

    screenCtx.font = '12px monospace'
    screenCtx.fillStyle = '#e2e8f0'
    let y = 60
    for (const line of terminalLines.slice(-9)) {
      screenCtx.fillText(line, 20, y)
      y += 20
    }

    // Blinking cursor
    if (Math.floor(Date.now() / 400) % 2 === 0) {
      screenCtx.fillStyle = '#ff1e42'
      screenCtx.fillRect(20, y - 10, 8, 14)
    }
  } else if (roomState.screenMode === 'textools') {
    screenCtx.fillStyle = '#0a0d14'
    screenCtx.fillRect(0, 0, screenCanvas.width, screenCanvas.height)

    // Border glow
    screenCtx.strokeStyle = '#ff1e42'
    screenCtx.lineWidth = 4
    screenCtx.strokeRect(6, 6, screenCanvas.width - 12, screenCanvas.height - 12)

    screenCtx.textAlign = 'center'
    screenCtx.font = 'bold 32px sans-serif'
    screenCtx.fillStyle = '#ffffff'
    screenCtx.fillText('TexTools', screenCanvas.width / 2, 110)

    screenCtx.font = 'bold 16px monospace'
    screenCtx.fillStyle = '#ff1e42'
    screenCtx.fillText('DEVELOPER BATTLESTATION 3D', screenCanvas.width / 2, 145)

    screenCtx.font = '12px monospace'
    screenCtx.fillStyle = '#94a3b8'
    screenCtx.fillText('WebMCP Digital Twin • System Online', screenCanvas.width / 2, 185)
    screenCtx.textAlign = 'start'
  }

  if (screenTexture) screenTexture.needsUpdate = true
}

// --- Three.js Procedural Room Builder ---
const buildScene = () => {
  if (!canvasContainer.value) return

  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight

  // 1. Scene & Fog
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0c10)
  scene.fog = new THREE.FogExp2(0x0a0c10, 0.035)

  // 2. Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
  camera.position.copy(targetCamPos)

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1

  canvasContainer.value.appendChild(renderer.domElement)

  // 4. Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.maxPolarAngle = Math.PI / 2.05
  controls.minDistance = 4
  controls.maxDistance = 22
  controls.target.copy(targetCamLook)

  // --- Lighting Setup ---
  ambientLight = new THREE.AmbientLight(0x2d3748, 0.6)
  scene.add(ambientLight)

  // Main Ceiling Point Light (the room primary illumination)
  roomCeilingLight = new THREE.PointLight(0xff1e42, 1.8, 16, 1.4)
  roomCeilingLight.position.set(0, 4.8, 0)
  roomCeilingLight.castShadow = true
  roomCeilingLight.shadow.mapSize.width = 1024
  roomCeilingLight.shadow.mapSize.height = 1024
  roomCeilingLight.shadow.bias = -0.002
  scene.add(roomCeilingLight)

  // Ceiling Light Fixture (Visual Mesh)
  const lampGeo = new THREE.CylinderGeometry(0.4, 0.6, 0.2, 16)
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.3, metalness: 0.8 })
  const lampMesh = new THREE.Mesh(lampGeo, lampMat)
  lampMesh.position.set(0, 4.9, 0)
  scene.add(lampMesh)

  // Desk LED Strip Light
  deskLedLight = new THREE.PointLight(0xff1e42, 1.2, 5, 1.8)
  deskLedLight.position.set(0, 1.6, -1.8)
  scene.add(deskLedLight)

  // PC RGB Light
  pcRgbLight = new THREE.PointLight(0xff0055, 1.0, 3.5, 1.8)
  pcRgbLight.position.set(2.4, 1.9, -1.5)
  scene.add(pcRgbLight)

  // Arcade Marquee Light
  arcadeMarqueeLight = new THREE.PointLight(0x00f0ff, 1.2, 4.5, 1.6)
  arcadeMarqueeLight.position.set(-3.2, 3.2, -1.6)
  scene.add(arcadeMarqueeLight)

  // --- Room Geometry (Floor & Isometric Walls) ---
  // Floor
  const floorGeo = new THREE.PlaneGeometry(12, 12)
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0e121a,
    roughness: 0.6,
    metalness: 0.3
  })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // Subtle Floor Grid Helper
  const grid = new THREE.GridHelper(12, 16, 0xff1e42, 0x1c2436)
  grid.position.y = 0.005
  scene.add(grid)

  // Back Wall (Z = -6)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f1420, roughness: 0.8 })
  const backWallGeo = new THREE.BoxGeometry(12, 6, 0.2)
  const backWall = new THREE.Mesh(backWallGeo, wallMat)
  backWall.position.set(0, 3, -6)
  backWall.receiveShadow = true
  scene.add(backWall)

  // Left Wall (X = -6)
  const leftWallGeo = new THREE.BoxGeometry(0.2, 6, 12)
  const leftWall = new THREE.Mesh(leftWallGeo, wallMat)
  leftWall.position.set(-6, 3, 0)
  leftWall.receiveShadow = true
  scene.add(leftWall)

  // Baseboards / Cyber Neon Trims
  const trimMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 })
  const trimBack = new THREE.Mesh(new THREE.BoxGeometry(12, 0.05, 0.05), trimMat)
  trimBack.position.set(0, 0.025, -5.9)
  scene.add(trimBack)

  const trimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 12), trimMat)
  trimLeft.position.set(-5.9, 0.025, 0)
  scene.add(trimLeft)

  // --- Battlestation Desk ---
  const deskGroup = new THREE.Group()

  // Table Top
  const deskTopGeo = new THREE.BoxGeometry(5.4, 0.12, 2.2)
  const deskTopMat = new THREE.MeshStandardMaterial({
    color: 0x151b27,
    roughness: 0.3,
    metalness: 0.6
  })
  const deskTop = new THREE.Mesh(deskTopGeo, deskTopMat)
  deskTop.position.set(0, 1.7, -1.6)
  deskTop.castShadow = true
  deskTop.receiveShadow = true
  deskGroup.add(deskTop)

  // Desk LED Edge Strip
  const ledGeo = new THREE.BoxGeometry(5.42, 0.04, 0.04)
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 })
  deskLedMesh = new THREE.Mesh(ledGeo, ledMat)
  deskLedMesh.position.set(0, 1.68, -0.48)
  deskGroup.add(deskLedMesh)

  // Desk Legs (Metallic Modern K-Frame)
  const legMat = new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.5, metalness: 0.8 })
  const legGeo = new THREE.BoxGeometry(0.12, 1.7, 1.8)

  const leftLeg = new THREE.Mesh(legGeo, legMat)
  leftLeg.position.set(-2.4, 0.85, -1.6)
  leftLeg.castShadow = true
  deskGroup.add(leftLeg)

  const rightLeg = new THREE.Mesh(legGeo, legMat)
  rightLeg.position.set(2.4, 0.85, -1.6)
  rightLeg.castShadow = true
  deskGroup.add(rightLeg)

  // Desk Mat / Mousepad
  const padGeo = new THREE.BoxGeometry(3.6, 0.02, 1.2)
  const padMat = new THREE.MeshStandardMaterial({ color: 0x090c12, roughness: 0.9 })
  const deskPad = new THREE.Mesh(padGeo, padMat)
  deskPad.position.set(0, 1.765, -1.4)
  deskGroup.add(deskPad)

  // Mechanical Keyboard
  const kbGeo = new THREE.BoxGeometry(1.6, 0.04, 0.55)
  const kbMat = new THREE.MeshStandardMaterial({ color: 0x1a2130, roughness: 0.4 })
  const kb = new THREE.Mesh(kbGeo, kbMat)
  kb.position.set(-0.2, 1.78, -1.3)
  kb.castShadow = true
  deskGroup.add(kb)

  // Mouse
  const mouseGeo = new THREE.BoxGeometry(0.2, 0.04, 0.35)
  const mouseMat = new THREE.MeshStandardMaterial({ color: 0x222a3a, roughness: 0.3 })
  const mouse = new THREE.Mesh(mouseGeo, mouseMat)
  mouse.position.set(1.0, 1.78, -1.3)
  deskGroup.add(mouse)

  // Ultrawide Curved Monitor
  const monitorStandBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.04, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x111622, metalness: 0.7 })
  )
  monitorStandBase.position.set(0, 1.78, -2.1)
  deskGroup.add(monitorStandBase)

  const monitorArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x111622, metalness: 0.8 })
  )
  monitorArm.position.set(0, 2.2, -2.1)
  deskGroup.add(monitorArm)

  // Screen Frame
  const frameGeo = new THREE.BoxGeometry(3.4, 1.5, 0.1)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0d121c, roughness: 0.4, metalness: 0.6 })
  const screenFrame = new THREE.Mesh(frameGeo, frameMat)
  screenFrame.position.set(0, 2.7, -1.95)
  screenFrame.castShadow = true
  deskGroup.add(screenFrame)

  // Display Screen Mesh (Connected to Dynamic CanvasTexture)
  initScreenCanvas()
  const displayGeo = new THREE.PlaneGeometry(3.28, 1.38)
  const displayMat = new THREE.MeshBasicMaterial({ map: screenTexture })
  const displayScreen = new THREE.Mesh(displayGeo, displayMat)
  displayScreen.position.set(0, 2.7, -1.89)
  deskGroup.add(displayScreen)

  // --- PC Workstation Tower ---
  const pcGroup = new THREE.Group()
  pcGroup.position.set(2.2, 1.76, -1.6)

  // Case Body (Matte Black)
  const pcBodyGeo = new THREE.BoxGeometry(0.7, 1.3, 1.4)
  const pcBodyMat = new THREE.MeshStandardMaterial({ color: 0x0e131d, roughness: 0.4, metalness: 0.8 })
  const pcBody = new THREE.Mesh(pcBodyGeo, pcBodyMat)
  pcBody.position.set(0, 0.65, 0)
  pcBody.castShadow = true
  pcGroup.add(pcBody)

  // Tempered Glass Left Side Panel
  const glassGeo = new THREE.BoxGeometry(0.02, 1.15, 1.25)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e283d,
    transparent: true,
    opacity: 0.35,
    roughness: 0.1,
    transmission: 0.9,
    thickness: 0.5
  })
  const glassPanel = new THREE.Mesh(glassGeo, glassMat)
  glassPanel.position.set(-0.35, 0.65, 0)
  pcGroup.add(glassPanel)

  // Internal PC Fans (Front & Rear)
  fanMeshes = []
  const fanGeo = new THREE.TorusGeometry(0.14, 0.03, 8, 24)
  const fanMat = new THREE.MeshBasicMaterial({ color: 0xff0055 })

  for (let i = 0; i < 2; i++) {
    const fan = new THREE.Mesh(fanGeo, fanMat)
    fan.rotation.y = Math.PI / 2
    fan.position.set(-0.15, 0.4 + i * 0.45, 0.55)
    pcGroup.add(fan)
    fanMeshes.push(fan)
  }

  deskGroup.add(pcGroup)
  scene.add(deskGroup)

  // --- Ergonomic Chair ---
  const chairGroup = new THREE.Group()
  chairGroup.position.set(0, 0, 0.4)

  // Seat
  const seatGeo = new THREE.BoxGeometry(1.4, 0.16, 1.3)
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x161c28, roughness: 0.6 })
  const seat = new THREE.Mesh(seatGeo, chairMat)
  seat.position.set(0, 1.2, 0)
  seat.castShadow = true
  chairGroup.add(seat)

  // Backrest
  const backGeo = new THREE.BoxGeometry(1.3, 1.6, 0.15)
  const back = new THREE.Mesh(backGeo, chairMat)
  back.position.set(0, 1.95, 0.6)
  back.castShadow = true
  chairGroup.add(back)

  // Chair Piston Stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x05070a, metalness: 0.9 })
  )
  stem.position.set(0, 0.6, 0)
  chairGroup.add(stem)

  // 5-Star Caster Base
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5
    const armGeo = new THREE.BoxGeometry(0.7, 0.06, 0.1)
    const arm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: 0x111622 }))
    arm.position.set(Math.cos(angle) * 0.35, 0.1, Math.sin(angle) * 0.35)
    arm.rotation.y = -angle
    chairGroup.add(arm)
  }
  scene.add(chairGroup)

  // --- Retro Arcade Cabinet in Corner ---
  const arcadeGroup = new THREE.Group()
  arcadeGroup.position.set(-4.0, 0, -3.2)
  arcadeGroup.rotation.y = Math.PI / 4

  // Main Cabinet Body
  const arcBodyGeo = new THREE.BoxGeometry(1.8, 3.8, 1.6)
  const arcBodyMat = new THREE.MeshStandardMaterial({
    color: 0x111520,
    roughness: 0.5,
    metalness: 0.4
  })
  const arcBody = new THREE.Mesh(arcBodyGeo, arcBodyMat)
  arcBody.position.set(0, 1.9, 0)
  arcBody.castShadow = true
  arcadeGroup.add(arcBody)

  // Angled Control Deck
  const deckGeo = new THREE.BoxGeometry(1.7, 0.15, 0.8)
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x1c2333 })
  const deck = new THREE.Mesh(deckGeo, deckMat)
  deck.position.set(0, 1.8, 0.6)
  deck.rotation.x = 0.25
  arcadeGroup.add(deck)

  // Joysticks & Neon Buttons
  const stickGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25)
  const stickBallGeo = new THREE.SphereGeometry(0.06)
  const stickMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 })

  const stick1 = new THREE.Mesh(stickGeo, new THREE.MeshStandardMaterial({ color: 0x334155 }))
  stick1.position.set(-0.4, 2.0, 0.6)
  const ball1 = new THREE.Mesh(stickBallGeo, stickMat)
  ball1.position.set(-0.4, 2.12, 0.6)
  arcadeGroup.add(stick1, ball1)

  // Arcade Screen (CRT Bezel + Display)
  const arcScreenGeo = new THREE.PlaneGeometry(1.4, 1.1)
  const arcScreenMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff })
  const arcScreen = new THREE.Mesh(arcScreenGeo, arcScreenMat)
  arcScreen.position.set(0, 2.65, 0.71)
  arcScreen.rotation.x = -0.15
  arcadeGroup.add(arcScreen)

  // Glowing Marquee Sign
  const marqueeGeo = new THREE.BoxGeometry(1.7, 0.4, 0.15)
  const marqueeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff })
  const marquee = new THREE.Mesh(marqueeGeo, marqueeMat)
  marquee.position.set(0, 3.55, 0.65)
  arcadeGroup.add(marquee)

  scene.add(arcadeGroup)

  // --- Wall Props: Cyber Shelf & LED Wall Sign ---
  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.08, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x151b27, roughness: 0.4 })
  )
  shelf.position.set(0, 4.4, -5.7)
  scene.add(shelf)

  // Neon Wall Sign: "TEXTOOLS // LAB"
  const signBack = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.7, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x090c12, roughness: 0.9 })
  )
  signBack.position.set(-3.2, 4.2, -5.9)
  scene.add(signBack)

  // --- Animation Loop ---
  let lastTime = performance.now()

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    const now = performance.now()
    const delta = (now - lastTime) / 1000
    lastTime = now

    // Smooth Camera Lerp
    if (camera && controls) {
      camera.position.lerp(targetCamPos, 0.06)
      controls.target.lerp(targetCamLook, 0.06)
      controls.update()
    }

    // Spin PC Fans
    const speed = (roomState.isOverclocked ? 18.0 : 4.0) * roomState.fanSpeedMultiplier
    fanMeshes.forEach((fan) => {
      fan.rotation.z += speed * delta
    })

    // Pulse Lights if Overclocked
    if (roomState.isOverclocked && pcRgbLight) {
      const pulse = 1.0 + Math.sin(now * 0.008) * 0.5
      pcRgbLight.intensity = pulse * 1.5
    }

    // Update screen canvas texture
    updateScreenCanvas()

    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  animate()

  // Handle Resize
  window.addEventListener('resize', handleResize)
}

const handleResize = () => {
  if (!canvasContainer.value || !renderer || !camera) return
  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

// --- WebMCP Tool Execution Engine ---
const executeMcpTool = (name: string, args: Record<string, unknown>) => {
  pushRpcLog('call', name, {
    jsonrpc: '2.0',
    id: Date.now(),
    method: `tools/call`,
    params: { name, arguments: args }
  })

  let resultMessage = ''

  switch (name) {
    case 'set_ambient_lighting': {
      const theme = (args.theme as string) || 'crimson'
      const intensity = typeof args.intensity === 'number' ? args.intensity : 1.5

      roomState.currentTheme = theme
      roomState.lightsOn = intensity > 0.1

      let hex = 0xff1e42
      if (theme === 'crimson') hex = 0xff1e42
      else if (theme === 'cyber') hex = 0x00f0ff
      else if (theme === 'matrix') hex = 0x00ff66
      else if (theme === 'night') hex = 0x3b82f6
      else if (theme === 'day') hex = 0xffeebb

      if (args.color && typeof args.color === 'string') {
        hex = parseInt((args.color as string).replace('#', '0x'), 16) || hex
      }

      roomState.lightColor = `#${hex.toString(16).padStart(6, '0')}`

      if (roomCeilingLight) {
        roomCeilingLight.color.setHex(hex)
        roomCeilingLight.intensity = roomState.lightsOn ? intensity : 0.08
      }
      if (deskLedLight) {
        deskLedLight.color.setHex(hex)
        deskLedLight.intensity = roomState.lightsOn ? intensity * 0.8 : 0.05
      }
      if (deskLedMesh) {
        (deskLedMesh.material as THREE.MeshBasicMaterial).color.setHex(hex)
      }
      if (ambientLight) {
        ambientLight.intensity = roomState.lightsOn ? 0.6 : 0.15
      }

      resultMessage = `Ambient lighting set: theme=${theme}, intensity=${intensity.toFixed(2)}, color=${roomState.lightColor}`
      break
    }

    case 'power_device': {
      const target = args.target as 'pc' | 'arcade' | 'room'
      const state = Boolean(args.state)

      if (target === 'pc') {
        roomState.pcOn = state
        if (!state) roomState.screenMode = 'off'
        else if (roomState.screenMode === 'off') roomState.screenMode = 'matrix'
        if (pcRgbLight) pcRgbLight.intensity = state ? 1.0 : 0
      } else if (target === 'arcade') {
        roomState.arcadeOn = state
        if (arcadeMarqueeLight) arcadeMarqueeLight.intensity = state ? 1.2 : 0
      } else if (target === 'room') {
        roomState.lightsOn = state
        if (roomCeilingLight) roomCeilingLight.intensity = state ? 1.8 : 0.08
        if (deskLedLight) deskLedLight.intensity = state ? 1.2 : 0.05
      }

      resultMessage = `Device '${target}' power changed to ${state ? 'ON' : 'OFF'}`
      break
    }

    case 'set_screen_mode': {
      const mode = (args.mode as 'matrix' | 'terminal' | 'textools' | 'off') || 'matrix'
      roomState.screenMode = mode
      if (mode !== 'off') roomState.pcOn = true
      resultMessage = `Monitor display mode switched to '${mode}'`
      break
    }

    case 'set_camera_view': {
      const preset = (args.preset as 'isometric' | 'desk' | 'arcade') || 'isometric'
      roomState.cameraPreset = preset

      if (preset === 'isometric') {
        targetCamPos.set(9, 7, 9)
        targetCamLook.set(0, 1.2, 0)
      } else if (preset === 'desk') {
        targetCamPos.set(1.4, 2.9, 1.0)
        targetCamLook.set(0.1, 2.3, -1.8)
      } else if (preset === 'arcade') {
        targetCamPos.set(-2.2, 2.6, -1.2)
        targetCamLook.set(-4.0, 2.3, -3.2)
      }
      resultMessage = `Camera transition initiated towards preset: '${preset}'`
      break
    }

    case 'overclock_system': {
      const enabled = Boolean(args.enabled)
      roomState.isOverclocked = enabled
      roomState.fanSpeedMultiplier = enabled ? 3.5 : 1.0

      if (enabled) {
        executeMcpTool('set_ambient_lighting', { theme: 'crimson', intensity: 2.0 })
        executeMcpTool('set_screen_mode', { mode: 'matrix' })
      }
      resultMessage = `Workstation overclocking ${enabled ? 'ENGAGED // MAX PERFORMANCE' : 'DISENGAGED // NORMAL'}`
      break
    }
  }

  // Push Result
  pushRpcLog('result', name, {
    jsonrpc: '2.0',
    id: Date.now(),
    result: {
      content: [{ type: 'text', text: resultMessage }]
    }
  })

  // Add line to terminal screen
  terminalLines.push(`[MCP] ${resultMessage}`)
}

// --- Natural Language Intent Interpreter (Browser AI Simulation) ---
const handleNaturalLanguagePrompt = () => {
  const query = promptInput.value.trim().toLowerCase()
  if (!query) return

  isProcessing.value = true

  setTimeout(() => {
    // Keyword pattern matching for agentic action
    if (query.includes('apaga') && (query.includes('luz') || query.includes('luces') || query.includes('room'))) {
      executeMcpTool('set_ambient_lighting', { theme: 'night', intensity: 0.1 })
    } else if (query.includes('prende') && (query.includes('luz') || query.includes('luces'))) {
      executeMcpTool('set_ambient_lighting', { theme: 'crimson', intensity: 1.8 })
    } else if (query.includes('rojo') || query.includes('carmesi') || query.includes('crimson') || query.includes('red')) {
      executeMcpTool('set_ambient_lighting', { theme: 'crimson', color: '#ff1e42', intensity: 1.8 })
    } else if (query.includes('cyan') || query.includes('cyber') || query.includes('azul') || query.includes('blue')) {
      executeMcpTool('set_ambient_lighting', { theme: 'cyber', color: '#00f0ff', intensity: 1.8 })
    } else if (query.includes('matrix') || query.includes('verde') || query.includes('green')) {
      executeMcpTool('set_ambient_lighting', { theme: 'matrix', color: '#00ff66', intensity: 1.6 })
      executeMcpTool('set_screen_mode', { mode: 'matrix' })
    } else if (query.includes('prende') && (query.includes('pc') || query.includes('computador') || query.includes('ordenador'))) {
      executeMcpTool('power_device', { target: 'pc', state: true })
      executeMcpTool('set_screen_mode', { mode: 'matrix' })
    } else if (query.includes('apaga') && (query.includes('pc') || query.includes('computador'))) {
      executeMcpTool('power_device', { target: 'pc', state: false })
    } else if (query.includes('arcade')) {
      executeMcpTool('set_camera_view', { preset: 'arcade' })
      executeMcpTool('power_device', { target: 'arcade', state: true })
    } else if (query.includes('escritorio') || query.includes('desk') || query.includes('monitor')) {
      executeMcpTool('set_camera_view', { preset: 'desk' })
    } else if (query.includes('general') || query.includes('isometric') || query.includes('habitacion') || query.includes('room')) {
      executeMcpTool('set_camera_view', { preset: 'isometric' })
    } else if (query.includes('terminal') || query.includes('consola') || query.includes('log')) {
      executeMcpTool('set_screen_mode', { mode: 'terminal' })
      executeMcpTool('set_camera_view', { preset: 'desk' })
    } else if (query.includes('logo') || query.includes('textools')) {
      executeMcpTool('set_screen_mode', { mode: 'textools' })
    } else if (query.includes('overclock') || query.includes('turbo') || query.includes('sobrecarga')) {
      executeMcpTool('overclock_system', { enabled: true })
    } else {
      // Default: parse as ambient lighting change
      executeMcpTool('set_ambient_lighting', { theme: 'cyber', intensity: 1.5 })
    }

    promptInput.value = ''
    isProcessing.value = false
  }, 250)
}

// Quick Sample Prompts
const setSamplePrompt = (text: string) => {
  promptInput.value = text
  handleNaturalLanguagePrompt()
}

// --- Optional Local WebSocket Relay (Option B) ---
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
      terminalLines.push(`[WS] Connected to Local Bridge: ${wsUrl.value}`)
      pushRpcLog('result', 'bridge/connect', { status: 'connected', url: wsUrl.value })
    }

    wsClient.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.method === 'tools/call') {
          executeMcpTool(payload.params.name, payload.params.arguments)
        }
      } catch (err) {
        console.error('Error parsing WS message', err)
      }
    }

    wsClient.onerror = () => {
      wsStatus.value = 'disconnected'
      terminalLines.push('[WS] Connection failed. Is relay-bridge running on localhost?')
      pushRpcLog('error', 'bridge/error', { message: 'Local relay not detected at ' + wsUrl.value })
    }

    wsClient.onclose = () => {
      wsStatus.value = 'disconnected'
    }
  } catch {
    wsStatus.value = 'disconnected'
  }
}

onMounted(() => {
  buildScene()
  terminalLines.push('[OK] 3D Battlestation Scene Mounted')
  pushRpcLog('result', 'system/init', { status: 'ready', tools_available: MCP_TOOLS.length })
})

onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  window.removeEventListener('resize', handleResize)
  if (wsClient) wsClient.close()
  if (renderer) renderer.dispose()
})
</script>

<template>
  <div class="msp-playground-container">
    <!-- Top Control Bar (HUD) -->
    <header class="playground-topbar">
      <div class="topbar-left">
        <div class="badge-tag">
          <span class="pulse-dot"></span>
          WEBMCP 3D LAB
        </div>
        <h2 class="playground-title">MSP Playground</h2>
        <span class="theme-chip" :style="{ borderColor: roomState.lightColor, color: roomState.lightColor }">
          {{ roomState.currentTheme.toUpperCase() }} MODE
        </span>
      </div>

      <div class="topbar-right">
        <!-- Local Bridge Status Pill -->
        <button 
          class="bridge-pill"
          :class="wsStatus"
          @click="isBridgeModalOpen = true"
          title="Configure Local MCP Agent Connection (Option B)"
        >
          <span class="bridge-indicator"></span>
          <span>Bridge: {{ wsStatus === 'connected' ? 'Connected' : 'Standalone' }}</span>
        </button>

        <!-- Inspector Drawer Toggle -->
        <button 
          class="btn-icon" 
          :class="{ active: isInspectorOpen }" 
          @click="isInspectorOpen = !isInspectorOpen"
          title="Toggle MCP Protocol Inspector"
        >
          <span>📜</span>
          <span class="btn-label">MCP Protocol</span>
        </button>
      </div>
    </header>

    <!-- Main Viewport Layout -->
    <div class="playground-body">
      <!-- 3D WebGL Canvas Layer -->
      <div ref="canvasContainer" class="canvas-viewport">
        <!-- Floating Camera Presets HUD -->
        <div class="camera-hud">
          <button 
            class="cam-btn" 
            :class="{ active: roomState.cameraPreset === 'isometric' }"
            @click="executeMcpTool('set_camera_view', { preset: 'isometric' })"
          >
            📐 Room View
          </button>
          <button 
            class="cam-btn" 
            :class="{ active: roomState.cameraPreset === 'desk' }"
            @click="executeMcpTool('set_camera_view', { preset: 'desk' })"
          >
            🖥️ Desk Focus
          </button>
          <button 
            class="cam-btn" 
            :class="{ active: roomState.cameraPreset === 'arcade' }"
            @click="executeMcpTool('set_camera_view', { preset: 'arcade' })"
          >
            🕹️ Arcade Focus
          </button>
        </div>

        <!-- Floating Prompt Bar (Agent Interface) -->
        <div class="prompt-hud">
          <div class="prompt-bar">
            <span class="prompt-icon">🤖</span>
            <input 
              v-model="promptInput" 
              type="text" 
              placeholder="Ask agent: 'apagar luces', 'modo cyber', 'prende pc', 'modo matrix', 'overclock'..."
              :disabled="isProcessing"
              @keydown.enter="handleNaturalLanguagePrompt"
            />
            <button 
              class="prompt-send-btn" 
              :disabled="isProcessing || !promptInput.trim()"
              @click="handleNaturalLanguagePrompt"
            >
              <span>{{ isProcessing ? 'Processing...' : 'Execute Tool' }}</span>
              <span>⚡</span>
            </button>
          </div>

          <!-- Quick Suggestion Pills -->
          <div class="suggestion-pills">
            <button class="pill" @click="setSamplePrompt('luces rojas carmesí')">🔴 Luces Carmesí</button>
            <button class="pill" @click="setSamplePrompt('modo cyber cyan')">🔷 Cyber Cyan</button>
            <button class="pill" @click="setSamplePrompt('modo matrix rain')">🟢 Matrix Screen</button>
            <button class="pill" @click="setSamplePrompt('enfocar terminal')">💻 Terminal Log</button>
            <button class="pill" @click="setSamplePrompt('apagar luces de la sala')">🌙 Noche / Off</button>
            <button class="pill" @click="setSamplePrompt('sobrecargar sistema')">🔥 Overclock PC</button>
          </div>
        </div>
      </div>

      <!-- Side Inspector Panel (MCP Tools, JSON-RPC Stream, Controls) -->
      <aside v-if="isInspectorOpen" class="inspector-sidebar">
        <!-- Inspector Tabs -->
        <div class="inspector-tabs">
          <button 
            :class="{ active: activeTab === 'hud' }" 
            @click="activeTab = 'hud'"
          >
            🎮 Controls
          </button>
          <button 
            :class="{ active: activeTab === 'tools' }" 
            @click="activeTab = 'tools'"
          >
            🛠️ Tools ({{ MCP_TOOLS.length }})
          </button>
          <button 
            :class="{ active: activeTab === 'logs' }" 
            @click="activeTab = 'logs'"
          >
            ⚡ RPC Logs ({{ rpcLogs.length }})
          </button>
        </div>

        <!-- Tab 1: Quick Action Controls -->
        <div v-if="activeTab === 'hud'" class="tab-content hud-panel">
          <div class="control-group">
            <label class="group-label">Ambient Lighting</label>
            <div class="color-palette">
              <button 
                class="palette-btn crimson" 
                :class="{ active: roomState.currentTheme === 'crimson' }"
                @click="executeMcpTool('set_ambient_lighting', { theme: 'crimson', color: '#ff1e42' })"
                title="Crimson"
              ></button>
              <button 
                class="palette-btn cyber" 
                :class="{ active: roomState.currentTheme === 'cyber' }"
                @click="executeMcpTool('set_ambient_lighting', { theme: 'cyber', color: '#00f0ff' })"
                title="Cyber Cyan"
              ></button>
              <button 
                class="palette-btn matrix" 
                :class="{ active: roomState.currentTheme === 'matrix' }"
                @click="executeMcpTool('set_ambient_lighting', { theme: 'matrix', color: '#00ff66' })"
                title="Matrix Green"
              ></button>
              <button 
                class="palette-btn night" 
                :class="{ active: roomState.currentTheme === 'night' }"
                @click="executeMcpTool('set_ambient_lighting', { theme: 'night', intensity: 0.15 })"
                title="Night Mood"
              ></button>
            </div>
            <button 
              class="action-btn toggle-btn" 
              :class="{ on: roomState.lightsOn }"
              @click="executeMcpTool('power_device', { target: 'room', state: !roomState.lightsOn })"
            >
              <span>{{ roomState.lightsOn ? '💡 Turn Lights OFF' : '💡 Turn Lights ON' }}</span>
            </button>
          </div>

          <div class="control-group">
            <label class="group-label">Workstation PC & Display</label>
            <div class="btn-grid">
              <button 
                class="action-btn"
                :class="{ active: roomState.screenMode === 'matrix' }"
                @click="executeMcpTool('set_screen_mode', { mode: 'matrix' })"
              >
                🟢 Matrix Rain
              </button>
              <button 
                class="action-btn"
                :class="{ active: roomState.screenMode === 'terminal' }"
                @click="executeMcpTool('set_screen_mode', { mode: 'terminal' })"
              >
                💻 Terminal
              </button>
              <button 
                class="action-btn"
                :class="{ active: roomState.screenMode === 'textools' }"
                @click="executeMcpTool('set_screen_mode', { mode: 'textools' })"
              >
                💎 TexTools
              </button>
              <button 
                class="action-btn"
                :class="{ active: roomState.screenMode === 'off' }"
                @click="executeMcpTool('set_screen_mode', { mode: 'off' })"
              >
                ⚫ Screen Off
              </button>
            </div>

            <button 
              class="action-btn oc-btn"
              :class="{ overclocked: roomState.isOverclocked }"
              @click="executeMcpTool('overclock_system', { enabled: !roomState.isOverclocked })"
            >
              <span>⚡ {{ roomState.isOverclocked ? 'DISENGAGE OVERCLOCK' : 'OVERCLOCK WORKSTATION' }}</span>
            </button>
          </div>

          <div class="control-group">
            <label class="group-label">Arcade Cabinet</label>
            <button 
              class="action-btn"
              :class="{ on: roomState.arcadeOn }"
              @click="executeMcpTool('power_device', { target: 'arcade', state: !roomState.arcadeOn })"
            >
              <span>🕹️ Arcade Power: {{ roomState.arcadeOn ? 'ONLINE' : 'STANDBY' }}</span>
            </button>
          </div>
        </div>

        <!-- Tab 2: MCP Tools Schema List -->
        <div v-else-if="activeTab === 'tools'" class="tab-content tools-panel">
          <p class="tab-desc">Available WebMCP tool specifications registered in this session:</p>
          <div v-for="tool in MCP_TOOLS" :key="tool.name" class="tool-card">
            <div class="tool-header">
              <span class="tool-name">{{ tool.name }}</span>
              <span class="tool-badge">TOOL</span>
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
            <span class="logs-count">{{ rpcLogs.length }} events recorded</span>
            <button class="clear-btn" @click="rpcLogs = []">Clear</button>
          </div>

          <div v-if="rpcLogs.length === 0" class="empty-logs">
            No JSON-RPC calls logged yet. Run a prompt or action above!
          </div>

          <div v-for="log in rpcLogs" :key="log.id" class="log-entry" :class="log.direction">
            <div class="log-meta">
              <span class="log-dir">{{ log.direction.toUpperCase() }}</span>
              <span class="log-method">{{ log.method }}</span>
              <span class="log-time">{{ log.timestamp }}</span>
            </div>
            <pre class="log-json"><code>{{ JSON.stringify(log.data, null, 2) }}</code></pre>
          </div>
        </div>
      </aside>
    </div>

    <!-- Option B Local Bridge Modal -->
    <div v-if="isBridgeModalOpen" class="bridge-modal-backdrop" @click.self="isBridgeModalOpen = false">
      <div class="bridge-modal">
        <div class="modal-header">
          <h3>🔗 Local Agent Bridge (Option B)</h3>
          <button class="close-btn" @click="isBridgeModalOpen = false">&times;</button>
        </div>

        <div class="modal-body">
          <p class="modal-desc">
            Connect your local AI agent (Claude Desktop, Antigravity, or custom Python script) directly to this 3D viewport over a local WebSocket.
          </p>

          <div class="input-row">
            <label>WebSocket Relay Endpoint:</label>
            <div class="ws-input-group">
              <input v-model="wsUrl" type="text" placeholder="ws://localhost:8765" />
              <button 
                class="btn-connect" 
                :class="wsStatus"
                @click="toggleWsConnection"
              >
                {{ wsStatus === 'connected' ? 'Disconnect' : 'Connect' }}
              </button>
            </div>
          </div>

          <div class="code-snippet-box">
            <div class="snippet-header">
              <span>Quick Node.js Bridge (bridge.js)</span>
            </div>
            <pre><code>// npm install ws @modelcontextprotocol/sdk
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ port: 8765 });
console.log('WebMCP Bridge running on ws://localhost:8765');
wss.on('connection', (ws) => {
  console.log('TexTools 3D Room Connected!');
  // Forward MCP stdio messages from your agent to the browser:
  process.stdin.on('data', (data) => ws.send(data));
});</code></pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.msp-playground-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  min-height: 600px;
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
  padding: 12px 20px;
  background: #0f1420;
  border-bottom: 1px solid #1c2638;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.badge-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(255, 30, 66, 0.15);
  border: 1px solid rgba(255, 30, 66, 0.4);
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #ff1e42;
  letter-spacing: 0.05em;
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
  font-size: 1.15rem;
  font-weight: 700;
  color: #f8fafc;
}

.theme-chip {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border: 1px solid;
  border-radius: 999px;
  letter-spacing: 0.04em;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bridge-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #141b2b;
  border: 1px solid #23304a;
  border-radius: 20px;
  color: #cbd5e1;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s;
}

.bridge-pill:hover {
  border-color: #ff1e42;
}

.bridge-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
}

.bridge-pill.connected .bridge-indicator {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.bridge-pill.connecting .bridge-indicator {
  background: #f59e0b;
}

.btn-icon {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #141b2b;
  border: 1px solid #23304a;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover, .btn-icon.active {
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

/* 3D Canvas Viewport */
.canvas-viewport {
  flex: 1;
  position: relative;
  background: #0a0c10;
  min-width: 0;
}

.canvas-viewport canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

/* Camera HUD */
.camera-hud {
  position: absolute;
  top: 14px;
  left: 14px;
  display: flex;
  gap: 6px;
  z-index: 10;
}

.cam-btn {
  padding: 6px 12px;
  background: rgba(15, 20, 32, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #94a3b8;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s;
}

.cam-btn:hover, .cam-btn.active {
  background: rgba(255, 30, 66, 0.2);
  border-color: #ff1e42;
  color: #ffffff;
}

/* Prompt HUD */
.prompt-hud {
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
  max-width: 760px;
  margin: 0 auto;
}

.prompt-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(15, 20, 32, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 30, 66, 0.4);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.prompt-icon {
  font-size: 1.2rem;
}

.prompt-bar input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #f8fafc;
  font-size: 0.9rem;
}

.prompt-bar input::placeholder {
  color: #64748b;
}

.prompt-send-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #ff1e42;
  border: none;
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.prompt-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.suggestion-pills {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.pill {
  padding: 4px 10px;
  background: rgba(15, 20, 32, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  color: #cbd5e1;
  font-size: 0.72rem;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}

.pill:hover {
  background: rgba(255, 30, 66, 0.15);
  border-color: #ff1e42;
  color: #ffffff;
}

/* Inspector Sidebar */
.inspector-sidebar {
  width: 360px;
  background: #0f1420;
  border-left: 1px solid #1c2638;
  display: flex;
  flex-direction: column;
}

.inspector-tabs {
  display: flex;
  border-bottom: 1px solid #1c2638;
}

.inspector-tabs button {
  flex: 1;
  padding: 10px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  font-size: 0.78rem;
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
  padding: 14px;
}

/* HUD Panel Controls */
.control-group {
  margin-bottom: 18px;
}

.group-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}

.color-palette {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.palette-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.2s;
}

.palette-btn:hover {
  transform: scale(1.1);
}

.palette-btn.active {
  border-color: #ffffff;
}

.palette-btn.crimson { background: #ff1e42; }
.palette-btn.cyber { background: #00f0ff; }
.palette-btn.matrix { background: #00ff66; }
.palette-btn.night { background: #1e293b; }

.action-btn {
  width: 100%;
  padding: 8px;
  background: #141b2b;
  border: 1px solid #23304a;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover, .action-btn.active {
  background: rgba(255, 30, 66, 0.15);
  border-color: #ff1e42;
  color: #ffffff;
}

.btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 8px;
}

.oc-btn {
  margin-top: 6px;
  background: rgba(255, 30, 66, 0.1);
  border-color: rgba(255, 30, 66, 0.3);
  color: #ff1e42;
  font-weight: 700;
}

.oc-btn.overclocked {
  background: #ff1e42;
  color: #ffffff;
  animation: pulse 1s infinite;
}

/* Tools Panel */
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
  font-family: monospace;
  font-weight: 700;
  color: #f8fafc;
  font-size: 0.8rem;
}

.tool-badge {
  font-size: 0.65rem;
  background: rgba(0, 240, 255, 0.15);
  color: #00f0ff;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
}

.tool-desc {
  font-size: 0.72rem;
  color: #94a3b8;
  margin: 4px 0 8px;
}

.param-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  margin-bottom: 2px;
}

.param-name {
  color: #ff1e42;
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

.log-entry.call {
  border-left-color: #00f0ff;
}

.log-entry.result {
  border-left-color: #10b981;
}

.log-entry.error {
  border-left-color: #ef4444;
}

.log-meta {
  display: flex;
  gap: 8px;
  font-size: 0.68rem;
  margin-bottom: 4px;
}

.log-dir {
  font-weight: 700;
  color: #00f0ff;
}

.log-entry.result .log-dir {
  color: #10b981;
}

.log-method {
  color: #e2e8f0;
  font-family: monospace;
}

.log-time {
  margin-left: auto;
  color: #64748b;
}

.log-json {
  margin: 0;
  font-size: 0.68rem;
  color: #cbd5e1;
  max-height: 120px;
  overflow-y: auto;
}

/* Option B Modal */
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
  font-size: 1.1rem;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 1.4rem;
  color: #94a3b8;
  cursor: pointer;
}

.modal-desc {
  font-size: 0.84rem;
  color: #94a3b8;
  line-height: 1.5;
  margin-bottom: 16px;
}

.input-row {
  margin-bottom: 16px;
}

.input-row label {
  display: block;
  font-size: 0.78rem;
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

@media (max-width: 900px) {
  .inspector-sidebar {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: 20;
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.7);
  }
}
</style>
