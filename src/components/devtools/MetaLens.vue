<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ExifReader from 'exifreader'
import { useToast } from '@/composables/useToast'

const { showToast, copyToClipboard } = useToast()

interface ParsedTag {
  id: string
  name: string
  category: string
  value: string
  raw?: unknown
}

interface CameraInfo {
  make?: string
  model?: string
  lens?: string
  focalLength?: string
  focalLength35mm?: string
  fNumber?: string
  exposureTime?: string
  iso?: string
  exposureProgram?: string
  meteringMode?: string
  flash?: string
  whiteBalance?: string
  dateTaken?: string
  modifyDate?: string
}

interface GpsInfo {
  latitude?: number
  longitude?: number
  latitudeRef?: string
  longitudeRef?: string
  altitude?: string
  timestamp?: string
  hasGps: boolean
}

interface TechnicalInfo {
  width?: number
  height?: number
  megapixels?: string
  aspectRatio?: string
  colorSpace?: string
  bitsPerSample?: string
  orientation?: string
  resolutionDpi?: string
  compression?: string
}

interface SoftwareAiInfo {
  software?: string
  artist?: string
  copyright?: string
  aiPrompt?: string
  aiNegativePrompt?: string
  aiModel?: string
  aiSeed?: string
  aiSampler?: string
  aiSteps?: string
  aiCfg?: string
  hasAiData: boolean
}

// Active State
const isLoading = ref(false)
const isDragging = ref(false)
const selectedImage = ref<{
  name: string
  size: number
  type: string
  dataUrl: string
} | null>(null)

// Parsed Data
const cameraInfo = ref<CameraInfo>({})
const gpsInfo = ref<GpsInfo>({ hasGps: false })
const technicalInfo = ref<TechnicalInfo>({})
const softwareAiInfo = ref<SoftwareAiInfo>({ hasAiData: false })
const rawTags = ref<ParsedTag[]>([])

// View Tab
type TabId = 'camera' | 'gps' | 'technical' | 'software' | 'raw'
const activeTab = ref<TabId>('camera')

// Raw Tags Explorer Search & Filter
const searchQuery = ref('')
const selectedCategoryFilter = ref('ALL')

const fileInputRef = ref<HTMLInputElement | null>(null)

// Format File Size
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// Compute Aspect Ratio
const computeAspectRatio = (w: number, h: number): string => {
  if (!w || !h) return ''
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const divisor = gcd(w, h)
  const rw = w / divisor
  const rh = h / divisor
  if (rw <= 21 && rh <= 21) {
    return `${rw}:${rh}`
  }
  return `${(w / h).toFixed(2)}:1`
}

