export interface ParsedTag {
  id: string
  name: string
  category: string
  value: string
  raw?: unknown
}

export interface CameraInfo {
  make?: string
  model?: string
  lens?: string
  bodySerial?: string
  lensSerial?: string
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

export interface GpsInfo {
  latitude?: number
  longitude?: number
  latitudeRef?: string
  longitudeRef?: string
  latitudeDms?: string
  longitudeDms?: string
  altitude?: string
  direction?: string
  speed?: string
  timestamp?: string
  hasGps: boolean
}

export interface TechnicalInfo {
  width?: number
  height?: number
  exifWidth?: number
  exifHeight?: number
  dimensionMismatch?: boolean
  megapixels?: string
  aspectRatio?: string
  colorSpace?: string
  bitsPerSample?: string
  orientation?: string
  resolutionDpi?: string
  compression?: string
  hasAlpha?: boolean
  isAnimated?: boolean
}

export interface SoftwareAiInfo {
  software?: string
  artist?: string
  copyright?: string
  aiPrompt?: string
  aiNegativePrompt?: string
  aiRawWorkflow?: string
  aiEngine?: string
  aiModel?: string
  aiSeed?: string
  aiSampler?: string
  aiScheduler?: string
  aiSteps?: string
  aiCfg?: string
  hasAiData: boolean
  isPostProcessed?: boolean
}

export interface AiTrace {
  label: string
  description: string
  category: 'C2PA' | 'IPTC' | 'EXIF' | 'CHUNK' | 'WATERMARK'
}

export type AiPlatform =
  | 'chatgpt'
  | 'gemini'
  | 'firefly'
  | 'midjourney'
  | 'stablediffusion'
  | 'grok'
  | 'meta'
  | 'ideogram'
  | 'c2pa_generic'
  | 'none'

export type AiConfidence =
  | 'HIGH'
  | 'MEDIUM'
  | 'AI_EDITED'
  | 'CAMERA_EDITED'
  | 'AUTHENTIC_CAMERA'
  | 'INCONCLUSIVE'

export interface AiProvenance {
  isAi: boolean
  platform: AiPlatform
  platformName: string
  platformIcon: string
  confidence: AiConfidence
  confidencePercent: number
  summary: string
  digitalSourceType?: string
  c2paManifestFound: boolean
  detectedTraces: AiTrace[]
}

export interface PrivacyFinding {
  id: string
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
}

export interface PrivacyAudit {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN'
  score: number // 0 (clean) to 100 (high exposure)
  summary: string
  findings: PrivacyFinding[]
}

export interface EmbeddedThumbnail {
  dataUrl: string
  sizeBytes: number
  width?: number
  height?: number
}

export interface BinarySegment {
  offset: number
  name: string
  size: number
  description: string
  isMetadata: boolean
}

export interface FileHashes {
  sha256: string
  md5: string
}

export interface DominantColor {
  hex: string
  pct: number
}

export interface PixelAnalysis {
  histogramR: number[]
  histogramG: number[]
  histogramB: number[]
  histogramL: number[]
  dominantColors: DominantColor[]
}

export interface InspectedImage {
  name: string
  size: number
  mime: string
  ext: string
  dataUrl: string
  buffer: ArrayBuffer
  previewSupported: boolean
  hashes: FileHashes
  camera: CameraInfo
  gps: GpsInfo
  technical: TechnicalInfo
  softwareAi: SoftwareAiInfo
  aiProvenance: AiProvenance
  privacyAudit: PrivacyAudit
  embeddedThumbnail: EmbeddedThumbnail | null
  binarySegments: BinarySegment[]
  rawTags: ParsedTag[]
}
