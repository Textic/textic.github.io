<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from '@/composables/useToast'

const { copyToClipboard } = useToast()

// --- 1. Base Color State ---
const hexInput = ref<string>('#ff1e42')

// Helpers for color conversions
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  let clean = hex.replace(/^#/, '').trim()
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('')
  }
  if (clean.length !== 6) return null
  const num = parseInt(clean, 16)
  if (isNaN(num)) return null
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  }
}

const rgbToHex = (r: number, g: number, b: number): string => {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')
}

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

// Approximate OKLCH from sRGB
const rgbToOklch = (r: number, g: number, b: number) => {
  const toLinear = (c: number) => {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)

  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  const l_c = Math.cbrt(l_)
  const m_c = Math.cbrt(m_)
  const s_c = Math.cbrt(s_)

  const L = 0.2104542553 * l_c + 0.7936177850 * m_c - 0.0040720468 * s_c
  const a = 1.9779984951 * l_c - 2.4285922050 * m_c + 0.4505937099 * s_c
  const b_ = 0.0259040371 * l_c + 0.7827717662 * m_c - 0.8086757660 * s_c

  const C = Math.sqrt(a * a + b_ * b_)
  let H = (Math.atan2(b_, a) * 180) / Math.PI
  if (H < 0) H += 360

  return {
    l: (L * 100).toFixed(1) + '%',
    c: C.toFixed(3),
    h: H.toFixed(1)
  }
}

const currentRgb = computed(() => hexToRgb(hexInput.value) || { r: 255, g: 30, b: 66 })
const currentHsl = computed(() => rgbToHsl(currentRgb.value.r, currentRgb.value.g, currentRgb.value.b))
const currentOklch = computed(() => rgbToOklch(currentRgb.value.r, currentRgb.value.g, currentRgb.value.b))

const formats = computed(() => [
  { label: 'HEX', value: hexInput.value.toUpperCase() },
  { label: 'RGB', value: `rgb(${currentRgb.value.r}, ${currentRgb.value.g}, ${currentRgb.value.b})` },
  { label: 'HSL', value: `hsl(${currentHsl.value.h}, ${currentHsl.value.s}%, ${currentHsl.value.l}%)` },
  { label: 'OKLCH', value: `oklch(${currentOklch.value.l} ${currentOklch.value.c} ${currentOklch.value.h})` },
  { label: 'CSS Variable', value: `--neon-accent: ${hexInput.value};` }
])