// Clean and Parse EXIF Tags
const parseExifData = async (buffer: ArrayBuffer, fileName: string, fileType: string, fileSize: number, dataUrl: string) => {
  try {
    isLoading.value = true

    // Load with ExifReader (flat map of tags)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tags: any = await ExifReader.load(buffer, { expanded: true })

    selectedImage.value = {
      name: fileName,
      size: fileSize,
      type: fileType,
      dataUrl
    }

    // Extract flat tags for Raw Explorer
    const parsedList: ParsedTag[] = []
    const rawCategories = ['exif', 'iptc', 'xmp', 'icc', 'pngFileChunk', 'file', 'jfif', 'riff']

    for (const cat of rawCategories) {
      if (tags[cat] && typeof tags[cat] === 'object') {
        for (const [key, val] of Object.entries(tags[cat])) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tagObj = val as any
          const desc = tagObj?.description ?? tagObj?.value ?? String(val)
          parsedList.push({
            id: `${cat}-${key}`,
            name: key,
            category: cat.toUpperCase(),
            value: String(desc),
            raw: tagObj
          })
        }
      }
    }

    // If no expanded category, check flat
    if (parsedList.length === 0) {
      for (const [key, val] of Object.entries(tags)) {
        if (key !== 'Thumbnail' && typeof val === 'object' && val !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tagObj = val as any
          parsedList.push({
            id: `tag-${key}`,
            name: key,
            category: 'EXIF',
            value: String(tagObj.description ?? tagObj.value ?? ''),
            raw: tagObj
          })
        }
      }
    }

    rawTags.value = parsedList

    // 1. Camera & Shot Extraction
    const getTag = (name: string): string | undefined => {
      // Check exif
      if (tags.exif?.[name]?.description) return String(tags.exif[name].description)
      if (tags.exif?.[name]?.value) return String(tags.exif[name].value)
      // Check flat
      if (tags[name]?.description) return String(tags[name].description)
      if (tags[name]?.value) return String(tags[name].value)
      return undefined
    }

    cameraInfo.value = {
      make: getTag('Make'),
      model: getTag('Model'),
      lens: getTag('LensModel') || getTag('Lens') || getTag('LensMake'),
      focalLength: getTag('FocalLength'),
      focalLength35mm: getTag('FocalLengthIn35mmFilm'),
      fNumber: getTag('FNumber'),
      exposureTime: getTag('ExposureTime'),
      iso: getTag('ISOSpeedRatings') || getTag('PhotographicSensitivity') || getTag('ISO'),
      exposureProgram: getTag('ExposureProgram'),
      meteringMode: getTag('MeteringMode'),
      flash: getTag('Flash'),
      whiteBalance: getTag('WhiteBalance'),
      dateTaken: getTag('DateTimeOriginal') || getTag('CreateDate') || getTag('DateTime'),
      modifyDate: getTag('ModifyDate')
    }

    // 2. GPS Extraction
    if (tags.gps && (tags.gps.Latitude !== undefined || tags.gps.Longitude !== undefined)) {
      const lat = Number(tags.gps.Latitude)
      const lon = Number(tags.gps.Longitude)
      const altDesc = tags.gps.Altitude ? `${tags.gps.Altitude.toFixed?.(1) ?? tags.gps.Altitude} m` : undefined

      gpsInfo.value = {
        latitude: isNaN(lat) ? undefined : lat,
        longitude: isNaN(lon) ? undefined : lon,
        latitudeRef: tags.gps.LatitudeRef?.value?.[0] || (lat >= 0 ? 'N' : 'S'),
        longitudeRef: tags.gps.LongitudeRef?.value?.[0] || (lon >= 0 ? 'E' : 'W'),
        altitude: altDesc,
        timestamp: tags.gps.DateStamp?.value ? `${tags.gps.DateStamp.value} ${tags.gps.TimeStamp?.value || ''}` : undefined,
        hasGps: !isNaN(lat) && !isNaN(lon)
      }
    } else {
      gpsInfo.value = { hasGps: false }
    }

    // 3. Technical Specs Extraction
    let width = Number(getTag('PixelXDimension') || getTag('Image Width') || tags.file?.['Image Width']?.value || 0)
    let height = Number(getTag('PixelYDimension') || getTag('Image Height') || tags.file?.['Image Height']?.value || 0)

    // Fallback: load image dimensions in background
    if (!width || !height) {
      const img = new Image()
      img.src = dataUrl
      await new Promise((resolve) => {
        img.onload = () => {
          width = img.naturalWidth
          height = img.naturalHeight
          resolve(true)
        }
        img.onerror = () => resolve(false)
      })
    }

    const mp = width && height ? ((width * height) / 1000000).toFixed(1) + ' MP' : undefined
    const aspect = width && height ? computeAspectRatio(width, height) : undefined

    technicalInfo.value = {
      width,
      height,
      megapixels: mp,
      aspectRatio: aspect,
      colorSpace: getTag('ColorSpace') || tags.icc?.['Color Space']?.description || 'sRGB',
      bitsPerSample: getTag('BitsPerSample') || tags.file?.['Bits Per Sample']?.description,
      orientation: getTag('Orientation'),
      resolutionDpi: getTag('XResolution') ? `${getTag('XResolution')} DPI` : undefined,
      compression: getTag('Compression')
    }

    // 4. Software & AI Prompt Extraction
    const software = getTag('Software') || getTag('ProcessingSoftware')
    const artist = getTag('Artist')
    const copyright = getTag('Copyright')

    // AI Prompts in PNG chunks or UserComment
    let aiPrompt = ''
    let aiNeg = ''
    let aiModel = ''
    let aiSeed = ''
    let aiSampler = ''
    let aiSteps = ''
    let aiCfg = ''

    // Check PNG Chunks (Automatic1111 / ComfyUI / NovelAI)
    if (tags.pngFileChunk) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chunks = tags.pngFileChunk as Record<string, any>
      const params = chunks['parameters']?.description || chunks['prompt']?.description || chunks['workflow']?.description || ''

      if (params) {
        aiPrompt = params
        // Extract typical Automatic1111 fields
        const negMatch = params.match(/Negative prompt:\s*([^]+?)(?=Steps:|$)/i)
        if (negMatch?.[1]) aiNeg = negMatch[1].trim()

        const stepsMatch = params.match(/Steps:\s*(\d+)/i)
        if (stepsMatch?.[1]) aiSteps = stepsMatch[1]

        const samplerMatch = params.match(/Sampler:\s*([^,]+)/i)
        if (samplerMatch?.[1]) aiSampler = samplerMatch[1].trim()

        const cfgMatch = params.match(/CFG scale:\s*([\d.]+)/i)
        if (cfgMatch?.[1]) aiCfg = cfgMatch[1]

        const seedMatch = params.match(/Seed:\s*(\d+)/i)
        if (seedMatch?.[1]) aiSeed = seedMatch[1]

        const modelMatch = params.match(/Model:\s*([^,]+)/i)
        if (modelMatch?.[1]) aiModel = modelMatch[1].trim()
      }
    }

    // Also check EXIF UserComment
    const userComment = getTag('UserComment')
    if (userComment && (userComment.includes('Steps:') || userComment.includes('Seed:'))) {
      if (!aiPrompt) aiPrompt = userComment
    }

    softwareAiInfo.value = {
      software,
      artist,
      copyright,
      aiPrompt: aiPrompt ? aiPrompt.slice(0, 1500) : undefined,
      aiNegativePrompt: aiNeg,
      aiModel,
      aiSeed,
      aiSampler,
      aiSteps,
      aiCfg,
      hasAiData: Boolean(aiPrompt)
    }

    showToast(`Metadata loaded: ${parsedList.length} tags detected`, 'success')
  } catch (err) {
    console.error('Error parsing EXIF', err)
    showToast('Failed to parse metadata from image', 'error')
  } finally {
    isLoading.value = false
  }
}

// File Handler
const handleFile = async (file: File) => {
  if (!file.type.startsWith('image/') && !file.name.match(/\.(jpe?g|png|webp|tiff?|heic|avif|gif)$/i)) {
    showToast('Please upload a valid image file', 'error')
    return
  }

  const reader = new FileReader()
  reader.onload = async (e) => {
    const buffer = e.target?.result as ArrayBuffer
    if (buffer) {
      // Create Object URL for preview
      const blob = new Blob([buffer], { type: file.type })
      const dataUrl = URL.createObjectURL(blob)
      await parseExifData(buffer, file.name, file.type, file.size, dataUrl)
    }
  }
  reader.readAsArrayBuffer(file)
}

// Dropzone Events
const onDrop = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files?.[0]) {
    handleFile(e.dataTransfer.files[0])
  }
}

const onFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files?.[0]) {
    handleFile(target.files[0])
  }
}

// Paste Event Handler (Ctrl+V)
const onPaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        handleFile(file)
        break
      }
    }
  }
}

