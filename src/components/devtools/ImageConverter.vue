<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useToast } from '@/composables/useToast'

const { showToast, copyToClipboard } = useToast()

// Types
export type TargetFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'bmp' | 'ico'
export type ScalePreset = '0.5x' | '1x' | '2x' | '4x' | '8x' | 'custom' | 'fav16' | 'fav32' | 'icon64' | 'icon256' | 'icon512' | 'hd1080'

export interface ImageQueueItem {
  id: string
  file?: File
  name: string
  origExtension: string
  origSize: number
  origWidth: number
  origHeight: number
  isSvg: boolean
  previewUrl: string
  svgText?: string
  
  // Conversion configuration
  targetFormat: TargetFormat
  scalePreset: ScalePreset
  customWidth: number
  customHeight: number
  lockAspectRatio: boolean
  quality: number // 10 - 100
  bgColor: string // 'transparent' | hex
  icoSizes: number[] // e.g. [16, 32, 48, 64]
  
  // Status & output
  status: 'pending' | 'converting' | 'done' | 'error'
  errorMsg?: string
  convertedBlob?: Blob
  convertedUrl?: string
  convertedSize?: number
  convertedWidth?: number
  convertedHeight?: number
}

// Global default configuration
const globalTargetFormat = ref<TargetFormat>('png')
const globalScalePreset = ref<ScalePreset>('1x')
const globalQuality = ref(92)
const globalBgColor = ref<string>('transparent')

// State
const queue = ref<ImageQueueItem[]>([])
const selectedItemId = ref<string | null>(null)
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isBatchConverting = ref(false)
const activeTab = ref<'queue' | 'preview'>('queue')

// Format metadata options
const formatOptions = [
  { id: 'png', label: 'PNG', ext: '.png', mime: 'image/png', desc: 'Lossless, Full Alpha Transparency', badge: 'LOSSLESS' },
  { id: 'jpeg', label: 'JPG / JPEG', ext: '.jpg', mime: 'image/jpeg', desc: 'High Compression, Solid Background', badge: 'COMPACT' },
  { id: 'webp', label: 'WebP', ext: '.webp', mime: 'image/webp', desc: 'Modern Web, Transparency & High Efficiency', badge: 'NEXT-GEN' },
  { id: 'avif', label: 'AVIF', ext: '.avif', mime: 'image/avif', desc: 'Ultra Efficiency Next-Gen Standard', badge: 'ULTRA' },
  { id: 'bmp', label: 'BMP', ext: '.bmp', mime: 'image/bmp', desc: 'Uncompressed Windows Bitmap Standard', badge: 'LEGACY' },
  { id: 'ico', label: 'ICO (Favicon)', ext: '.ico', mime: 'image/x-icon', desc: 'Windows Icon & Browser Favicon (Multi-res)', badge: 'FAVICON' }
] as const

const scalePresetOptions: Array<{ id: ScalePreset; label: string }> = [
  { id: '0.5x', label: '0.5x (Half Size)' },
  { id: '1x', label: '1x (Original Scale)' },
  { id: '2x', label: '2x (Retina HD)' },
  { id: '4x', label: '4x (Ultra 4K)' },
  { id: '8x', label: '8x (Vector Super-Res)' },
  { id: 'fav16', label: '16 × 16 (Micro Favicon)' },
  { id: 'fav32', label: '32 × 32 (Standard Favicon)' },
  { id: 'icon64', label: '64 × 64 (Toolbar Icon)' },
  { id: 'icon256', label: '256 × 256 (App Icon)' },
  { id: 'icon512', label: '512 × 512 (Store Hero)' },
  { id: 'hd1080', label: '1920 × 1080 (Full HD)' },
  { id: 'custom', label: 'Custom Pixel Dimensions' }
]

const bgPresets = [
  { id: 'transparent', label: 'Transparent', value: 'transparent', preview: 'checkered' },
  { id: 'white', label: 'White', value: '#ffffff', preview: '#ffffff' },
  { id: 'black', label: 'Black', value: '#000000', preview: '#000000' },
  { id: 'slate', label: 'Dark Slate', value: '#0b0e17', preview: '#0b0e17' },
  { id: 'crimson', label: 'Crimson', value: '#ff1e42', preview: '#ff1e42' }
]

// Computed selected item
const selectedItem = computed<ImageQueueItem | null>(() => {
  if (!queue.value.length) return null
  return queue.value.find(i => i.id === selectedItemId.value) || queue.value[0] || null
})

// File size formatter
const formatFileSize = (bytes?: number) => {
  if (bytes === undefined || bytes === null) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// Generate unique id
const uid = () => Math.random().toString(36).substring(2, 9)

// ----------------------------------------------------------------------
// Pure Client-side Binary Encoders: BMP & ICO
// ----------------------------------------------------------------------

/**
 * Encode an RGBA ImageData buffer into a valid 24-bit uncompressed Windows BMP
 */
function encodeBMP24(imageData: ImageData): Uint8Array {
  const { width, height, data } = imageData
  const rowBytes = Math.ceil((width * 3) / 4) * 4
  const pixelDataSize = rowBytes * height
  const fileSize = 54 + pixelDataSize

  const buffer = new ArrayBuffer(fileSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // BITMAPFILEHEADER (14 bytes)
  view.setUint16(0, 0x4D42, false) // 'BM' in ASCII
  view.setUint32(2, fileSize, true) // File size in bytes
  view.setUint16(6, 0, true) // Reserved 1
  view.setUint16(8, 0, true) // Reserved 2
  view.setUint32(10, 54, true) // Offset to pixel array

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true) // Header size
  view.setInt32(18, width, true) // Image width
  view.setInt32(22, height, true) // Image height (bottom-to-top)
  view.setUint16(26, 1, true) // Color planes (must be 1)
  view.setUint16(28, 24, true) // Bits per pixel (24-bit BGR)
  view.setUint32(30, 0, true) // Compression: BI_RGB (none)
  view.setUint32(34, pixelDataSize, true) // Image size
  view.setInt32(38, 2835, true) // Horizontal resolution (72 DPI)
  view.setInt32(42, 2835, true) // Vertical resolution (72 DPI)
  view.setUint32(46, 0, true) // Colors in color palette
  view.setUint32(50, 0, true) // Important colors

  // Pixel data: bottom-to-top, BGR order
  let offset = 54
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      bytes[offset++] = data[idx + 2] ?? 0 // B
      bytes[offset++] = data[idx + 1] ?? 0 // G
      bytes[offset++] = data[idx] ?? 0     // R
    }
    // Row padding to 4-byte boundary
    const padding = rowBytes - (width * 3)
    for (let p = 0; p < padding; p++) {
      bytes[offset++] = 0
    }
  }

  return bytes
}

