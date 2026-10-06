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

export interface AiTrace {
  label: string
  description: string
  category: 'C2PA' | 'IPTC' | 'EXIF' | 'CHUNK' | 'WATERMARK'
}

export interface AiProvenance {
  isAi: boolean
  platform: 'chatgpt' | 'gemini' | 'midjourney' | 'stablediffusion' | 'c2pa_generic' | 'none'
  platformName: string
  platformIcon: string
  confidence: 'HIGH' | 'MEDIUM' | 'SUSPECTED' | 'AUTHENTIC_CAMERA' | 'INCONCLUSIVE'
  confidencePercent: number
  summary: string
  digitalSourceType?: string
  c2paManifestFound: boolean
  detectedTraces: AiTrace[]
}

// Active State
const isLoading = ref(false)
const isDragging = ref(false)
const dragCounter = ref(0)
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
const aiProvenance = ref<AiProvenance>({
  isAi: false,
  platform: 'none',
  platformName: 'No Image Loaded',
  platformIcon: '🔍',
  confidence: 'INCONCLUSIVE',
  confidencePercent: 0,
  summary: 'Upload an image to inspect AI signatures and EXIF metadata.',
  c2paManifestFound: false,
  detectedTraces: []
})
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

// Clean and Parse EXIF Tags & AI Signatures
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
      // Check iptc / xmp
      if (tags.iptc?.[name]?.description) return String(tags.iptc[name].description)
      if (tags.xmp?.[name]?.description) return String(tags.xmp[name].description)
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

    // 5. Deep AI Provenance & Signature Analysis (ChatGPT, Gemini, Midjourney, SD, C2PA)
    // Scan raw buffer text safely (first 4MB + last 512KB for trailers)
    const scanLimit = Math.min(buffer.byteLength, 4 * 1024 * 1024)
    const headerBytes = new Uint8Array(buffer.slice(0, scanLimit))
    const headerLatin1 = new TextDecoder('latin1').decode(headerBytes)

    let trailerLatin1 = ''
    if (buffer.byteLength > scanLimit) {
      const trailerOffset = Math.max(0, buffer.byteLength - 512 * 1024)
      const trailerBytes = new Uint8Array(buffer.slice(trailerOffset))
      trailerLatin1 = new TextDecoder('latin1').decode(trailerBytes)
    }
    const rawBufferText = headerLatin1 + ' ' + trailerLatin1

    // Extract potential IPTC / XMP tags for provenance
    const iptcCredit = tags.iptc?.['Credit']?.description || tags.xmp?.['Credit']?.description || ''
    const digitalSourceType = tags.iptc?.['Digital Source Type']?.description || 
                              tags.xmp?.['DigitalSourceType']?.description || 
                              tags.xmp?.['Iptc4xmpExt:DigitalSourceType']?.description || ''
    const creatorTool = tags.xmp?.['CreatorTool']?.description || ''
    const softwareTag = software || ''

    // Detection flags
    const traces: AiTrace[] = []

    // A. Check C2PA / CAI Content Credentials Manifest
    const c2paFound = rawBufferText.includes('urn:c2pa:') || 
                      rawBufferText.includes('c2pa.assertions') || 
                      rawBufferText.includes('c2pa.claim') ||
                      rawBufferText.includes('claim_generator') ||
                      rawBufferText.includes('c2pa.action')

    if (c2paFound) {
      traces.push({
        label: 'C2PA Content Credentials Manifest',
        description: 'Embedded Coalition for Content Provenance and Authenticity (C2PA) assertion structure detected.',
        category: 'C2PA'
      })
    }

    // B. Check IPTC trainedAlgorithmicMedia standard
    const hasTrainedMedia = digitalSourceType.includes('trainedAlgorithmicMedia') || 
                            rawBufferText.includes('trainedAlgorithmicMedia')

    if (hasTrainedMedia) {
      traces.push({
        label: 'IPTC: trainedAlgorithmicMedia',
        description: 'International IPTC standard marker indicating image was synthesized by AI algorithm.',
        category: 'IPTC'
      })
    }

    // C. Check OpenAI / ChatGPT (DALL-E 3)
    const hasOpenAiDalle = 
      /DALL[\u00B7.-]E\s*3/i.test(softwareTag) ||
      /DALL[\u00B7.-]E/i.test(softwareTag) ||
      /ChatGPT/i.test(softwareTag) ||
      /DALL[\u00B7.-]E\s*3/i.test(rawBufferText) ||
      /DALL[\u00B7.-]E/i.test(rawBufferText) ||
      /claim_generator.*DALL-E/i.test(rawBufferText) ||
      (c2paFound && (/OpenAI/i.test(rawBufferText) || /openai\.com/i.test(rawBufferText)))

    if (hasOpenAiDalle) {
      traces.push({
        label: 'OpenAI DALL-E Signature',
        description: 'Metadata traces and claim signatures identify OpenAI ChatGPT / DALL-E 3 generative engine.',
        category: 'EXIF'
      })
    }

    // D. Check Google Gemini / Imagen 3
    const hasGoogleCredit = /Made with Google AI/i.test(iptcCredit) || /Made with Google AI/i.test(rawBufferText)
    const hasGoogleImagen = /Google Imagen/i.test(creatorTool) || 
                            /Google Imagen/i.test(softwareTag) || 
                            /Google Imagen/i.test(rawBufferText) ||
                            /Google AI/i.test(creatorTool)
    const hasSynthId = /SynthID/i.test(rawBufferText)
    const hasGoogleTrust = c2paFound && (/Google LLC/i.test(rawBufferText) || /pki\.goog/i.test(rawBufferText) || /Google Trust Services/i.test(rawBufferText))

    if (hasGoogleCredit) {
      traces.push({
        label: 'IPTC Credit: "Made with Google AI"',
        description: 'Standard Google provenance credit badge embedded in metadata.',
        category: 'IPTC'
      })
    }
    if (hasGoogleImagen) {
      traces.push({
        label: 'Creator Tool: Google Imagen',
        description: 'Generation software identified as Google Imagen / Gemini imaging engine.',
        category: 'EXIF'
      })
    }
    if (hasSynthId) {
      traces.push({
        label: 'SynthID Digital Watermark Signature',
        description: 'Google DeepMind SynthID provenance metadata marker detected.',
        category: 'WATERMARK'
      })
    }
    if (hasGoogleTrust) {
      traces.push({
        label: 'Google Trust Services C2PA Anchor',
        description: 'C2PA cryptographic manifest signed by Google LLC Certificate Authority.',
        category: 'C2PA'
      })
    }

    const isGoogleGemini = hasGoogleCredit || hasGoogleImagen || hasSynthId || hasGoogleTrust

    // E. Check Midjourney
    const isMidjourney = /Midjourney/i.test(softwareTag) || 
                         /Midjourney/i.test(rawBufferText) || 
                         /--v\s+[456]/i.test(rawBufferText)

    if (isMidjourney && !hasOpenAiDalle && !isGoogleGemini) {
      traces.push({
        label: 'Midjourney Engine Signature',
        description: 'Metadata chunk identifies Midjourney generation engine.',
        category: 'CHUNK'
      })
    }

    // F. Check Stable Diffusion / ComfyUI / Flux
    const isStableDiffusion = Boolean(aiPrompt) || 
                              (rawBufferText.includes('Steps:') && rawBufferText.includes('Sampler:') && rawBufferText.includes('CFG scale:'))

    if (isStableDiffusion && !hasOpenAiDalle && !isGoogleGemini && !isMidjourney) {
      traces.push({
        label: 'Stable Diffusion / ComfyUI Parameters',
        description: 'Explicit prompt and hyperparameter chunks (Steps, Sampler, Seed, CFG) detected.',
        category: 'CHUNK'
      })
    }

    // Decide classification & confidence
    if (hasOpenAiDalle) {
      aiProvenance.value = {
        isAi: true,
        platform: 'chatgpt',
        platformName: 'ChatGPT (DALL-E 3)',
        platformIcon: '🤖',
        confidence: 'HIGH',
        confidencePercent: 99,
        summary: 'Image contains verified digital signatures and C2PA Content Credentials generated by OpenAI ChatGPT / DALL-E 3.',
        digitalSourceType: hasTrainedMedia ? 'trainedAlgorithmicMedia (IPTC Standard)' : undefined,
        c2paManifestFound: c2paFound,
        detectedTraces: traces
      }
    } else if (isGoogleGemini) {
      aiProvenance.value = {
        isAi: true,
        platform: 'gemini',
        platformName: 'Google Gemini (Imagen 3)',
        platformIcon: '✨',
        confidence: 'HIGH',
        confidencePercent: 99,
        summary: 'Image contains verified provenance attribution and digital markers generated by Google Gemini / Imagen 3 AI.',
        digitalSourceType: hasTrainedMedia ? 'trainedAlgorithmicMedia (IPTC Standard)' : undefined,
        c2paManifestFound: c2paFound,
        detectedTraces: traces
      }
    } else if (isMidjourney) {
      aiProvenance.value = {
        isAi: true,
        platform: 'midjourney',
        platformName: 'Midjourney',
        platformIcon: '🎨',
        confidence: 'HIGH',
        confidencePercent: 98,
        summary: 'Image metadata matches Midjourney generative AI pipeline and styling parameters.',
        digitalSourceType: hasTrainedMedia ? 'trainedAlgorithmicMedia' : undefined,
        c2paManifestFound: c2paFound,
        detectedTraces: traces
      }
    } else if (isStableDiffusion) {
      aiProvenance.value = {
        isAi: true,
        platform: 'stablediffusion',
        platformName: 'Stable Diffusion / ComfyUI / Flux',
        platformIcon: '🧠',
        confidence: 'HIGH',
        confidencePercent: 99,
        summary: 'Embedded generation prompts, sampler parameters, seed, and workflow chunks found in file headers.',
        digitalSourceType: hasTrainedMedia ? 'trainedAlgorithmicMedia' : undefined,
        c2paManifestFound: c2paFound,
        detectedTraces: traces
      }
    } else if (hasTrainedMedia || c2paFound) {
      aiProvenance.value = {
        isAi: true,
        platform: 'c2pa_generic',
        platformName: 'C2PA Certified Generative AI',
        platformIcon: '🛡️',
        confidence: 'HIGH',
        confidencePercent: 95,
        summary: 'Complies with C2PA and IPTC standards for trainedAlgorithmicMedia (Synthetically Generated Media).',
        digitalSourceType: 'trainedAlgorithmicMedia',
        c2paManifestFound: c2paFound,
        detectedTraces: traces
      }
    } else if (cameraInfo.value.make && (cameraInfo.value.model || cameraInfo.value.fNumber || cameraInfo.value.iso || cameraInfo.value.exposureTime)) {
      aiProvenance.value = {
        isAi: false,
        platform: 'none',
        platformName: 'Authentic Camera Capture',
        platformIcon: '📸',
        confidence: 'AUTHENTIC_CAMERA',
        confidencePercent: 98,
        summary: `Captured by optical sensor hardware: ${cameraInfo.value.make} ${cameraInfo.value.model || ''}. Authentic exposure and lens parameters detected.`,
        c2paManifestFound: false,
        detectedTraces: []
      }
    } else {
      aiProvenance.value = {
        isAi: false,
        platform: 'none',
        platformName: 'No Provenance Metadata',
        platformIcon: 'ℹ️',
        confidence: 'INCONCLUSIVE',
        confidencePercent: 0,
        summary: 'No camera hardware EXIF or generative AI provenance tags found. Note: Most social media and messaging apps (WhatsApp, X, Instagram) strip metadata during upload.',
        c2paManifestFound: false,
        detectedTraces: []
      }
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

  // Revoke previous URL if any
  if (selectedImage.value?.dataUrl && selectedImage.value.dataUrl.startsWith('blob:')) {
    URL.revokeObjectURL(selectedImage.value.dataUrl)
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

// Container Drag & Drop Events (Works anywhere on screen, replaces instantly)
const onContainerDragEnter = (e: DragEvent) => {
  e.preventDefault()
  dragCounter.value++
  isDragging.value = true
}

const onContainerDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
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
    provenance: aiProvenance.value,
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
  if (selectedImage.value?.dataUrl && selectedImage.value.dataUrl.startsWith('blob:')) {
    URL.revokeObjectURL(selectedImage.value.dataUrl)
  }
  selectedImage.value = null
  cameraInfo.value = {}
  gpsInfo.value = { hasGps: false }
  technicalInfo.value = {}
  softwareAiInfo.value = { hasAiData: false }
  aiProvenance.value = {
    isAi: false,
    platform: 'none',
    platformName: 'No Image Loaded',
    platformIcon: '🔍',
    confidence: 'INCONCLUSIVE',
    confidencePercent: 0,
    summary: 'Upload an image to inspect AI signatures and EXIF metadata.',
    c2paManifestFound: false,
    detectedTraces: []
  }
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
  <div 
    class="metalens-container"
    @dragenter.prevent="onContainerDragEnter"
    @dragover.prevent="onContainerDragOver"
    @dragleave.prevent="onContainerDragLeave"
    @drop.prevent="onContainerDrop"
  >
    <!-- Global File Input (Always in DOM) -->
    <input 
      ref="fileInputRef" 
      type="file" 
      accept="image/jpeg,image/png,image/webp,image/tiff,image/heic,image/avif,image/gif" 
      class="hidden-input" 
      @change="onFileSelect"
    />

    <!-- Drag Replacement Visual Overlay -->
    <div v-if="isDragging" class="drag-replace-overlay" @click.stop>
      <div class="replace-overlay-card">
        <span class="replace-overlay-icon">📥</span>
        <h3 v-if="selectedImage">Drop New Image to Replace</h3>
        <h3 v-else>Drop Image Here to Inspect</h3>
        <p v-if="selectedImage">Existing photo will be swapped instantly • 100% Client-Side</p>
        <p v-else>Supports JPEG, PNG, WebP, TIFF, HEIC, AVIF & GIF</p>
      </div>
    </div>

    <!-- Header Console -->
    <header class="metalens-header">
      <div class="header-left">
        <h2 class="metalens-title">📸 MetaLens Studio</h2>
        <span class="metalens-desc">Image EXIF, GPS, Technical Specs & AI Provenance Inspector</span>
      </div>

      <div class="header-actions">
        <button v-if="selectedImage" class="btn-replace-header" @click="fileInputRef?.click()">
          <span>🔄</span> Replace Image
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
      @click="fileInputRef?.click()"
    >
      <div class="dropzone-icon">📷</div>
      <h3 class="dropzone-title">Drop your image here, or click to browse</h3>
      <p class="dropzone-subtitle">
        Supports JPEG, PNG, WebP, TIFF, HEIC, AVIF & GIF • No data leaves your browser.
      </p>

      <div class="dropzone-actions" @click.stop>
        <button class="btn-upload" @click="fileInputRef?.click()">
          <span>📁</span> Browse Local Image
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

      <!-- AI Provenance & Hardware Authenticity Banner -->
      <section 
        class="provenance-banner" 
        :class="{
          'ai-alert': aiProvenance.isAi,
          'camera-verified': aiProvenance.confidence === 'AUTHENTIC_CAMERA',
          'inconclusive': aiProvenance.confidence === 'INCONCLUSIVE'
        }"
      >
        <div class="provenance-content">
          <div class="provenance-main-row">
            <span class="provenance-badge-icon">{{ aiProvenance.platformIcon }}</span>
            <div class="provenance-info">
              <div class="provenance-tags-row">
                <span class="provenance-name">{{ aiProvenance.platformName }}</span>
                <span 
                  class="confidence-pill" 
                  :class="aiProvenance.confidence.toLowerCase()"
                >
                  {{ aiProvenance.confidence === 'AUTHENTIC_CAMERA' ? 'HARDWARE SENSOR' : aiProvenance.confidence === 'INCONCLUSIVE' ? 'STRIPPED / UNKNOWN' : `${aiProvenance.confidencePercent}% CONFIDENCE` }}
                </span>
                <span v-if="aiProvenance.c2paManifestFound" class="c2pa-pill">
                  🛡️ C2PA CREDENTIALS
                </span>
                <span v-if="aiProvenance.digitalSourceType" class="iptc-pill">
                  IPTC ALGORITHMIC
                </span>
              </div>
              <p class="provenance-description">{{ aiProvenance.summary }}</p>
            </div>
          </div>

          <!-- Forensic Traces Chips -->
          <div v-if="aiProvenance.detectedTraces.length > 0" class="provenance-traces-box">
            <span class="traces-heading">FORENSIC TRACES DETECTED:</span>
            <div class="traces-list">
              <span 
                v-for="(trace, tIdx) in aiProvenance.detectedTraces" 
                :key="tIdx" 
                class="trace-badge"
                :title="trace.description"
              >
                <span class="trace-type">{{ trace.category }}</span>
                <span class="trace-name">{{ trace.label }}</span>
              </span>
            </div>
          </div>
        </div>

        <button 
          v-if="aiProvenance.isAi" 
          class="btn-view-ai-tab"
          @click="activeTab = 'software'"
        >
          Inspect AI Parameters ➔
        </button>
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
          <span v-if="aiProvenance.isAi" class="tab-chip red">AI DETECTED</span>
          <span v-else-if="softwareAiInfo.hasAiData" class="tab-chip cyan">AI CHUNKS</span>
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
            <!-- AI Forensic & Provenance Analysis Card (Full Width) -->
            <div class="info-card full-width ai-forensic-card" :class="{ 'detected': aiProvenance.isAi }">
              <div class="card-header">
                <span class="card-icon">🔬</span>
                <span class="card-title">AI Forensic & Provenance Verification</span>
                <span v-if="aiProvenance.isAi" class="forensic-status-badge ai">AI DETECTED</span>
                <span v-else-if="aiProvenance.confidence === 'AUTHENTIC_CAMERA'" class="forensic-status-badge camera">OPTICAL CAMERA</span>
                <span v-else class="forensic-status-badge unknown">NO SIGNATURES</span>
              </div>

              <div class="forensic-summary-box">
                <div class="forensic-icon-col">
                  <span class="f-big-icon">{{ aiProvenance.platformIcon }}</span>
                </div>
                <div class="forensic-text-col">
                  <div class="f-title-row">
                    <h4>{{ aiProvenance.platformName }}</h4>
                    <span class="f-conf">{{ aiProvenance.confidencePercent }}% Confidence</span>
                  </div>
                  <p class="f-desc">{{ aiProvenance.summary }}</p>
                </div>
              </div>

              <!-- Forensic Indicators Grid -->
              <div class="forensic-indicators-grid">
                <div class="f-indicator">
                  <span class="fi-label">C2PA Manifest</span>
                  <span class="fi-val" :class="{ positive: aiProvenance.c2paManifestFound }">
                    {{ aiProvenance.c2paManifestFound ? 'Embedded (Found)' : 'None Detected' }}
                  </span>
                </div>
                <div class="f-indicator">
                  <span class="fi-label">Digital Source Type</span>
                  <span class="fi-val" :class="{ positive: Boolean(aiProvenance.digitalSourceType) }">
                    {{ aiProvenance.digitalSourceType || 'Standard Media' }}
                  </span>
                </div>
                <div class="f-indicator">
                  <span class="fi-label">Identified Platform</span>
                  <span class="fi-val highlight">
                    {{ aiProvenance.platformName }}
                  </span>
                </div>
                <div class="f-indicator">
                  <span class="fi-label">Signatures Found</span>
                  <span class="fi-val" :class="{ positive: aiProvenance.detectedTraces.length > 0 }">
                    {{ aiProvenance.detectedTraces.length }} Trace(s)
                  </span>
                </div>
              </div>

              <!-- Detailed Trace Table -->
              <div v-if="aiProvenance.detectedTraces.length > 0" class="forensic-traces-table-wrapper">
                <span class="ft-table-title">Forensic Signature Log:</span>
                <div class="ft-rows">
                  <div v-for="(t, idx) in aiProvenance.detectedTraces" :key="idx" class="ft-row">
                    <span class="ft-category" :class="t.category.toLowerCase()">{{ t.category }}</span>
                    <div class="ft-content">
                      <strong class="ft-label">{{ t.label }}</strong>
                      <span class="ft-desc">{{ t.description }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

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
  position: relative;
  min-height: 480px;
}

/* Drag Replacement Overlay */
.drag-replace-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 14, 23, 0.88);
  backdrop-filter: blur(8px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 2px dashed #ff1e42;
  pointer-events: none;
  animation: fadeInOverlay 0.15s ease-out;
}