// Load Pre-Crafted Sample Photo
const loadSampleImage = async () => {
  isLoading.value = true

  // Create a realistic sample photo data canvas
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 800
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // Beautiful gradient
    const grad = ctx.createLinearGradient(0, 0, 1200, 800)
    grad.addColorStop(0, '#0f172a')
    grad.addColorStop(0.5, '#1e1b4b')
    grad.addColorStop(1, '#ff1e42')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 1200, 800)

    // Sun / Moon circle
    ctx.fillStyle = '#ffedd5'
    ctx.beginPath()
    ctx.arc(600, 360, 120, 0, Math.PI * 2)
    ctx.fill()

    // Mountain peak silhouette
    ctx.fillStyle = '#090d16'
    ctx.beginPath()
    ctx.moveTo(100, 800)
    ctx.lineTo(600, 320)
    ctx.lineTo(1100, 800)
    ctx.closePath()
    ctx.fill()

    // Title stamp
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = 'bold 36px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('MOUNT FUJI // SUNRISE SAMPLE', 600, 680)
    ctx.font = '20px monospace'
    ctx.fillStyle = 'rgba(255, 30, 66, 0.9)'
    ctx.fillText('Sony Alpha 7 IV • 24-70mm F2.8 GM II • GPS Embedded', 600, 720)
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

  // Populate realistic sample state
  selectedImage.value = {
    name: 'DSC08942_Fuji_Sunrise_Sample.jpg',
    size: 4892014,
    type: 'image/jpeg',
    dataUrl
  }

  cameraInfo.value = {
    make: 'Sony',
    model: 'ILCE-7M4 (Alpha 7 IV)',
    lens: 'FE 24-70mm F2.8 GM II',
    focalLength: '35.0 mm',
    focalLength35mm: '35 mm',
    fNumber: 'f/2.8',
    exposureTime: '1/640 s',
    iso: '100',
    exposureProgram: 'Aperture Priority (A)',
    meteringMode: 'Multi-segment Pattern',
    flash: 'Off, Did not fire',
    whiteBalance: 'Daylight (5500K)',
    dateTaken: '2024:09:18 05:48:22',
    modifyDate: '2024:09:18 06:12:05'
  }

  gpsInfo.value = {
    latitude: 35.3606,
    longitude: 138.7274,
    latitudeRef: 'N',
    longitudeRef: 'E',
    altitude: '3,776 m',
    timestamp: '2024:09:18 05:48:22 UTC',
    hasGps: true
  }

  technicalInfo.value = {
    width: 7008,
    height: 4672,
    megapixels: '32.7 MP',
    aspectRatio: '3:2',
    colorSpace: 'Display P3',
    bitsPerSample: '8, 8, 8 (24-bit RGB)',
    orientation: 'Horizontal (normal)',
    resolutionDpi: '300 DPI',
    compression: 'JPEG'
  }

  softwareAiInfo.value = {
    software: 'Adobe Photoshop Lightroom Classic 13.2',
    artist: 'TexTools Photography Lab',
    copyright: '© 2026 TexTools Creative Studio',
    hasAiData: false
  }

  rawTags.value = [
    { id: '1', name: 'Make', category: 'EXIF', value: 'Sony' },
    { id: '2', name: 'Model', category: 'EXIF', value: 'ILCE-7M4' },
    { id: '3', name: 'LensModel', category: 'EXIF', value: 'FE 24-70mm F2.8 GM II' },
    { id: '4', name: 'FNumber', category: 'EXIF', value: '2.8' },
    { id: '5', name: 'ExposureTime', category: 'EXIF', value: '0.0015625 (1/640 s)' },
    { id: '6', name: 'ISOSpeedRatings', category: 'EXIF', value: '100' },
    { id: '7', name: 'FocalLength', category: 'EXIF', value: '35 mm' },
    { id: '8', name: 'FocalLengthIn35mmFilm', category: 'EXIF', value: '35' },
    { id: '9', name: 'DateTimeOriginal', category: 'EXIF', value: '2024:09:18 05:48:22' },
    { id: '10', name: 'GPSLatitude', category: 'GPS', value: '35.3606° N' },
    { id: '11', name: 'GPSLongitude', category: 'GPS', value: '138.7274° E' },
    { id: '12', name: 'GPSAltitude', category: 'GPS', value: '3776 m' },
    { id: '13', name: 'ColorSpace', category: 'EXIF', value: 'Display P3' },
    { id: '14', name: 'PixelXDimension', category: 'EXIF', value: '7008' },
    { id: '15', name: 'PixelYDimension', category: 'EXIF', value: '4672' },
    { id: '16', name: 'Software', category: 'EXIF', value: 'Lightroom Classic 13.2' },
    { id: '17', name: 'Artist', category: 'IPTC', value: 'TexTools Photography Lab' },
    { id: '18', name: 'Copyright', category: 'IPTC', value: '© 2026 TexTools Creative Studio' }
  ]

  isLoading.value = false
  showToast('Sample photo with full EXIF & GPS loaded!', 'success')
}

// Privacy Sanitizer: Strip Metadata & Download
const stripMetadataAndDownload = () => {
  if (!selectedImage.value) return

  const img = new Image()
  img.src = selectedImage.value.dataUrl
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(img, 0, 0)

    const cleanMime = selectedImage.value?.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const ext = cleanMime === 'image/png' ? '.png' : '.jpg'
    const cleanFileName = `clean_${selectedImage.value?.name.replace(/\.[^/.]+$/, '') || 'image'}${ext}`

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = cleanFileName
      a.click()
      URL.revokeObjectURL(url)

      showToast(`Clean image downloaded: ${cleanFileName}`, 'success')
    }, cleanMime, 0.95)
  }
}

