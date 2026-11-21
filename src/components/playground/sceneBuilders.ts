import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { DynamicTextures } from './sceneTextures'

export interface InteractiveHit {
  action: 'monitor' | 'side_monitor' | 'pc' | 'arcade' | 'server_rack' | 'desk_lamp' | 'holo_core' | 'window' | 'chair'
  label: string
}

export interface SceneRefs {
  ambientLight: THREE.AmbientLight
  hemiLight: THREE.HemisphereLight
  dirLight: THREE.DirectionalLight
  roomCeilingLight: THREE.PointLight
  deskLedLight: THREE.PointLight
  monitorBackglowLight: THREE.PointLight
  pcRgbLight: THREE.PointLight
  arcadePointLight: THREE.PointLight
  deskLampLight: THREE.PointLight
  holoLight: THREE.PointLight
  serverLight: THREE.PointLight

  deskTopGroup: THREE.Group
  chairUpperGroup: THREE.Group
  holoGroup: THREE.Group
  holoOuterRing: THREE.Mesh
  holoInnerRing: THREE.Mesh
  holoCoreMesh: THREE.Mesh
  holoConeMesh: THREE.Mesh

  deskLedMeshes: THREE.Mesh[]
  wallTrimMeshes: THREE.Mesh[]
  pcRgbMeshes: THREE.Mesh[]
  keyboardRgbMeshes: THREE.Mesh[]
  fanMeshes: THREE.Mesh[]
  serverLedMeshes: THREE.Mesh[]
  steamMeshes: THREE.Mesh[]
  ceilingLightMesh: THREE.Mesh
  deskLampBulbMat: THREE.MeshBasicMaterial
  interactiveTargets: THREE.Object3D[]
}

function tagInteractive(obj: THREE.Object3D, hit: InteractiveHit, targets: THREE.Object3D[]) {
  obj.userData.mcpHit = hit
  targets.push(obj)
}

/**
 * Bend a subdivided PlaneGeometry or BoxGeometry along a horizontal circular arc
 * so the edges curve naturally toward +Z (toward the viewer).
 */
function bendGeometry(geo: THREE.BufferGeometry, radius: number) {
  const pos = geo.attributes.position
  if (!pos) return
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const angle = x / radius
    pos.setX(i, Math.sin(angle) * radius)
    pos.setZ(i, z + (radius - Math.cos(angle) * radius))
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
}