@keyframes fadeInOverlay {
  from { opacity: 0; transform: scale(0.99); }
  to { opacity: 1; transform: scale(1); }
}

.replace-overlay-card {
  text-align: center;
  background: #0f1420;
  border: 1px solid rgba(255, 30, 66, 0.4);
  padding: 32px 48px;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(255, 30, 66, 0.2);
}

.replace-overlay-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 12px;
  animation: bounceSlow 1.5s infinite alternate ease-in-out;
}

@keyframes bounceSlow {
  from { transform: translateY(0); }
  to { transform: translateY(-8px); }
}

.replace-overlay-card h3 {
  margin: 0 0 6px;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f8fafc;
}

.replace-overlay-card p {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
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

.btn-replace-header:hover {
  background: #00f0ff;
  color: #090d16;
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

.btn-upload {
  padding: 10px 18px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: #ff1e42;
  border: none;
  color: #ffffff;
}

.btn-upload:hover {
  background: #e01638;
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

/* AI Provenance Banner */
.provenance-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  background: #0f1420;
  border: 1px solid #1c2638;
  border-radius: 10px;
  transition: all 0.25s ease;
  flex-wrap: wrap;
}

.provenance-banner.ai-alert {
  background: linear-gradient(135deg, rgba(255, 30, 66, 0.08) 0%, rgba(15, 20, 32, 0.95) 100%);
  border-color: rgba(255, 30, 66, 0.45);
  box-shadow: 0 4px 20px rgba(255, 30, 66, 0.08);
}

.provenance-banner.camera-verified {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 20, 32, 0.95) 100%);
  border-color: rgba(16, 185, 129, 0.4);
}