// Copy JSON Export of All Metadata
const exportAllJson = () => {
  const exportPayload = {
    file: {
      name: selectedImage.value?.name,
      sizeBytes: selectedImage.value?.size,
      mimeType: selectedImage.value?.type
    },
    camera: cameraInfo.value,
    gps: gpsInfo.value,
    technical: technicalInfo.value,
    softwareAndAi: softwareAiInfo.value,
    rawTags: rawTags.value.reduce((acc, tag) => {
      acc[tag.name] = tag.value
      return acc
    }, {} as Record<string, string>)
  }

  copyToClipboard(JSON.stringify(exportPayload, null, 2), 'All metadata copied as JSON!')
}

// Clear State
const clearImage = () => {
  selectedImage.value = null
  cameraInfo.value = {}
  gpsInfo.value = { hasGps: false }
  technicalInfo.value = {}
  softwareAiInfo.value = { hasAiData: false }
  rawTags.value = []
  if (fileInputRef.value) fileInputRef.value.value = ''
  showToast('Image cleared', 'info')
}

// Categories for Raw Filter
const availableCategories = computed(() => {
  const cats = new Set<string>()
  rawTags.value.forEach(t => cats.add(t.category))
  return ['ALL', ...Array.from(cats).sort()]
})

// Filtered Raw Tags
const filteredRawTags = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const cat = selectedCategoryFilter.value

  return rawTags.value.filter(tag => {
    const matchesCat = cat === 'ALL' || tag.category === cat
    const matchesQuery = !query || tag.name.toLowerCase().includes(query) || tag.value.toLowerCase().includes(query)
    return matchesCat && matchesQuery
  })
})

onMounted(() => {
  window.addEventListener('paste', onPaste)
})

onUnmounted(() => {
  window.removeEventListener('paste', onPaste)
})
</script>

