<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { useToast } from '@/composables/useToast'

const { showToast } = useToast()

export interface VideoFormatDef {
  value: string
  label: string
  ext: string
  mime: string
  category: 'video' | 'audio' | 'animation'
  icon: string
  desc: string
}

export interface VideoItem {
  id: string
  file: File
  name: string
  originalSize: number
  originalExt: string
  previewUrl: string
  duration: number
  width: number
  height: number
  targetFormat: string
  quality: 'balanced' | 'high' | 'small' | 'remux'
  resolution: 'original' | '1080p' | '720p' | '480p' | '360p'
  audioMode: 'keep' | 'mute' | 'extract'
  trimEnabled: boolean
  trimStart: number
  trimEnd: number
  status: 'idle' | 'converting' | 'done' | 'error'
  progress: number
  convertedBlob?: Blob
  convertedUrl?: string
  convertedSize?: number
  errorMessage?: string
}

const VIDEO_FORMATS: VideoFormatDef[] = [
  // Video Containers
  { value: 'mp4', label: 'MP4 (H.264)', ext: '.mp4', mime: 'video/mp4', category: 'video', icon: '🎬', desc: 'Universal compatibility across all devices' },
  { value: 'webm', label: 'WebM (VP9)', ext: '.webm', mime: 'video/webm', category: 'video', icon: '🌐', desc: 'Lightweight format optimized for web' },
  { value: 'mov', label: 'MOV (QuickTime)', ext: '.mov', mime: 'video/quicktime', category: 'video', icon: '🍏', desc: 'Apple QuickTime video format' },
  { value: 'mkv', label: 'MKV (Matroska)', ext: '.mkv', mime: 'video/x-matroska', category: 'video', icon: '📦', desc: 'Flexible container for multiple tracks' },
  { value: 'avi', label: 'AVI (Xvid)', ext: '.avi', mime: 'video/x-msvideo', category: 'video', icon: '📼', desc: 'Standard Windows legacy container' },
  // Animation
  { value: 'gif', label: 'GIF Animation', ext: '.gif', mime: 'image/gif', category: 'animation', icon: '🎞️', desc: 'High-quality 2-pass palette animated GIF' },
  // Audio Extraction
  { value: 'mp3', label: 'MP3 Audio', ext: '.mp3', mime: 'audio/mpeg', category: 'audio', icon: '🎵', desc: 'Extract track to universal MP3 audio' },
  { value: 'wav', label: 'WAV Lossless', ext: '.wav', mime: 'audio/wav', category: 'audio', icon: '🔊', desc: 'Uncompressed CD-quality PCM audio' },
  { value: 'aac', label: 'AAC Audio', ext: '.aac', mime: 'audio/aac', category: 'audio', icon: '🎧', desc: 'High-efficiency digital audio track' }
]

// Queue State
const queue = ref<VideoItem[]>([])
const selectedItemId = ref<string | null>(null)
const isDragging = ref(false)
const dragCounter = ref(0)
const fileInputRef = ref<HTMLInputElement | null>(null)
const videoPlayerRef = ref<HTMLVideoElement | null>(null)

// Engine State
type EngineStatus = 'unloaded' | 'loading' | 'ready' | 'error'
const engineStatus = ref<EngineStatus>('unloaded')
const engineStatusText = ref('Standby • Loads on demand')
const showLogs = ref(false)
const terminalLogs = ref<string[]>([])

// FFmpeg Singleton
let ffmpegInstance: FFmpeg | null = null

// Selected Video Item
const selectedItem = computed(() => {
  if (!selectedItemId.value) return queue.value[0] || null
  return queue.value.find(item => item.id === selectedItemId.value) || queue.value[0] || null
})