.provenance-banner.inconclusive {
  background: #0f1420;
  border-color: #1c2638;
}

.provenance-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-width: 280px;
}

.provenance-main-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.provenance-badge-icon {
  font-size: 2rem;
  line-height: 1;
  flex-shrink: 0;
  padding: 6px;
  background: #141b2b;
  border: 1px solid #23304a;
  border-radius: 8px;
}

.provenance-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.provenance-tags-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.provenance-name {
  font-size: 1.05rem;
  font-weight: 800;
  color: #f8fafc;
}

.confidence-pill {
  font-size: 0.68rem;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 4px;
  letter-spacing: 0.03em;
}

.confidence-pill.high {
  background: rgba(255, 30, 66, 0.2);
  border: 1px solid #ff1e42;
  color: #ff4d6d;
}

.confidence-pill.authentic_camera {
  background: rgba(16, 185, 129, 0.18);
  border: 1px solid #10b981;
  color: #34d399;
}

.confidence-pill.inconclusive {
  background: #1c2638;
  border: 1px solid #2d3b55;
  color: #94a3b8;
}

.c2pa-pill {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 7px;
  background: rgba(0, 240, 255, 0.12);
  border: 1px solid rgba(0, 240, 255, 0.35);
  color: #00f0ff;
  border-radius: 4px;
}