export function buildPlaygroundScene(scene: THREE.Scene, textures: DynamicTextures): SceneRefs {
  const deskLedMeshes: THREE.Mesh[] = []
  const wallTrimMeshes: THREE.Mesh[] = []
  const pcRgbMeshes: THREE.Mesh[] = []
  const keyboardRgbMeshes: THREE.Mesh[] = []
  const fanMeshes: THREE.Mesh[] = []
  const serverLedMeshes: THREE.Mesh[] = []
  const steamMeshes: THREE.Mesh[] = []
  const interactiveTargets: THREE.Object3D[] = []

  // --- Shared Materials ---
  const matDarkMetal = new THREE.MeshStandardMaterial({ color: 0x161d2b, roughness: 0.38, metalness: 0.78 })
  const matGunmetal = new THREE.MeshStandardMaterial({ color: 0x222c3f, roughness: 0.42, metalness: 0.55 })
  const matMatteBlack = new THREE.MeshStandardMaterial({ color: 0x0e131e, roughness: 0.75, metalness: 0.15 })
  const matGlass = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    transparent: true,
    opacity: 0.28,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0
  })

  // --- 1. LIGHTING SYSTEM ---
  const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x1a2233, 1.25)
  scene.add(hemiLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0)
  dirLight.position.set(10, 16, 10)
  dirLight.target.position.set(0, 1.5, 0)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 2048
  dirLight.shadow.mapSize.height = 2048
  dirLight.shadow.bias = -0.001
  dirLight.shadow.camera.near = 2
  dirLight.shadow.camera.far = 40
  dirLight.shadow.camera.left = -9
  dirLight.shadow.camera.right = 9
  dirLight.shadow.camera.top = 9
  dirLight.shadow.camera.bottom = -9
  scene.add(dirLight)
  scene.add(dirLight.target)

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.42)
  scene.add(ambientLight)

  const roomCeilingLight = new THREE.PointLight(0xfff0f5, 2.1, 18, 1.2)
  roomCeilingLight.position.set(0, 5.1, -0.8)
  scene.add(roomCeilingLight)

  const deskLedLight = new THREE.PointLight(0xff1e42, 1.6, 6.5, 1.4)
  deskLedLight.position.set(0, 1.55, 1.15)

  const monitorBackglowLight = new THREE.PointLight(0xff1e42, 2.2, 8, 1.4)
  monitorBackglowLight.position.set(-0.2, 2.8, -1.25)

  const pcRgbLight = new THREE.PointLight(0xff1e42, 1.8, 4.5, 1.4)
  pcRgbLight.position.set(2.45, 2.4, -0.05)

  const arcadePointLight = new THREE.PointLight(0x00f0ff, 2.2, 6, 1.4)
  arcadePointLight.position.set(-3.4, 3.2, 1.4)
  scene.add(arcadePointLight)

  const deskLampLight = new THREE.PointLight(0xfff4d6, 1.6, 4.5, 1.5)
  deskLampLight.position.set(1.42, 2.35, 0.45)

  const holoLight = new THREE.PointLight(0x00f0ff, 1.2, 3.2, 1.6)
  holoLight.position.set(-1.55, 2.2, 0.38)

  const serverLight = new THREE.PointLight(0x00ff88, 1.2, 4, 1.6)
  serverLight.position.set(-4.3, 1.8, -4.1)
  scene.add(serverLight)

  // --- 2. ROOM ARCHITECTURE ---
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({ color: 0x151c29, roughness: 0.5, metalness: 0.25 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const grid = new THREE.GridHelper(12, 16, 0xff1e42, 0x2a374e)
  grid.position.y = 0.004
  scene.add(grid)

  // Cyber Gaming Rug
  const rug = new THREE.Mesh(
    new RoundedBoxGeometry(5.2, 0.025, 3.8, 2, 0.01),
    new THREE.MeshStandardMaterial({ map: textures.rugTexture, roughness: 0.9, metalness: 0.05 })
  )
  rug.position.set(0, 0.013, 0.55)
  rug.receiveShadow = true
  scene.add(rug)

  // Back & Left Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b2436, roughness: 0.55, metalness: 0.18 })
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 0.2), wallMat)
  backWall.position.set(0, 3, -6)
  backWall.receiveShadow = true
  scene.add(backWall)

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6, 12), wallMat)
  leftWall.position.set(-6, 3, 0)
  leftWall.receiveShadow = true
  scene.add(leftWall)

  // Wall Neon Accent Trims
  const trimMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 })
  const addWallTrim = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat.clone())
    m.position.set(x, y, z)
    scene.add(m)
    wallTrimMeshes.push(m)
  }
  addWallTrim(12, 0.06, 0.06, 0, 0.03, -5.88)
  addWallTrim(0.06, 0.06, 12, -5.88, 0.03, 0)
  addWallTrim(11.6, 0.04, 0.04, 0, 3.95, -5.88)

  // Acoustic Foam Panels Grid behind desk (Back wall)
  const acousticMat = new THREE.MeshStandardMaterial({ color: 0x121826, roughness: 0.9, metalness: 0.08 })
  const acousticGroup = new THREE.Group()
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      const tile = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.52, 0.07, 2, 0.02), acousticMat)
      tile.position.set(-2.2 + col * 0.63, 1.9 + row * 0.58, -5.87)
      tile.receiveShadow = true
      acousticGroup.add(tile)
    }
  }
  scene.add(acousticGroup)

  // Real Neon Wall Sign ("TEXTOOLS // LAB")
  const signGroup = new THREE.Group()
  signGroup.position.set(-3.45, 4.85, -5.84)
  const signFrame = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.9, 0.08, 2, 0.02), matDarkMetal)
  const signFace = new THREE.Mesh(
    new THREE.PlaneGeometry(3.26, 0.78),
    new THREE.MeshBasicMaterial({ map: textures.neonSignTexture })
  )
  signFace.position.z = 0.045
  signGroup.add(signFrame, signFace)
  scene.add(signGroup)

  // Framed Synthwave Wall Poster (Right side of back wall)
  const posterGroup = new THREE.Group()
  posterGroup.position.set(3.95, 3.3, -5.85)
  const posterFrame = new THREE.Mesh(new RoundedBoxGeometry(1.65, 2.25, 0.07, 2, 0.02), matDarkMetal)
  const posterArt = new THREE.Mesh(
    new THREE.PlaneGeometry(1.48, 2.08),
    new THREE.MeshBasicMaterial({ map: textures.posterTexture })
  )
  posterArt.position.z = 0.04
  posterGroup.add(posterFrame, posterArt)
  scene.add(posterGroup)

  // Floating Wall Shelf & Props (books, cyber-bot figure, glowing crystal, succulent)
  const shelfGroup = new THREE.Group()
  shelfGroup.position.set(0.45, 4.65, -5.62)
  const shelfPlank = new THREE.Mesh(new RoundedBoxGeometry(3.3, 0.08, 0.56, 2, 0.02), matGunmetal)
  shelfPlank.castShadow = true
  shelfPlank.receiveShadow = true
  shelfGroup.add(shelfPlank)

  // Shelf brackets
  for (const bx of [-1.2, 1.2]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.42), matDarkMetal)
    bracket.position.set(bx, -0.18, -0.05)
    shelfGroup.add(bracket)
  }

  // Books Stack
  const bookColors = [0xff1e42, 0x0ea5e9, 0x10b981, 0xa855f7]
  bookColors.forEach((col, i) => {
    const book = new THREE.Mesh(
      new RoundedBoxGeometry(0.11, 0.44 - i * 0.02, 0.34, 2, 0.01),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 })
    )
    book.position.set(-1.15 + i * 0.125, 0.25 - i * 0.01, 0)
    book.castShadow = true
    shelfGroup.add(book)
  })

  // Mini Cyber Robot Mascot on Shelf
  const botGroup = new THREE.Group()
  botGroup.position.set(-0.2, 0.04, 0.02)
  const botBody = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.28, 0.2, 2, 0.03), matGunmetal)
  botBody.position.y = 0.14
  const botHead = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.22, 0.22, 2, 0.04), matDarkMetal)
  botHead.position.y = 0.4
  const botVisor = new THREE.Mesh(
    new RoundedBoxGeometry(0.22, 0.08, 0.04, 2, 0.01),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff })
  )
  botVisor.position.set(0, 0.4, 0.11)
  const botAnt = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12), matGunmetal)
  botAnt.position.set(0, 0.56, 0)
  botGroup.add(botBody, botHead, botVisor, botAnt)
  shelfGroup.add(botGroup)

  // Glowing Crystal Artifact
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 0),
    new THREE.MeshStandardMaterial({ color: 0xff1e42, emissive: 0xff1e42, emissiveIntensity: 0.7, roughness: 0.2 })
  )
  crystal.position.set(0.55, 0.26, 0)
  pcRgbMeshes.push(crystal)
  shelfGroup.add(crystal)

  // Potted Plant on Shelf
  const shelfPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.1, 0.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 })
  )
  shelfPot.position.set(1.15, 0.14, 0)
  shelfGroup.add(shelfPot)
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.5 })
  for (let l = 0; l < 5; l++) {
    const ang = (l / 5) * Math.PI * 2
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 5), leafMat)
    leaf.position.set(1.15 + Math.cos(ang) * 0.07, 0.28, Math.sin(ang) * 0.07)
    leaf.rotation.z = -Math.cos(ang) * 0.5
    leaf.rotation.x = Math.sin(ang) * 0.5
    shelfGroup.add(leaf)
  }
  scene.add(shelfGroup)

  // Suspended Linear Ceiling Light Bar
  const ceilingGroup = new THREE.Group()
  ceilingGroup.position.set(0, 5.45, -1.2)
  const lightBarBody = new THREE.Mesh(new RoundedBoxGeometry(3.6, 0.1, 0.24, 2, 0.02), matDarkMetal)
  const ceilingLightMesh = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.04, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xfff0f5 })
  )
  ceilingLightMesh.position.y = -0.04
  for (const rx of [-1.4, 1.4]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.65), matDarkMetal)
    rod.position.set(rx, 0.35, 0)
    ceilingGroup.add(rod)
  }
  ceilingGroup.add(lightBarBody, ceilingLightMesh)
  scene.add(ceilingGroup)

  // Cyberpunk City Window (Left Wall)
  const windowGroup = new THREE.Group()
  windowGroup.position.set(-5.86, 3.1, -1.8)
  windowGroup.rotation.y = Math.PI / 2
  const winFrame = new THREE.Mesh(new RoundedBoxGeometry(2.9, 2.15, 0.12, 2, 0.02), matDarkMetal)
  const winGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(2.68, 1.92),
    new THREE.MeshBasicMaterial({ map: textures.windowTexture })
  )
  winGlass.position.z = 0.07
  // Mullions (crossbars)
  const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.95, 0.04), matDarkMetal)
  vBar.position.z = 0.08
  const hBar = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.05, 0.04), matDarkMetal)
  hBar.position.z = 0.08
  const winSill = new THREE.Mesh(new RoundedBoxGeometry(3.1, 0.08, 0.28, 2, 0.02), matGunmetal)
  winSill.position.set(0, -1.08, 0.06)
  windowGroup.add(winFrame, winGlass, vBar, hBar, winSill)
  tagInteractive(winGlass, { action: 'window', label: 'City Window (Cycle Weather)' }, interactiveTargets)
  scene.add(windowGroup)

  // --- 3. MOTORIZED STANDING DESK & PERIPHERALS ---
  const deskRootPos = new THREE.Vector3(0, 0, -1.85)

  // Stationary lower leg columns & wide feet
  for (const lx of [-2.45, 2.45]) {
    const foot = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.06, 1.95, 2, 0.02), matDarkMetal)
    foot.position.set(lx, 0.03, deskRootPos.z)
    foot.castShadow = true
    foot.receiveShadow = true
    scene.add(foot)

    const lowerCol = new THREE.Mesh(new RoundedBoxGeometry(0.16, 1.05, 0.24, 2, 0.02), matDarkMetal)
    lowerCol.position.set(lx, 0.55, deskRootPos.z)
    lowerCol.castShadow = true
    scene.add(lowerCol)
  }

  // Movable Desk Group (animates Y for Sit / Stand!)
  const deskTopGroup = new THREE.Group()
  deskTopGroup.position.copy(deskRootPos)
  deskTopGroup.add(deskLedLight, monitorBackglowLight, pcRgbLight, deskLampLight, holoLight)
  scene.add(deskTopGroup)

  // Telescoping upper leg columns attached to deskTopGroup
  for (const lx of [-2.45, 2.45]) {
    const upperCol = new THREE.Mesh(new RoundedBoxGeometry(0.12, 1.15, 0.18, 2, 0.02), matGunmetal)
    upperCol.position.set(lx, 1.05, 0)
    upperCol.castShadow = true
    deskTopGroup.add(upperCol)
  }

  // Beveled Tabletop
  const tabletop = new THREE.Mesh(
    new RoundedBoxGeometry(6.1, 0.12, 2.4, 4, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x1e2738, roughness: 0.36, metalness: 0.35 })
  )
  tabletop.position.set(0, 1.66, 0)
  tabletop.castShadow = true
  tabletop.receiveShadow = true
  deskTopGroup.add(tabletop)

  // Wrap-around RGB LED Strip (Front & Sides)
  const addDeskLed = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const led = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: 0xff1e42 }))
    led.position.set(x, y, z)
    deskTopGroup.add(led)
    deskLedMeshes.push(led)
  }
  addDeskLed(6.12, 0.035, 0.035, 0, 1.66, 1.2)
  addDeskLed(0.035, 0.035, 2.4, -3.05, 1.66, 0)
  addDeskLed(0.035, 0.035, 2.4, 3.05, 1.66, 0)

  // Standing Desk Digital Control Keypad
  const keypad = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.05, 0.14, 2, 0.01), matMatteBlack)
  keypad.position.set(1.6, 1.59, 1.18)
  const keypadLed = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.03),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff })
  )
  keypadLed.position.set(1.6, 1.59, 1.252)
  deskTopGroup.add(keypad, keypadLed)

  // Under-desk Cable Tray
  const cableTray = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.25), matMatteBlack)
  cableTray.position.set(-0.3, 1.48, -0.85)
  deskTopGroup.add(cableTray)

  // Extended Desk Mat
  const deskMat = new THREE.Mesh(
    new RoundedBoxGeometry(2.85, 0.016, 1.12, 2, 0.006),
    new THREE.MeshStandardMaterial({ map: textures.deskMatTexture, roughness: 0.88 })
  )
  deskMat.position.set(-0.25, 1.728, 0.42)
  deskMat.receiveShadow = true
  deskTopGroup.add(deskMat)

  // --- 3A. DUAL MONITOR ARM & MONITORS ---
  const clampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 1.25, 16), matDarkMetal)
  clampPole.position.set(-0.55, 2.34, -0.92)
  deskTopGroup.add(clampPole)

  const armMain = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.08, 0.45, 2, 0.02), matGunmetal)
  armMain.position.set(-0.15, 2.7, -0.75)
  deskTopGroup.add(armMain)

  const armSide = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.07, 0.07, 2, 0.02), matGunmetal)
  armSide.position.set(-1.35, 2.72, -0.75)
  armSide.rotation.y = -0.22
  deskTopGroup.add(armSide)

  // Primary Curved Ultrawide Monitor
  const curvedGroup = new THREE.Group()
  curvedGroup.position.set(-0.15, 2.72, -0.58)

  const curvedFrameGeo = new THREE.BoxGeometry(3.26, 1.4, 0.08, 24, 2, 1)
  bendGeometry(curvedFrameGeo, 5.5)
  const curvedFrame = new THREE.Mesh(curvedFrameGeo, matMatteBlack)
  curvedFrame.castShadow = true

  const curvedScreenGeo = new THREE.PlaneGeometry(3.14, 1.28, 24, 1)
  bendGeometry(curvedScreenGeo, 5.5)
  const curvedScreen = new THREE.Mesh(
    curvedScreenGeo,
    new THREE.MeshBasicMaterial({ map: textures.screenTexture })
  )
  curvedScreen.position.z = 0.044

  // Rear RGB Monitor Halo Ring
  const rearHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.022, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xff1e42 })
  )
  rearHalo.position.set(0, 0, -0.055)
  deskLedMeshes.push(rearHalo)

  curvedGroup.add(curvedFrame, curvedScreen, rearHalo)
  tagInteractive(curvedScreen, { action: 'monitor', label: 'Ultrawide Monitor (Cycle Screen)' }, interactiveTargets)
  deskTopGroup.add(curvedGroup)

  // Secondary Vertical Portrait Coding Monitor
  const sideMonGroup = new THREE.Group()
  sideMonGroup.position.set(-2.22, 2.74, -0.3)
  sideMonGroup.rotation.y = 0.44

  const sideFrame = new THREE.Mesh(new RoundedBoxGeometry(0.92, 1.38, 0.06, 2, 0.015), matMatteBlack)
  sideFrame.castShadow = true
  const sideScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.84, 1.28),
    new THREE.MeshBasicMaterial({ map: textures.sideScreenTexture })
  )
  sideScreen.position.z = 0.033
  sideMonGroup.add(sideFrame, sideScreen)
  tagInteractive(sideScreen, { action: 'side_monitor', label: 'Coding Monitor (Cycle View)' }, interactiveTargets)
  deskTopGroup.add(sideMonGroup)

  // --- 3B. 75% MECHANICAL KEYBOARD + COILED AVIATOR CABLE + MOUSE ---
  const kbGroup = new THREE.Group()
  kbGroup.position.set(-0.35, 1.74, 0.45)
  kbGroup.rotation.x = 0.06

  const kbCase = new THREE.Mesh(new RoundedBoxGeometry(1.38, 0.05, 0.5, 2, 0.015), matGunmetal)
  kbCase.castShadow = true
  kbGroup.add(kbCase)

  // Translucent RGB Underglow Strip around keyboard
  const kbRgbPlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.018, 0.52),
    new THREE.MeshBasicMaterial({ color: 0xff1e42 })
  )
  kbRgbPlate.position.y = -0.01
  keyboardRgbMeshes.push(kbRgbPlate)
  kbGroup.add(kbRgbPlate)

  // Keycaps grid (5 rows x 14 cols)
  const keyDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45 })
  const keyAccentMat = new THREE.MeshStandardMaterial({ color: 0xff1e42, roughness: 0.4 })
  const keyCyanMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
  const keyGeo = new THREE.BoxGeometry(0.072, 0.026, 0.068)

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 14; c++) {
      // Spacebar span in bottom row
      if (r === 4 && c >= 4 && c <= 8) {
        if (c === 6) {
          const spaceKey = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.026, 0.068), keyAccentMat)
          spaceKey.position.set(-0.56 + 6 * 0.086, 0.032, -0.17 + r * 0.085)
          kbGroup.add(spaceKey)
        }
        continue
      }
      const isEsc = r === 0 && c === 0
      const isEnter = r === 2 && c === 13
      const isWasd = (r === 1 && c === 2) || (r === 2 && c >= 1 && c <= 3)
      const mat = isEsc || isEnter ? keyAccentMat : isWasd ? keyCyanMat : keyDarkMat
      const key = new THREE.Mesh(keyGeo, mat)
      key.position.set(-0.56 + c * 0.086, 0.032, -0.17 + r * 0.085)
      kbGroup.add(key)
    }
  }

  // Rotary Encoder Knob
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.035, 16), matDarkMetal)
  knob.position.set(0.58, 0.04, -0.17)
  kbGroup.add(knob)
  deskTopGroup.add(kbGroup)

  // Coiled Aviator Cable
  const cablePts: THREE.Vector3[] = []
  for (let i = 0; i <= 36; i++) {
    const t = i / 36
    const x = -0.5 + t * 0.55
    const y = 1.755 + Math.sin(t * Math.PI * 12) * 0.018
    const z = 0.14 + Math.cos(t * Math.PI * 12) * 0.018
    cablePts.push(new THREE.Vector3(x, y, z))
  }
  cablePts.push(new THREE.Vector3(0.15, 1.74, -0.25), new THREE.Vector3(0.15, 1.72, -0.65))
  const cableGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 48, 0.012, 8, false)
  const cableMesh = new THREE.Mesh(cableGeo, new THREE.MeshStandardMaterial({ color: 0xff1e42, roughness: 0.4 }))
  deskTopGroup.add(cableMesh)

  // Sculpted Gaming Mouse
  const mouseGroup = new THREE.Group()
  mouseGroup.position.set(0.75, 1.74, 0.48)
  const mouseShell = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), matMatteBlack)
  mouseShell.scale.set(0.88, 0.48, 1.45)
  mouseShell.position.y = 0.03
  mouseShell.castShadow = true
  const mouseWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.008, 8, 16),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff })
  )
  mouseWheel.rotation.y = Math.PI / 2
  mouseWheel.position.set(0, 0.065, -0.06)
  mouseGroup.add(mouseShell, mouseWheel)
  deskTopGroup.add(mouseGroup)

  // --- 3C. STUDIO SPEAKERS, MIC BOOM, HEADSET, LAMP, HOLO-CORE, MUG ---
  const buildSpeaker = (x: number, z: number, rotY: number) => {
    const spk = new THREE.Group()
    spk.position.set(x, 1.72, z)
    spk.rotation.y = rotY
    const cab = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.52, 0.34, 2, 0.025), matMatteBlack)
    cab.position.y = 0.26
    cab.castShadow = true
    const woofer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.08, 0.03, 20),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3, metalness: 0.6 })
    )
    woofer.rotation.x = Math.PI / 2
    woofer.position.set(0, 0.19, 0.165)
    const tweeter = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.25 })
    )
    tweeter.position.set(0, 0.38, 0.165)
    const spkLed = new THREE.Mesh(new THREE.SphereGeometry(0.012), new THREE.MeshBasicMaterial({ color: 0x10b981 }))
    spkLed.position.set(0.09, 0.06, 0.175)
    spk.add(cab, woofer, tweeter, spkLed)
    deskTopGroup.add(spk)
  }
  buildSpeaker(-2.72, -0.68, 0.38)
  buildSpeaker(1.68, -0.78, -0.32)

  // Articulated Boom Arm + Condenser Mic
  const boomCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.55, 1.74, -0.9),
    new THREE.Vector3(-1.55, 2.35, -0.7),
    new THREE.Vector3(-1.25, 2.55, -0.15),
    new THREE.Vector3(-1.05, 2.38, 0.18)
  ])
  const boomTube = new THREE.Mesh(new THREE.TubeGeometry(boomCurve, 24, 0.018, 8, false), matDarkMetal)
  const micBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.18, 16), matGunmetal)
  micBody.position.set(-1.05, 2.3, 0.18)
  micBody.rotation.z = 0.2
  const micRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.048, 0.008, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0xff1e42 })
  )
  micRing.rotation.x = Math.PI / 2
  micRing.position.set(-1.05, 2.32, 0.18)
  deskTopGroup.add(boomTube, micBody, micRing)

  // Headphone Stand + Cyber Headset
  const hsGroup = new THREE.Group()
  hsGroup.position.set(-2.55, 1.72, 0.55)
  hsGroup.rotation.y = 0.3
  const hsBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.03, 16), matDarkMetal)
  hsBase.position.y = 0.015
  const hsStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 12), matGunmetal)
  hsStem.position.y = 0.24
  const hsBand = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 10, 20, Math.PI), matMatteBlack)
  hsBand.position.y = 0.36
  for (const side of [-0.15, 0.15]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.055, 16), matGunmetal)
    cup.rotation.z = Math.PI / 2
    cup.position.set(side, 0.32, 0)
    const cupLed = new THREE.Mesh(
      new THREE.TorusGeometry(0.06, 0.008, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    )
    cupLed.rotation.y = Math.PI / 2
    cupLed.position.set(side + Math.sign(side) * 0.03, 0.32, 0)
    hsGroup.add(cup, cupLed)
  }
  hsGroup.add(hsBase, hsStem, hsBand)
  deskTopGroup.add(hsGroup)

  // Architect Desk Lamp (Right side of desk)
  const lampGroup = new THREE.Group()
  lampGroup.position.set(1.72, 1.72, 0.35)
  const lampFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 16), matDarkMetal)
  lampFoot.position.y = 0.02
  const lampNeckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.04, 0),
    new THREE.Vector3(0.05, 0.45, -0.1),
    new THREE.Vector3(-0.08, 0.85, 0.02),
    new THREE.Vector3(-0.26, 0.78, 0.12)
  ])
  const lampArm = new THREE.Mesh(new THREE.TubeGeometry(lampNeckCurve, 20, 0.018, 8, false), matGunmetal)
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.18, 16), matDarkMetal)
  lampShade.position.set(-0.28, 0.74, 0.12)
  lampShade.rotation.z = 0.45
  const deskLampBulbMat = new THREE.MeshBasicMaterial({ color: 0xfff4d6 })
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), deskLampBulbMat)
  lampBulb.position.set(-0.28, 0.67, 0.12)
  lampGroup.add(lampFoot, lampArm, lampShade, lampBulb)
  tagInteractive(lampShade, { action: 'desk_lamp', label: 'Desk Lamp (Toggle Power)' }, interactiveTargets)
  deskTopGroup.add(lampGroup)

  // 3D Holographic AI Core Emitter ("Holo-Core")
  const holoGroup = new THREE.Group()
  holoGroup.position.set(-1.55, 1.72, 0.38)
  const holoBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.07, 16), matDarkMetal)
  holoBase.position.y = 0.035
  const holoEmitterRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.014, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff })
  )
  holoEmitterRing.rotation.x = Math.PI / 2
  holoEmitterRing.position.y = 0.075

  const holoConeMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.44, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide
    })
  )
  holoConeMesh.rotation.x = Math.PI
  holoConeMesh.position.y = 0.3

  const holoCoreMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.11, 0),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true })
  )
  holoCoreMesh.position.y = 0.36

  const holoOuterRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.008, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xff1e42 })
  )
  holoOuterRing.position.y = 0.36

  const holoInnerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.007, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff })
  )
  holoInnerRing.position.y = 0.36

  holoGroup.add(holoBase, holoEmitterRing, holoConeMesh, holoCoreMesh, holoOuterRing, holoInnerRing)
  tagInteractive(holoBase, { action: 'holo_core', label: 'Holo-Core AI (Cycle Mode)' }, interactiveTargets)
  tagInteractive(holoCoreMesh, { action: 'holo_core', label: 'Holo-Core AI (Cycle Mode)' }, interactiveTargets)
  deskTopGroup.add(holoGroup)

  // Developer Coffee Mug + RGB Coaster + Animated Steam Wisps
  const mugGroup = new THREE.Group()
  mugGroup.position.set(1.25, 1.72, 0.68)
  const coaster = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.015, 16), matMatteBlack)
  coaster.position.y = 0.008
  const coasterLed = new THREE.Mesh(
    new THREE.TorusGeometry(0.118, 0.007, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xff1e42 })
  )
  coasterLed.rotation.x = Math.PI / 2
  coasterLed.position.y = 0.014
  deskLedMeshes.push(coasterLed)

  const mugBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.072, 0.17, 16),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
  )
  mugBody.position.y = 0.1
  mugBody.castShadow = true
  const coffeeSurface = new THREE.Mesh(
    new THREE.CircleGeometry(0.07, 16),
    new THREE.MeshStandardMaterial({ color: 0x2c1608, roughness: 0.2 })
  )
  coffeeSurface.rotation.x = -Math.PI / 2
  coffeeSurface.position.y = 0.18
  const mugHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.05, 0.014, 8, 14, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
  )
  mugHandle.rotation.z = -Math.PI / 2
  mugHandle.position.set(0.075, 0.1, 0)

  for (let s = 0; s < 3; s++) {
    const steam = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.32 })
    )
    steam.position.set((s - 1) * 0.02, 0.24 + s * 0.08, 0)
    mugGroup.add(steam)
    steamMeshes.push(steam)
  }
  mugGroup.add(coaster, coasterLed, mugBody, coffeeSurface, mugHandle)
  deskTopGroup.add(mugGroup)

  // --- 4. SHOWCASE LIQUID-COOLED PC RIG ---
  const pcGroup = new THREE.Group()
  pcGroup.position.set(2.45, 1.72, -0.15)

  // Feet
  for (const fx of [-0.32, 0.32]) {
    for (const fz of [-0.58, 0.58]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10), matDarkMetal)
      foot.position.set(fx, 0.025, fz)
      pcGroup.add(foot)
    }
  }

  // Main Matte Gunmetal Chassis Shell
  const pcFrameBack = new THREE.Mesh(new RoundedBoxGeometry(0.78, 1.4, 1.48, 2, 0.02), matMatteBlack)
  pcFrameBack.position.set(0.05, 0.74, 0)
  pcFrameBack.castShadow = true
  // Cut away interior feel: build separate structural panels (Back, Right, Top, Bottom, PSU shroud, Front mesh)
  const pcBottom = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 1.46), matDarkMetal)
  pcBottom.position.set(0, 0.16, 0)
  pcBottom.castShadow = true
  const pcTop = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 1.46), matDarkMetal)
  pcTop.position.set(0, 1.4, 0)
  pcTop.castShadow = true
  const pcBackPanel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.24, 0.06), matDarkMetal)
  pcBackPanel.position.set(0, 0.76, -0.7)
  const pcRightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.24, 1.46), matDarkMetal)
  pcRightPanel.position.set(0.35, 0.76, 0)
  const pcFrontMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 1.22, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x101624, roughness: 0.7, metalness: 0.5 })
  )
  pcFrontMesh.position.set(0, 0.76, 0.71)

  // Tempered Glass Left Panel
  const pcGlass = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.18, 1.38), matGlass)
  pcGlass.position.set(-0.37, 0.76, 0)

  // Motherboard Tray & Heatsinks
  const mobo = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.85), matMatteBlack)
  mobo.position.set(0.28, 0.84, -0.15)

  // 4 RGB RAM Sticks
  for (let r = 0; r < 4; r++) {
    const ram = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.22, 0.022),
      new THREE.MeshBasicMaterial({ color: 0xff1e42 })
    )
    ram.position.set(0.24, 0.98, 0.04 + r * 0.042)
    pcRgbMeshes.push(ram)
    pcGroup.add(ram)
  }

  // AIO Liquid Cooler Block + Curved Braided Tubes
  const aioBlock = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 16), matGunmetal)
  aioBlock.rotation.z = Math.PI / 2
  aioBlock.position.set(0.23, 0.98, -0.22)
  const aioRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.065, 0.01, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff })
  )
  aioRing.rotation.y = Math.PI / 2
  aioRing.position.set(0.19, 0.98, -0.22)
  pcRgbMeshes.push(aioRing)

  const tubeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
  const tube1 = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.22, 0.98, -0.18),
        new THREE.Vector3(0.08, 1.18, 0.08),
        new THREE.Vector3(0.05, 1.32, 0.35)
      ]),
      18,
      0.016,
      8,
      false
    ),
    tubeMat
  )
  const tube2 = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.22, 0.95, -0.26),
        new THREE.Vector3(0.05, 1.14, 0.02),
        new THREE.Vector3(0.0, 1.32, 0.3)
      ]),
      18,
      0.016,
      8,
      false
    ),
    tubeMat
  )

  // Triple-Fan Flagship GPU with Glowing Side Bar
  const gpuBody = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.11, 0.88, 2, 0.015), matGunmetal)
  gpuBody.position.set(0.14, 0.56, -0.1)
  const gpuStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.03, 0.72),
    new THREE.MeshBasicMaterial({ color: 0xff1e42 })
  )
  gpuStrip.position.set(-0.025, 0.56, -0.1)
  pcRgbMeshes.push(gpuStrip)

  // Spinning Multi-Blade Fans (3 Front Intake + 1 Rear Exhaust)
  const createFan = (x: number, y: number, z: number, rotY: number) => {
    const fanAssembly = new THREE.Group()
    fanAssembly.position.set(x, y, z)
    fanAssembly.rotation.y = rotY

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.02, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xff1e42 })
    )
    pcRgbMeshes.push(ring)

    const bladeHub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), matDarkMetal)
    bladeHub.rotation.x = Math.PI / 2
    for (let b = 0; b < 5; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.01), matGunmetal)
      blade.rotation.z = (b * Math.PI) / 5
      bladeHub.add(blade)
    }

    fanAssembly.add(ring, bladeHub)
    fanMeshes.push(bladeHub)
    pcGroup.add(fanAssembly)
  }

  // 3 Front fans
  for (let i = 0; i < 3; i++) {
    createFan(0, 0.42 + i * 0.34, 0.65, 0)
  }
  // 1 Rear exhaust fan
  createFan(0, 1.05, -0.64, 0)

  pcGroup.add(pcBottom, pcTop, pcBackPanel, pcRightPanel, pcFrontMesh, pcGlass, mobo, aioBlock, aioRing, tube1, tube2, gpuBody, gpuStrip)
  tagInteractive(pcGlass, { action: 'pc', label: 'Workstation PC (Toggle Overclock)' }, interactiveTargets)
  tagInteractive(pcTop, { action: 'pc', label: 'Workstation PC (Toggle Overclock)' }, interactiveTargets)
  deskTopGroup.add(pcGroup)
  void pcFrameBack // unused helper avoided cleanly

  // --- 5. ERGONOMIC GAMING CHAIR ---
  const chairBaseGroup = new THREE.Group()
  chairBaseGroup.position.set(-0.2, 0, 0.72)

  // 5-star base + dual wheels
  for (let i = 0; i < 5; i++) {
    const ang = (i * Math.PI * 2) / 5
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.055, 0.08, 2, 0.015), matDarkMetal)
    arm.position.set(Math.cos(ang) * 0.38, 0.1, Math.sin(ang) * 0.38)
    arm.rotation.y = -ang
    chairBaseGroup.add(arm)

    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), matMatteBlack)
    wheel.rotation.x = Math.PI / 2
    wheel.position.set(Math.cos(ang) * 0.72, 0.05, Math.sin(ang) * 0.72)
    chairBaseGroup.add(wheel)
  }

  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.95, 16), matDarkMetal)
  piston.position.y = 0.56
  chairBaseGroup.add(piston)

  // Upper Rotating Chair Section
  const chairUpperGroup = new THREE.Group()
  chairUpperGroup.position.y = 1.05
  chairUpperGroup.rotation.y = Math.PI - 0.15

  const seatCushion = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.16, 1.2, 3, 0.05), matGunmetal)
  seatCushion.castShadow = true
  // Side seat bolsters
  for (const sx of [-0.58, 0.58]) {
    const bolster = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.22, 1.15, 2, 0.04), matMatteBlack)
    bolster.position.set(sx, 0.05, 0)
    chairUpperGroup.add(bolster)
  }

  // 4D Armrests
  for (const ax of [-0.72, 0.72]) {
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.08), matDarkMetal)
    stalk.position.set(ax, 0.16, 0.05)
    const pad = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.05, 0.55, 2, 0.02), matMatteBlack)
    pad.position.set(ax, 0.35, 0.12)
    chairUpperGroup.add(stalk, pad)
  }

  // Contoured Backrest + Winged Bolsters + Pillows
  const backrest = new THREE.Mesh(new RoundedBoxGeometry(1.12, 1.58, 0.14, 3, 0.05), matGunmetal)
  backrest.position.set(0, 0.85, -0.56)
  backrest.rotation.x = -0.08
  backrest.castShadow = true

  const lumbarPillow = new THREE.Mesh(
    new RoundedBoxGeometry(0.75, 0.28, 0.14, 3, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.65 })
  )
  lumbarPillow.position.set(0, 0.34, -0.45)

  const headPillow = new THREE.Mesh(
    new RoundedBoxGeometry(0.58, 0.26, 0.14, 3, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.65 })
  )
  headPillow.position.set(0, 1.48, -0.48)

  chairUpperGroup.add(seatCushion, backrest, lumbarPillow, headPillow)
  tagInteractive(seatCushion, { action: 'chair', label: 'Ergonomic Chair (Toggle Spin)' }, interactiveTargets)
  tagInteractive(backrest, { action: 'chair', label: 'Ergonomic Chair (Toggle Spin)' }, interactiveTargets)
  chairBaseGroup.add(chairUpperGroup)
  scene.add(chairBaseGroup)

  // --- 6. UPGRADED RETRO ARCADE CABINET ---
  const arcadeGroup = new THREE.Group()
  arcadeGroup.position.set(-3.85, 0, 1.3)
  arcadeGroup.rotation.y = Math.PI / 4

  const arcMat = new THREE.MeshStandardMaterial({ color: 0x201838, roughness: 0.42, metalness: 0.35 })
  const arcBody = new THREE.Mesh(new RoundedBoxGeometry(1.75, 3.65, 1.52, 2, 0.03), arcMat)
  arcBody.position.set(0, 1.825, 0)
  arcBody.castShadow = true
  arcBody.receiveShadow = true
  arcadeGroup.add(arcBody)

  // Side Art Panels
  const sideArtMat = new THREE.MeshStandardMaterial({ map: textures.arcadeSideArtTexture, roughness: 0.5 })
  for (const sx of [-0.88, 0.88]) {
    const sideArt = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 3.3), sideArtMat)
    sideArt.position.set(sx, 1.8, 0)
    sideArt.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2
    arcadeGroup.add(sideArt)
  }

  // Neon T-Molding Edge Trims
  const arcTrimMat = new THREE.MeshBasicMaterial({ color: 0xff007f })
  for (const sx of [-0.87, 0.87]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.66, 1.54), arcTrimMat)
    trim.position.set(sx, 1.83, 0)
    arcadeGroup.add(trim)
  }

  // Control Deck
  const deck = new THREE.Mesh(new RoundedBoxGeometry(1.68, 0.16, 0.78, 2, 0.025), arcMat)
  deck.position.set(0, 1.76, 0.64)
  deck.rotation.x = 0.2
  deck.castShadow = true
  arcadeGroup.add(deck)

  // Dual Joysticks & 8 Illuminated Buttons
  const stickGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.22)
  const ballGeo = new THREE.SphereGeometry(0.062)
  const p1Stick = new THREE.Mesh(stickGeo, matGunmetal)
  p1Stick.position.set(-0.5, 1.94, 0.62)
  const p1Ball = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: 0xff1e42 }))
  p1Ball.position.set(-0.5, 2.05, 0.62)

  const p2Stick = new THREE.Mesh(stickGeo, matGunmetal)
  p2Stick.position.set(0.18, 1.94, 0.62)
  const p2Ball = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff }))
  p2Ball.position.set(0.18, 2.05, 0.62)
  arcadeGroup.add(p1Stick, p1Ball, p2Stick, p2Ball)

  const btnColors = [0xff1e42, 0x00f0ff, 0xffaa00, 0x00ff88]
  const btnGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.045, 12)
  for (let p = 0; p < 2; p++) {
    for (let b = 0; b < 4; b++) {
      const btn = new THREE.Mesh(btnGeo, new THREE.MeshBasicMaterial({ color: btnColors[b % btnColors.length] }))
      btn.position.set(-0.3 + p * 0.68 + (b % 2) * 0.11, 1.88 + Math.floor(b / 2) * 0.03, 0.54 + Math.floor(b / 2) * 0.1)
      arcadeGroup.add(btn)
    }
  }

  // Coin Door
  const coinDoor = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.72, 0.06, 2, 0.02), matMatteBlack)
  coinDoor.position.set(0, 0.82, 0.76)
  arcadeGroup.add(coinDoor)
  for (const cx of [-0.2, 0.2]) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: 0xff8800 }))
    slot.position.set(cx, 0.9, 0.795)
    arcadeGroup.add(slot)
  }

  // Recessed CRT Screen
  const arcScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.36, 1.08),
    new THREE.MeshBasicMaterial({ map: textures.arcadeTexture })
  )
  arcScreen.position.set(0, 2.52, 0.72)
  arcScreen.rotation.x = -0.16
  arcadeGroup.add(arcScreen)
  tagInteractive(arcScreen, { action: 'arcade', label: 'Arcade CRT (Switch Game)' }, interactiveTargets)

  // Glowing Marquee Sign
  const marquee = new THREE.Mesh(
    new RoundedBoxGeometry(1.66, 0.46, 0.14, 2, 0.02),
    new THREE.MeshBasicMaterial({ map: textures.arcadeMarqueeTexture })
  )
  marquee.position.set(0, 3.38, 0.66)
  arcadeGroup.add(marquee)
  scene.add(arcadeGroup)

  // --- 7. HOMELAB 12U SERVER RACK ---
  const rackGroup = new THREE.Group()
  rackGroup.position.set(-4.65, 0, -4.45)
  rackGroup.rotation.y = 0.35

  const rackShell = new THREE.Mesh(new RoundedBoxGeometry(1.05, 2.45, 1.0, 2, 0.03), matMatteBlack)
  rackShell.position.y = 1.225
  rackShell.castShadow = true
  rackShell.receiveShadow = true
  rackGroup.add(rackShell)

  const rackGlassDoor = new THREE.Mesh(new THREE.BoxGeometry(0.92, 2.25, 0.03), matGlass)
  rackGlassDoor.position.set(0, 1.24, 0.51)
  rackGroup.add(rackGlassDoor)

  // Rack Blades (Switch, NAS Drives, GPU Compute Node, UPS)
  for (let u = 0; u < 6; u++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.24, 0.04), matDarkMetal)
    blade.position.set(0, 0.42 + u * 0.34, 0.48)
    rackGroup.add(blade)

    // Blinking activity LEDs per blade
    for (let l = 0; l < 4; l++) {
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.025, 0.015),
        new THREE.MeshBasicMaterial({ color: l === 0 ? 0x00f0ff : 0x10b981 })
      )
      led.position.set(-0.32 + l * 0.11, 0.42 + u * 0.34, 0.502)
      serverLedMeshes.push(led)
      rackGroup.add(led)
    }
  }
  tagInteractive(rackGlassDoor, { action: 'server_rack', label: 'Homelab Server Rack (Toggle Power)' }, interactiveTargets)
  tagInteractive(rackShell, { action: 'server_rack', label: 'Homelab Server Rack (Toggle Power)' }, interactiveTargets)
  scene.add(rackGroup)

  return {
    ambientLight,
    hemiLight,
    dirLight,
    roomCeilingLight,
    deskLedLight,
    monitorBackglowLight,
    pcRgbLight,
    arcadePointLight,
    deskLampLight,
    holoLight,
    serverLight,
    deskTopGroup,
    chairUpperGroup,
    holoGroup,
    holoOuterRing,
    holoInnerRing,
    holoCoreMesh,
    holoConeMesh,
    deskLedMeshes,
    wallTrimMeshes,
    pcRgbMeshes,
    keyboardRgbMeshes,
    fanMeshes,
    serverLedMeshes,
    steamMeshes,
    ceilingLightMesh,
    deskLampBulbMat,
    interactiveTargets
  }
}