// --- 2. Contrast & WCAG Calculator ---
const getLuminance = (r: number, g: number, b: number) => {
  const a = [r, g, b].map(v => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  const [lr = 0, lg = 0, lb = 0] = a
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

const getContrastRatio = (lum1: number, lum2: number) => {
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

const colorLuminance = computed(() => getLuminance(currentRgb.value.r, currentRgb.value.g, currentRgb.value.b))
const darkBgLuminance = getLuminance(12, 5, 10) // #0c050a
const whiteLuminance = getLuminance(255, 255, 255)

const contrastOnDark = computed(() => {
  const ratio = getContrastRatio(colorLuminance.value, darkBgLuminance)
  return {
    ratio: ratio.toFixed(2),
    aaNormal: ratio >= 4.5,
    aaaNormal: ratio >= 7.0,
    aaLarge: ratio >= 3.0,
    aaaLarge: ratio >= 4.5
  }
})

const contrastOnWhite = computed(() => {
  const ratio = getContrastRatio(colorLuminance.value, whiteLuminance)
  return {
    ratio: ratio.toFixed(2),
    aaNormal: ratio >= 4.5,
    aaaNormal: ratio >= 7.0,
    aaLarge: ratio >= 3.0,
    aaaLarge: ratio >= 4.5
  }
})

// --- 3. Cyberpunk Gradient Studio ---
interface GradientPreset {
  name: string
  color1: string
  color2: string
  color3?: string
  angle: number
}

const gradientPresets: GradientPreset[] = [
  { name: 'Crimson Matrix', color1: '#ff1e42', color2: '#120207', angle: 135 },
  { name: 'Synthwave Dusk', color1: '#ff007f', color2: '#7928ca', color3: '#00dfd8', angle: 90 },
  { name: 'Emerald Terminal', color1: '#00ff66', color2: '#002611', angle: 180 },
  { name: 'Cyber Violet', color1: '#8b5cf6', color2: '#ec4899', angle: 45 },
  { name: 'Solar Flare', color1: '#ffaa00', color2: '#ff1e42', angle: 120 }
]

const gradColor1 = ref('#ff1e42')
const gradColor2 = ref('#7928ca')
const gradColor3 = ref('#00dfd8')
const useThirdColor = ref(true)
const gradAngle = ref(135)
const gradType = ref<'linear' | 'radial'>('linear')

const applyPreset = (preset: GradientPreset) => {
  gradColor1.value = preset.color1
  gradColor2.value = preset.color2
  if (preset.color3) {
    gradColor3.value = preset.color3
    useThirdColor.value = true
  } else {
    useThirdColor.value = false
  }
  gradAngle.value = preset.angle
}

const cssGradientValue = computed(() => {
  const stops = useThirdColor.value
    ? `${gradColor1.value}, ${gradColor2.value}, ${gradColor3.value}`
    : `${gradColor1.value}, ${gradColor2.value}`

  if (gradType.value === 'radial') {
    return `radial-gradient(circle, ${stops})`
  }
  return `linear-gradient(${gradAngle.value}deg, ${stops})`
})

// --- 4. Box Shadow & Neon Glow Studio ---
const glowBlur = ref(25)
const glowSpread = ref(0)
const glowOpacity = ref(0.6)
const isMultiGlow = ref(true)

const cssBoxShadow = computed(() => {
  const { r, g, b } = currentRgb.value
  const primaryRgba = `rgba(${r}, ${g}, ${b}, ${glowOpacity.value})`
  const deepRgba = `rgba(${r}, ${g}, ${b}, ${(glowOpacity.value * 0.4).toFixed(2)})`

  if (isMultiGlow.value) {
    return `0 0 10px ${primaryRgba}, 0 0 ${glowBlur.value}px ${glowSpread.value}px ${primaryRgba}, 0 0 ${glowBlur.value * 2}px ${deepRgba}`
  }
  return `0 0 ${glowBlur.value}px ${glowSpread.value}px ${primaryRgba}`
})
</script>

<template>
  <div class="color-studio-container">
    <!-- Header Hero Banner -->
    <div class="color-header-card">
      <div class="header-left">
        <span class="header-icon">🎨</span>
        <div>
          <h2 class="header-title">Color & CSS Studio</h2>
          <p class="header-desc">Multi-format color conversion, WCAG contrast accessibility, neon glow, and gradient laboratory.</p>
        </div>
      </div>

      <!-- Live Color Picker Orb -->
      <div class="live-color-box">
        <label class="color-picker-orb" :style="{ backgroundColor: hexInput }">
          <input v-model="hexInput" type="color" class="hidden-color-input" />
        </label>
        <div class="color-meta-box">
          <span class="color-code">{{ hexInput.toUpperCase() }}</span>
          <span class="color-badge">Click orb to pick</span>
        </div>
      </div>
    </div>

    <!-- Grid Layout: Converters & Presets -->
    <div class="studio-grid">
      <!-- Section 1: Color Formats -->
      <div class="card studio-card">
        <div class="card-header">
          <div class="card-title-box">
            <span class="card-icon">⚡</span>
            <h3 class="card-title">Color Formats</h3>
          </div>
          <span class="card-badge">Synchronized</span>
        </div>

        <!-- Formats List -->
        <div class="formats-list">
          <div
            v-for="fmt in formats"
            :key="fmt.label"
            class="format-row"
          >
            <span class="fmt-label">{{ fmt.label }}</span>
            <div class="fmt-val-box">
              <span class="fmt-val">{{ fmt.value }}</span>
              <button class="btn-copy-format" title="Copy format" @click="copyToClipboard(fmt.value)">
                📋
              </button>
            </div>
          </div>
        </div>

        <!-- RGB Channel Sliders -->
        <div class="sliders-box">
          <span class="sliders-title">Channel Tweaker:</span>
          <div class="slider-item">
            <span class="slider-ch red-ch">R: {{ currentRgb.r }}</span>
            <input
              type="range"
              min="0"
              max="255"
              :value="currentRgb.r"
              class="range-slider slider-red"
              @input="(e) => hexInput = rgbToHex(Number((e.target as HTMLInputElement).value), currentRgb.g, currentRgb.b)"
            />
          </div>
          <div class="slider-item">
            <span class="slider-ch green-ch">G: {{ currentRgb.g }}</span>
            <input
              type="range"
              min="0"
              max="255"
              :value="currentRgb.g"
              class="range-slider slider-green"
              @input="(e) => hexInput = rgbToHex(currentRgb.r, Number((e.target as HTMLInputElement).value), currentRgb.b)"
            />
          </div>
          <div class="slider-item">
            <span class="slider-ch blue-ch">B: {{ currentRgb.b }}</span>
            <input
              type="range"
              min="0"
              max="255"
              :value="currentRgb.b"
              class="range-slider slider-blue"
              @input="(e) => hexInput = rgbToHex(currentRgb.r, currentRgb.g, Number((e.target as HTMLInputElement).value))"
            />
          </div>
        </div>
      </div>

      <!-- Section 2: WCAG Contrast & Accessibility -->
      <div class="card studio-card">
        <div class="card-header">
          <div class="card-title-box">
            <span class="card-icon">👁️</span>
            <h3 class="card-title">WCAG 2.1 Contrast</h3>
          </div>
          <span class="card-badge">Accessibility</span>
        </div>

        <!-- Contrast on Dark Background -->
        <div class="contrast-tile dark-tile">
          <div class="tile-header">
            <span class="tile-title">Against Dark Theme (#0C050A)</span>
            <span class="ratio-badge" :class="{ 'ratio-pass': Number(contrastOnDark.ratio) >= 4.5 }">
              {{ contrastOnDark.ratio }} : 1
            </span>
          </div>
          <div class="wcag-scores">
            <span class="score-tag" :class="{ pass: contrastOnDark.aaNormal }">Normal AA</span>
            <span class="score-tag" :class="{ pass: contrastOnDark.aaaNormal }">Normal AAA</span>
            <span class="score-tag" :class="{ pass: contrastOnDark.aaLarge }">Large AA</span>
            <span class="score-tag" :class="{ pass: contrastOnDark.aaaLarge }">Large AAA</span>
          </div>
          <p class="contrast-sample" :style="{ color: hexInput }">
            Cyberpunk Typography Preview Sample 01
          </p>
        </div>

        <!-- Contrast on White Background -->
        <div class="contrast-tile light-tile">
          <div class="tile-header">
            <span class="tile-title">Against White (#FFFFFF)</span>
            <span class="ratio-badge" :class="{ 'ratio-pass': Number(contrastOnWhite.ratio) >= 4.5 }">
              {{ contrastOnWhite.ratio }} : 1
            </span>
          </div>
          <div class="wcag-scores">
            <span class="score-tag" :class="{ pass: contrastOnWhite.aaNormal }">Normal AA</span>
            <span class="score-tag" :class="{ pass: contrastOnWhite.aaaNormal }">Normal AAA</span>
            <span class="score-tag" :class="{ pass: contrastOnWhite.aaLarge }">Large AA</span>
            <span class="score-tag" :class="{ pass: contrastOnWhite.aaaLarge }">Large AAA</span>
          </div>
          <p class="contrast-sample" :style="{ color: hexInput }">
            Cyberpunk Typography Preview Sample 02
          </p>
        </div>
      </div>
    </div>

    <!-- Section 3: Cyberpunk Gradient Generator -->
    <div class="card studio-card">
      <div class="card-header">
        <div class="card-title-box">
          <span class="card-icon">🌈</span>
          <h3 class="card-title">Cyberpunk Gradient Generator</h3>
        </div>
        <button class="btn btn-primary btn-sm" @click="copyToClipboard(`background: ${cssGradientValue};`, 'Gradient CSS copied!')">
          📋 Copy CSS
        </button>
      </div>

      <!-- Presets Row -->
      <div class="preset-gradients-row">
        <span class="presets-title">Presets:</span>
        <button
          v-for="p in gradientPresets"
          :key="p.name"
          class="gradient-preset-btn"
          @click="applyPreset(p)"
        >
          {{ p.name }}
        </button>
      </div>

      <!-- Controls & Live Preview -->
      <div class="gradient-editor-grid">
        <!-- Controls Left -->
        <div class="gradient-controls">
          <div class="control-row">
            <label class="control-label">Type:</label>
            <div class="btn-group">
              <button
                class="btn btn-xs"
                :class="gradType === 'linear' ? 'btn-primary' : 'btn-secondary'"
                @click="gradType = 'linear'"
              >
                Linear
              </button>
              <button
                class="btn btn-xs"
                :class="gradType === 'radial' ? 'btn-primary' : 'btn-secondary'"
                @click="gradType = 'radial'"
              >
                Radial
              </button>
            </div>
          </div>

          <div v-if="gradType === 'linear'" class="control-row">
            <label class="control-label">Angle: {{ gradAngle }}°</label>
            <input v-model.number="gradAngle" type="range" min="0" max="360" class="range-slider" />
          </div>

          <div class="control-row stops-row">
            <label class="control-label">Stops:</label>
            <div class="stops-inputs">
              <input v-model="gradColor1" type="color" class="color-dot-picker" />
              <input v-model="gradColor2" type="color" class="color-dot-picker" />
              <input v-if="useThirdColor" v-model="gradColor3" type="color" class="color-dot-picker" />
              <button
                class="btn btn-secondary btn-xs"
                @click="useThirdColor = !useThirdColor"
              >
                {{ useThirdColor ? '− 2 Stops' : '+ 3 Stops' }}
              </button>
            </div>
          </div>

          <div class="css-code-snippet">
            <code>background: {{ cssGradientValue }};</code>
          </div>
        </div>

        <!-- Preview Box Right -->
        <div class="gradient-preview-box" :style="{ background: cssGradientValue }">
          <span class="preview-glow-text">TEXTIC GRADIENT</span>
        </div>
      </div>
    </div>

    <!-- Section 4: Neon Glow & Box Shadow Studio -->
    <div class="card studio-card">
      <div class="card-header">
        <div class="card-title-box">
          <span class="card-icon">✨</span>
          <h3 class="card-title">Neon Glow & Box Shadow Studio</h3>
        </div>
        <button class="btn btn-primary btn-sm" @click="copyToClipboard(`box-shadow: ${cssBoxShadow};`, 'Box-shadow CSS copied!')">
          📋 Copy Glow CSS
        </button>
      </div>

      <div class="shadow-editor-grid">
        <div class="shadow-controls">
          <div class="control-row">
            <label class="control-label">Blur Radius: {{ glowBlur }}px</label>
            <input v-model.number="glowBlur" type="range" min="5" max="80" class="range-slider" />
          </div>
          <div class="control-row">
            <label class="control-label">Spread: {{ glowSpread }}px</label>
            <input v-model.number="glowSpread" type="range" min="0" max="40" class="range-slider" />
          </div>
          <div class="control-row">
            <label class="control-label">Glow Opacity: {{ Math.round(glowOpacity * 100) }}%</label>
            <input v-model.number="glowOpacity" type="range" min="0.1" max="1" step="0.05" class="range-slider" />
          </div>
          <div class="control-row">
            <label class="checkbox-label">
              <input v-model="isMultiGlow" type="checkbox" />
              <span>Multi-layer Cyberpunk Atmosphere</span>
            </label>
          </div>
          <div class="css-code-snippet">
            <code>box-shadow: {{ cssBoxShadow }};</code>
          </div>
        </div>

        <!-- Preview Box -->
        <div class="shadow-preview-stage">
          <div
            class="glow-box"
            :style="{
              boxShadow: cssBoxShadow,
              borderColor: hexInput,
              color: hexInput
            }"
          >
            <span>CYBER GLOW</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-studio-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
}

.color-header-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-icon {
  font-size: 2.2rem;
  color: var(--neon-red);
  filter: drop-shadow(0 0 12px rgba(255, 30, 66, 0.5));
}

.header-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: white;
  margin-bottom: 0.25rem;
}

.header-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.live-color-box {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.75rem 1.25rem;
}

.color-picker-orb {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
  position: relative;
  overflow: hidden;
  transition: transform 0.2s;
}

.color-picker-orb:hover {
  transform: scale(1.08);
}

.hidden-color-input {
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.color-meta-box {
  display: flex;
  flex-direction: column;
}

.color-code {
  font-family: var(--font-mono);
  font-size: 1.15rem;
  font-weight: 800;
  color: white;
}

.color-badge {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.studio-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1.5rem;
}

@media (min-width: 992px) {
  .studio-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.studio-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  transition: var(--transition);
}

.studio-card:hover {
  border-color: var(--border-glow-red);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card-icon {
  font-size: 1.2rem;
}

.card-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: white;
}

.card-badge {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.formats-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.format-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-sm);
  padding: 0.6rem 0.85rem;
}

.fmt-label {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--neon-red);
}

.fmt-val-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.fmt-val {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: white;
}

.btn-copy-format {
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.6;
  font-size: 0.85rem;
  transition: opacity 0.2s;
}

.btn-copy-format:hover {
  opacity: 1;
}

.sliders-box {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.5rem;
}

.sliders-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
}