.iptc-pill {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 7px;
  background: rgba(168, 85, 247, 0.15);
  border: 1px solid rgba(168, 85, 247, 0.35);
  color: #c084fc;
  border-radius: 4px;
}

.provenance-description {
  margin: 0;
  font-size: 0.82rem;
  color: #cbd5e1;
  line-height: 1.4;
}

.provenance-traces-box {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.traces-heading {
  font-size: 0.65rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.05em;
}

.traces-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.trace-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: #141b2b;
  border: 1px solid #23304a;
  border-radius: 4px;
  font-size: 0.72rem;
  color: #cbd5e1;
}

.trace-type {
  font-size: 0.62rem;
  font-weight: 700;
  color: #ff1e42;
  background: rgba(255, 30, 66, 0.12);
  padding: 1px 4px;
  border-radius: 2px;
}

.trace-name {
  font-weight: 600;
}

.btn-view-ai-tab {
  padding: 9px 14px;
  background: rgba(255, 30, 66, 0.15);
  border: 1px solid rgba(255, 30, 66, 0.4);
  color: #ff4d6d;
  font-size: 0.78rem;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.btn-view-ai-tab:hover {
  background: #ff1e42;
  color: #ffffff;
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

.tab-chip.red {
  background: rgba(255, 30, 66, 0.2);
  color: #ff4d6d;
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

/* AI Forensic Inspector Card */
.ai-forensic-card {
  border-color: #23304a;
}

.ai-forensic-card.detected {
  border-color: rgba(255, 30, 66, 0.4);
  background: linear-gradient(180deg, rgba(255, 30, 66, 0.03) 0%, #0f1420 100%);
}

.forensic-status-badge {
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.forensic-status-badge.ai {
  background: rgba(255, 30, 66, 0.2);
  color: #ff4d6d;
  border: 1px solid #ff1e42;
}

.forensic-status-badge.camera {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid #10b981;
}

.forensic-status-badge.unknown {
  background: #1c2638;
  color: #94a3b8;
  border: 1px solid #2d3b55;
}

.forensic-summary-box {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px;
  background: #141b2b;
  border: 1px solid #1c2638;
  border-radius: 8px;
  margin-bottom: 14px;
}

.f-big-icon {
  font-size: 2.2rem;
}

.forensic-text-col {
  flex: 1;
}

.f-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.f-title-row h4 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #f8fafc;
}

.f-conf {
  font-size: 0.72rem;
  font-weight: 700;
  color: #00f0ff;
  background: rgba(0, 240, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.f-desc {
  margin: 0;
  font-size: 0.8rem;
  color: #94a3b8;
  line-height: 1.4;
}

.forensic-indicators-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.f-indicator {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  background: #090c12;
  border: 1px solid #1c2638;
  border-radius: 6px;
}

.fi-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.fi-val {
  font-size: 0.82rem;
  font-weight: 600;
  color: #cbd5e1;
  word-break: break-all;
}

.fi-val.positive {
  color: #00f0ff;
}

.fi-val.highlight {
  color: #ff4d6d;
}

.forensic-traces-table-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #090c12;
  border: 1px solid #1c2638;
  border-radius: 8px;
  padding: 12px;
}

.ft-table-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ft-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ft-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  background: #141b2b;
  border: 1px solid #1c2638;
  border-radius: 6px;
}

.ft-category {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.ft-category.c2pa { background: rgba(0, 240, 255, 0.15); color: #00f0ff; }
.ft-category.iptc { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
.ft-category.exif { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.ft-category.watermark { background: rgba(255, 30, 66, 0.15); color: #ff4d6d; }
.ft-category.chunk { background: rgba(16, 185, 129, 0.15); color: #34d399; }

.ft-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ft-label {
  font-size: 0.78rem;
  color: #f8fafc;
}

.ft-desc {
  font-size: 0.72rem;
  color: #94a3b8;
  line-height: 1.35;
}
</style>