/**
 * Encode multiple PNG frames into a single standard Windows ICO icon file
 */
async function encodeICOFile(frames: { width: number; height: number; blob: Blob }[]): Promise<Blob> {
  const count = frames.length
  const headerSize = 6 + count * 16

  const arrayBuffers: ArrayBuffer[] = []
  for (const frame of frames) {
    arrayBuffers.push(await frame.blob.arrayBuffer())
  }

  let totalSize = headerSize
  for (const buf of arrayBuffers) {
    totalSize += buf.byteLength
  }

  const icoBuffer = new ArrayBuffer(totalSize)
  const view = new DataView(icoBuffer)
  const uint8 = new Uint8Array(icoBuffer)

  // ICONDIR header (6 bytes)
  view.setUint16(0, 0, true) // Reserved, must be 0
  view.setUint16(2, 1, true) // Resource type: 1 = Icon (.ico)
  view.setUint16(4, count, true) // Number of images

  let currentOffset = headerSize
  for (let i = 0; i < count; i++) {
    const frame = frames[i]
    const buf = arrayBuffers[i]
    if (!frame || !buf) continue

    const entryOffset = 6 + i * 16

    // ICONDIRENTRY (16 bytes)
    view.setUint8(entryOffset + 0, frame.width >= 256 ? 0 : frame.width)
    view.setUint8(entryOffset + 1, frame.height >= 256 ? 0 : frame.height)
    view.setUint8(entryOffset + 2, 0) // Color count (0 for 32bpp)
    view.setUint8(entryOffset + 3, 0) // Reserved
    view.setUint16(entryOffset + 4, 1, true) // Color planes
    view.setUint16(entryOffset + 6, 32, true) // Bits per pixel
    view.setUint32(entryOffset + 8, buf.byteLength, true) // Size of image data in bytes
    view.setUint32(entryOffset + 12, currentOffset, true) // Absolute offset of image data

    // Copy raw PNG frame bytes into ICO payload
    uint8.set(new Uint8Array(buf), currentOffset)
    currentOffset += buf.byteLength
  }

  return new Blob([icoBuffer], { type: 'image/x-icon' })
}

// ----------------------------------------------------------------------
// Image Processing Engine
// ----------------------------------------------------------------------

/**
 * Load image from Data URL or Blob into an HTMLImageElement
 */
const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = (err) => reject(new Error('Failed to load image resource: ' + err))
    img.src = url
  })
}

/**
 * Compute target dimensions based on preset, custom inputs, or aspect ratio
 */
const computeTargetDimensions = (item: ImageQueueItem): { targetWidth: number; targetHeight: number } => {
  const origW = item.origWidth || 300
  const origH = item.origHeight || 300
  const aspect = origW / origH

  switch (item.scalePreset) {
    case '0.5x':
      return { targetWidth: Math.max(1, Math.round(origW * 0.5)), targetHeight: Math.max(1, Math.round(origH * 0.5)) }
    case '1x':
      return { targetWidth: origW, targetHeight: origH }
    case '2x':
      return { targetWidth: origW * 2, targetHeight: origH * 2 }
    case '4x':
      return { targetWidth: origW * 4, targetHeight: origH * 4 }
    case '8x':
      return { targetWidth: origW * 8, targetHeight: origH * 8 }
    case 'fav16':
      return { targetWidth: 16, targetHeight: 16 }
    case 'fav32':
      return { targetWidth: 32, targetHeight: 32 }
    case 'icon64':
      return { targetWidth: 64, targetHeight: 64 }
    case 'icon256':
      return { targetWidth: 256, targetHeight: 256 }
    case 'icon512':
      return { targetWidth: 512, targetHeight: 512 }
    case 'hd1080': {
      const targetW = 1920
      const targetH = Math.round(1920 / aspect)
      return { targetWidth: targetW, targetHeight: targetH }
    }
    case 'custom': {
      const w = Math.max(1, Math.round(item.customWidth || origW))
      let h = Math.max(1, Math.round(item.customHeight || origH))
      if (item.lockAspectRatio) {
        h = Math.max(1, Math.round(w / aspect))
      }
      return { targetWidth: w, targetHeight: h }
    }
    default:
      return { targetWidth: origW, targetHeight: origH }
  }
}

/**
 * Draw image onto a canvas with background color handling
 */
const renderToCanvas = (
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  bgColor: string,
  forceSolid = false
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not acquire 2D canvas context')

  // Smooth rendering
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Clear
  ctx.clearRect(0, 0, targetWidth, targetHeight)

  // Background fill
  if (bgColor && bgColor !== 'transparent') {
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, targetWidth, targetHeight)
  } else if (forceSolid) {
    // If format doesn't support alpha (like JPEG or standard BMP) and user had transparent
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetWidth, targetHeight)
  }

  // Draw image stretched/scaled to target dimensions
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
  return canvas
}

/**
 * Convert a canvas to Blob with quality settings & format fallback
 */
const canvasToBlobPromise = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          // Fallback if browser does not support specific mimeType (e.g. image/avif)
          if (mimeType === 'image/avif') {
            canvas.toBlob(
              (fallbackBlob) => {
                if (fallbackBlob) resolve(fallbackBlob)
                else reject(new Error('Canvas export failed'))
              },
              'image/webp',
              quality
            )
          } else {
            reject(new Error(`Failed to encode canvas to ${mimeType}`))
          }
        }
      },
      mimeType,
      quality
    )
  })
}

/**
 * Primary conversion routine for a single item
 */