// Format File Size
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// Format Time (seconds to mm:ss or hh:mm:ss)
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '00:00'
  const s = Math.floor(seconds)
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Initialize FFmpeg WebAssembly Engine (Single-threaded for 100% GitHub Pages compatibility)
const ensureEngine = async (): Promise<FFmpeg> => {
  if (ffmpegInstance && engineStatus.value === 'ready') {
    return ffmpegInstance
  }

  try {
    engineStatus.value = 'loading'
    engineStatusText.value = 'Fetching FFmpeg WebAssembly core (~25 MB, cached locally)...'

    const ffmpeg = new FFmpeg()
    ffmpegInstance = ffmpeg

    // Listen to logs
    ffmpeg.on('log', ({ message }) => {
      terminalLogs.value.push(message)
      if (terminalLogs.value.length > 250) {
        terminalLogs.value.shift()
      }
    })

    // Listen to progress
    ffmpeg.on('progress', ({ progress }) => {
      const current = selectedItem.value
      if (current && current.status === 'converting') {
        const pct = Math.min(99, Math.max(1, Math.round(progress > 1 ? progress : progress * 100)))
        current.progress = pct
      }
    })

    // Multi-CDN fallback for reliability
    const coreBaseUrls = [
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm'
    ]

    let loadError: unknown = null
    for (const baseURL of coreBaseUrls) {
      try {
        engineStatusText.value = `Loading core from ${new URL(baseURL).hostname}...`
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
        })
        loadError = null
        break
      } catch (err) {
        loadError = err
        console.warn(`Failed loading FFmpeg core from ${baseURL}, trying fallback...`, err)
      }
    }

    if (loadError) {
      throw loadError
    }

    engineStatus.value = 'ready'
    engineStatusText.value = 'WebAssembly Engine Ready'
    showToast('FFmpeg WebAssembly engine loaded successfully!', 'success')
    return ffmpeg
  } catch (err) {
    engineStatus.value = 'error'
    engineStatusText.value = 'Failed to load FFmpeg engine'
    console.error('FFmpeg engine load failed:', err)
    showToast('Could not initialize FFmpeg WebAssembly engine. Check your internet connection.', 'error')
    throw err
  }
}

// Add Video Files to Queue
const addFiles = (files: FileList | File[]) => {
  const allowedExts = /\.(mp4|mov|webm|mkv|avi|flv|wmv|m4v|ts|3gp|ogv|gif)$/i
  let count = 0

  Array.from(files).forEach((file) => {
    if (!file.type.startsWith('video/') && !file.name.match(allowedExts)) {
      return
    }

    const extMatch = file.name.match(/\.([a-z0-9]+)$/i)
    const ext = (extMatch && extMatch[1]) ? extMatch[1].toLowerCase() : 'mp4'
    const previewUrl = URL.createObjectURL(file)

    // Suggest logical default target format
    let defaultTarget = 'mp4'
    if (ext === 'mp4') defaultTarget = 'webm'
    else if (ext === 'webm') defaultTarget = 'mp4'
    else if (ext === 'mov') defaultTarget = 'mp4'

    const newItem: VideoItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      file,
      name: file.name,
      originalSize: file.size,
      originalExt: ext,
      previewUrl,
      duration: 0,
      width: 0,
      height: 0,
      targetFormat: defaultTarget,
      quality: 'balanced',
      resolution: 'original',
      audioMode: 'keep',
      trimEnabled: false,
      trimStart: 0,
      trimEnd: 0,
      status: 'idle',
      progress: 0
    }

    queue.value.push(newItem)
    count++

    if (!selectedItemId.value) {
      selectedItemId.value = newItem.id
    }
  })

  if (count > 0) {
    showToast(`${count} video${count > 1 ? 's' : ''} added to VideoForge`, 'success')
  } else {
    showToast('Please select valid video files (MP4, MOV, WebM, MKV, AVI, etc.)', 'error')
  }
}

// Video Player Loaded Metadata
const onVideoMetadata = (item: VideoItem, e: Event) => {
  const vid = e.target as HTMLVideoElement
  if (vid) {
    item.duration = Math.round(vid.duration || 0)
    item.width = vid.videoWidth || 0
    item.height = vid.videoHeight || 0
    if (!item.trimEnd || item.trimEnd === 0) {
      item.trimEnd = item.duration
    }
  }
}

// Set Trim Point from Current Video Time
const setTrimPoint = (point: 'start' | 'end') => {
  if (!selectedItem.value || !videoPlayerRef.value) return
  const current = Math.floor(videoPlayerRef.value.currentTime)
  if (point === 'start') {
    selectedItem.value.trimStart = current
    if (selectedItem.value.trimEnd <= current) {
      selectedItem.value.trimEnd = Math.min(selectedItem.value.duration, current + 5)
    }
    showToast(`Trim start set to ${formatTime(current)}`, 'info')
  } else {
    selectedItem.value.trimEnd = Math.max(selectedItem.value.trimStart + 1, current)
    showToast(`Trim end set to ${formatTime(current)}`, 'info')
  }
}

