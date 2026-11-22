<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import ExifReader from 'exifreader'
import { useToast } from '@/composables/useToast'
import type {
  CameraInfo,
  GpsInfo,
  InspectedImage,
  ParsedTag,
  PixelAnalysis,
  TechnicalInfo
} from './metalens/types'
import {
  computeFileHashes,
  inferMimeAndExt,
  parseBinarySegments,
  stripJpegMetadataLossless,
  stripPngMetadataLossless
} from './metalens/binaryUtils'
import {
  analyzeAiProvenance,
  computePrivacyAudit,
  extractSoftwareAndAiInfo,
  formatDms
} from './metalens/forensics'
import {
  computePixelAnalysis,
  drawHistogramCanvas,
  generateElaDataUrl
} from './metalens/pixelAnalysis'

const { showToast, copyToClipboard } = useToast()

// Primary & Compare State
const isLoading = ref(false)
const isDragging = ref(false)
const dragCounter = ref(0)
const dropTargetSlot = ref<'primary' | 'compare'>('primary')

const primaryImage = ref<InspectedImage | null>(null)
const compareImage = ref<InspectedImage | null>(null)

// Pixel Analysis & ELA State
const pixelAnalysis = ref<PixelAnalysis | null>(null)
const histogramCanvasRef = ref<HTMLCanvasElement | null>(null)
const histChannels = ref({ l: true, r: true, g: true, b: true })

const elaUrl = ref<string | null>(null)
const elaQuality = ref(90)
const elaAmp = ref(16)
const isElaGenerating = ref(false)

// Sanitizer Settings
const sanitizeMode = ref<'lossless' | 'reencode'>('lossless')
const sanitizeFormat = ref<'auto' | 'image/png' | 'image/jpeg' | 'image/webp'>('auto')
const sanitizeQuality = ref(92)
const lastCleanStats = ref<{ origSize: number; cleanSize: number; method: string } | null>(null)

// GPS Map Preview Toggle (on-demand)
const showEmbeddedMap = ref(false)

// Raw Workflow Expand Toggle
const showFullWorkflowJson = ref(false)

// Active Navigation Tab
type TabId = 'camera' | 'gps' | 'technical' | 'software' | 'forensics' | 'raw' | 'compare'
const activeTab = ref<TabId>('camera')

// Raw Tags Explorer Filter
const searchQuery = ref('')
const selectedCategoryFilter = ref('ALL')

// Compare Input Ref
const fileInputRef = ref<HTMLInputElement | null>(null)
const compareInputRef = ref<HTMLInputElement | null>(null)

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const computeAspectRatio = (w: number, h: number): string => {
  if (!w || !h) return ''
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const divisor = gcd(w, h)
  const rw = w / divisor
  const rh = h / divisor
  if (rw <= 21 && rh <= 21) return `${rw}:${rh}`
  return `${(w / h).toFixed(2)}:1`
}

const checkImagePreview = (url: string): Promise<{ supported: boolean; width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ supported: true, width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ supported: false, width: 0, height: 0 })
    img.src = url
  })
}