.slider-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.slider-ch {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  width: 55px;
}

.red-ch { color: #ff4d6d; }
.green-ch { color: #52b788; }
.blue-ch { color: #4ea8de; }

.range-slider {
  flex: 1;
  accent-color: var(--neon-red);
  cursor: pointer;
  height: 5px;
}

.slider-red { accent-color: #ff4d6d; }
.slider-green { accent-color: #52b788; }
.slider-blue { accent-color: #4ea8de; }

/* WCAG Tiles */
.contrast-tile {
  border-radius: var(--radius-sm);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  border: 1px solid var(--border-color);
}

.dark-tile {
  background: #0c050a;
}

.light-tile {
  background: #ffffff;
}

.light-tile .tile-title {
  color: #111;
}

.tile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tile-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.ratio-badge {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 800;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.ratio-badge.ratio-pass {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.wcag-scores {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.score-tag {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
}

.score-tag.pass {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.contrast-sample {
  font-weight: 800;
  font-size: 0.95rem;
  margin-top: 0.25rem;
}

/* Gradient Generator */
.preset-gradients-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.presets-title {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
}

.gradient-preset-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.72rem;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
  transition: var(--transition);
}

.gradient-preset-btn:hover {
  background: rgba(255, 30, 66, 0.15);
  border-color: var(--neon-red);
  color: white;
}

.gradient-editor-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .gradient-editor-grid {
    grid-template-columns: 1.2fr 1fr;
  }
}

.gradient-controls {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  justify-content: space-between;
}

.control-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.stops-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-dot-picker {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid white;
  cursor: pointer;
  background: transparent;
}

.btn-group {
  display: flex;
  gap: 0.3rem;
}

.css-code-snippet {
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.6rem 0.85rem;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--neon-red);
  word-break: break-all;
}

.gradient-preview-box {
  min-height: 160px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
}

.preview-glow-text {
  font-weight: 900;
  letter-spacing: 0.1em;
  font-size: 1.2rem;
  color: white;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}

/* Box Shadow / Glow Studio */
.shadow-editor-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .shadow-editor-grid {
    grid-template-columns: 1.2fr 1fr;
  }
}

.shadow-controls {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.shadow-preview-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  border-radius: var(--radius-md);
  min-height: 180px;
  border: 1px solid var(--border-color);
}

.glow-box {
  width: 140px;
  height: 90px;
  border-radius: var(--radius-sm);
  border: 2px solid;
  background: rgba(10, 6, 9, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  transition: all 0.25s ease;
}
</style>