// Main Video Conversion Runner
const convertItem = async (item: VideoItem) => {
  if (item.status === 'converting') return

  try {
    item.status = 'converting'
    item.progress = 5
    item.errorMessage = undefined

    const ffmpeg = await ensureEngine()

    const inExt = item.originalExt || 'mp4'
    const outExt = item.targetFormat
    const inName = `input_${item.id}.${inExt}`
    const outName = `output_${item.id}.${outExt}`

    // 1. Write file to virtual FS
    engineStatusText.value = `Writing ${item.name} to memory FS...`
    await ffmpeg.writeFile(inName, await fetchFile(item.file))

    // 2. Build FFmpeg command arguments
    const args: string[] = []

    // Fast seek trimming if enabled
    if (item.trimEnabled && item.trimEnd > item.trimStart) {
      args.push('-ss', String(item.trimStart))
      args.push('-to', String(item.trimEnd))
    }

    args.push('-i', inName)

    // Format specific encoding pipelines
    if (item.targetFormat === 'gif') {
      // 2-Pass Palette Generation for Crisp, High-Quality GIF
      let scalePart = 'scale=480:-1:flags=lanczos'
      if (item.resolution === '720p') scalePart = 'scale=720:-1:flags=lanczos'
      else if (item.resolution === '360p') scalePart = 'scale=360:-1:flags=lanczos'
      else if (item.resolution === '1080p') scalePart = 'scale=1080:-1:flags=lanczos'

      args.push(
        '-vf', `fps=12,${scalePart},split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer`,
        '-loop', '0'
      )
    } else if (['mp3', 'wav', 'aac'].includes(item.targetFormat)) {
      // Audio Extraction
      args.push('-vn')
      if (item.targetFormat === 'mp3') {
        args.push('-c:a', 'libmp3lame', '-q:a', '2')
      } else if (item.targetFormat === 'wav') {
        args.push('-c:a', 'pcm_s16le')
      } else if (item.targetFormat === 'aac') {
        args.push('-c:a', 'aac', '-b:a', '192k')
      }
    } else {
      // Standard Video Output (MP4, WebM, MOV, MKV, AVI)
      // Resolution scale filter
      if (item.resolution === '1080p') {
        args.push('-vf', "scale='min(1920,iw)':-2")
      } else if (item.resolution === '720p') {
        args.push('-vf', "scale='min(1280,iw)':-2")
      } else if (item.resolution === '480p') {
        args.push('-vf', "scale='min(854,iw)':-2")
      } else if (item.resolution === '360p') {
        args.push('-vf', "scale='min(640,iw)':-2")
      }

      // Audio handling
      if (item.audioMode === 'mute') {
        args.push('-an')
      }

      // Quality & Codecs
      if (item.quality === 'remux') {
        args.push('-c', 'copy')
      } else if (['mp4', 'mov', 'mkv'].includes(item.targetFormat)) {
        const crf = item.quality === 'high' ? '19' : item.quality === 'small' ? '28' : '23'
        args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', crf)
        if (item.audioMode !== 'mute') {
          args.push('-c:a', 'aac', '-b:a', '128k')
        }
      } else if (item.targetFormat === 'webm') {
        const crf = item.quality === 'high' ? '25' : item.quality === 'small' ? '36' : '30'
        args.push('-c:v', 'libvpx', '-crf', crf, '-b:v', '1M')
        if (item.audioMode !== 'mute') {
          args.push('-c:a', 'libvorbis')
        }
      } else if (item.targetFormat === 'avi') {
        args.push('-c:v', 'mpeg4', '-vtag', 'xvid')
        if (item.audioMode !== 'mute') {
          args.push('-c:a', 'mp3')
        }
      }
    }

    args.push(outName)

    engineStatusText.value = `Encoding ${item.name} to ${item.targetFormat.toUpperCase()}...`

    // 3. Execute transcode command
    const exitCode = await ffmpeg.exec(args)

    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with error code ${exitCode}`)
    }

    // 4. Read output file from virtual FS
    const outData = await ffmpeg.readFile(outName)
    const fmtDef = VIDEO_FORMATS.find(f => f.value === item.targetFormat)
    const mime = fmtDef?.mime || 'video/mp4'

    // Clean previous URL if existing
    if (item.convertedUrl) {
      URL.revokeObjectURL(item.convertedUrl)
    }

    const blob = new Blob([outData as unknown as BlobPart], { type: mime })
    const url = URL.createObjectURL(blob)

    item.convertedBlob = blob
    item.convertedUrl = url
    item.convertedSize = blob.size
    item.status = 'done'
    item.progress = 100

    // 5. Cleanup virtual FS files
    await ffmpeg.deleteFile(inName).catch(() => {})
    await ffmpeg.deleteFile(outName).catch(() => {})

    engineStatusText.value = 'WebAssembly Engine Ready'
    showToast(`Converted: ${item.name} ➔ ${item.targetFormat.toUpperCase()}`, 'success')
  } catch (err: unknown) {
    item.status = 'error'
    const errorMsg = err instanceof Error ? err.message : String(err)
    item.errorMessage = errorMsg || 'Conversion failed'
    engineStatusText.value = 'Engine Ready (Last job encountered error)'
    showToast(`Conversion failed for ${item.name}`, 'error')
    console.error('Transcode error:', err)
  }
}

// Convert All Items Sequentially
const convertAll = async () => {
  const pending = queue.value.filter(i => i.status !== 'converting' && i.status !== 'done')
  if (pending.length === 0) {
    showToast('No pending items in queue', 'info')
    return
  }

  for (const item of pending) {
    selectedItemId.value = item.id
    await convertItem(item)
  }
}

// Download Converted File
const downloadItem = (item: VideoItem) => {
  if (!item.convertedUrl) {
    if (item.status !== 'converting') {
      convertItem(item)
    }
    return
  }

  const baseName = item.name.replace(/\.[^/.]+$/, '')
  const ext = item.targetFormat
  const fileName = `${baseName}_converted.${ext}`

  const a = document.createElement('a')
  a.href = item.convertedUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  showToast(`Downloaded: ${fileName}`, 'success')
}

// Remove Item from Queue
const removeItem = (id: string) => {
  const idx = queue.value.findIndex(i => i.id === id)
  if (idx !== -1) {
    const item = queue.value[idx]
    if (item) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl)
    }
    queue.value.splice(idx, 1)

    if (selectedItemId.value === id) {
      selectedItemId.value = queue.value[0]?.id || null
    }
  }
}

// Clear Entire Queue
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

// Drag & Drop Handlers
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
  if (e.dataTransfer?.files?.length) {
    addFiles(e.dataTransfer.files)
  }
}

const onFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files?.length) {
    addFiles(target.files)
  }
}

// Cleanup on unmount
onMounted(() => {
  // Pre-load check or lazy stand-by
})

onUnmounted(() => {
  queue.value.forEach(item => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl)
  })
})
</script>

<template>
  <div 
    class="videoforge-container"
    @dragenter.prevent="onContainerDragEnter"
    @dragover.prevent="onContainerDragOver"
    @dragleave.prevent="onContainerDragLeave"
    @drop.prevent="onContainerDrop"
  >
    <!-- Hidden File Input -->
    <input 
      ref="fileInputRef" 
      type="file" 
      multiple
      accept="video/*,.mkv,.avi,.flv,.wmv,.m4v,.ts,.mov" 
      class="hidden-input" 
      @change="onFileSelect"
    />

    <!-- Drag Replacement & Drop Overlay -->
    <div v-if="isDragging" class="drag-overlay" @click.stop>
      <div class="drag-overlay-card">
        <span class="drag-overlay-icon">🎬</span>
        <h3>Drop Video Files Here</h3>
        <p>100% Client-Side Transcoding • Zero Server Uploads</p>
      </div>
    </div>

    <!-- Header Console -->
    <header class="videoforge-header">
      <div class="header-left">
        <div class="header-badge-row">
          <span class="engine-badge" :class="engineStatus">
            <span class="dot"></span>
            {{ engineStatusText }}
          </span>
          <span class="privacy-badge">100% CLIENT-SIDE • ZERO UPLOADS</span>
        </div>
        <h2 class="videoforge-title">🎬 VideoForge Studio</h2>
        <span class="videoforge-desc">
          Universal Client-Side Video Transcoder, Audio Extractor & High-Fidelity GIF Studio
        </span>
      </div>

      <div class="header-actions">
        <button class="btn-action primary" @click="fileInputRef?.click()">
          <span>➕</span> Add Videos
        </button>
        <button v-if="queue.length > 0" class="btn-action" @click="convertAll">
          <span>⚡</span> Convert All ({{ queue.filter(i => i.status !== 'done').length }})
        </button>
        <button v-if="queue.length > 0" class="btn-action secondary" @click="clearQueue">
          <span>🗑️</span> Clear
        </button>
      </div>
    </header>

    <!-- Empty State / Dropzone -->
    <div 
      v-if="queue.length === 0" 
      class="dropzone-area"
      :class="{ dragging: isDragging }"
      @click="fileInputRef?.click()"
    >
      <div class="dropzone-icon">🎬</div>
      <h3 class="dropzone-title">Drop your video clips here, or click to browse</h3>
      <p class="dropzone-subtitle">
        Supports MP4, MOV, WebM, MKV, AVI, FLV, WMV, M4V & TS • Transcoded entirely in your browser memory via WebAssembly.
      </p>

      <div class="format-pills-row">
        <span class="f-pill">MP4 (H.264)</span>
        <span class="f-pill">WebM (VP9)</span>
        <span class="f-pill">MOV</span>
        <span class="f-pill">MKV</span>
        <span class="f-pill">AVI</span>
        <span class="f-pill">GIF Animation</span>
        <span class="f-pill">MP3 Audio</span>
        <span class="f-pill">WAV</span>
      </div>

      <div class="dropzone-actions" @click.stop>
        <button class="btn-upload" @click="fileInputRef?.click()">
          <span>📁</span> Browse Local Videos
        </button>
      </div>

      <div class="dropzone-note">
        <span>⚡ Best performance with video clips up to 200 MB</span>
      </div>
    </div>

    <!-- Active Workspace -->
    <div v-else class="workspace-grid">
      <!-- Left Column: Video Preview, Trimming & Conversion Config -->
      <section v-if="selectedItem" class="main-panel">
        <!-- Video Player Card -->
        <div class="panel-card player-card">
          <div class="video-container">
            <video 
              ref="videoPlayerRef"
              :src="selectedItem.previewUrl" 
              controls 
              class="preview-video"
              @loadedmetadata="onVideoMetadata(selectedItem, $event)"
            ></video>
          </div>

          <!-- Quick Video Stats Bar -->
          <div class="stats-bar">
            <div class="stat-item">
              <span class="s-label">SOURCE NAME</span>
              <span class="s-val" :title="selectedItem.name">{{ selectedItem.name }}</span>
            </div>
            <div class="stat-item">
              <span class="s-label">ORIGINAL SIZE</span>
              <span class="s-val">{{ formatFileSize(selectedItem.originalSize) }}</span>
            </div>
            <div v-if="selectedItem.duration" class="stat-item">
              <span class="s-label">DURATION</span>
              <span class="s-val">{{ formatTime(selectedItem.duration) }}</span>
            </div>
            <div v-if="selectedItem.width && selectedItem.height" class="stat-item">
              <span class="s-label">DIMENSIONS</span>
              <span class="s-val">{{ selectedItem.width }} × {{ selectedItem.height }}</span>
            </div>
          </div>
        </div>

        <!-- Trimming & Time Range Card -->
        <div class="panel-card trim-card">
          <div class="card-title-row">
            <div class="title-with-toggle">
              <input 
                id="trim-toggle" 
                v-model="selectedItem.trimEnabled" 
                type="checkbox" 
                class="cyber-checkbox"
              />
              <label for="trim-toggle" class="card-title">✂️ Trim Clip Duration</label>
            </div>
            <span v-if="selectedItem.trimEnabled" class="trim-summary-badge">
              Active Range: {{ formatTime(selectedItem.trimStart) }} ➔ {{ formatTime(selectedItem.trimEnd) }} 
              ({{ formatTime(Math.max(0, selectedItem.trimEnd - selectedItem.trimStart)) }})
            </span>
          </div>

          <div v-if="selectedItem.trimEnabled" class="trim-controls">
            <div class="trim-col">
              <div class="trim-label-row">
                <span class="trim-label">START TIME (s)</span>
                <button class="btn-time-set" @click="setTrimPoint('start')">⏱️ Set Current Player Time</button>
              </div>
              <input 
                v-model.number="selectedItem.trimStart" 
                type="number" 
                min="0" 
                :max="selectedItem.trimEnd" 
                class="time-input" 
              />
            </div>

            <div class="trim-col">
              <div class="trim-label-row">
                <span class="trim-label">END TIME (s)</span>
                <button class="btn-time-set" @click="setTrimPoint('end')">⏱️ Set Current Player Time</button>
              </div>
              <input 
                v-model.number="selectedItem.trimEnd" 
                type="number" 
                :min="selectedItem.trimStart" 
                :max="selectedItem.duration || 9999" 
                class="time-input" 
              />
            </div>
          </div>
        </div>

        <!-- Conversion Settings Card -->
        <div class="panel-card config-card">
          <div class="card-title-row">
            <span class="card-title">⚙️ Output Settings & Target Format</span>
          </div>

          <!-- Format Picker -->
          <div class="setting-group">
            <label class="setting-label">TARGET FORMAT:</label>
            <div class="format-grid">
              <button 
                v-for="fmt in VIDEO_FORMATS" 
                :key="fmt.value"
                class="format-btn"
                :class="{ active: selectedItem.targetFormat === fmt.value }"
                @click="selectedItem.targetFormat = fmt.value"
              >
                <span class="fmt-icon">{{ fmt.icon }}</span>
                <div class="fmt-text">
                  <span class="fmt-label">{{ fmt.label }}</span>
                  <span class="fmt-desc">{{ fmt.desc }}</span>
                </div>
              </button>
            </div>
          </div>

          <!-- Settings Row (Quality, Scale, Audio) -->
          <div class="settings-two-col">
            <!-- Quality Preset -->
            <div class="setting-col">
              <label class="setting-label">QUALITY & ENCODING PRESET:</label>
              <select v-model="selectedItem.quality" class="cyber-select">
                <option value="balanced">Balanced (Optimal Quality / File Size)</option>
                <option value="high">High Fidelity (Visually Lossless, larger file)</option>
                <option value="small">Small File / Discord (Compressed for sharing)</option>
                <option value="remux">Lightning Remux (Stream copy, instant finish)</option>
              </select>
            </div>

            <!-- Resolution Scale -->
            <div class="setting-col">
              <label class="setting-label">RESOLUTION SCALE:</label>
              <select v-model="selectedItem.resolution" class="cyber-select">
                <option value="original">Original Resolution (100%)</option>
                <option value="1080p">1080p (Full HD - max 1920x1080)</option>
                <option value="720p">720p (HD - max 1280x720)</option>
                <option value="480p">480p (SD - max 854x480)</option>
                <option value="360p">360p (Mobile - max 640x360)</option>
              </select>
            </div>

            <!-- Audio Mode -->
            <div v-if="!['mp3', 'wav', 'aac'].includes(selectedItem.targetFormat)" class="setting-col">
              <label class="setting-label">AUDIO TRACK HANDLING:</label>
              <select v-model="selectedItem.audioMode" class="cyber-select">
                <option value="keep">Keep Audio Track (Default)</option>
                <option value="mute">Mute / Strip Audio (Video Only)</option>
              </select>
            </div>
          </div>

          <!-- Action & Progress Bar -->
          <div class="action-footer">
            <div v-if="selectedItem.status === 'converting'" class="progress-container">
              <div class="progress-bar-track">
                <div class="progress-bar-fill" :style="{ width: `${selectedItem.progress}%` }"></div>
              </div>
              <div class="progress-label-row">
                <span>Transcoding with WebAssembly...</span>
                <span class="pct">{{ selectedItem.progress }}%</span>
              </div>
            </div>

            <div class="action-buttons-row">
              <button 
                v-if="selectedItem.status === 'done'" 
                class="btn-primary-action download"
                @click="downloadItem(selectedItem)"
              >
                <span>💾</span> Download {{ selectedItem.targetFormat.toUpperCase() }} ({{ formatFileSize(selectedItem.convertedSize) }})
              </button>

              <button 
                v-else
                class="btn-primary-action convert"
                :disabled="selectedItem.status === 'converting'"
                @click="convertItem(selectedItem)"
              >
                <span v-if="selectedItem.status === 'converting'">⏳ Converting...</span>
                <span v-else>⚡ Convert {{ selectedItem.originalExt.toUpperCase() }} ➔ {{ selectedItem.targetFormat.toUpperCase() }}</span>
              </button>

              <button 
                v-if="selectedItem.status === 'done'"
                class="btn-secondary-action"
                @click="convertItem(selectedItem)"
              >
                <span>🔄</span> Re-encode
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Right Column: Queue & Batch Actions -->
      <aside class="queue-panel">
        <div class="queue-card">
          <div class="queue-header">
            <span class="queue-title">Batch Queue ({{ queue.length }})</span>
            <button class="btn-text-action" @click="fileInputRef?.click()">+ Add More</button>
          </div>

          <div class="queue-items-list">
            <div 
              v-for="item in queue" 
              :key="item.id"
              class="queue-item"
              :class="{ 
                active: selectedItem?.id === item.id,
                done: item.status === 'done',
                converting: item.status === 'converting',
                error: item.status === 'error'
              }"
              @click="selectedItemId = item.id"
            >
              <div class="item-left">
                <span class="item-status-icon">
                  <span v-if="item.status === 'done'">✅</span>
                  <span v-else-if="item.status === 'converting'">⏳</span>
                  <span v-else-if="item.status === 'error'">❌</span>
                  <span v-else>🎬</span>
                </span>
                <div class="item-meta">
                  <span class="item-name" :title="item.name">{{ item.name }}</span>
                  <div class="item-sub">
                    <span>{{ formatFileSize(item.originalSize) }}</span>
                    <span>➔</span>
                    <span class="target-tag">{{ item.targetFormat.toUpperCase() }}</span>
                    <span v-if="item.status === 'done'" class="result-size">
                      ({{ formatFileSize(item.convertedSize) }})
                    </span>
                  </div>
                </div>
              </div>

              <div class="item-actions" @click.stop>
                <button 
                  v-if="item.status === 'done'" 
                  class="btn-mini-download" 
                  title="Download"
                  @click="downloadItem(item)"
                >
                  💾
                </button>
                <button 
                  class="btn-mini-remove" 
                  title="Remove from queue"
                  @click="removeItem(item.id)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Terminal Logs Drawer (Collapsible) -->
        <div class="logs-card">
          <div class="logs-header" @click="showLogs = !showLogs">
            <span class="logs-title">🖥️ FFmpeg Terminal Output</span>
            <span class="logs-toggle">{{ showLogs ? '▲ Hide' : '▼ View Logs' }}</span>
          </div>
          <div v-if="showLogs" class="logs-terminal">
            <pre v-if="terminalLogs.length > 0"><code>{{ terminalLogs.join('\n') }}</code></pre>
            <p v-else class="logs-empty">No FFmpeg terminal events recorded yet.</p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.videoforge-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: 24px;
  position: relative;
  min-height: 520px;
}

/* Drag Overlay */
.drag-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 14, 23, 0.9);
  backdrop-filter: blur(8px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #ff1e42;
  border-radius: 12px;
  pointer-events: none;
}

.drag-overlay-card {
  text-align: center;
  background: #0f1420;
  border: 1px solid rgba(255, 30, 66, 0.4);
  padding: 32px 48px;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(255, 30, 66, 0.2);
}

.drag-overlay-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 8px;
}

.drag-overlay-card h3 {
  margin: 0 0 4px;
  font-size: 1.3rem;
  color: #f8fafc;
}

.drag-overlay-card p {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

/* Header */
.videoforge-header {
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

.header-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.engine-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid;
}

.engine-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.engine-badge.unloaded {
  background: rgba(100, 116, 139, 0.15);
  border-color: rgba(100, 116, 139, 0.3);
  color: #94a3b8;
}
.engine-badge.unloaded .dot { background: #94a3b8; }

.engine-badge.loading {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.35);
  color: #fbbf24;
}
.engine-badge.loading .dot { background: #fbbf24; }

.engine-badge.ready {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.35);
  color: #34d399;
}
.engine-badge.ready .dot { background: #10b981; }

.engine-badge.error {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.35);
  color: #f87171;
}
.engine-badge.error .dot { background: #ef4444; }

.privacy-badge {
  font-size: 0.68rem;
  font-weight: 700;
  color: #00f0ff;
  background: rgba(0, 240, 255, 0.1);
  border: 1px solid rgba(0, 240, 255, 0.3);
  padding: 2px 8px;
  border-radius: 4px;
}

.videoforge-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
  color: #f8fafc;
}

.videoforge-desc {
  font-size: 0.8rem;
  color: #94a3b8;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.82rem;
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

.btn-action.secondary:hover {
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
  font-size: 1.25rem;
  font-weight: 700;
  color: #f8fafc;
}

.dropzone-subtitle {
  margin: 0 0 20px;
  font-size: 0.85rem;
  color: #64748b;
  max-width: 580px;
  line-height: 1.4;
}

.format-pills-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 24px;
  max-width: 600px;
}

.f-pill {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 8px;
  background: #141b2b;
  border: 1px solid #1c2638;
  border-radius: 4px;
  color: #cbd5e1;
}

.dropzone-actions {
  margin-bottom: 16px;
}

.btn-upload {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  background: #ff1e42;
  border: none;
  color: #ffffff;
  transition: all 0.2s;
}

.btn-upload:hover {
  background: #e01638;
}

.dropzone-note {
  font-size: 0.75rem;
  color: #64748b;
}

/* Workspace Grid */
.workspace-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 16px;
  align-items: start;
}

@media (max-width: 960px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}

.main-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-card {
  background: #0f1420;
  border: 1px solid #1c2638;
  border-radius: 10px;
  overflow: hidden;
}

/* Player Card */
.player-card {
  display: flex;
  flex-direction: column;
}

.video-container {
  width: 100%;
  max-height: 420px;
  background: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-video {
  width: 100%;
  max-height: 420px;
  outline: none;
}

.stats-bar {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  background: #141b2b;
  border-top: 1px solid #1c2638;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.s-label {
  font-size: 0.62rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.05em;
}

.s-val {
  font-size: 0.8rem;
  font-weight: 600;
  color: #cbd5e1;
}

/* Trim Card */
.trim-card {
  padding: 16px;
}

.card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.title-with-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cyber-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #ff1e42;
  cursor: pointer;
}

.card-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: #f8fafc;
  cursor: pointer;
}

.trim-summary-badge {
  font-size: 0.72rem;
  font-weight: 700;
  color: #ff4d6d;
  background: rgba(255, 30, 66, 0.12);
  border: 1px solid rgba(255, 30, 66, 0.35);
  padding: 2px 8px;
  border-radius: 4px;
}

.trim-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid #1c2638;
}

@media (max-width: 600px) {
  .trim-controls {
    grid-template-columns: 1fr;
  }
}

.trim-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trim-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.trim-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #94a3b8;
}

.btn-time-set {
  background: transparent;
  border: none;
  color: #00f0ff;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}

.btn-time-set:hover {
  text-decoration: underline;
}

.time-input {
  background: #141b2b;
  border: 1px solid #1c2638;
  border-radius: 6px;
  color: #f8fafc;
  padding: 8px 12px;
  font-size: 0.85rem;
  outline: none;
}

.time-input:focus {
  border-color: #ff1e42;
}

/* Config Card */
.config-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.05em;
}

.format-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
}

.format-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #141b2b;
  border: 1px solid #1c2638;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.format-btn:hover {
  border-color: #ff1e42;
  background: rgba(255, 30, 66, 0.04);
}

.format-btn.active {
  border-color: #ff1e42;
  background: rgba(255, 30, 66, 0.12);
  box-shadow: 0 0 12px rgba(255, 30, 66, 0.15);
}

.fmt-icon {
  font-size: 1.4rem;
}

.fmt-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fmt-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #f8fafc;
}

.fmt-desc {
  font-size: 0.65rem;
  color: #94a3b8;
  line-height: 1.2;
}

.settings-two-col {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.setting-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cyber-select {
  background: #141b2b;
  border: 1px solid #1c2638;
  border-radius: 6px;
  color: #f8fafc;
  padding: 8px 12px;
  font-size: 0.8rem;
  outline: none;
  cursor: pointer;
}

.cyber-select:focus {
  border-color: #ff1e42;
}

/* Action Footer */
.action-footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #1c2638;
}

.progress-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-bar-track {
  width: 100%;
  height: 8px;
  background: #141b2b;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff1e42, #00f0ff);
  transition: width 0.2s ease;
}

.progress-label-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: #94a3b8;
}

.progress-label-row .pct {
  color: #00f0ff;
  font-weight: 700;
}

.action-buttons-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-primary-action {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-primary-action.convert {
  background: #ff1e42;
  color: #ffffff;
}

.btn-primary-action.convert:hover:not(:disabled) {
  background: #e01638;
}

.btn-primary-action.convert:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary-action.download {
  background: #10b981;
  color: #ffffff;
}

.btn-primary-action.download:hover {
  background: #059669;
}

.btn-secondary-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  background: #141b2b;
  border: 1px solid #1c2638;
  color: #cbd5e1;
}

.btn-secondary-action:hover {
  border-color: #ff1e42;
  color: #ffffff;
}

/* Queue Panel */
.queue-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.queue-card {
  background: #0f1420;
  border: 1px solid #1c2638;
  border-radius: 10px;
  overflow: hidden;
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #141b2b;
  border-bottom: 1px solid #1c2638;
}

.queue-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: #f8fafc;
}

.btn-text-action {
  background: transparent;
  border: none;
  color: #ff4d6d;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.btn-text-action:hover {
  text-decoration: underline;
}

.queue-items-list {
  display: flex;
  flex-direction: column;
  max-height: 480px;
  overflow-y: auto;
}

.queue-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid #1c2638;
  cursor: pointer;
  transition: all 0.15s;
}

.queue-item:hover {
  background: rgba(255, 30, 66, 0.03);
}

.queue-item.active {
  background: rgba(255, 30, 66, 0.08);
  border-left: 3px solid #ff1e42;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}

.item-status-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.item-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.item-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: #f8fafc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.68rem;
  color: #64748b;
}

.target-tag {
  color: #00f0ff;
  font-weight: 700;
}

.result-size {
  color: #10b981;
  font-weight: 600;
}

.item-actions {
  display: flex;
  gap: 4px;
}

.btn-mini-download, .btn-mini-remove {
  background: #141b2b;
  border: 1px solid #23304a;
  border-radius: 4px;
  color: #cbd5e1;
  font-size: 0.72rem;
  padding: 3px 6px;
  cursor: pointer;
}

.btn-mini-download:hover {
  border-color: #10b981;
  color: #10b981;
}

.btn-mini-remove:hover {
  border-color: #ef4444;
  color: #ef4444;
}

/* Logs Drawer */
.logs-card {
  background: #0f1420;
  border: 1px solid #1c2638;
  border-radius: 10px;
  overflow: hidden;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #141b2b;
  cursor: pointer;
}

.logs-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: #cbd5e1;
}

.logs-toggle {
  font-size: 0.7rem;
  color: #64748b;
}

.logs-terminal {
  max-height: 200px;
  overflow-y: auto;
  background: #080c14;
  padding: 10px;
  font-family: monospace;
}

.logs-terminal pre {
  margin: 0;
  font-size: 0.68rem;
  color: #00f0ff;
  white-space: pre-wrap;
  word-break: break-all;
}

.logs-empty {
  margin: 0;
  font-size: 0.7rem;
  color: #64748b;
  text-align: center;
  padding: 12px;
}
</style>