const buildInspectedImage = async (file: File, buffer: ArrayBuffer): Promise<InspectedImage> => {
  const { mime, ext } = inferMimeAndExt(file.name, file.type, buffer)
  const blob = new Blob([buffer], { type: mime })
  const dataUrl = URL.createObjectURL(blob)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tags: any = await ExifReader.load(buffer, { expanded: true })

  // 1. Extract Raw Tags across all ExifReader groups
  const parsedList: ParsedTag[] = []
  const rawCategories = [
    'exif',
    'iptc',
    'xmp',
    'icc',
    'pngText',
    'png',
    'pngFile',
    'file',
    'jfif',
    'riff',
    'gif',
    'photoshop',
    'composite'
  ]

  for (const cat of rawCategories) {
    if (tags[cat] && typeof tags[cat] === 'object') {
      for (const [key, val] of Object.entries(tags[cat])) {
        if (key === '_raw') continue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tagObj = val as any
        const desc = tagObj?.description ?? tagObj?.value ?? String(val)
        parsedList.push({
          id: `${cat}-${key}`,
          name: key,
          category: cat.toUpperCase(),
          value: typeof desc === 'object' ? JSON.stringify(desc) : String(desc),
          raw: tagObj
        })
      }
    }
  }

  if (parsedList.length === 0) {
    for (const [key, val] of Object.entries(tags)) {
      if (key !== 'Thumbnail' && key !== 'gps' && typeof val === 'object' && val !== null) {
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

  const getTag = (name: string): string | undefined => {
    for (const group of ['exif', 'iptc', 'xmp', 'pngText', 'png', 'pngFile', 'file']) {
      const entry = tags[group]?.[name]
      if (entry?.description !== undefined) return String(entry.description)
      if (entry?.value !== undefined) return String(entry.value)
    }
    if (tags[name]?.description !== undefined) return String(tags[name].description)
    if (tags[name]?.value !== undefined) return String(tags[name].value)
    return undefined
  }

  // 2. Camera & Hardware Info
  const camera: CameraInfo = {
    make: getTag('Make'),
    model: getTag('Model'),
    lens: getTag('LensModel') || getTag('Lens') || getTag('LensMake'),
    bodySerial: getTag('BodySerialNumber') || getTag('SerialNumber') || getTag('InternalSerialNumber'),
    lensSerial: getTag('LensSerialNumber'),
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

  // 3. GPS Extraction + DMS
  let gps: GpsInfo = { hasGps: false }
  if (tags.gps && (tags.gps.Latitude !== undefined || tags.gps.Longitude !== undefined)) {
    const lat = Number(tags.gps.Latitude)
    const lon = Number(tags.gps.Longitude)
    const altDesc = tags.gps.Altitude
      ? `${typeof tags.gps.Altitude === 'number' ? tags.gps.Altitude.toFixed(1) : tags.gps.Altitude} m`
      : undefined
    const validCoords = !isNaN(lat) && !isNaN(lon)
    gps = {
      latitude: isNaN(lat) ? undefined : lat,
      longitude: isNaN(lon) ? undefined : lon,
      latitudeRef: tags.gps.LatitudeRef?.value?.[0] || (lat >= 0 ? 'N' : 'S'),
      longitudeRef: tags.gps.LongitudeRef?.value?.[0] || (lon >= 0 ? 'E' : 'W'),
      latitudeDms: validCoords ? formatDms(lat, 'N', 'S') : undefined,
      longitudeDms: validCoords ? formatDms(lon, 'E', 'W') : undefined,
      altitude: altDesc,
      direction: getTag('GPSImgDirection') ? `${getTag('GPSImgDirection')}°` : undefined,
      speed: getTag('GPSSpeed'),
      timestamp: getTag('GPSDateStamp')
        ? `${getTag('GPSDateStamp')} ${getTag('GPSTimeStamp') || ''}`.trim()
        : undefined,
      hasGps: validCoords
    }
  }

  // 4. Technical Specs (true values only, no fake fallbacks)
  const previewCheck = await checkImagePreview(dataUrl)
  const fileW = Number(tags.file?.['Image Width']?.value || tags.pngFile?.['Image Width']?.value || 0)
  const fileH = Number(tags.file?.['Image Height']?.value || tags.pngFile?.['Image Height']?.value || 0)
  const exifW = Number(getTag('PixelXDimension') || getTag('ExifImageWidth') || 0) || undefined
  const exifH = Number(getTag('PixelYDimension') || getTag('ExifImageHeight') || 0) || undefined

  const width = previewCheck.width || fileW || exifW || 0
  const height = previewCheck.height || fileH || exifH || 0
  const dimensionMismatch = Boolean(
    exifW &&
      exifH &&
      width &&
      height &&
      !((exifW === width && exifH === height) || (exifW === height && exifH === width))
  )

  const pngColorDesc = tags.pngFile?.['Color Type']?.description
  const technical: TechnicalInfo = {
    width,
    height,
    exifWidth: exifW,
    exifHeight: exifH,
    dimensionMismatch,
    megapixels: width && height ? `${((width * height) / 1000000).toFixed(2)} MP` : undefined,
    aspectRatio: width && height ? computeAspectRatio(width, height) : undefined,
    colorSpace:
      getTag('ColorSpace') ||
      tags.icc?.['Color Space']?.description ||
      (pngColorDesc ? String(pngColorDesc) : undefined),
    bitsPerSample:
      getTag('BitsPerSample') ||
      tags.file?.['Bits Per Sample']?.description ||
      tags.pngFile?.['Bit Depth']?.description ||
      tags.gif?.['Bits Per Pixel']?.description,
    orientation: getTag('Orientation'),
    resolutionDpi: getTag('XResolution') ? `${getTag('XResolution')} DPI` : undefined,
    compression: getTag('Compression') || tags.pngFile?.['Compression']?.description,
    hasAlpha:
      tags.riff?.Alpha?.value === 1 ||
      (typeof pngColorDesc === 'string' && pngColorDesc.includes('Alpha')),
    isAnimated: tags.riff?.Animation?.value === 1
  }

  // 5. Embedded EXIF Thumbnail
  let embeddedThumbnail: InspectedImage['embeddedThumbnail'] = null
  if (tags.Thumbnail?.base64) {
    const thumbBytes = tags.Thumbnail.image?.byteLength || Math.round((tags.Thumbnail.base64.length * 3) / 4)
    embeddedThumbnail = {
      dataUrl: `data:${tags.Thumbnail.type || 'image/jpeg'};base64,${tags.Thumbnail.base64}`,
      sizeBytes: thumbBytes,
      width: tags.Thumbnail.ImageWidth?.value,
      height: tags.Thumbnail.ImageLength?.value
    }
  }

  // 6. Software, AI Prompts, AI Provenance, Privacy Audit, Binary & Hashes
  const softwareAi = extractSoftwareAndAiInfo(
    tags,
    getTag('Software') || getTag('ProcessingSoftware') || tags.pngText?.['Software']?.description,
    getTag('Artist') || tags.pngText?.['Author']?.description,
    getTag('Copyright'),
    getTag('UserComment')
  )

  const aiProvenance = analyzeAiProvenance(buffer, tags, camera, technical, softwareAi)
  const privacyAudit = computePrivacyAudit(camera, gps, softwareAi, Boolean(embeddedThumbnail), parsedList.length)
  const binarySegments = parseBinarySegments(buffer, ext)
  const hashes = await computeFileHashes(buffer)

  return {
    name: file.name,
    size: file.size,
    mime,
    ext,
    dataUrl,
    buffer,
    previewSupported: previewCheck.supported,
    hashes,
    camera,
    gps,
    technical,
    softwareAi,
    aiProvenance,
    privacyAudit,
    embeddedThumbnail,
    binarySegments,
    rawTags: parsedList
  }
}

const redrawHistogram = () => {
  if (!histogramCanvasRef.value || !pixelAnalysis.value) return
  drawHistogramCanvas(histogramCanvasRef.value, pixelAnalysis.value, histChannels.value)
}

watch([activeTab, histChannels], () => {
  if (activeTab.value === 'technical') {
    nextTick(() => redrawHistogram())
  }
}, { deep: true })

const refreshEla = async () => {
  if (!primaryImage.value?.previewSupported) return
  isElaGenerating.value = true
  elaUrl.value = await generateElaDataUrl(primaryImage.value.dataUrl, elaQuality.value / 100, elaAmp.value)
  isElaGenerating.value = false
}

const handleFile = async (file: File, slot: 'primary' | 'compare' = 'primary') => {
  if (!file.type.startsWith('image/') && !file.name.match(/\.(jpe?g|png|webp|tiff?|heic|avif|gif|bmp)$/i)) {
    showToast('Invalid file. Please upload a valid image file', 'error')
    return
  }

  try {
    isLoading.value = true
    const buffer = await file.arrayBuffer()
    const inspected = await buildInspectedImage(file, buffer)

    if (slot === 'compare') {
      if (compareImage.value?.dataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(compareImage.value.dataUrl)
      }
      compareImage.value = inspected
      activeTab.value = 'compare'
      showToast(`Compare image loaded: ${inspected.name}`, 'success')
      return
    }

    if (primaryImage.value?.dataUrl.startsWith('blob:')) {
      URL.revokeObjectURL(primaryImage.value.dataUrl)
    }
    primaryImage.value = inspected
    elaUrl.value = null
    showEmbeddedMap.value = false
    showFullWorkflowJson.value = false
    lastCleanStats.value = null

    // Auto-select lossless sanitizer for JPEG/PNG, re-encode for WebP/AVIF/others
    sanitizeMode.value = inspected.ext === 'jpg' || inspected.ext === 'jpeg' || inspected.ext === 'png'
      ? 'lossless'
      : 'reencode'

    if (inspected.previewSupported) {
      pixelAnalysis.value = await computePixelAnalysis(inspected.dataUrl)
      nextTick(() => redrawHistogram())
      if (activeTab.value === 'forensics') {
        refreshEla()
      }
    } else {
      pixelAnalysis.value = null
    }

    showToast(`Metadata loaded: ${inspected.rawTags.length} tags detected`, 'success')
  } catch (err) {
    console.error('Error parsing image metadata:', err)
    showToast('Failed to parse metadata from image', 'error')
  } finally {
    isLoading.value = false
  }
}

const canLosslessStrip = computed(() => {
  const ext = primaryImage.value?.ext
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png'
})

const createSanitizedBlob = async (): Promise<{ blob: Blob; fileName: string; method: string } | null> => {
  const imgData = primaryImage.value
  if (!imgData) return null

  const baseName = imgData.name.replace(/\.[^/.]+$/, '') || 'image'

  // 1. Lossless byte-level stripping for JPEG & PNG
  if (sanitizeMode.value === 'lossless' && canLosslessStrip.value) {
    const lossless =
      imgData.ext === 'png'
        ? stripPngMetadataLossless(imgData.buffer)
        : stripJpegMetadataLossless(imgData.buffer)
    if (lossless) {
      const ext = imgData.ext === 'png' ? '.png' : '.jpg'
      return { blob: lossless, fileName: `clean_${baseName}${ext}`, method: 'Lossless Byte Strip' }
    }
  }

  // 2. Deep Canvas Re-Encode (supports PNG, JPEG, WebP)
  if (!imgData.previewSupported) {
    showToast('Browser cannot decode this format for canvas re-encoding', 'error')
    return null
  }

  const img = new Image()
  img.src = imgData.dataUrl
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to decode image'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)

  let targetMime = sanitizeFormat.value
  if (targetMime === 'auto') {
    if (imgData.mime === 'image/png' || imgData.mime === 'image/webp') {
      targetMime = imgData.mime
    } else {
      targetMime = 'image/jpeg'
    }
  }

  const extMap: Record<string, string> = {
    'image/png': '.png',
    'image/webp': '.webp',
    'image/jpeg': '.jpg'
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), targetMime, sanitizeQuality.value / 100)
  )
  if (!blob) return null

  return {
    blob,
    fileName: `clean_${baseName}${extMap[targetMime] || '.jpg'}`,
    method: `Canvas Re-encode (${targetMime.replace('image/', '').toUpperCase()})`
  }
}

const stripMetadataAndDownload = async () => {
  const result = await createSanitizedBlob()
  if (!result || !primaryImage.value) return

  lastCleanStats.value = {
    origSize: primaryImage.value.size,
    cleanSize: result.blob.size,
    method: result.method
  }

  const url = URL.createObjectURL(result.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  showToast(`Clean image downloaded (${formatFileSize(result.blob.size)})`, 'success')
}

const stripAndCompareClean = async () => {
  const result = await createSanitizedBlob()
  if (!result || !primaryImage.value) return

  lastCleanStats.value = {
    origSize: primaryImage.value.size,
    cleanSize: result.blob.size,
    method: result.method
  }

  const cleanFile = new File([result.blob], result.fileName, { type: result.blob.type })
  await handleFile(cleanFile, 'compare')
}

// Export Helpers
const buildExportPayload = () => {
  const img = primaryImage.value
  if (!img) return null
  return {
    file: {
      name: img.name,
      sizeBytes: img.size,
      mimeType: img.mime,
      hashes: img.hashes
    },
    privacyAudit: img.privacyAudit,
    provenance: img.aiProvenance,
    camera: img.camera,
    gps: img.gps,
    technical: img.technical,
    softwareAndAi: img.softwareAi,
    binarySegments: img.binarySegments,
    rawTags: img.rawTags.reduce((acc, t) => {
      acc[t.name] = t.value
      return acc
    }, {} as Record<string, string>)
  }
}

const exportAllJson = () => {
  const payload = buildExportPayload()
  if (!payload) return
  copyToClipboard(JSON.stringify(payload, null, 2), 'All metadata copied as JSON!')
}

const downloadReport = (format: 'json' | 'txt') => {
  const img = primaryImage.value
  const payload = buildExportPayload()
  if (!img || !payload) return

  const baseName = img.name.replace(/\.[^/.]+$/, '') || 'report'
  let content = ''
  let mime = 'application/json'

  if (format === 'json') {
    content = JSON.stringify(payload, null, 2)
  } else {
    mime = 'text/plain'
    content = [
      `=== METALENS FORENSIC REPORT ===`,
      `File: ${img.name} (${formatFileSize(img.size)}, ${img.mime})`,
      `SHA-256: ${img.hashes.sha256}`,
      `MD5: ${img.hashes.md5}`,
      `Privacy Risk: ${img.privacyAudit.riskLevel} (${img.privacyAudit.score}/100)`,
      `AI Provenance: ${img.aiProvenance.platformName} (${img.aiProvenance.confidencePercent}%)`,
      `Summary: ${img.aiProvenance.summary}`,
      ``,
      `--- RAW TAGS (${img.rawTags.length}) ---`,
      ...img.rawTags.map((t) => `[${t.category}] ${t.name}: ${t.value}`)
    ].join('\n')
  }

  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${baseName}_metadata.${format}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  showToast(`Downloaded ${baseName}_metadata.${format}`, 'success')
}

// Clear State
const clearImage = () => {
  if (primaryImage.value?.dataUrl.startsWith('blob:')) URL.revokeObjectURL(primaryImage.value.dataUrl)
  if (compareImage.value?.dataUrl.startsWith('blob:')) URL.revokeObjectURL(compareImage.value.dataUrl)
  primaryImage.value = null
  compareImage.value = null
  pixelAnalysis.value = null
  elaUrl.value = null
  lastCleanStats.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
  if (compareInputRef.value) compareInputRef.value.value = ''
  showToast('Workspace cleared', 'info')
}

// Raw Tags Filtering
const availableCategories = computed(() => {
  const cats = new Set<string>()
  primaryImage.value?.rawTags.forEach((t) => cats.add(t.category))
  return ['ALL', ...Array.from(cats).sort()]
})

const filteredRawTags = computed(() => {
  const tags = primaryImage.value?.rawTags || []
  const query = searchQuery.value.trim().toLowerCase()
  const cat = selectedCategoryFilter.value

  return tags.filter((tag) => {
    const matchesCat = cat === 'ALL' || tag.category === cat
    const matchesQuery =
      !query || tag.name.toLowerCase().includes(query) || tag.value.toLowerCase().includes(query)
    return matchesCat && matchesQuery
  })
})

// Tag Diff for Compare Tab
interface TagDiffRow {
  name: string
  valA: string
  valB: string
  status: 'REMOVED' | 'ADDED' | 'CHANGED' | 'SAME'
}

const compareTagDiff = computed<TagDiffRow[]>(() => {
  if (!primaryImage.value || !compareImage.value) return []
  const mapA = new Map<string, string>()
  const mapB = new Map<string, string>()
  primaryImage.value.rawTags.forEach((t) => mapA.set(`${t.category}:${t.name}`, t.value))
  compareImage.value.rawTags.forEach((t) => mapB.set(`${t.category}:${t.name}`, t.value))

  const allKeys = new Set([...mapA.keys(), ...mapB.keys()])
  const rows: TagDiffRow[] = []

  for (const key of allKeys) {
    const a = mapA.get(key)
    const b = mapB.get(key)
    let status: TagDiffRow['status'] = 'SAME'
    if (a !== undefined && b === undefined) status = 'REMOVED'
    else if (a === undefined && b !== undefined) status = 'ADDED'
    else if (a !== b) status = 'CHANGED'

    if (status !== 'SAME') {
      rows.push({
        name: key,
        valA: a ?? '—',
        valB: b ?? '—',
        status
      })
    }
  }
  return rows
})

const metadataSegmentsCount = computed(() => {
  return primaryImage.value?.binarySegments.filter((s) => s.isMetadata).length || 0
})

// Drag & Drop Handlers
const onContainerDragEnter = (e: DragEvent) => {
  e.preventDefault()
  dragCounter.value++
  isDragging.value = true
}
const onContainerDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  isDragging.value = true
}
const onContainerDragLeave = (e: DragEvent) => {
  e.preventDefault()
  dragCounter.value--
  if (dragCounter.value <= 0) {
    dragCounter.value = 0
    isDragging.value = false
  }
}
const onContainerDrop = (e: DragEvent) => {
  e.preventDefault()
  dragCounter.value = 0
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (!files?.length) return
  if (files[0]) handleFile(files[0], dropTargetSlot.value)
  if (files[1]) handleFile(files[1], 'compare')
  dropTargetSlot.value = 'primary'
}

const onFileSelect = (e: Event, slot: 'primary' | 'compare') => {
  const target = e.target as HTMLInputElement
  const f = target.files?.[0]
  if (f) handleFile(f, slot)
  target.value = ''
}

const onPaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        handleFile(file, activeTab.value === 'compare' && primaryImage.value ? 'compare' : 'primary')
        break
      }
    }
  }
}