<template>
  <div class="metalens-container">
    <!-- Header Console -->
    <header class="metalens-header">
      <div class="header-left">
        <div class="badge-tag">
          <span class="privacy-dot"></span>
          100% PRIVATE • CLIENT-SIDE
        </div>
        <h2 class="metalens-title">📸 MetaLens Studio</h2>
        <span class="metalens-desc">Image EXIF, GPS & Technical Metadata Inspector</span>
      </div>

      <div class="header-actions">
        <button class="btn-sample" @click="loadSampleImage">
          <span>🖼️</span> Load Sample Photo
        </button>
        <button v-if="selectedImage" class="btn-clear" @click="clearImage">
          <span>🗑️</span> Clear
        </button>
      </div>
    </header>

    <!-- Upload / Dropzone (When No Image is Loaded) -->
    <div 
      v-if="!selectedImage" 
      class="dropzone-area"
      :class="{ dragging: isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="fileInputRef?.click()"
    >
      <input 
        ref="fileInputRef" 
        type="file" 
        accept="image/jpeg,image/png,image/webp,image/tiff,image/heic,image/avif,image/gif" 
        class="hidden-input" 
        @change="onFileSelect"
      />
      <div class="dropzone-icon">📷</div>
      <h3 class="dropzone-title">Drop your image here, or click to browse</h3>
      <p class="dropzone-subtitle">
        Supports JPEG, PNG, WebP, TIFF, HEIC, AVIF & GIF • No data leaves your browser.
      </p>

      <div class="dropzone-actions" @click.stop>
        <button class="btn-upload" @click="fileInputRef?.click()">
          <span>📁</span> Browse Local Image
        </button>
        <button class="btn-sample-secondary" @click="loadSampleImage">
          <span>✨</span> Try Sample EXIF Photo
        </button>
      </div>

      <div class="dropzone-tip">
        <span>Tip: You can also paste an image directly using</span>
        <code>Ctrl + V</code>
      </div>
    </div>

    <!-- Active Image Workspace (When Image is Loaded) -->
    <div v-else class="metalens-workspace">
      <!-- Top Quick Banner -->
      <section class="image-banner">
        <div class="banner-preview">
          <img :src="selectedImage.dataUrl" :alt="selectedImage.name" class="thumb-img" />
        </div>

        <div class="banner-meta">
          <div class="banner-top-row">
            <h3 class="file-name" :title="selectedImage.name">{{ selectedImage.name }}</h3>
            <span class="mime-badge">{{ selectedImage.type.replace('image/', '').toUpperCase() }}</span>
          </div>

          <div class="specs-pills">
            <div class="spec-pill">
              <span class="pill-label">SIZE</span>
              <span class="pill-val">{{ formatFileSize(selectedImage.size) }}</span>
            </div>
            <div v-if="technicalInfo.width && technicalInfo.height" class="spec-pill">
              <span class="pill-label">RESOLUTION</span>
              <span class="pill-val">{{ technicalInfo.width }} × {{ technicalInfo.height }}</span>
            </div>
            <div v-if="technicalInfo.megapixels" class="spec-pill">
              <span class="pill-label">MEGAPIXELS</span>
              <span class="pill-val">{{ technicalInfo.megapixels }}</span>
            </div>
            <div v-if="technicalInfo.aspectRatio" class="spec-pill">
              <span class="pill-label">RATIO</span>
              <span class="pill-val">{{ technicalInfo.aspectRatio }}</span>
            </div>
          </div>
        </div>

        <div class="banner-actions">
          <button class="btn-action primary" @click="stripMetadataAndDownload" title="Strip all EXIF/GPS tags and download clean image">
            <span>🧹</span> Strip EXIF & Download
          </button>
          <button class="btn-action" @click="exportAllJson" title="Copy all metadata tags as JSON">
            <span>📋</span> Copy JSON
          </button>
          <button class="btn-action secondary" @click="fileInputRef?.click()">
            <span>🔄</span> Replace
          </button>
        </div>
      </section>

      <!-- Navigation Tabs -->
      <nav class="metalens-tabs">
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'camera' }"
          @click="activeTab = 'camera'"
        >
          <span>📷</span> Camera & Shot
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'gps' }"
          @click="activeTab = 'gps'"
        >
          <span>📍</span> GPS Location
          <span v-if="gpsInfo.hasGps" class="tab-chip green">DETECTED</span>
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'technical' }"
          @click="activeTab = 'technical'"
        >
          <span>📐</span> Image Specs
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'software' }"
          @click="activeTab = 'software'"
        >
          <span>🤖</span> Software & AI
          <span v-if="softwareAiInfo.hasAiData" class="tab-chip cyan">AI CHUNKS</span>
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'raw' }"
          @click="activeTab = 'raw'"
        >
          <span>📜</span> Raw Tags ({{ rawTags.length }})
        </button>
      </nav>

      <!-- Tab Content Area -->
      <main class="tab-viewport">
        <!-- 1. Camera & Shot Tab -->
        <div v-if="activeTab === 'camera'" class="tab-pane">
          <div class="cards-grid">
            <!-- Camera Device Card -->
            <div class="info-card">
              <div class="card-header">
                <span class="card-icon">📸</span>
                <span class="card-title">Device & Camera</span>
              </div>
              <div class="kv-list">
                <div class="kv-row">
                  <span class="kv-key">Make</span>
                  <span class="kv-val">{{ cameraInfo.make || 'Not specified' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Model</span>
                  <span class="kv-val highlight">{{ cameraInfo.model || 'Unknown' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Lens Model</span>
                  <span class="kv-val">{{ cameraInfo.lens || 'Built-in / Not reported' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Date & Time Taken</span>
                  <span class="kv-val code">{{ cameraInfo.dateTaken || 'No timestamp' }}</span>
                </div>
              </div>
            </div>

            <!-- Exposure Parameters Card -->
            <div class="info-card">
              <div class="card-header">
                <span class="card-icon">⚡</span>
                <span class="card-title">Exposure & Optics</span>
              </div>
              <div class="kv-list">
                <div class="kv-row">
                  <span class="kv-key">Aperture (F-Number)</span>
                  <span class="kv-val badge-f">{{ cameraInfo.fNumber || 'N/A' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Shutter Speed</span>
                  <span class="kv-val badge-shutter">{{ cameraInfo.exposureTime || 'N/A' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">ISO Sensitivity</span>
                  <span class="kv-val badge-iso">{{ cameraInfo.iso ? `ISO ${cameraInfo.iso}` : 'N/A' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Focal Length</span>
                  <span class="kv-val">
                    {{ cameraInfo.focalLength || 'N/A' }}
                    <span v-if="cameraInfo.focalLength35mm" class="sub-val">({{ cameraInfo.focalLength35mm }} eq.)</span>
                  </span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Exposure Program</span>
                  <span class="kv-val">{{ cameraInfo.exposureProgram || 'Normal' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Metering Mode</span>
                  <span class="kv-val">{{ cameraInfo.meteringMode || 'Average' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Flash Status</span>
                  <span class="kv-val">{{ cameraInfo.flash || 'Not fired' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">White Balance</span>
                  <span class="kv-val">{{ cameraInfo.whiteBalance || 'Auto' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. GPS Location Tab -->
        <div v-if="activeTab === 'gps'" class="tab-pane">
          <div v-if="gpsInfo.hasGps" class="gps-card">
            <div class="gps-header">
              <div class="gps-status">
                <span class="ping-circle"></span>
                <span>Geolocation Coordinates Embedded</span>
              </div>
              <div class="gps-coords-badge">
                {{ gpsInfo.latitude?.toFixed(5) }}° {{ gpsInfo.latitudeRef }}, {{ gpsInfo.longitude?.toFixed(5) }}° {{ gpsInfo.longitudeRef }}
              </div>
            </div>

            <div class="gps-details-grid">
              <div class="gps-item">
                <span class="gps-label">LATITUDE</span>
                <span class="gps-val">{{ gpsInfo.latitude }} ({{ gpsInfo.latitudeRef }})</span>
              </div>
              <div class="gps-item">
                <span class="gps-label">LONGITUDE</span>
                <span class="gps-val">{{ gpsInfo.longitude }} ({{ gpsInfo.longitudeRef }})</span>
              </div>
              <div class="gps-item">
                <span class="gps-label">ALTITUDE</span>
                <span class="gps-val">{{ gpsInfo.altitude || 'Not reported' }}</span>
              </div>
              <div class="gps-item">
                <span class="gps-label">GPS TIME (UTC)</span>
                <span class="gps-val">{{ gpsInfo.timestamp || 'N/A' }}</span>
              </div>
            </div>

            <!-- Map Action Buttons -->
            <div class="gps-actions-bar">
              <a 
                :href="`https://www.google.com/maps?q=${gpsInfo.latitude},${gpsInfo.longitude}`" 
                target="_blank" 
                rel="noopener noreferrer" 
                class="map-btn google"
              >
                <span>🗺️</span> Open in Google Maps ↗
              </a>
              <a 
                :href="`https://www.openstreetmap.org/?mlat=${gpsInfo.latitude}&mlon=${gpsInfo.longitude}#map=16/${gpsInfo.latitude}/${gpsInfo.longitude}`" 
                target="_blank" 
                rel="noopener noreferrer" 
                class="map-btn osm"
              >
                <span>🌍</span> Open in OpenStreetMap ↗
              </a>
              <button 
                class="map-btn copy"
                @click="copyToClipboard(`${gpsInfo.latitude}, ${gpsInfo.longitude}`, 'Coordinates copied!')"
              >
                <span>📋</span> Copy Coordinates
              </button>
            </div>
          </div>

          <div v-else class="empty-state-box">
            <span class="empty-icon">🛡️</span>
            <h3>No GPS Coordinates Embedded</h3>
            <p>
              This image does not contain location metadata. This is normal for photos taken with location permissions disabled, or images downloaded from social media (Twitter/X, WhatsApp, Instagram strip GPS by default).
            </p>
          </div>
        </div>

        <!-- 3. Technical Specs Tab -->
        <div v-if="activeTab === 'technical'" class="tab-pane">
          <div class="info-card full-width">
            <div class="card-header">
              <span class="card-icon">📐</span>
              <span class="card-title">Image Technical Specifications</span>
            </div>
            <div class="specs-matrix">
              <div class="matrix-cell">
                <span class="m-label">Dimensions</span>
                <span class="m-val">{{ technicalInfo.width }} × {{ technicalInfo.height }} px</span>
              </div>
              <div class="matrix-cell">
                <span class="m-label">Megapixels</span>
                <span class="m-val highlight">{{ technicalInfo.megapixels || 'N/A' }}</span>
              </div>
              <div class="matrix-cell">
                <span class="m-label">Aspect Ratio</span>
                <span class="m-val">{{ technicalInfo.aspectRatio || 'N/A' }}</span>
              </div>
              <div class="matrix-cell">
                <span class="m-label">Color Space</span>
                <span class="m-val">{{ technicalInfo.colorSpace || 'sRGB' }}</span>
              </div>
              <div class="matrix-cell">
                <span class="m-label">Bit Depth</span>
                <span class="m-val">{{ technicalInfo.bitsPerSample || '8-bit' }}</span>
              </div>
              <div class="matrix-cell">
                <span class="m-label">Resolution / DPI</span>
                <span class="m-val">{{ technicalInfo.resolutionDpi || '72 DPI' }}</span>
              </div>
              <div class="matrix-cell">
                <span class="m-label">Orientation</span>
                <span class="m-val">{{ technicalInfo.orientation || 'Horizontal (Normal)' }}</span>
              </div>
              <div class="matrix-cell">
                <span class="m-label">Compression</span>
                <span class="m-val">{{ technicalInfo.compression || 'JPEG Standard' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Software & AI Prompts Tab -->
        <div v-if="activeTab === 'software'" class="tab-pane">
          <div class="cards-grid">
            <!-- Author & Editing Software Card -->
            <div class="info-card">
              <div class="card-header">
                <span class="card-icon">🖥️</span>
                <span class="card-title">Editing Software & Rights</span>
              </div>
              <div class="kv-list">
                <div class="kv-row">
                  <span class="kv-key">Software Used</span>
                  <span class="kv-val highlight">{{ softwareAiInfo.software || 'Camera native firmware' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Artist / Author</span>
                  <span class="kv-val">{{ softwareAiInfo.artist || 'Not specified' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Copyright</span>
                  <span class="kv-val">{{ softwareAiInfo.copyright || 'Public / Unspecified' }}</span>
                </div>
              </div>
            </div>

            <!-- AI Generation Parameters Card -->
            <div class="info-card">
              <div class="card-header">
                <span class="card-icon">🤖</span>
                <span class="card-title">AI Generation Parameters</span>
              </div>

              <div v-if="softwareAiInfo.hasAiData" class="ai-params-block">
                <div class="ai-field">
                  <div class="ai-label-row">
                    <span class="ai-label">Positive Prompt</span>
                    <button class="btn-copy-small" @click="copyToClipboard(softwareAiInfo.aiPrompt || '', 'Prompt copied!')">Copy</button>
                  </div>
                  <pre class="ai-code"><code>{{ softwareAiInfo.aiPrompt }}</code></pre>
                </div>

                <div v-if="softwareAiInfo.aiNegativePrompt" class="ai-field">
                  <div class="ai-label-row">
                    <span class="ai-label">Negative Prompt</span>
                    <button class="btn-copy-small" @click="copyToClipboard(softwareAiInfo.aiNegativePrompt || '', 'Negative prompt copied!')">Copy</button>
                  </div>
                  <pre class="ai-code neg"><code>{{ softwareAiInfo.aiNegativePrompt }}</code></pre>
                </div>

                <div class="ai-chips-row">
                  <span v-if="softwareAiInfo.aiModel" class="ai-chip">Model: {{ softwareAiInfo.aiModel }}</span>
                  <span v-if="softwareAiInfo.aiSeed" class="ai-chip">Seed: {{ softwareAiInfo.aiSeed }}</span>
                  <span v-if="softwareAiInfo.aiSampler" class="ai-chip">Sampler: {{ softwareAiInfo.aiSampler }}</span>
                  <span v-if="softwareAiInfo.aiSteps" class="ai-chip">Steps: {{ softwareAiInfo.aiSteps }}</span>
                  <span v-if="softwareAiInfo.aiCfg" class="ai-chip">CFG: {{ softwareAiInfo.aiCfg }}</span>
                </div>
              </div>

              <div v-else class="empty-ai">
                <p>No AI generation prompts (Stable Diffusion / Midjourney PNG chunks) detected in this file.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. Raw Tags Explorer Tab -->
        <div v-if="activeTab === 'raw'" class="tab-pane">
          <!-- Filter and Search Header -->
          <div class="raw-filter-bar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="Search by tag name or value (e.g. ISO, Date, Lens)..."
              />
            </div>

            <div class="category-pills">
              <button 
                v-for="cat in availableCategories" 
                :key="cat"
                class="cat-pill"
                :class="{ active: selectedCategoryFilter === cat }"
                @click="selectedCategoryFilter = cat"
              >
                {{ cat }}
              </button>
            </div>
          </div>

          <!-- Tags Table -->
          <div class="tags-table-container">
            <table class="tags-table">
              <thead>
                <tr>
                  <th style="width: 25%">Tag Name</th>
                  <th style="width: 15%">Category</th>
                  <th style="width: 60%">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tag in filteredRawTags" :key="tag.id" class="tag-row">
                  <td class="tag-name">
                    <code>{{ tag.name }}</code>
                  </td>
                  <td>
                    <span class="tag-cat-badge" :class="tag.category.toLowerCase()">{{ tag.category }}</span>
                  </td>
                  <td class="tag-value" @click="copyToClipboard(tag.value, `Copied ${tag.name} value!`)">
                    <span class="val-text" :title="tag.value">{{ tag.value }}</span>
                    <span class="copy-hint">Copy</span>
                  </td>
                </tr>

                <tr v-if="filteredRawTags.length === 0">
                  <td colspan="3" class="no-tags-row">
                    No tags matching search query.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.metalens-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: 24px;
}

/* Header */
.metalens-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 20px;
  background: #0f1420;
  border: 1px solid #1c2638;
  border-radius: 10px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.badge-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 2px 8px;
  border-radius: 4px;
  width: fit-content;
}

.privacy-dot {
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
}

.metalens-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
  color: #f8fafc;
}

.metalens-desc {
  font-size: 0.8rem;
  color: #94a3b8;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-sample, .btn-clear {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sample {
  background: rgba(255, 30, 66, 0.15);
  border: 1px solid rgba(255, 30, 66, 0.4);
  color: #ff4d6d;
}

.btn-sample:hover {
  background: #ff1e42;
  color: #ffffff;
}

.btn-clear {
  background: #141b2b;
  border: 1px solid #23304a;
  color: #cbd5e1;
}

.btn-clear:hover {
  border-color: #ef4444;
  color: #ef4444;
}

/* Dropzone */
.dropzone-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  background: #0c1017;
  border: 2px dashed #23304a;
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.dropzone-area:hover, .dropzone-area.dragging {
  border-color: #ff1e42;
  background: rgba(255, 30, 66, 0.04);
}

.hidden-input {
  display: none;
}

.dropzone-icon {
  font-size: 3.5rem;
  margin-bottom: 12px;
}

.dropzone-title {
  margin: 0 0 6px;
  font-size: 1.2rem;
  font-weight: 700;
  color: #f8fafc;
}

.dropzone-subtitle {
  margin: 0 0 20px;
  font-size: 0.85rem;
  color: #64748b;
  max-width: 500px;
}

.dropzone-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.btn-upload, .btn-sample-secondary {
  padding: 10px 18px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-upload {
  background: #ff1e42;
  border: none;
  color: #ffffff;
}

.btn-upload:hover {
  background: #e01638;
}

.btn-sample-secondary {
  background: #141b2b;
  border: 1px solid #23304a;
  color: #cbd5e1;
}

.btn-sample-secondary:hover {
  border-color: #ff1e42;
  color: #ffffff;
}

.dropzone-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  color: #64748b;
}

.dropzone-tip code {
  background: #141b2b;
  border: 1px solid #23304a;
  padding: 2px 6px;
  border-radius: 4px;
  color: #ff1e42;
}

/* Image Banner */
.image-banner {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px;
  background: #0f1420;
  border: 1px solid #1c2638;
  border-radius: 10px;
  flex-wrap: wrap;
}

.banner-preview {
  width: 90px;
  height: 90px;
  border-radius: 8px;
  overflow: hidden;
  background: #090c12;
  border: 1px solid #23304a;
  flex-shrink: 0;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.banner-meta {
  flex: 1;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.banner-top-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #f8fafc;
  word-break: break-all;
}

.mime-badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 6px;
  background: rgba(0, 240, 255, 0.15);
  border: 1px solid rgba(0, 240, 255, 0.3);
  color: #00f0ff;
  border-radius: 4px;
}

.specs-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.spec-pill {
  display: flex;
  flex-direction: column;
  padding: 4px 8px;
  background: #141b2b;
  border: 1px solid #1c2638;
  border-radius: 4px;
}

.pill-label {
  font-size: 0.62rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.05em;
}

.pill-val {
  font-size: 0.8rem;
  font-weight: 600;
  color: #cbd5e1;
}

.banner-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  background: #141b2b;
  border: 1px solid #23304a;
  color: #cbd5e1;
  transition: all 0.2s;
}

.btn-action:hover {
  border-color: #ff1e42;
  color: #ffffff;
}

.btn-action.primary {
  background: #ff1e42;
  border-color: #ff1e42;
  color: #ffffff;
}

.btn-action.primary:hover {
  background: #e01638;
}

/* Tabs */
.metalens-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #1c2638;
  overflow-x: auto;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #cbd5e1;
}

.tab-btn.active {
  color: #ff1e42;
  border-bottom-color: #ff1e42;
  background: rgba(255, 30, 66, 0.05);
}

.tab-chip {
  font-size: 0.62rem;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 700;
}

.tab-chip.green {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.tab-chip.cyan {
  background: rgba(0, 240, 255, 0.2);
  color: #00f0ff;
}

/* Tab Viewport */
.tab-viewport {
  padding-top: 8px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
}

.info-card {
  background: #0f1420;
  border: 1px solid #1c2638;
  border-radius: 10px;
  padding: 16px;
}

.info-card.full-width {
  width: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid #1c2638;
  margin-bottom: 12px;
}

.card-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #f8fafc;
}

.kv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kv-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.kv-key {
  color: #64748b;
}

.kv-val {
  color: #cbd5e1;
  font-weight: 500;
  text-align: right;
}

.kv-val.highlight {
  color: #f8fafc;
  font-weight: 700;
}

.kv-val.code {
  font-family: monospace;
  color: #38bdf8;
}

.sub-val {
  color: #64748b;
  font-size: 0.75rem;
  margin-left: 4px;
}

.badge-f {
  color: #10b981;
  font-family: monospace;
  font-weight: 700;
}

.badge-shutter {
  color: #f59e0b;
  font-family: monospace;
  font-weight: 700;
}

.badge-iso {
  color: #ff1e42;
  font-family: monospace;
  font-weight: 700;
}

/* GPS Styles */
.gps-card {
  background: #0f1420;
  border: 1px solid #1c2638;
  border-radius: 10px;
  padding: 20px;
}

.gps-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid #1c2638;
  margin-bottom: 16px;
}

.gps-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  font-weight: 700;
  color: #10b981;
}

.ping-circle {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 10px #10b981;
}

.gps-coords-badge {
  font-family: monospace;
  font-size: 0.95rem;
  font-weight: 700;
  color: #38bdf8;
  background: #141b2b;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #23304a;
}

.gps-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.gps-item {
  display: flex;
  flex-direction: column;
  padding: 10px;
  background: #141b2b;
  border: 1px solid #1c2638;
  border-radius: 6px;
}

.gps-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.05em;
}

.gps-val {
  font-size: 0.9rem;
  font-weight: 600;
  color: #cbd5e1;
  font-family: monospace;
  margin-top: 4px;
}

.gps-actions-bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.map-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
}

.map-btn.google {
  background: rgba(66, 133, 244, 0.15);
  border: 1px solid rgba(66, 133, 244, 0.4);
  color: #60a5fa;
}

.map-btn.google:hover {
  background: #2563eb;
  color: #ffffff;
}

.map-btn.osm {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #34d399;
}

.map-btn.osm:hover {
  background: #059669;
  color: #ffffff;
}

.map-btn.copy {
  background: #141b2b;
  border: 1px solid #23304a;
  color: #cbd5e1;
}

.map-btn.copy:hover {
  border-color: #ff1e42;
  color: #ffffff;
}

.empty-state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  background: #0f1420;
  border: 1px solid #1c2638;
  border-radius: 10px;
  text-align: center;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
}

.empty-state-box h3 {
  margin: 0 0 8px;
  color: #f8fafc;
  font-size: 1.1rem;
}

.empty-state-box p {
  margin: 0;
  color: #64748b;
  font-size: 0.85rem;
  max-width: 520px;
  line-height: 1.5;
}

/* Specs Matrix */
.specs-matrix {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.matrix-cell {
  display: flex;
  flex-direction: column;
  padding: 10px;
  background: #141b2b;
  border: 1px solid #1c2638;
  border-radius: 6px;
}

.m-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.05em;
}

.m-val {
  font-size: 0.95rem;
  font-weight: 600;
  color: #cbd5e1;
  margin-top: 4px;
}

.m-val.highlight {
  color: #ff1e42;
  font-weight: 700;
}

/* AI Params */
.ai-params-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ai-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.btn-copy-small {
  background: transparent;
  border: none;
  color: #00f0ff;
  font-size: 0.72rem;
  cursor: pointer;
}

.btn-copy-small:hover {
  text-decoration: underline;
}

.ai-code {
  margin: 0;
  padding: 8px 10px;
  background: #090c12;
  border: 1px solid #1c2638;
  border-radius: 6px;
  color: #38bdf8;
  font-size: 0.76rem;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 140px;
  overflow-y: auto;
}

.ai-code.neg {
  color: #f87171;
}

.ai-chips-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ai-chip {
  padding: 2px 8px;
  background: #141b2b;
  border: 1px solid #23304a;
  border-radius: 4px;
  font-size: 0.7rem;
  color: #cbd5e1;
}

.empty-ai {
  font-size: 0.8rem;
  color: #64748b;
  padding: 12px 0;
}

/* Raw Tags Explorer */
.raw-filter-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0f1420;
  border: 1px solid #1c2638;
  border-radius: 8px;
  padding: 8px 12px;
}

.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #f8fafc;
  font-size: 0.85rem;
}

.search-box input::placeholder {
  color: #64748b;
}

.category-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.cat-pill {
  padding: 4px 10px;
  background: #141b2b;
  border: 1px solid #1c2638;
  border-radius: 12px;
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.cat-pill:hover, .cat-pill.active {
  background: rgba(255, 30, 66, 0.15);
  border-color: #ff1e42;
  color: #ffffff;
}

.tags-table-container {
  background: #0f1420;
  border: 1px solid #1c2638;
  border-radius: 10px;
  overflow: hidden;
  max-height: 520px;
  overflow-y: auto;
}

.tags-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.tags-table th {
  padding: 10px 14px;
  background: #141b2b;
  color: #94a3b8;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  position: sticky;
  top: 0;
  z-index: 2;
}

.tag-row {
  border-bottom: 1px solid #1c2638;
  transition: background 0.15s;
}

.tag-row:hover {
  background: #141b2b;
}

.tags-table td {
  padding: 8px 14px;
  font-size: 0.78rem;
}

.tag-name code {
  color: #ff4d6d;
}

.tag-cat-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  background: #23304a;
  color: #cbd5e1;
}

.tag-cat-badge.exif { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
.tag-cat-badge.gps { background: rgba(16, 185, 129, 0.2); color: #34d399; }
.tag-cat-badge.iptc { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
.tag-cat-badge.xmp { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
.tag-cat-badge.icc { background: rgba(236, 72, 153, 0.2); color: #f472b6; }
.tag-cat-badge.pngfilechunk { background: rgba(0, 240, 255, 0.2); color: #00f0ff; }

.tag-value {
  color: #cbd5e1;
  word-break: break-all;
  cursor: pointer;
  position: relative;
}

.copy-hint {
  display: none;
  font-size: 0.65rem;
  color: #00f0ff;
  margin-left: 8px;
}

.tag-value:hover .copy-hint {
  display: inline;
}

.no-tags-row {
  text-align: center;
  color: #64748b;
  padding: 32px;
}
</style>