const convertItem = async (item: ImageQueueItem): Promise<void> => {
  item.status = 'converting'
  item.errorMsg = undefined

  try {
    const { targetWidth, targetHeight } = computeTargetDimensions(item)
    const isJpegOrBmp = item.targetFormat === 'jpeg' || item.targetFormat === 'bmp'
    const img = await loadImage(item.previewUrl)

    // Handle ICO specifically (multi-size or custom resolution icon generator)
    if (item.targetFormat === 'ico') {
      const icoSizesToRender = (item.scalePreset === 'fav16')
        ? [16]
        : (item.scalePreset === 'fav32')
        ? [32]
        : (item.scalePreset === 'icon64')
        ? [64]
        : item.icoSizes && item.icoSizes.length
        ? item.icoSizes
        : [16, 32, 48, 64]

      const pngFrames: { width: number; height: number; blob: Blob }[] = []

      for (const size of icoSizesToRender) {
        const frameCanvas = renderToCanvas(img, size, size, item.bgColor, false)
        const frameBlob = await canvasToBlobPromise(frameCanvas, 'image/png', 1)
        pngFrames.push({ width: size, height: size, blob: frameBlob })
      }

      const finalIcoBlob = await encodeICOFile(pngFrames)
      const url = URL.createObjectURL(finalIcoBlob)

      const lastIcoSize = icoSizesToRender[icoSizesToRender.length - 1] ?? 64
      item.convertedBlob = finalIcoBlob
      item.convertedUrl = url
      item.convertedSize = finalIcoBlob.size
      item.convertedWidth = lastIcoSize
      item.convertedHeight = lastIcoSize
      item.status = 'done'
      return
    }

    // Render image to main canvas
    const canvas = renderToCanvas(img, targetWidth, targetHeight, item.bgColor, isJpegOrBmp)

    // BMP conversion
    if (item.targetFormat === 'bmp') {
      const ctx = canvas.getContext('2d')!
      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight)
      const bmpBytes = encodeBMP24(imageData)
      const bmpBlob = new Blob([bmpBytes.buffer as ArrayBuffer], { type: 'image/bmp' })
      const url = URL.createObjectURL(bmpBlob)

      item.convertedBlob = bmpBlob
      item.convertedUrl = url
      item.convertedSize = bmpBlob.size
      item.convertedWidth = targetWidth
      item.convertedHeight = targetHeight
      item.status = 'done'
      return
    }

    // Standard raster targets: PNG, JPEG, WebP, AVIF
    const formatMeta = formatOptions.find(f => f.id === item.targetFormat) || formatOptions[0]
    const mimeType = formatMeta.mime
    const normalizedQuality = Math.min(1, Math.max(0.1, item.quality / 100))

    const blob = await canvasToBlobPromise(canvas, mimeType, normalizedQuality)
    const url = URL.createObjectURL(blob)

    item.convertedBlob = blob
    item.convertedUrl = url
    item.convertedSize = blob.size
    item.convertedWidth = targetWidth
    item.convertedHeight = targetHeight
    item.status = 'done'
  } catch (err: unknown) {
    console.error('Error during image conversion:', err)
    item.status = 'error'
    item.errorMsg = err instanceof Error ? err.message : 'Conversion failed'
  }
}

/**
 * Parse an uploaded File and create a queue item
 */
const processFile = async (file: File): Promise<void> => {
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase() || '.png'

  let previewUrl = ''
  let svgContent: string | undefined
  let width = 300
  let height = 300

  if (isSvg) {
    svgContent = await file.text()
    // Extract intrinsic width & height from SVG if available
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svgEl = doc.querySelector('svg')
    if (svgEl) {
      const viewBox = svgEl.getAttribute('viewBox')
      if (viewBox) {
        const parts = viewBox.split(/[\s,]+/).map(Number)
        const p2 = parts[2]
        const p3 = parts[3]
        if (parts.length >= 4 && p2 !== undefined && p3 !== undefined && !isNaN(p2) && !isNaN(p3)) {
          width = Math.round(p2)
          height = Math.round(p3)
        }
      } else {
        const wAttr = parseFloat(svgEl.getAttribute('width') || '300')
        const hAttr = parseFloat(svgEl.getAttribute('height') || '300')
        if (!isNaN(wAttr)) width = Math.round(wAttr)
        if (!isNaN(hAttr)) height = Math.round(hAttr)
      }
    }
    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    previewUrl = URL.createObjectURL(blob)
  } else {
    previewUrl = URL.createObjectURL(file)
    // Extract dimensions from image
    try {
      const img = await loadImage(previewUrl)
      width = img.naturalWidth || width
      height = img.naturalHeight || height
    } catch {
      // Fallback defaults
    }
  }

  const newItem: ImageQueueItem = {
    id: uid(),
    file,
    name: file.name,
    origExtension: ext,
    origSize: file.size,
    origWidth: width,
    origHeight: height,
    isSvg,
    previewUrl,
    svgText: svgContent,
    targetFormat: globalTargetFormat.value,
    scalePreset: globalScalePreset.value,
    customWidth: width,
    customHeight: height,
    lockAspectRatio: true,
    quality: globalQuality.value,
    bgColor: globalBgColor.value,
    icoSizes: [16, 32, 48, 64],
    status: 'pending'
  }

  queue.value.push(newItem)
  const reactiveItem = queue.value.find(i => i.id === newItem.id) ?? newItem
  if (!selectedItemId.value) {
    selectedItemId.value = reactiveItem.id
  }

  // Automatically start conversion on the reactive proxy
  await convertItem(reactiveItem)
}

/**
 * Handle multiple dropped or selected files
 */
const handleFiles = async (files: FileList | File[]) => {
  const fileArray = Array.from(files)
  const validFiles: File[] = []
  for (const f of fileArray) {
    if (
      f.type.startsWith('image/') ||
      f.name.match(/\.(svg|png|jpe?g|webp|avif|bmp|ico|gif)$/i)
    ) {
      validFiles.push(f)
    }
  }

  if (!validFiles.length) {
    showToast('Please select valid image or SVG files', 'error')
    return
  }

  showToast(`Loading ${validFiles.length} file(s)...`, 'info')
  for (const file of validFiles) {
    await processFile(file)
  }
}

// Dropzone event handlers
const onDrop = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files?.length) {
    handleFiles(e.dataTransfer.files)
  }
}

// Clipboard Paste
const onPaste = (e: ClipboardEvent) => {
  if (e.clipboardData?.files?.length) {
    handleFiles(e.clipboardData.files)
  }
}