onMounted(() => {
  window.addEventListener('paste', onPaste)
})

onUnmounted(() => {
  window.removeEventListener('paste', onPaste)
  if (primaryImage.value?.dataUrl.startsWith('blob:')) URL.revokeObjectURL(primaryImage.value.dataUrl)
  if (compareImage.value?.dataUrl.startsWith('blob:')) URL.revokeObjectURL(compareImage.value.dataUrl)
})
</script>

<template>
  <div
    class="metalens-container"
    @dragenter.prevent="onContainerDragEnter"
    @dragover.prevent="onContainerDragOver"
    @dragleave.prevent="onContainerDragLeave"
    @drop.prevent="onContainerDrop"
  >
    <input
      ref="fileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/tiff,image/heic,image/avif,image/gif,image/bmp"
      class="hidden-input"
      @change="onFileSelect($event, 'primary')"
    />
    <input
      ref="compareInputRef"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/tiff,image/heic,image/avif,image/gif,image/bmp"
      class="hidden-input"
      @change="onFileSelect($event, 'compare')"
    />

    <!-- Drag Overlay -->
    <div v-if="isDragging" class="drag-replace-overlay" @click.stop>
      <div class="replace-overlay-card">
        <span class="replace-overlay-icon">📥</span>
        <h3 v-if="primaryImage">Drop Image to Inspect (Drop 2 files to Compare)</h3>
        <h3 v-else>Drop Image Here to Inspect</h3>
        <p>Supports JPEG, PNG, WebP, TIFF, HEIC, AVIF, GIF & BMP</p>
      </div>
    </div>

    <!-- Header Console -->
    <header class="metalens-header">
      <div class="header-left">
        <h2 class="metalens-title">📸 MetaLens Studio</h2>
        <span class="metalens-desc">
          EXIF, GPS, AI Forensics, Lossless Privacy Sanitizer, ELA & Container Analyzer
        </span>
      </div>

      <div class="header-actions">
        <button v-if="primaryImage" class="btn-replace-header" @click="compareInputRef?.click()">
          <span>⚖️</span> {{ compareImage ? 'Swap Image B' : 'Compare 2nd Image' }}
        </button>
        <button v-if="primaryImage" class="btn-replace-header" @click="fileInputRef?.click()">
          <span>🔄</span> Replace
        </button>
        <button v-if="primaryImage" class="btn-clear" @click="clearImage">
          <span>🗑️</span> Clear
        </button>
      </div>
    </header>

    <!-- Dropzone -->
    <div
      v-if="!primaryImage"
      class="dropzone-area"
      :class="{ dragging: isDragging }"
      @click="fileInputRef?.click()"
    >
      <div class="dropzone-icon">📷</div>
      <h3 class="dropzone-title">Drop your image here, or click to browse</h3>
      <p class="dropzone-subtitle">
        Supports JPEG, PNG, WebP, TIFF, HEIC, AVIF, GIF & BMP • Drop 2 files at once for Side-by-Side Diff
      </p>

      <div class="dropzone-actions" @click.stop>
        <button class="btn-upload" @click="fileInputRef?.click()">
          <span>📁</span> Browse Local Image
        </button>
      </div>

      <div class="dropzone-tip">
        <span>Tip: Paste directly from clipboard with</span>
        <code>Ctrl + V</code>
      </div>
    </div>

    <!-- Active Workspace -->
    <div v-else class="metalens-workspace">
      <!-- Top Banner -->
      <section class="image-banner">
        <div class="banner-preview">
          <img
            v-if="primaryImage.previewSupported"
            :src="primaryImage.dataUrl"
            :alt="primaryImage.name"
            class="thumb-img"
          />
          <div v-else class="unsupported-thumb" title="Browser cannot natively decode this format">
            <span>{{ primaryImage.ext.toUpperCase() }}</span>
          </div>
        </div>

        <div class="banner-meta">
          <div class="banner-top-row">
            <h3 class="file-name" :title="primaryImage.name">{{ primaryImage.name }}</h3>
            <span class="mime-badge">{{ primaryImage.ext.toUpperCase() }}</span>
            <span
              class="privacy-pill"
              :class="primaryImage.privacyAudit.riskLevel.toLowerCase()"
              :title="primaryImage.privacyAudit.summary"
            >
              🛡️ PRIVACY: {{ primaryImage.privacyAudit.riskLevel }} ({{ primaryImage.privacyAudit.score }}/100)
            </span>
            <span
              v-if="primaryImage.aiProvenance.isAi"
              class="top-provenance-badge ai"
              :title="primaryImage.aiProvenance.summary"
            >
              {{ primaryImage.aiProvenance.platformIcon }} {{ primaryImage.aiProvenance.platformName }}
            </span>
            <span
              v-else-if="primaryImage.aiProvenance.confidence === 'AUTHENTIC_CAMERA'"
              class="top-provenance-badge camera"
              :title="primaryImage.aiProvenance.summary"
            >
              📸 Authentic Camera
            </span>
            <span
              v-else-if="primaryImage.aiProvenance.confidence === 'CAMERA_EDITED'"
              class="top-provenance-badge edited"
              :title="primaryImage.aiProvenance.summary"
            >
              🖌️ Camera (Edited)
            </span>
          </div>

          <div class="specs-pills">
            <div class="spec-pill">
              <span class="pill-label">SIZE</span>
              <span class="pill-val">{{ formatFileSize(primaryImage.size) }}</span>
            </div>
            <div v-if="primaryImage.technical.width && primaryImage.technical.height" class="spec-pill">
              <span class="pill-label">RESOLUTION</span>
              <span class="pill-val">{{ primaryImage.technical.width }} × {{ primaryImage.technical.height }}</span>
            </div>
            <div v-if="primaryImage.technical.megapixels" class="spec-pill">
              <span class="pill-label">MEGAPIXELS</span>
              <span class="pill-val">{{ primaryImage.technical.megapixels }}</span>
            </div>
            <div v-if="primaryImage.technical.aspectRatio" class="spec-pill">
              <span class="pill-label">RATIO</span>
              <span class="pill-val">{{ primaryImage.technical.aspectRatio }}</span>
            </div>
            <div class="spec-pill">
              <span class="pill-label">TAGS</span>
              <span class="pill-val">{{ primaryImage.rawTags.length }}</span>
            </div>
          </div>
        </div>

        <div class="banner-actions">
          <button class="btn-action" title="Copy all metadata as JSON" @click="exportAllJson">
            <span>📋</span> Copy JSON
          </button>
          <button class="btn-action" title="Download JSON report" @click="downloadReport('json')">
            <span>💾</span> .JSON
          </button>
          <button class="btn-action" title="Download TXT report" @click="downloadReport('txt')">
            <span>📄</span> .TXT
          </button>
        </div>
      </section>

      <!-- Privacy Audit & Sanitizer Bar -->
      <section class="privacy-sanitizer-bar" :class="primaryImage.privacyAudit.riskLevel.toLowerCase()">
        <div class="privacy-summary-col">
          <div class="privacy-title-row">
            <span class="privacy-heading">🛡️ Privacy Audit: {{ primaryImage.privacyAudit.summary }}</span>
          </div>
          <div v-if="primaryImage.privacyAudit.findings.length > 0" class="findings-chips">
            <span
              v-for="f in primaryImage.privacyAudit.findings"
              :key="f.id"
              class="finding-chip"
              :class="f.severity"
              :title="f.detail"
            >
              {{ f.title }}
            </span>
          </div>
        </div>

        <div class="sanitizer-controls-col">
          <div class="sanitizer-options">
            <select v-model="sanitizeMode" class="mini-select" title="Sanitization method">
              <option value="lossless" :disabled="!canLosslessStrip">
                {{ canLosslessStrip ? 'Lossless Byte Strip (0 Quality Loss)' : 'Lossless (JPEG/PNG only)' }}
              </option>
              <option value="reencode">Deep Re-Encode (Canvas)</option>
            </select>

            <template v-if="sanitizeMode === 'reencode'">
              <select v-model="sanitizeFormat" class="mini-select">
                <option value="auto">Keep Format</option>
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </select>
              <input
                v-if="sanitizeFormat !== 'image/png'"
                v-model.number="sanitizeQuality"
                type="range"
                min="60"
                max="100"
                class="mini-range"
                :title="`Quality: ${sanitizeQuality}%`"
              />
            </template>
          </div>

          <div class="sanitizer-btns">
            <button class="btn-action primary" @click="stripMetadataAndDownload">
              <span>🧹</span> Strip & Download
            </button>
            <button class="btn-action" title="Sanitize and compare side-by-side" @click="stripAndCompareClean">
              <span>🔍</span> Strip & Verify
            </button>
          </div>

          <span v-if="lastCleanStats" class="clean-stats-hint">
            {{ lastCleanStats.method }}: {{ formatFileSize(lastCleanStats.origSize) }} →
            {{ formatFileSize(lastCleanStats.cleanSize) }}
          </span>
        </div>
      </section>

      <!-- Navigation Tabs -->
      <nav class="metalens-tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'camera' }" @click="activeTab = 'camera'">
          <span>📷</span> Camera & Shot
          <span v-if="primaryImage.camera.make || primaryImage.camera.model" class="tab-chip green">DETECTED</span>
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'gps' }" @click="activeTab = 'gps'">
          <span>📍</span> GPS Location
          <span v-if="primaryImage.gps.hasGps" class="tab-chip red">EXPOSED</span>
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'technical' }" @click="activeTab = 'technical'">
          <span>📐</span> Specs & Pixels
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'software' }" @click="activeTab = 'software'">
          <span>🤖</span> Software & AI
          <span v-if="primaryImage.aiProvenance.isAi" class="tab-chip red">AI</span>
          <span v-else-if="primaryImage.softwareAi.hasAiData" class="tab-chip cyan">CHUNKS</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'forensics' }"
          @click="activeTab = 'forensics'; if (!elaUrl) refreshEla()"
        >
          <span>🔬</span> Forensics & Binary
          <span v-if="primaryImage.embeddedThumbnail" class="tab-chip red">THUMB</span>
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'raw' }" @click="activeTab = 'raw'">
          <span>📜</span> Raw Tags ({{ primaryImage.rawTags.length }})
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'compare' }" @click="activeTab = 'compare'">
          <span>⚖️</span> Compare
          <span v-if="compareImage" class="tab-chip cyan">DIFF</span>
        </button>
      </nav>

      <!-- Tab Content -->
      <div class="tab-viewport">
        <!-- 1. Camera & Shot -->
        <div v-if="activeTab === 'camera'" class="tab-pane">
          <div
            v-if="primaryImage.aiProvenance.confidence === 'CAMERA_EDITED'"
            class="warning-callout"
          >
            <span>⚠️</span>
            <span>{{ primaryImage.aiProvenance.summary }}</span>
          </div>

          <div class="cards-grid">
            <div class="info-card">
              <div class="card-header">
                <span class="card-icon">📸</span>
                <span class="card-title">Device & Camera</span>
              </div>
              <div class="kv-list">
                <div class="kv-row">
                  <span class="kv-key">Make</span>
                  <span class="kv-val">{{ primaryImage.camera.make || 'Not reported' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Model</span>
                  <span class="kv-val highlight">{{ primaryImage.camera.model || 'Not reported' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Lens Model</span>
                  <span class="kv-val">{{ primaryImage.camera.lens || 'Not reported' }}</span>
                </div>
                <div v-if="primaryImage.camera.bodySerial" class="kv-row">
                  <span class="kv-key">Body Serial #</span>
                  <span class="kv-val code warn-text">{{ primaryImage.camera.bodySerial }}</span>
                </div>
                <div v-if="primaryImage.camera.lensSerial" class="kv-row">
                  <span class="kv-key">Lens Serial #</span>
                  <span class="kv-val code warn-text">{{ primaryImage.camera.lensSerial }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Date Taken</span>
                  <span class="kv-val code">{{ primaryImage.camera.dateTaken || 'No timestamp' }}</span>
                </div>
                <div v-if="primaryImage.camera.modifyDate" class="kv-row">
                  <span class="kv-key">Modified Date</span>
                  <span class="kv-val code">{{ primaryImage.camera.modifyDate }}</span>
                </div>
              </div>
            </div>

            <div class="info-card">
              <div class="card-header">
                <span class="card-icon">⚡</span>
                <span class="card-title">Exposure & Optics</span>
              </div>
              <div class="kv-list">
                <div class="kv-row">
                  <span class="kv-key">Aperture (F-Number)</span>
                  <span class="kv-val badge-f">{{ primaryImage.camera.fNumber || 'N/A' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Shutter Speed</span>
                  <span class="kv-val badge-shutter">{{ primaryImage.camera.exposureTime || 'N/A' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">ISO Sensitivity</span>
                  <span class="kv-val badge-iso">
                    {{ primaryImage.camera.iso ? `ISO ${primaryImage.camera.iso}` : 'N/A' }}
                  </span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Focal Length</span>
                  <span class="kv-val">
                    {{ primaryImage.camera.focalLength || 'N/A' }}
                    <span v-if="primaryImage.camera.focalLength35mm" class="sub-val">
                      ({{ primaryImage.camera.focalLength35mm }} eq.)
                    </span>
                  </span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Exposure Program</span>
                  <span class="kv-val">{{ primaryImage.camera.exposureProgram || 'Not reported' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Metering Mode</span>
                  <span class="kv-val">{{ primaryImage.camera.meteringMode || 'Not reported' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Flash Status</span>
                  <span class="kv-val">{{ primaryImage.camera.flash || 'Not reported' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">White Balance</span>
                  <span class="kv-val">{{ primaryImage.camera.whiteBalance || 'Not reported' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. GPS Location -->
        <div v-if="activeTab === 'gps'" class="tab-pane">
          <div v-if="primaryImage.gps.hasGps" class="gps-card">
            <div class="gps-header">
              <div class="gps-status">
                <span class="ping-circle"></span>
                <span>Geolocation Coordinates Embedded</span>
              </div>
              <div class="gps-coords-badge">
                {{ primaryImage.gps.latitude?.toFixed(5) }}°, {{ primaryImage.gps.longitude?.toFixed(5) }}°
              </div>
            </div>

            <div class="gps-details-grid">
              <div class="gps-item">
                <span class="gps-label">LATITUDE (DEC / DMS)</span>
                <span class="gps-val">{{ primaryImage.gps.latitude?.toFixed(6) }}</span>
                <span class="gps-sub">{{ primaryImage.gps.latitudeDms }}</span>
              </div>
              <div class="gps-item">
                <span class="gps-label">LONGITUDE (DEC / DMS)</span>
                <span class="gps-val">{{ primaryImage.gps.longitude?.toFixed(6) }}</span>
                <span class="gps-sub">{{ primaryImage.gps.longitudeDms }}</span>
              </div>
              <div class="gps-item">
                <span class="gps-label">ALTITUDE</span>
                <span class="gps-val">{{ primaryImage.gps.altitude || 'Not reported' }}</span>
              </div>
              <div class="gps-item">
                <span class="gps-label">DIRECTION / SPEED</span>
                <span class="gps-val">
                  {{ primaryImage.gps.direction || 'N/A' }}
                  <span v-if="primaryImage.gps.speed"> • {{ primaryImage.gps.speed }}</span>
                </span>
              </div>
              <div class="gps-item">
                <span class="gps-label">GPS TIME (UTC)</span>
                <span class="gps-val">{{ primaryImage.gps.timestamp || 'Not reported' }}</span>
              </div>
            </div>

            <div class="gps-actions-bar">
              <button class="map-btn osm" @click="showEmbeddedMap = !showEmbeddedMap">
                <span>🗺️</span> {{ showEmbeddedMap ? 'Hide Map Preview' : 'Preview Map (OSM)' }}
              </button>
              <a
                :href="`https://www.google.com/maps?q=${primaryImage.gps.latitude},${primaryImage.gps.longitude}`"
                target="_blank"
                rel="noopener noreferrer"
                class="map-btn google"
              >
                <span>🌐</span> Open Google Maps ↗
              </a>
              <a
                :href="`https://www.openstreetmap.org/?mlat=${primaryImage.gps.latitude}&mlon=${primaryImage.gps.longitude}#map=16/${primaryImage.gps.latitude}/${primaryImage.gps.longitude}`"
                target="_blank"
                rel="noopener noreferrer"
                class="map-btn osm"
              >
                <span>🌍</span> OpenStreetMap ↗
              </a>
              <button
                class="map-btn copy"
                @click="copyToClipboard(`${primaryImage.gps.latitude}, ${primaryImage.gps.longitude}`, 'Coordinates copied!')"
              >
                <span>📋</span> Copy Coordinates
              </button>
            </div>

            <div v-if="showEmbeddedMap && primaryImage.gps.latitude !== undefined && primaryImage.gps.longitude !== undefined" class="osm-embed-box">
              <iframe
                title="OpenStreetMap Location Preview"
                class="osm-iframe"
                loading="lazy"
                :src="`https://www.openstreetmap.org/export/embed.html?bbox=${primaryImage.gps.longitude - 0.012},${primaryImage.gps.latitude - 0.008},${primaryImage.gps.longitude + 0.012},${primaryImage.gps.latitude + 0.008}&layer=mapnik&marker=${primaryImage.gps.latitude},${primaryImage.gps.longitude}`"
              ></iframe>
            </div>
          </div>

          <div v-else class="empty-state-box">
            <span class="empty-icon">🛡️</span>
            <h3>No GPS Coordinates Embedded</h3>
            <p>
              This image does not contain geolocation metadata.
            </p>
          </div>
        </div>

        <!-- 3. Technical Specs, Hashes, Histogram & Dominant Colors -->
        <div v-if="activeTab === 'technical'" class="tab-pane">
          <div class="cards-grid">
            <div class="info-card full-width">
              <div class="card-header">
                <span class="card-icon">📐</span>
                <span class="card-title">Image Technical Specifications</span>
                <span v-if="primaryImage.technical.dimensionMismatch" class="mismatch-pill">
                  ⚠️ EXIF Size Mismatch ({{ primaryImage.technical.exifWidth }}×{{ primaryImage.technical.exifHeight }})
                </span>
              </div>
              <div class="specs-matrix">
                <div class="matrix-cell">
                  <span class="m-label">Pixel Dimensions</span>
                  <span class="m-val">
                    {{ primaryImage.technical.width ? `${primaryImage.technical.width} × ${primaryImage.technical.height} px` : 'Not reported' }}
                  </span>
                </div>
                <div class="matrix-cell">
                  <span class="m-label">Megapixels</span>
                  <span class="m-val highlight">{{ primaryImage.technical.megapixels || 'Not reported' }}</span>
                </div>
                <div class="matrix-cell">
                  <span class="m-label">Aspect Ratio</span>
                  <span class="m-val">{{ primaryImage.technical.aspectRatio || 'Not reported' }}</span>
                </div>
                <div class="matrix-cell">
                  <span class="m-label">Color Space / Type</span>
                  <span class="m-val">{{ primaryImage.technical.colorSpace || 'Not reported' }}</span>
                </div>
                <div class="matrix-cell">
                  <span class="m-label">Bit Depth</span>
                  <span class="m-val">{{ primaryImage.technical.bitsPerSample || 'Not reported' }}</span>
                </div>
                <div class="matrix-cell">
                  <span class="m-label">Resolution / DPI</span>
                  <span class="m-val">{{ primaryImage.technical.resolutionDpi || 'Not reported' }}</span>
                </div>
                <div class="matrix-cell">
                  <span class="m-label">Orientation</span>
                  <span class="m-val">{{ primaryImage.technical.orientation || 'Not reported' }}</span>
                </div>
                <div class="matrix-cell">
                  <span class="m-label">Compression / Features</span>
                  <span class="m-val">
                    {{ primaryImage.technical.compression || 'Not reported' }}
                    <span v-if="primaryImage.technical.hasAlpha"> • Alpha</span>
                    <span v-if="primaryImage.technical.isAnimated"> • Animated</span>
                  </span>
                </div>
              </div>
            </div>

            <!-- Histogram & Dominant Palette -->
            <div v-if="pixelAnalysis" class="info-card">
              <div class="card-header">
                <span class="card-icon">📊</span>
                <span class="card-title">RGB & Luminance Histogram</span>
                <div class="hist-toggles">
                  <button class="hist-btn" :class="{ active: histChannels.l }" @click="histChannels.l = !histChannels.l">L</button>
                  <button class="hist-btn r" :class="{ active: histChannels.r }" @click="histChannels.r = !histChannels.r">R</button>
                  <button class="hist-btn g" :class="{ active: histChannels.g }" @click="histChannels.g = !histChannels.g">G</button>
                  <button class="hist-btn b" :class="{ active: histChannels.b }" @click="histChannels.b = !histChannels.b">B</button>
                </div>
              </div>
              <canvas ref="histogramCanvasRef" width="460" height="150" class="histogram-canvas"></canvas>

              <div class="palette-section">
                <span class="palette-label">Dominant Color Palette (Click to copy HEX):</span>
                <div class="palette-swatches">
                  <button
                    v-for="col in pixelAnalysis.dominantColors"
                    :key="col.hex"
                    class="swatch-pill"
                    @click="copyToClipboard(col.hex, `Copied ${col.hex}`)"
                  >
                    <span class="swatch-dot" :style="{ backgroundColor: col.hex }"></span>
                    <span class="swatch-hex">{{ col.hex }}</span>
                    <span class="swatch-pct">{{ col.pct }}%</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- File Cryptographic Hashes -->
            <div class="info-card">
              <div class="card-header">
                <span class="card-icon">🔏</span>
                <span class="card-title">Cryptographic Integrity Hashes</span>
              </div>
              <div class="hashes-list">
                <div class="hash-row">
                  <div class="hash-label-row">
                    <span class="hash-label">SHA-256</span>
                    <button class="btn-copy-small" @click="copyToClipboard(primaryImage.hashes.sha256, 'SHA-256 copied!')">Copy</button>
                  </div>
                  <code class="hash-val">{{ primaryImage.hashes.sha256 }}</code>
                </div>
                <div class="hash-row">
                  <div class="hash-label-row">
                    <span class="hash-label">MD5</span>
                    <button class="btn-copy-small" @click="copyToClipboard(primaryImage.hashes.md5, 'MD5 copied!')">Copy</button>
                  </div>
                  <code class="hash-val">{{ primaryImage.hashes.md5 }}</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Software & AI Prompts -->
        <div v-if="activeTab === 'software'" class="tab-pane">
          <div class="cards-grid">
            <div class="info-card full-width ai-forensic-card" :class="{ detected: primaryImage.aiProvenance.isAi }">
              <div class="card-header">
                <span class="card-icon">🔬</span>
                <span class="card-title">AI Forensic & Provenance Verification</span>
                <span v-if="primaryImage.aiProvenance.isAi" class="forensic-status-badge ai">AI DETECTED</span>
                <span
                  v-else-if="primaryImage.aiProvenance.confidence === 'AUTHENTIC_CAMERA'"
                  class="forensic-status-badge camera"
                >
                  OPTICAL CAMERA
                </span>
                <span
                  v-else-if="primaryImage.aiProvenance.confidence === 'CAMERA_EDITED'"
                  class="forensic-status-badge edited"
                >
                  CAMERA + EDITED
                </span>
                <span v-else class="forensic-status-badge unknown">NO SIGNATURES</span>
              </div>

              <div class="forensic-summary-box">
                <div class="forensic-icon-col">
                  <span class="f-big-icon">{{ primaryImage.aiProvenance.platformIcon }}</span>
                </div>
                <div class="forensic-text-col">
                  <div class="f-title-row">
                    <h4>{{ primaryImage.aiProvenance.platformName }}</h4>
                    <span class="f-conf">{{ primaryImage.aiProvenance.confidencePercent }}% Confidence</span>
                  </div>
                  <p class="f-desc">{{ primaryImage.aiProvenance.summary }}</p>
                </div>
              </div>

              <div class="forensic-indicators-grid">
                <div class="f-indicator">
                  <span class="fi-label">C2PA Manifest</span>
                  <span class="fi-val" :class="{ positive: primaryImage.aiProvenance.c2paManifestFound }">
                    {{ primaryImage.aiProvenance.c2paManifestFound ? 'Embedded (Found)' : 'None Detected' }}
                  </span>
                </div>
                <div class="f-indicator">
                  <span class="fi-label">Digital Source Type</span>
                  <span class="fi-val" :class="{ positive: Boolean(primaryImage.aiProvenance.digitalSourceType) }">
                    {{ primaryImage.aiProvenance.digitalSourceType || 'Standard Media' }}
                  </span>
                </div>
                <div class="f-indicator">
                  <span class="fi-label">Identified Platform</span>
                  <span class="fi-val highlight">{{ primaryImage.aiProvenance.platformName }}</span>
                </div>
                <div class="f-indicator">
                  <span class="fi-label">Signatures Found</span>
                  <span class="fi-val" :class="{ positive: primaryImage.aiProvenance.detectedTraces.length > 0 }">
                    {{ primaryImage.aiProvenance.detectedTraces.length }} Trace(s)
                  </span>
                </div>
              </div>

              <div v-if="primaryImage.aiProvenance.detectedTraces.length > 0" class="forensic-traces-table-wrapper">
                <span class="ft-table-title">Forensic Signature Log:</span>
                <div class="ft-rows">
                  <div v-for="(t, idx) in primaryImage.aiProvenance.detectedTraces" :key="idx" class="ft-row">
                    <span class="ft-category" :class="t.category.toLowerCase()">{{ t.category }}</span>
                    <div class="ft-content">
                      <strong class="ft-label">{{ t.label }}</strong>
                      <span class="ft-desc">{{ t.description }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="info-card">
              <div class="card-header">
                <span class="card-icon">🖥️</span>
                <span class="card-title">Editing Software & Rights</span>
              </div>
              <div class="kv-list">
                <div class="kv-row">
                  <span class="kv-key">Software Used</span>
                  <span class="kv-val highlight">{{ primaryImage.softwareAi.software || 'Not reported' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Artist / Author</span>
                  <span class="kv-val">{{ primaryImage.softwareAi.artist || 'Not specified' }}</span>
                </div>
                <div class="kv-row">
                  <span class="kv-key">Copyright</span>
                  <span class="kv-val">{{ primaryImage.softwareAi.copyright || 'Unspecified' }}</span>
                </div>
              </div>
            </div>

            <div class="info-card">
              <div class="card-header">
                <span class="card-icon">🧠</span>
                <span class="card-title">AI Generation Parameters (A1111 / ComfyUI)</span>
              </div>

              <div v-if="primaryImage.softwareAi.hasAiData" class="ai-params-block">
                <div v-if="primaryImage.softwareAi.aiPrompt" class="ai-field">
                  <div class="ai-label-row">
                    <span class="ai-label">Positive Prompt</span>
                    <button class="btn-copy-small" @click="copyToClipboard(primaryImage.softwareAi.aiPrompt || '', 'Prompt copied!')">Copy</button>
                  </div>
                  <pre class="ai-code"><code>{{ primaryImage.softwareAi.aiPrompt }}</code></pre>
                </div>

                <div v-if="primaryImage.softwareAi.aiNegativePrompt" class="ai-field">
                  <div class="ai-label-row">
                    <span class="ai-label">Negative Prompt</span>
                    <button class="btn-copy-small" @click="copyToClipboard(primaryImage.softwareAi.aiNegativePrompt || '', 'Negative prompt copied!')">Copy</button>
                  </div>
                  <pre class="ai-code neg"><code>{{ primaryImage.softwareAi.aiNegativePrompt }}</code></pre>
                </div>

                <div class="ai-chips-row">
                  <span v-if="primaryImage.softwareAi.aiEngine" class="ai-chip">Engine: {{ primaryImage.softwareAi.aiEngine }}</span>
                  <span v-if="primaryImage.softwareAi.aiModel" class="ai-chip">Model: {{ primaryImage.softwareAi.aiModel }}</span>
                  <span v-if="primaryImage.softwareAi.aiSeed" class="ai-chip">Seed: {{ primaryImage.softwareAi.aiSeed }}</span>
                  <span v-if="primaryImage.softwareAi.aiSampler" class="ai-chip">Sampler: {{ primaryImage.softwareAi.aiSampler }}</span>
                  <span v-if="primaryImage.softwareAi.aiScheduler" class="ai-chip">Scheduler: {{ primaryImage.softwareAi.aiScheduler }}</span>
                  <span v-if="primaryImage.softwareAi.aiSteps" class="ai-chip">Steps: {{ primaryImage.softwareAi.aiSteps }}</span>
                  <span v-if="primaryImage.softwareAi.aiCfg" class="ai-chip">CFG: {{ primaryImage.softwareAi.aiCfg }}</span>
                </div>

                <div v-if="primaryImage.softwareAi.aiRawWorkflow" class="ai-field">
                  <div class="ai-label-row">
                    <button class="btn-copy-small" @click="showFullWorkflowJson = !showFullWorkflowJson">
                      {{ showFullWorkflowJson ? '▲ Hide Raw ComfyUI JSON' : '▼ Inspect Full ComfyUI JSON' }}
                    </button>
                    <button class="btn-copy-small" @click="copyToClipboard(primaryImage.softwareAi.aiRawWorkflow || '', 'Workflow JSON copied!')">Copy JSON</button>
                  </div>
                  <pre v-if="showFullWorkflowJson" class="ai-code"><code>{{ primaryImage.softwareAi.aiRawWorkflow }}</code></pre>
                </div>
              </div>

              <div v-else class="empty-ai">
                <p>No Stable Diffusion / ComfyUI / Midjourney generation chunks detected in this file.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. Forensics & Binary (ELA + Embedded Thumbnail + Container Chunks) -->
        <div v-if="activeTab === 'forensics'" class="tab-pane">
          <div class="cards-grid">
            <!-- ELA Error Level Analysis -->
            <div class="info-card">
              <div class="card-header">
                <span class="card-icon">🧪</span>
                <span class="card-title">Error Level Analysis (ELA)</span>
                <button class="btn-copy-small" style="margin-left: auto" @click="refreshEla">
                  {{ isElaGenerating ? 'Computing...' : '🔄 Recompute' }}
                </button>
              </div>
              <p class="forensic-note">
                Recompresses the image at {{ elaQuality }}% JPEG and amplifies compression differences ({{ elaAmp }}×) to reveal spliced or edited regions.
              </p>

              <div class="ela-controls">
                <label>
                  <span>Quality: {{ elaQuality }}%</span>
                  <input v-model.number="elaQuality" type="range" min="50" max="95" @change="refreshEla" />
                </label>
                <label>
                  <span>Gain: {{ elaAmp }}×</span>
                  <input v-model.number="elaAmp" type="range" min="5" max="35" @change="refreshEla" />
                </label>
              </div>

              <div class="ela-preview-box">
                <img v-if="elaUrl" :src="elaUrl" alt="ELA Analysis Heatmap" class="ela-img" />
                <span v-else class="empty-hint">
                  {{ primaryImage.previewSupported ? 'Click Recompute to run ELA' : 'Format not decodable by browser canvas' }}
                </span>
              </div>
            </div>

            <!-- Embedded EXIF Thumbnail -->
            <div class="info-card">
              <div class="card-header">
                <span class="card-icon">🖼️</span>
                <span class="card-title">Embedded EXIF Thumbnail</span>
                <span
                  class="forensic-status-badge"
                  :class="primaryImage.embeddedThumbnail ? 'ai' : 'camera'"
                >
                  {{ primaryImage.embeddedThumbnail ? 'HIDDEN THUMB FOUND' : 'NONE' }}
                </span>
              </div>

              <div v-if="primaryImage.embeddedThumbnail" class="thumb-forensic-box">
                <p class="forensic-note">
                  Compare this embedded thumbnail against the main image. Edited or cropped photos sometimes leak the uncropped original here!
                </p>
                <div class="thumb-compare-pair">
                  <div>
                    <span class="pair-label">Main Image</span>
                    <img v-if="primaryImage.previewSupported" :src="primaryImage.dataUrl" class="pair-img" />
                  </div>
                  <div>
                    <span class="pair-label">
                      EXIF Thumbnail ({{ formatFileSize(primaryImage.embeddedThumbnail.sizeBytes) }})
                    </span>
                    <img :src="primaryImage.embeddedThumbnail.dataUrl" class="pair-img" />
                  </div>
                </div>
              </div>
              <div v-else class="empty-ai">
                <p>No embedded EXIF thumbnail found inside this file.</p>
              </div>
            </div>

            <!-- Container Binary Segments / Chunks -->
            <div class="info-card full-width">
              <div class="card-header">
                <span class="card-icon">🧱</span>
                <span class="card-title">Binary Container Segments & Chunks ({{ primaryImage.binarySegments.length }})</span>
                <span class="mismatch-pill" v-if="metadataSegmentsCount > 0">
                  {{ metadataSegmentsCount }} Metadata Segment(s)
                </span>
              </div>

              <div v-if="primaryImage.binarySegments.length > 0" class="tags-table-container">
                <table class="tags-table">
                  <thead>
                    <tr>
                      <th>Offset</th>
                      <th>Segment / Chunk</th>
                      <th>Size</th>
                      <th>Type</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(seg, idx) in primaryImage.binarySegments" :key="idx" class="tag-row">
                      <td class="cell-nowrap"><code>0x{{ seg.offset.toString(16).toUpperCase().padStart(6, '0') }}</code></td>
                      <td class="tag-name"><code>{{ seg.name }}</code></td>
                      <td class="cell-nowrap">{{ formatFileSize(seg.size) }}</td>
                      <td>
                        <span class="tag-cat-badge" :class="seg.isMetadata ? 'iptc' : 'exif'">
                          {{ seg.isMetadata ? 'METADATA' : 'MEDIA' }}
                        </span>
                      </td>
                      <td class="tag-value">{{ seg.description }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="empty-ai">
                <p>Binary chunk inspection is currently available for JPEG, PNG, and WebP containers.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 6. Raw Tags Explorer -->
        <div v-if="activeTab === 'raw'" class="tab-pane">
          <div class="raw-filter-bar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search by tag name or value (e.g. ISO, Date, Lens, prompt)..."
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
                  <td class="tag-name"><code>{{ tag.name }}</code></td>
                  <td>
                    <span class="tag-cat-badge" :class="tag.category.toLowerCase()">{{ tag.category }}</span>
                  </td>
                  <td class="tag-value" @click="copyToClipboard(tag.value, `Copied ${tag.name}!`)">
                    <span class="val-text" :title="tag.value">{{ tag.value }}</span>
                    <span class="copy-hint">Copy</span>
                  </td>
                </tr>

                <tr v-if="filteredRawTags.length === 0">
                  <td colspan="3" class="no-tags-row">No tags matching search query.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 7. Side-by-Side Image Compare -->
        <div v-if="activeTab === 'compare'" class="tab-pane">
          <div v-if="!compareImage" class="empty-state-box">
            <span class="empty-icon">⚖️</span>
            <h3>Compare Two Images Side-by-Side</h3>
            <p>
              Load a second image (e.g. original vs WhatsApp-compressed, or click "Strip & Verify" above) to compare file sizes, AI provenance, and exact EXIF tag differences.
            </p>
            <button class="btn-upload" style="margin-top: 14px" @click="compareInputRef?.click()">
              <span>📁</span> Select 2nd Image (Image B)
            </button>
          </div>

          <div v-else class="compare-layout">
            <div class="compare-cards">
              <div class="info-card">
                <div class="card-header">
                  <span class="card-title">Image A: {{ primaryImage.name }}</span>
                </div>
                <div class="kv-list">
                  <div class="kv-row"><span class="kv-key">Size</span><span class="kv-val">{{ formatFileSize(primaryImage.size) }}</span></div>
                  <div class="kv-row"><span class="kv-key">Tags</span><span class="kv-val">{{ primaryImage.rawTags.length }}</span></div>
                  <div class="kv-row"><span class="kv-key">Privacy Risk</span><span class="kv-val">{{ primaryImage.privacyAudit.riskLevel }} ({{ primaryImage.privacyAudit.score }})</span></div>
                  <div class="kv-row"><span class="kv-key">GPS</span><span class="kv-val">{{ primaryImage.gps.hasGps ? 'Exposed' : 'None' }}</span></div>
                </div>
              </div>

              <div class="info-card">
                <div class="card-header">
                  <span class="card-title">Image B: {{ compareImage.name }}</span>
                  <button class="btn-copy-small" style="margin-left: auto" @click="compareInputRef?.click()">Swap</button>
                </div>
                <div class="kv-list">
                  <div class="kv-row"><span class="kv-key">Size</span><span class="kv-val">{{ formatFileSize(compareImage.size) }}</span></div>
                  <div class="kv-row"><span class="kv-key">Tags</span><span class="kv-val">{{ compareImage.rawTags.length }}</span></div>
                  <div class="kv-row"><span class="kv-key">Privacy Risk</span><span class="kv-val">{{ compareImage.privacyAudit.riskLevel }} ({{ compareImage.privacyAudit.score }})</span></div>
                  <div class="kv-row"><span class="kv-key">GPS</span><span class="kv-val">{{ compareImage.gps.hasGps ? 'Exposed' : 'None' }}</span></div>
                </div>
              </div>
            </div>

            <div class="info-card full-width" style="margin-top: 16px">
              <div class="card-header">
                <span class="card-icon">🔍</span>
                <span class="card-title">Metadata Tag Diff ({{ compareTagDiff.length }} differences)</span>
              </div>
              <div class="tags-table-container">
                <table class="tags-table">
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>Status</th>
                      <th>Image A</th>
                      <th>Image B</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in compareTagDiff" :key="row.name" class="tag-row">
                      <td class="tag-name"><code>{{ row.name }}</code></td>
                      <td>
                        <span class="diff-badge" :class="row.status.toLowerCase()">{{ row.status }}</span>
                      </td>
                      <td class="tag-value">{{ row.valA }}</td>
                      <td class="tag-value">{{ row.valB }}</td>
                    </tr>
                    <tr v-if="compareTagDiff.length === 0">
                      <td colspan="4" class="no-tags-row">Both images contain identical metadata tags.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metalens-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1220px;
  margin: 0 auto;
  padding-bottom: 24px;
  position: relative;
  min-height: 480px;
}

.drag-replace-overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 14, 23, 0.88);
  backdrop-filter: blur(8px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 2px dashed #ff1e42;
  pointer-events: none;
}

.replace-overlay-card {
  text-align: center;
  background: #0f1420;
  border: 1px solid rgba(255, 30, 66, 0.4);
  padding: 32px 48px;
  border-radius: 12px;
}

.replace-overlay-icon { font-size: 3rem; display: block; margin-bottom: 12px; }
.replace-overlay-card h3 { margin: 0 0 6px; font-size: 1.2rem; color: #f8fafc; }
.replace-overlay-card p { margin: 0; font-size: 0.85rem; color: #94a3b8; }

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

.header-left { display: flex; flex-direction: column; gap: 4px; }
.metalens-title { margin: 0; font-size: 1.3rem; font-weight: 800; color: #f8fafc; }
.metalens-desc { font-size: 0.8rem; color: #94a3b8; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.btn-replace-header, .btn-clear {
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

.btn-replace-header {
  background: rgba(0, 240, 255, 0.12);
  border: 1px solid rgba(0, 240, 255, 0.35);
  color: #00f0ff;
}

.btn-replace-header:hover { background: #00f0ff; color: #090d16; }

.btn-clear { background: #141b2b; border: 1px solid #23304a; color: #cbd5e1; }
.btn-clear:hover { border-color: #ef4444; color: #ef4444; }

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

.hidden-input { display: none; }
.dropzone-icon { font-size: 3.5rem; margin-bottom: 12px; }
.dropzone-title { margin: 0 0 6px; font-size: 1.2rem; font-weight: 700; color: #f8fafc; }
.dropzone-subtitle { margin: 0 0 20px; font-size: 0.85rem; color: #64748b; max-width: 540px; }
.dropzone-actions { display: flex; gap: 12px; margin-bottom: 20px; }

.btn-upload {
  padding: 10px 18px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  background: #ff1e42;
  border: none;
  color: #ffffff;
}

.btn-upload:hover { background: #e01638; }
.dropzone-tip { display: flex; align-items: center; gap: 6px; font-size: 0.76rem; color: #64748b; }
.dropzone-tip code { background: #141b2b; border: 1px solid #23304a; padding: 2px 6px; border-radius: 4px; color: #ff1e42; }

.metalens-workspace { display: flex; flex-direction: column; gap: 14px; }

.image-banner {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 16px;
  background: #0f1420;
  border: 1px solid #1c2638;
  border-radius: 10px;
  flex-wrap: wrap;
}

.banner-preview {
  width: 88px;
  height: 88px;
  border-radius: 8px;
  overflow: hidden;
  background: #090c12;
  border: 1px solid #23304a;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumb-img { width: 100%; height: 100%; object-fit: cover; }
.unsupported-thumb { font-family: monospace; font-weight: 800; color: #94a3b8; font-size: 0.9rem; }

.banner-meta { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 8px; }
.banner-top-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.file-name { margin: 0; font-size: 1.05rem; font-weight: 700; color: #f8fafc; word-break: break-all; }

.mime-badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 6px;
  background: rgba(0, 240, 255, 0.15);
  border: 1px solid rgba(0, 240, 255, 0.3);
  color: #00f0ff;
  border-radius: 4px;
}

.privacy-pill {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}
.privacy-pill.high { background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; }
.privacy-pill.medium { background: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color: #fcd34d; }
.privacy-pill.low { background: rgba(59, 130, 246, 0.2); border: 1px solid #3b82f6; color: #93c5fd; }
.privacy-pill.clean { background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #6ee7b7; }

.top-provenance-badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}
.top-provenance-badge.ai { background: rgba(255, 30, 66, 0.18); border: 1px solid #ff1e42; color: #ff4d6d; }
.top-provenance-badge.camera { background: rgba(16, 185, 129, 0.18); border: 1px solid #10b981; color: #34d399; }
.top-provenance-badge.edited { background: rgba(245, 158, 11, 0.18); border: 1px solid #f59e0b; color: #fbbf24; }

.specs-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.spec-pill { display: flex; flex-direction: column; padding: 4px 8px; background: #141b2b; border: 1px solid #1c2638; border-radius: 4px; }
.pill-label { font-size: 0.6rem; font-weight: 700; color: #64748b; letter-spacing: 0.05em; }
.pill-val { font-size: 0.78rem; font-weight: 600; color: #cbd5e1; }

.banner-actions { display: flex; gap: 6px; flex-wrap: wrap; }

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 11px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  background: #141b2b;
  border: 1px solid #23304a;
  color: #cbd5e1;
  transition: all 0.2s;
}
.btn-action:hover { border-color: #ff1e42; color: #ffffff; }
.btn-action.primary { background: #ff1e42; border-color: #ff1e42; color: #ffffff; }
.btn-action.primary:hover { background: #e01638; }

/* Privacy & Sanitizer Bar */
.privacy-sanitizer-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  padding: 14px 16px;
  background: #0f1420;
  border: 1px solid #1c2638;
  border-left: 4px solid #10b981;
  border-radius: 10px;
}
.privacy-sanitizer-bar.high { border-left-color: #ef4444; }
.privacy-sanitizer-bar.medium { border-left-color: #f59e0b; }
.privacy-sanitizer-bar.low { border-left-color: #3b82f6; }

.privacy-summary-col { flex: 1; min-width: 260px; display: flex; flex-direction: column; gap: 8px; }
.privacy-heading { font-size: 0.85rem; font-weight: 700; color: #f8fafc; }
.findings-chips { display: flex; gap: 6px; flex-wrap: wrap; }

.finding-chip {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  background: #141b2b;
  border: 1px solid #23304a;
  color: #cbd5e1;
}
.finding-chip.high { border-color: rgba(239, 68, 68, 0.5); color: #fca5a5; }
.finding-chip.medium { border-color: rgba(245, 158, 11, 0.5); color: #fcd34d; }

.sanitizer-controls-col { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.sanitizer-options { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sanitizer-btns { display: flex; gap: 6px; flex-wrap: wrap; }
.mini-select {
  background: #141b2b;
  border: 1px solid #23304a;
  color: #e2e8f0;
  font-size: 0.74rem;
  padding: 4px 8px;
  border-radius: 5px;
}
.mini-range { width: 70px; accent-color: #ff1e42; }
.clean-stats-hint { font-family: monospace; font-size: 0.7rem; color: #34d399; }

/* Tabs */
.metalens-tabs { display: flex; flex-wrap: wrap; gap: 4px 6px; border-bottom: 1px solid #1c2638; }
.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 11px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.tab-btn:hover { color: #cbd5e1; }
.tab-btn.active { color: #ff1e42; border-bottom-color: #ff1e42; background: rgba(255, 30, 66, 0.05); }

.tab-chip { font-size: 0.6rem; padding: 1px 5px; border-radius: 4px; font-weight: 700; }
.tab-chip.green { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.tab-chip.cyan { background: rgba(0, 240, 255, 0.2); color: #00f0ff; }
.tab-chip.red { background: rgba(255, 30, 66, 0.2); color: #ff4d6d; }

.warning-callout {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 8px;
  color: #fcd34d;
  font-size: 0.82rem;
}

.cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; }
.info-card { background: #0f1420; border: 1px solid #1c2638; border-radius: 10px; padding: 16px; }
.info-card.full-width { grid-column: 1 / -1; }

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid #1c2638;
  margin-bottom: 12px;
}
.card-title { font-size: 0.95rem; font-weight: 700; color: #f8fafc; }

.mismatch-pill {
  margin-left: auto;
  font-size: 0.68rem;
  font-weight: 700;
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.35);
  padding: 2px 8px;
  border-radius: 4px;
}

.kv-list { display: flex; flex-direction: column; gap: 8px; }
.kv-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; padding: 4px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.03); }
.kv-key { color: #64748b; }
.kv-val { color: #cbd5e1; font-weight: 500; text-align: right; }
.kv-val.highlight { color: #f8fafc; font-weight: 700; }
.kv-val.code { font-family: monospace; color: #38bdf8; }
.warn-text { color: #fca5a5 !important; }
.sub-val { color: #64748b; font-size: 0.75rem; margin-left: 4px; }
.badge-f { color: #10b981; font-family: monospace; font-weight: 700; }
.badge-shutter { color: #f59e0b; font-family: monospace; font-weight: 700; }
.badge-iso { color: #ff1e42; font-family: monospace; font-weight: 700; }

/* GPS */
.gps-card { background: #0f1420; border: 1px solid #1c2638; border-radius: 10px; padding: 20px; }
.gps-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #1c2638; margin-bottom: 16px; }
.gps-status { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; font-weight: 700; color: #10b981; }
.ping-circle { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; }
.gps-coords-badge { font-family: monospace; font-size: 0.92rem; font-weight: 700; color: #38bdf8; background: #141b2b; padding: 4px 10px; border-radius: 6px; border: 1px solid #23304a; }
.gps-details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 18px; }
.gps-item { display: flex; flex-direction: column; padding: 10px; background: #141b2b; border: 1px solid #1c2638; border-radius: 6px; }
.gps-label { font-size: 0.65rem; font-weight: 700; color: #64748b; letter-spacing: 0.05em; }
.gps-val { font-size: 0.88rem; font-weight: 600; color: #cbd5e1; font-family: monospace; margin-top: 4px; }
.gps-sub { font-size: 0.72rem; color: #38bdf8; font-family: monospace; margin-top: 2px; }
.gps-actions-bar { display: flex; gap: 10px; flex-wrap: wrap; }
.map-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 6px; font-size: 0.82rem; font-weight: 600; text-decoration: none; cursor: pointer; }
.map-btn.google { background: rgba(66, 133, 244, 0.15); border: 1px solid rgba(66, 133, 244, 0.4); color: #60a5fa; }
.map-btn.osm { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; }
.map-btn.copy { background: #141b2b; border: 1px solid #23304a; color: #cbd5e1; }
.osm-embed-box { margin-top: 16px; border-radius: 8px; overflow: hidden; border: 1px solid #23304a; }
.osm-iframe { width: 100%; height: 280px; border: none; display: block; }

.empty-state-box { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; background: #0f1420; border: 1px solid #1c2638; border-radius: 10px; text-align: center; }
.empty-icon { font-size: 2.5rem; margin-bottom: 12px; }
.empty-state-box h3 { margin: 0 0 8px; color: #f8fafc; }
.empty-state-box p { margin: 0; color: #64748b; font-size: 0.85rem; max-width: 520px; }

/* Specs & Histogram & Hashes */
.specs-matrix { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
.matrix-cell { display: flex; flex-direction: column; padding: 10px; background: #141b2b; border: 1px solid #1c2638; border-radius: 6px; }
.m-label { font-size: 0.65rem; font-weight: 700; color: #64748b; letter-spacing: 0.05em; }
.m-val { font-size: 0.9rem; font-weight: 600; color: #cbd5e1; margin-top: 4px; }
.m-val.highlight { color: #ff1e42; font-weight: 700; }

.hist-toggles { display: flex; gap: 4px; margin-left: auto; }
.hist-btn { padding: 2px 8px; font-size: 0.68rem; font-weight: 700; border-radius: 4px; background: #141b2b; border: 1px solid #23304a; color: #64748b; cursor: pointer; }
.hist-btn.active { border-color: #f8fafc; color: #f8fafc; }
.hist-btn.r.active { border-color: #ff3b5c; color: #ff3b5c; }
.hist-btn.g.active { border-color: #10b981; color: #10b981; }
.hist-btn.b.active { border-color: #38bdf8; color: #38bdf8; }

.histogram-canvas { width: 100%; height: 150px; border-radius: 6px; border: 1px solid #1c2638; display: block; margin-bottom: 12px; }
.palette-section { display: flex; flex-direction: column; gap: 6px; }
.palette-label { font-size: 0.72rem; color: #94a3b8; font-weight: 600; }
.palette-swatches { display: flex; gap: 6px; flex-wrap: wrap; }
.swatch-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; background: #141b2b; border: 1px solid #23304a; border-radius: 6px; cursor: pointer; font-family: monospace; font-size: 0.72rem; color: #e2e8f0; }
.swatch-pill:hover { border-color: #ff1e42; }
.swatch-dot { width: 12px; height: 12px; border-radius: 3px; border: 1px solid rgba(255, 255, 255, 0.25); }
.swatch-pct { color: #64748b; font-size: 0.66rem; }

.hashes-list { display: flex; flex-direction: column; gap: 12px; }
.hash-row { background: #090c12; border: 1px solid #1c2638; border-radius: 6px; padding: 10px; }
.hash-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.hash-label { font-size: 0.7rem; font-weight: 700; color: #94a3b8; }
.hash-val { font-size: 0.74rem; color: #38bdf8; word-break: break-all; display: block; }

/* AI & Forensics */
.ai-forensic-card.detected { border-color: rgba(255, 30, 66, 0.4); }
.forensic-status-badge { margin-left: auto; font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
.forensic-status-badge.ai { background: rgba(255, 30, 66, 0.2); color: #ff4d6d; border: 1px solid #ff1e42; }
.forensic-status-badge.camera { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981; }
.forensic-status-badge.edited { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #f59e0b; }
.forensic-status-badge.unknown { background: #1c2638; color: #94a3b8; border: 1px solid #2d3b55; }

.forensic-summary-box { display: flex; align-items: center; gap: 16px; padding: 14px; background: #141b2b; border: 1px solid #1c2638; border-radius: 8px; margin-bottom: 14px; }
.f-big-icon { font-size: 2.2rem; }
.forensic-text-col { flex: 1; }
.f-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; flex-wrap: wrap; }
.f-title-row h4 { margin: 0; font-size: 1.05rem; font-weight: 800; color: #f8fafc; }
.f-conf { font-size: 0.72rem; font-weight: 700; color: #00f0ff; background: rgba(0, 240, 255, 0.1); padding: 2px 6px; border-radius: 4px; }
.f-desc { margin: 0; font-size: 0.8rem; color: #94a3b8; line-height: 1.4; }

.forensic-indicators-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 14px; }
.f-indicator { display: flex; flex-direction: column; gap: 4px; padding: 10px; background: #090c12; border: 1px solid #1c2638; border-radius: 6px; }
.fi-label { font-size: 0.65rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
.fi-val { font-size: 0.82rem; font-weight: 600; color: #cbd5e1; word-break: break-all; }
.fi-val.positive { color: #00f0ff; }
.fi-val.highlight { color: #ff4d6d; }

.forensic-traces-table-wrapper { display: flex; flex-direction: column; gap: 8px; background: #090c12; border: 1px solid #1c2638; border-radius: 8px; padding: 12px; }
.ft-table-title { font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
.ft-rows { display: flex; flex-direction: column; gap: 8px; }
.ft-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px 10px; background: #141b2b; border: 1px solid #1c2638; border-radius: 6px; }
.ft-category { font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
.ft-category.c2pa { background: rgba(0, 240, 255, 0.15); color: #00f0ff; }
.ft-category.iptc { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
.ft-category.exif { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.ft-category.watermark { background: rgba(255, 30, 66, 0.15); color: #ff4d6d; }
.ft-category.chunk { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.ft-content { display: flex; flex-direction: column; gap: 2px; }
.ft-label { font-size: 0.78rem; color: #f8fafc; }
.ft-desc { font-size: 0.72rem; color: #94a3b8; }

.ai-params-block { display: flex; flex-direction: column; gap: 12px; }
.ai-field { display: flex; flex-direction: column; gap: 4px; }
.ai-label-row { display: flex; justify-content: space-between; align-items: center; }
.ai-label { font-size: 0.72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
.btn-copy-small { background: transparent; border: none; color: #00f0ff; font-size: 0.72rem; cursor: pointer; }
.btn-copy-small:hover { text-decoration: underline; }
.ai-code { margin: 0; padding: 8px 10px; background: #090c12; border: 1px solid #1c2638; border-radius: 6px; color: #38bdf8; font-size: 0.76rem; white-space: pre-wrap; word-break: break-all; max-height: 220px; overflow-y: auto; }
.ai-code.neg { color: #f87171; }
.ai-chips-row { display: flex; gap: 6px; flex-wrap: wrap; }
.ai-chip { padding: 2px 8px; background: #141b2b; border: 1px solid #23304a; border-radius: 4px; font-size: 0.7rem; color: #cbd5e1; }
.empty-ai { font-size: 0.8rem; color: #64748b; padding: 12px 0; }

/* Forensics ELA & Embedded Thumb */
.forensic-note { font-size: 0.76rem; color: #94a3b8; margin-bottom: 10px; line-height: 1.45; }
.ela-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; font-size: 0.74rem; color: #cbd5e1; }
.ela-controls label { display: flex; flex-direction: column; gap: 4px; }
.ela-preview-box { background: #07090f; border: 1px solid #1c2638; border-radius: 8px; min-height: 180px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.ela-img { max-width: 100%; max-height: 280px; object-fit: contain; display: block; }

.thumb-compare-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pair-label { display: block; font-size: 0.68rem; color: #94a3b8; margin-bottom: 4px; font-weight: 600; }
.pair-img { width: 100%; max-height: 200px; object-fit: contain; border-radius: 6px; border: 1px solid #23304a; background: #07090f; }

/* Raw Explorer & Compare */
.raw-filter-bar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.search-box { display: flex; align-items: center; gap: 8px; background: #0f1420; border: 1px solid #1c2638; border-radius: 8px; padding: 8px 12px; }
.search-box input { flex: 1; background: transparent; border: none; outline: none; color: #f8fafc; font-size: 0.85rem; }
.category-pills { display: flex; gap: 6px; flex-wrap: wrap; }
.cat-pill { padding: 4px 10px; background: #141b2b; border: 1px solid #1c2638; border-radius: 12px; color: #64748b; font-size: 0.72rem; font-weight: 700; cursor: pointer; }
.cat-pill:hover, .cat-pill.active { background: rgba(255, 30, 66, 0.15); border-color: #ff1e42; color: #ffffff; }

.tags-table-container { background: #0f1420; border: 1px solid #1c2638; border-radius: 10px; overflow: auto; max-height: 500px; }
.tags-table { width: 100%; border-collapse: collapse; text-align: left; }
.tags-table th { padding: 10px 14px; background: #141b2b; color: #94a3b8; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; white-space: nowrap; position: sticky; top: 0; z-index: 2; }
.tag-row { border-bottom: 1px solid #1c2638; }
.tag-row:hover { background: #141b2b; }
.tags-table td { padding: 8px 14px; font-size: 0.76rem; }
.cell-nowrap,
.tag-name { white-space: nowrap; }
.tag-name code { color: #ff4d6d; }
.tag-cat-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; background: #23304a; color: #cbd5e1; }
.tag-cat-badge.exif { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
.tag-cat-badge.iptc { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
.tag-cat-badge.xmp { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
.tag-cat-badge.pngtext { background: rgba(0, 240, 255, 0.2); color: #00f0ff; }

.tag-value { color: #cbd5e1; overflow-wrap: anywhere; word-break: normal; cursor: pointer; }
.copy-hint { display: none; font-size: 0.65rem; color: #00f0ff; margin-left: 8px; }
.tag-value:hover .copy-hint { display: inline; }
.no-tags-row { text-align: center; color: #64748b; padding: 32px; }

.compare-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.diff-badge { font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
.diff-badge.removed { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
.diff-badge.added { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
.diff-badge.changed { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
.empty-hint { font-size: 0.8rem; color: #64748b; }
</style>