// Load Sample Futuristic SVG Logo
const loadSampleSvg = async () => {
  const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <linearGradient id="cyberGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff1e42" />
      <stop offset="50%" stop-color="#a855f7" />
      <stop offset="100%" stop-color="#00f0ff" />
    </linearGradient>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#141926" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0b0e17" stop-opacity="0.98" />
    </linearGradient>
    <filter id="neonBlur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Ambient background glow ring -->
  <circle cx="400" cy="400" r="320" fill="none" stroke="url(#cyberGlow)" stroke-width="6" opacity="0.4" stroke-dasharray="16 12" />
  <circle cx="400" cy="400" r="280" fill="none" stroke="#00f0ff" stroke-width="2" opacity="0.6" />

  <!-- Quantum Shield Base -->
  <polygon points="400,140 620,260 620,520 400,680 180,520 180,260" fill="url(#shieldGrad)" stroke="url(#cyberGlow)" stroke-width="8" filter="url(#neonBlur)" />

  <!-- Inner Cyber Hexagon Details -->
  <polygon points="400,190 580,290 580,500 400,630 220,500 220,290" fill="none" stroke="#ff1e42" stroke-width="3" opacity="0.5" />

  <!-- Central Dynamic Vector Icon -->
  <path d="M400 240 L480 380 L360 410 L440 560 L320 420 L440 390 Z" fill="url(#cyberGlow)" />

  <!-- Modern Typography -->
  <text x="400" y="610" font-family="Outfit, system-ui, sans-serif" font-weight="900" font-size="38" fill="#ffffff" text-anchor="middle" letter-spacing="8">IMAGEFORGE</text>
  <text x="400" y="645" font-family="Fira Code, monospace" font-size="16" fill="#00f0ff" text-anchor="middle" letter-spacing="4">VECTOR // MATRIX</text>
</svg>`

  const blob = new Blob([sampleSvg], { type: 'image/svg+xml' })
  const file = new File([blob], 'ImageForge_Cyber_Logo_Sample.svg', { type: 'image/svg+xml' })
  await processFile(file)
  showToast('Loaded sample logo!', 'success')
}

// Convert all pending/modified items in queue
const convertAll = async () => {
  if (!queue.value.length) return
  isBatchConverting.value = true
  showToast(`Converting ${queue.value.length} image(s)...`, 'info')

  for (const item of queue.value) {
    await convertItem(item)
  }

  isBatchConverting.value = false
  showToast('All conversions completed!', 'success')
}

// Download single converted image
const downloadItem = async (item: ImageQueueItem) => {
  if (item.status !== 'done' || !item.convertedUrl || !item.convertedBlob) {
    showToast('Preparing image download...', 'info')
    await convertItem(item)
  }

  if (!item.convertedUrl || !item.convertedBlob) {
    showToast('Failed to prepare image for download', 'error')
    return
  }

  const formatMeta = formatOptions.find(f => f.id === item.targetFormat)
  const baseName = item.name.replace(/\.[^/.]+$/, '')
  const ext = formatMeta ? formatMeta.ext : `.${item.targetFormat}`
  const fileName = `${baseName}_converted${ext}`

  const a = document.createElement('a')
  a.href = item.convertedUrl
  a.download = fileName
  a.click()
  showToast(`Downloading ${fileName}`, 'success')
}

// Download all converted items sequentially
const downloadAll = () => {
  const readyItems = queue.value.filter(i => i.status === 'done' && i.convertedUrl)
  if (!readyItems.length) {
    showToast('No converted images available to download', 'error')
    return
  }

  showToast(`Starting download for ${readyItems.length} file(s)...`, 'info')
  readyItems.forEach((item, index) => {
    setTimeout(() => {
      downloadItem(item)
    }, index * 300)
  })
}

// Remove item from queue
const removeItem = (id: string) => {
  const idx = queue.value.findIndex(i => i.id === id)
  if (idx !== -1) {
    const item = queue.value[idx]
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    if (item?.convertedUrl) URL.revokeObjectURL(item.convertedUrl)
    queue.value.splice(idx, 1)

    if (selectedItemId.value === id) {
      selectedItemId.value = queue.value[0]?.id || null
    }
    showToast('Item removed from queue', 'info')
  }
}

// Toggle resolution inclusion in ICO payload
const toggleIcoSize = (item: ImageQueueItem | null | undefined, size: number, checked: boolean) => {
  if (!item) return
  if (checked) {
    if (!item.icoSizes.includes(size)) {
      item.icoSizes.push(size)
    }
  } else {
    item.icoSizes = item.icoSizes.filter(s => s !== size)
  }
  updateItemConfig(item)
}

// Clear entire queue
const clearQueue = () => {
  queue.value.forEach(item => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl)
  })
  queue.value = []
  selectedItemId.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
  showToast('Queue cleared', 'info')
}

// Apply global target format to all items
const applyGlobalFormat = () => {
  queue.value.forEach(item => {
    item.targetFormat = globalTargetFormat.value
    // If format changed to JPEG/BMP and color was transparent, set white
    if ((globalTargetFormat.value === 'jpeg' || globalTargetFormat.value === 'bmp') && item.bgColor === 'transparent') {
      item.bgColor = '#ffffff'
    }
  })
  convertAll()
}

// Apply global scale preset to all items
const applyGlobalScale = () => {
  queue.value.forEach(item => {
    item.scalePreset = globalScalePreset.value
  })
  convertAll()
}

// Update single item settings & re-convert
const updateItemConfig = (item: ImageQueueItem) => {
  if (item.targetFormat === 'jpeg' && item.bgColor === 'transparent') {
    item.bgColor = '#ffffff'
  }
  convertItem(item)
}

// Quick action: Copy SVG source code
const copySvgSource = (item: ImageQueueItem) => {
  if (item.svgText) {
    copyToClipboard(item.svgText, 'SVG vector source copied to clipboard!')
  }
}

// Lifecycle listeners
onMounted(() => {
  window.addEventListener('paste', onPaste)
})

onUnmounted(() => {
  window.removeEventListener('paste', onPaste)
  clearQueue()
})
</script>

<template>
  <div class="image-converter-container">
    <!-- Header Console -->
    <header class="converter-header">
      <div class="header-left">
        <h1 class="header-title">ImageForge</h1>
        <p class="header-desc">
          Universal image format conversion studio. Convert seamlessly between modern formats (PNG, JPG, WebP, AVIF, BMP, ICO favicons, SVG), with batch processing, scaling multipliers, and quality controls.
        </p>
      </div>
      <div class="header-actions">
        <button class="btn-sample" @click="loadSampleSvg">
          <span class="btn-icon">⚡</span>
          Load Sample Logo
        </button>
        <button v-if="queue.length" class="btn-clear" @click="clearQueue">
          <span class="btn-icon">✕</span>
          Clear All ({{ queue.length }})
        </button>
      </div>
    </header>

    <!-- Upload Dropzone Hero Area -->
    <div
      class="converter-dropzone"
      :class="{ 'is-dragging': isDragging, 'has-files': queue.length > 0 }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="fileInputRef?.click()"
    >
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept=".svg,.png,.jpg,.jpeg,.webp,.avif,.bmp,.ico,.gif,image/*"
        class="hidden-input"
        @change="(e: any) => handleFiles(e.target.files)"
      />

      <div class="dropzone-content">
        <div class="dropzone-icon-ring">
          <span class="dropzone-icon">🔄</span>
        </div>
        <div class="dropzone-text">
          <h3>Drop Images here to Convert</h3>
          <p>
            Supports <strong>PNG, JPG, WebP, AVIF, SVG, BMP, ICO</strong> • Batch upload & Clipboard (<code>Ctrl+V</code>) ready
          </p>
        </div>
        <div class="dropzone-formats-badge">
          <span>UNIVERSAL CONVERTER</span>
          <span>MULTI-SIZE ICO FAVICON</span>
          <span>RETINA 2X / 4X / 8X</span>
        </div>
      </div>
    </div>

    <!-- Active Workspace: When Files Exist -->
    <div v-if="queue.length > 0" class="workspace-grid">
      <!-- Left Panel: Batch Queue & Item List -->
      <section class="queue-panel">
        <div class="panel-header">
          <div class="panel-title-group">
            <span class="panel-icon">📁</span>
            <h2>Queue ({{ queue.length }})</h2>
          </div>
          <div class="panel-header-buttons">
            <button
              class="btn-batch-action btn-convert-all"
              :disabled="isBatchConverting"
              @click="convertAll"
            >
              <span>⚡</span> Convert All
            </button>
            <button
              class="btn-batch-action btn-download-all"
              @click="downloadAll"
            >
              <span>⬇</span> Download All
            </button>
          </div>
        </div>

        <!-- Global Quick Settings Bar -->
        <div class="global-bar">
          <div class="global-field">
            <label>Batch Format:</label>
            <select v-model="globalTargetFormat" @change="applyGlobalFormat">
              <option v-for="fmt in formatOptions" :key="fmt.id" :value="fmt.id">
                {{ fmt.label }} ({{ fmt.ext }})
              </option>
            </select>
          </div>

          <div class="global-field">
            <label>Batch Scale:</label>
            <select v-model="globalScalePreset" @change="applyGlobalScale">
              <option v-for="sc in scalePresetOptions" :key="sc.id" :value="sc.id">
                {{ sc.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Queue Item List -->
        <div class="queue-list">
          <div
            v-for="item in queue"
            :key="item.id"
            class="queue-item"
            :class="{
              'is-selected': selectedItemId === item.id,
              'status-done': item.status === 'done',
              'status-converting': item.status === 'converting',
              'status-error': item.status === 'error'
            }"
            @click="selectedItemId = item.id"
          >
            <!-- Checkered Preview Thumbnail -->
            <div class="item-thumb-wrapper">
              <img :src="item.previewUrl" :alt="item.name" class="item-thumb" />
              <span v-if="item.isSvg" class="svg-badge">SVG</span>
            </div>

            <!-- Item Info -->
            <div class="item-details">
              <div class="item-name-row">
                <span class="item-name" :title="item.name">{{ item.name }}</span>
                <span class="item-size-tag">{{ formatFileSize(item.origSize) }}</span>
              </div>
              <div class="item-meta-row">
                <span class="item-dims">
                  {{ item.origWidth }} × {{ item.origHeight }} px
                </span>
                <span class="arrow-sep">➔</span>
                <span class="target-badge">
                  {{ item.targetFormat.toUpperCase() }}
                </span>
                <span v-if="item.convertedWidth" class="item-new-dims">
                  ({{ item.convertedWidth }} × {{ item.convertedHeight }})
                </span>
              </div>

              <!-- Status Feedback -->
              <div class="item-status-row">
                <span v-if="item.status === 'pending'" class="status-indicator pending">
                  <span class="dot"></span> Ready to Convert
                </span>
                <span v-else-if="item.status === 'converting'" class="status-indicator converting">
                  <span class="spinner-small"></span> Converting...
                </span>
                <span v-else-if="item.status === 'done'" class="status-indicator done">
                  <span class="dot"></span> {{ formatFileSize(item.convertedSize) }}
                  <span v-if="item.convertedSize && item.origSize" class="delta-badge">
                    {{ item.convertedSize < item.origSize ? `(-${Math.round((1 - item.convertedSize / item.origSize) * 100)}%)` : `(+${Math.round((item.convertedSize / item.origSize - 1) * 100)}%)` }}
                  </span>
                </span>
                <span v-else-if="item.status === 'error'" class="status-indicator error">
                  <span class="dot"></span> Error: {{ item.errorMsg }}
                </span>
              </div>
            </div>

            <!-- Item Action Buttons -->
            <div class="item-actions" @click.stop>
              <button
                class="btn-icon-action btn-download"
                :title="item.status === 'done' ? 'Download Converted Image' : 'Convert & Download'"
                @click="downloadItem(item)"
              >
                ⬇
              </button>
              <button
                class="btn-icon-action btn-remove"
                title="Remove from Queue"
                @click="removeItem(item.id)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Right Panel: Tuning, Resolution & Real-Time Preview -->
      <section v-if="selectedItem" class="inspector-panel">
        <div class="panel-header">
          <div class="panel-title-group">
            <span class="panel-icon">⚙️</span>
            <h2>Configure & Tune: {{ selectedItem.name }}</h2>
          </div>
          <div class="tabs-group">
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'queue' }"
              @click="activeTab = 'queue'"
            >
              Controls
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'preview' }"
              @click="activeTab = 'preview'"
            >
              Side-by-Side
            </button>
          </div>
        </div>

        <div class="inspector-body">
          <!-- SECTION 1: Target Format Selection -->
          <div class="config-block">
            <label class="block-label">1. Target Format</label>
            <div class="format-grid">
              <button
                v-for="fmt in formatOptions"
                :key="fmt.id"
                class="format-card"
                :class="{ active: selectedItem.targetFormat === fmt.id }"
                @click="selectedItem.targetFormat = fmt.id; updateItemConfig(selectedItem)"
              >
                <div class="format-card-top">
                  <span class="format-card-title">{{ fmt.label }}</span>
                  <span class="format-card-badge">{{ fmt.badge }}</span>
                </div>
                <span class="format-card-desc">{{ fmt.desc }}</span>
              </button>
            </div>
          </div>

          <!-- SECTION 2: Dimensions & Scaling Multipliers -->
          <div class="config-block">
            <div class="block-label-row">
              <label class="block-label">2. Scale & Resolution</label>
              <span v-if="selectedItem.isSvg" class="vector-tip-pill">
                ✨ Vector Source: Infinitely Scalable Without Quality Loss
              </span>
            </div>

            <!-- Scale Presets -->
            <div class="scale-chips-row">
              <button
                v-for="sc in scalePresetOptions"
                :key="sc.id"
                class="scale-chip"
                :class="{ active: selectedItem.scalePreset === sc.id }"
                @click="selectedItem.scalePreset = sc.id; updateItemConfig(selectedItem)"
              >
                {{ sc.label }}
              </button>
            </div>

            <!-- Custom Pixel Dimensions Box -->
            <div v-if="selectedItem.scalePreset === 'custom'" class="custom-dims-box">
              <div class="dim-input-group">
                <label>Width (px)</label>
                <input
                  v-model.number="selectedItem.customWidth"
                  type="number"
                  min="1"
                  max="16384"
                  @change="updateItemConfig(selectedItem)"
                />
              </div>

              <button
                class="btn-aspect-lock"
                :class="{ locked: selectedItem.lockAspectRatio }"
                title="Toggle Aspect Ratio Lock"
                @click="selectedItem.lockAspectRatio = !selectedItem.lockAspectRatio; updateItemConfig(selectedItem)"
              >
                {{ selectedItem.lockAspectRatio ? '🔒 Locked Aspect' : '🔓 Free Aspect' }}
              </button>

              <div class="dim-input-group">
                <label>Height (px)</label>
                <input
                  v-model.number="selectedItem.customHeight"
                  type="number"
                  min="1"
                  max="16384"
                  :disabled="selectedItem.lockAspectRatio"
                  @change="updateItemConfig(selectedItem)"
                />
              </div>
            </div>
          </div>

          <!-- SECTION 3: Background & Transparency -->
          <div class="config-block">
            <div class="block-label-row">
              <label class="block-label">3. Background Fill</label>
              <span v-if="selectedItem.targetFormat === 'jpeg'" class="alert-inline">
                ⚠️ JPG does not support alpha transparency (Solid background required)
              </span>
            </div>

            <div class="bg-picker-row">
              <button
                v-for="bg in bgPresets"
                :key="bg.id"
                class="bg-preset-btn"
                :class="{
                  active: selectedItem.bgColor === bg.value,
                  disabled: selectedItem.targetFormat === 'jpeg' && bg.value === 'transparent'
                }"
                :disabled="selectedItem.targetFormat === 'jpeg' && bg.value === 'transparent'"
                @click="selectedItem.bgColor = bg.value; updateItemConfig(selectedItem)"
              >
                <span
                  class="bg-preview-swatch"
                  :class="{ 'checkered-swatch': bg.preview === 'checkered' }"
                  :style="bg.preview !== 'checkered' ? { backgroundColor: bg.preview } : {}"
                ></span>
                {{ bg.label }}
              </button>

              <!-- Custom Color Picker -->
              <div class="custom-color-field">
                <input
                  v-model="selectedItem.bgColor"
                  type="color"
                  class="color-input"
                  @change="updateItemConfig(selectedItem)"
                />
                <input
                  v-model="selectedItem.bgColor"
                  type="text"
                  class="color-hex-text"
                  placeholder="#hex"
                  @change="updateItemConfig(selectedItem)"
                />
              </div>
            </div>
          </div>

          <!-- SECTION 4: Quality Compression (Lossy Formats) -->
          <div
            v-if="['jpeg', 'webp', 'avif'].includes(selectedItem.targetFormat)"
            class="config-block"
          >
            <div class="block-label-row">
              <label class="block-label">4. Quality & Compression</label>
              <span class="quality-val-badge">{{ selectedItem.quality }}%</span>
            </div>
            <div class="quality-slider-row">
              <span class="slider-hint">Compact File</span>
              <input
                v-model.number="selectedItem.quality"
                type="range"
                min="10"
                max="100"
                step="1"
                class="quality-slider"
                @input="updateItemConfig(selectedItem)"
              />
              <span class="slider-hint">Maximum Quality</span>
            </div>
          </div>

          <!-- SECTION 5: ICO Multi-Size Selection (For Favicons) -->
          <div v-if="selectedItem.targetFormat === 'ico'" class="config-block">
            <label class="block-label">5. Embedded ICO Favicon Resolutions</label>
            <p class="section-subtext">Select resolutions to pack into the Windows .ico file:</p>
            <div class="ico-checkbox-row">
              <label
                v-for="size in [16, 32, 48, 64, 128, 256]"
                :key="size"
                class="ico-checkbox-label"
              >
                <input
                  type="checkbox"
                  :checked="selectedItem.icoSizes.includes(size)"
                  @change="(e: any) => toggleIcoSize(selectedItem, size, e.target.checked)"
                />
                {{ size }} × {{ size }}
              </label>
            </div>
          </div>

          <!-- SECTION 6: Side-by-Side or Large Interactive Preview -->
          <div class="preview-stage-card">
            <div class="preview-stage-header">
              <div class="stage-tabs">
                <span class="stage-tag">OUTPUT PREVIEW ({{ selectedItem.targetFormat.toUpperCase() }})</span>
                <span v-if="selectedItem.convertedWidth" class="stage-dims">
                  {{ selectedItem.convertedWidth }} × {{ selectedItem.convertedHeight }} px • {{ formatFileSize(selectedItem.convertedSize) }}
                </span>
              </div>
              <div class="stage-quick-actions">
                <button
                  v-if="selectedItem.isSvg"
                  class="btn-stage-secondary"
                  @click="copySvgSource(selectedItem)"
                >
                  📋 Copy SVG Code
                </button>
                <button
                  class="btn-stage-primary"
                  :disabled="selectedItem.status === 'converting'"
                  @click="downloadItem(selectedItem)"
                >
                  <span v-if="selectedItem.status === 'converting'">⏳ Converting...</span>
                  <span v-else>⬇ Download {{ selectedItem.targetFormat.toUpperCase() }}</span>
                </button>
              </div>
            </div>

            <!-- Preview Canvas Display -->
            <div class="preview-canvas-container" :class="{ 'has-transparency': selectedItem.bgColor === 'transparent' }">
              <img
                v-if="selectedItem.convertedUrl"
                :src="selectedItem.convertedUrl"
                :alt="selectedItem.name"
                class="converted-preview-img"
              />
              <img
                v-else
                :src="selectedItem.previewUrl"
                :alt="selectedItem.name"
                class="converted-preview-img fallback"
              />
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Empty State Walkthrough -->
    <div v-else class="empty-guide-grid">
      <div class="guide-card">
        <div class="guide-card-icon">⚡</div>
        <h3>True Vector Scaling</h3>
        <p>
          Drop any SVG file and scale it up to <strong>2x, 4x, 8x or custom 4K resolution</strong>.
          Every bezier curve and gradient stays razor sharp.
        </p>
      </div>

      <div class="guide-card">
        <div class="guide-card-icon">🎯</div>
        <h3>Favicon & ICO Maker</h3>
        <p>
          Generate production-ready multi-size <code>.ico</code> files embedding 16×16, 32×32, 48×48,
          and 64×64 icons with full alpha transparency.
        </p>
      </div>

      <div class="guide-card">
        <div class="guide-card-icon">🛡️</div>
        <h3>Zero-Server Privacy</h3>
        <p>
          Conversions occur strictly on your machine via HTML5 Canvas and native binary DataView encoders.
          No images or logos ever touch the cloud.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-converter-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  color: #f1f5f9;
}

/* Header */
.converter-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1.25rem;
  padding: 1.5rem;
  background: rgba(13, 17, 39, 0.75);
  border: 1px solid rgba(255, 30, 66, 0.2);
  border-radius: 16px;
  backdrop-filter: blur(12px);
}

.header-left {
  max-width: 720px;
}

.badge-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #ff1e42;
  background: rgba(255, 30, 66, 0.12);
  border: 1px solid rgba(255, 30, 66, 0.3);
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  margin-bottom: 0.75rem;
}

.privacy-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff1e42;
  box-shadow: 0 0 8px #ff1e42;
}

.header-title {
  font-size: 1.85rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 0.4rem 0;
  background: linear-gradient(135deg, #ffffff 0%, #ff6b81 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header-desc {
  font-size: 0.9rem;
  color: #94a3b8;
  line-height: 1.5;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.btn-sample,
.btn-clear {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.1rem;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-sample {
  background: rgba(255, 30, 66, 0.15);
  border: 1px solid rgba(255, 30, 66, 0.4);
  color: #ff6b81;
}

.btn-sample:hover {
  background: rgba(255, 30, 66, 0.25);
  border-color: #ff1e42;
  box-shadow: 0 0 16px rgba(255, 30, 66, 0.3);
  color: #fff;
}

.btn-clear {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
}

.btn-clear:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

/* Dropzone */
.converter-dropzone {
  position: relative;
  border: 2px dashed rgba(255, 30, 66, 0.35);
  background: rgba(13, 17, 39, 0.5);
  border-radius: 16px;
  padding: 2.25rem 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.converter-dropzone:hover,
.converter-dropzone.is-dragging {
  border-color: #ff1e42;
  background: rgba(255, 30, 66, 0.08);
  box-shadow: 0 0 30px rgba(255, 30, 66, 0.25);
  transform: translateY(-2px);
}

.converter-dropzone.has-files {
  padding: 1.5rem 1rem;
}

.hidden-input {
  display: none;
}

.dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.dropzone-icon-ring {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: rgba(255, 30, 66, 0.12);
  border: 1px solid rgba(255, 30, 66, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dropzone-icon {
  font-size: 1.6rem;
}

.dropzone-text h3 {
  font-size: 1.15rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 0.3rem 0;
}

.dropzone-text p {
  font-size: 0.85rem;
  color: #94a3b8;
  margin: 0;
}

.dropzone-text code {
  background: rgba(255, 255, 255, 0.08);
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  color: #ff6b81;
}

.dropzone-formats-badge {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  justify-content: center;
  margin-top: 0.5rem;
}

.dropzone-formats-badge span {
  font-size: 0.68rem;
  font-family: monospace;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
}

/* Workspace Grid */
.workspace-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 1080px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}

/* Panels */
.queue-panel,
.inspector-panel {
  background: rgba(13, 17, 39, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  backdrop-filter: blur(16px);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: rgba(9, 13, 26, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel-title-group {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.panel-icon {
  font-size: 1.1rem;
}

.panel-title-group h2 {
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0;
  color: #ffffff;
}

.panel-header-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-batch-action {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.btn-convert-all {
  background: rgba(255, 30, 66, 0.2);
  border-color: rgba(255, 30, 66, 0.4);
  color: #ff6b81;
}

.btn-convert-all:hover:not(:disabled) {
  background: #ff1e42;
  color: #fff;
}

.btn-download-all {
  background: rgba(0, 240, 255, 0.15);
  border-color: rgba(0, 240, 255, 0.35);
  color: #00f0ff;
}

.btn-download-all:hover {
  background: #00f0ff;
  color: #050811;
}

/* Global Bar */
.global-bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  background: rgba(20, 26, 51, 0.4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.global-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.global-field label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.global-field select {
  background: rgba(9, 13, 26, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f1f5f9;
  font-size: 0.78rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
}

/* Queue List */
.queue-list {
  max-height: 520px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: all 0.2s ease;
}

.queue-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.queue-item.is-selected {
  background: rgba(255, 30, 66, 0.12);
  border-left: 3px solid #ff1e42;
}

/* Thumbnail Checkered */
.item-thumb-wrapper {
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background-color: #1e293b;
  background-image: linear-gradient(45deg, #0f172a 25%, transparent 25%),
    linear-gradient(-45deg, #0f172a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #0f172a 75%),
    linear-gradient(-45deg, transparent 75%, #0f172a 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-thumb {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.svg-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  background: #ff1e42;
  color: #fff;
  font-size: 0.55rem;
  font-weight: 800;
  padding: 0.1rem 0.25rem;
  border-radius: 3px;
  line-height: 1;
}

.item-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.item-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.item-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-size-tag {
  font-size: 0.7rem;
  color: #64748b;
  font-family: monospace;
}

.item-meta-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: #94a3b8;
}

.arrow-sep {
  color: #ff1e42;
  font-weight: 700;
}

.target-badge {
  color: #00f0ff;
  font-weight: 700;
  font-family: monospace;
}

.item-new-dims {
  font-size: 0.68rem;
  color: #64748b;
}

.item-status-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.status-indicator.pending {
  color: #f59e0b;
}

.status-indicator.converting {
  color: #00f0ff;
}

.status-indicator.done {
  color: #10b981;
  font-weight: 600;
}

.status-indicator.error {
  color: #ef4444;
}

.status-indicator .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.delta-badge {
  font-size: 0.65rem;
  color: #38bdf8;
  margin-left: 0.25rem;
}

.spinner-small {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(0, 240, 255, 0.2);
  border-top-color: #00f0ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.item-actions {
  display: flex;
  gap: 0.35rem;
}

.btn-icon-action {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-icon-action.btn-download:hover {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}

.btn-icon-action.btn-remove:hover {
  background: #ef4444;
  border-color: #ef4444;
  color: #fff;
}

/* Inspector Panel */
.tabs-group {
  display: flex;
  gap: 0.4rem;
}

.tab-btn {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.3rem 0.7rem;
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: rgba(255, 30, 66, 0.15);
  border-color: rgba(255, 30, 66, 0.4);
  color: #ff6b81;
}

.inspector-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.config-block {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.block-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.block-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.vector-tip-pill {
  font-size: 0.7rem;
  font-weight: 600;
  color: #00f0ff;
  background: rgba(0, 240, 255, 0.1);
  border: 1px solid rgba(0, 240, 255, 0.25);
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
}

.alert-inline {
  font-size: 0.72rem;
  color: #f59e0b;
}

/* Format Cards Grid */
.format-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.65rem;
}

.format-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  background: rgba(18, 24, 48, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.format-card:hover {
  border-color: rgba(255, 30, 66, 0.4);
  background: rgba(255, 30, 66, 0.05);
}

.format-card.active {
  background: rgba(255, 30, 66, 0.15);
  border-color: #ff1e42;
  box-shadow: 0 0 15px rgba(255, 30, 66, 0.25);
}

.format-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.format-card-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #ffffff;
}

.format-card-badge {
  font-size: 0.6rem;
  font-family: monospace;
  font-weight: 700;
  color: #ff6b81;
  background: rgba(255, 30, 66, 0.15);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}

.format-card-desc {
  font-size: 0.7rem;
  color: #94a3b8;
  line-height: 1.3;
}

/* Scale Chips */
.scale-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.scale-chip {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  background: rgba(20, 26, 51, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.2s ease;
}

.scale-chip:hover {
  background: rgba(255, 255, 255, 0.08);
}

.scale-chip.active {
  background: #ff1e42;
  border-color: #ff1e42;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(255, 30, 66, 0.35);
}

/* Custom Dimensions Box */
.custom-dims-box {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem;
  background: rgba(9, 13, 26, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}

.dim-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dim-input-group label {
  font-size: 0.7rem;
  color: #94a3b8;
}

.dim-input-group input {
  width: 120px;
  background: rgba(20, 26, 51, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ffffff;
  font-size: 0.85rem;
  font-family: monospace;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
}

.btn-aspect-lock {
  padding: 0.45rem 0.85rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
  cursor: pointer;
  margin-top: 1.1rem;
}

.btn-aspect-lock.locked {
  background: rgba(0, 240, 255, 0.15);
  border-color: rgba(0, 240, 255, 0.4);
  color: #00f0ff;
}

/* Background Picker */
.bg-picker-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.bg-preset-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  background: rgba(20, 26, 51, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bg-preset-btn.active {
  border-color: #ff1e42;
  background: rgba(255, 30, 66, 0.15);
  color: #ffffff;
}

.bg-preset-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.bg-preview-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.checkered-swatch {
  background-color: #334155;
  background-image: linear-gradient(45deg, #0f172a 25%, transparent 25%),
    linear-gradient(-45deg, #0f172a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #0f172a 75%),
    linear-gradient(-45deg, transparent 75%, #0f172a 75%);
  background-size: 6px 6px;
  background-position: 0 0, 0 3px, 3px -3px, -3px 0px;
}

.custom-color-field {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.color-input {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.color-hex-text {
  width: 90px;
  background: rgba(20, 26, 51, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ffffff;
  font-family: monospace;
  font-size: 0.78rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
}

/* Quality Slider */
.quality-val-badge {
  font-size: 0.8rem;
  font-weight: 700;
  font-family: monospace;
  color: #00f0ff;
}

.quality-slider-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.slider-hint {
  font-size: 0.72rem;
  color: #64748b;
}

.quality-slider {
  flex: 1;
  accent-color: #ff1e42;
  cursor: pointer;
}

/* ICO Checkboxes */
.section-subtext {
  font-size: 0.75rem;
  color: #94a3b8;
  margin: 0;
}

.ico-checkbox-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
}

.ico-checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-family: monospace;
  color: #cbd5e1;
  cursor: pointer;
}

.ico-checkbox-label input {
  accent-color: #ff1e42;
}

/* Preview Stage Card */
.preview-stage-card {
  display: flex;
  flex-direction: column;
  background: rgba(9, 13, 26, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  overflow: hidden;
}

.preview-stage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.stage-tag {
  font-size: 0.75rem;
  font-weight: 800;
  color: #ff1e42;
  letter-spacing: 0.06em;
}

.stage-dims {
  font-size: 0.72rem;
  color: #94a3b8;
  font-family: monospace;
  margin-left: 0.5rem;
}

.stage-quick-actions {
  display: flex;
  gap: 0.6rem;
}

.btn-stage-secondary,
.btn-stage-primary {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-stage-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
}

.btn-stage-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.btn-stage-primary {
  background: linear-gradient(135deg, #ff1e42 0%, #e11d48 100%);
  border: 1px solid #ff1e42;
  color: #ffffff;
  box-shadow: 0 0 15px rgba(255, 30, 66, 0.3);
}

.btn-stage-primary:hover:not(:disabled) {
  box-shadow: 0 0 25px rgba(255, 30, 66, 0.5);
  transform: translateY(-1px);
}

.btn-stage-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Canvas Display */
.preview-canvas-container {
  min-height: 280px;
  max-height: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  overflow: auto;
  background-color: #0d1124;
}

.preview-canvas-container.has-transparency {
  background-color: #1e293b;
  background-image: linear-gradient(45deg, #0f172a 25%, transparent 25%),
    linear-gradient(-45deg, #0f172a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #0f172a 75%),
    linear-gradient(-45deg, transparent 75%, #0f172a 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
}

.converted-preview-img {
  max-width: 100%;
  max-height: 380px;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
}

/* Empty State Guides */
.empty-guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
  margin-top: 0.5rem;
}

.guide-card {
  background: rgba(13, 17, 39, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 1.5rem;
  backdrop-filter: blur(12px);
  transition: all 0.2s ease;
}

.guide-card:hover {
  border-color: rgba(255, 30, 66, 0.3);
  transform: translateY(-2px);
}

.guide-card-icon {
  font-size: 1.8rem;
  margin-bottom: 0.75rem;
}

.guide-card h3 {
  font-size: 1.05rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 0.5rem 0;
}

.guide-card p {
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.5;
  margin: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
