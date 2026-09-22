<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useToast } from '@/composables/useToast'

const { copyToClipboard } = useToast()

// --- 1. Live Epoch Clock ---
const now = ref(Date.now())
const isPaused = ref(false)
let timerId: number | null = null

const startClock = () => {
  if (timerId !== null) return
  timerId = window.setInterval(() => {
    if (!isPaused.value) {
      now.value = Date.now()
    }
  }, 200)
}

const togglePause = () => {
  isPaused.value = !isPaused.value
}

const currentSeconds = computed(() => Math.floor(now.value / 1000))
const currentMs = computed(() => now.value)

// --- 2. Timestamp to Human Date ---
const tsInput = ref<string>('')
const detectedUnit = computed<'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds' | 'invalid'>(() => {
  const clean = tsInput.value.trim()
  if (!clean || !/^-?\d+$/.test(clean)) return 'invalid'
  const len = clean.replace(/^-/, '').length
  if (len <= 11) return 'seconds'
  if (len <= 14) return 'milliseconds'
  if (len <= 17) return 'microseconds'
  return 'nanoseconds'
})

const parsedDateFromTs = computed<Date | null>(() => {
  const clean = tsInput.value.trim()
  if (!clean || !/^-?\d+$/.test(clean)) return null
  const num = parseInt(clean, 10)
  if (isNaN(num)) return null

  switch (detectedUnit.value) {
    case 'seconds':
      return new Date(num * 1000)
    case 'milliseconds':
      return new Date(num)
    case 'microseconds':
      return new Date(Math.floor(num / 1000))
    case 'nanoseconds':
      return new Date(Math.floor(num / 1000000))
    default:
      return null
  }
})

const relativeTime = (targetDate: Date): string => {
  const diffSec = Math.floor((targetDate.getTime() - Date.now()) / 1000)
  const isPast = diffSec < 0
  const abs = Math.abs(diffSec)

  if (abs < 5) return 'Just now'
  if (abs < 60) return isPast ? `${abs} seconds ago` : `in ${abs} seconds`
  const minutes = Math.floor(abs / 60)
  if (minutes < 60) return isPast ? `${minutes}m ago` : `in ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return isPast ? `${hours}h ago` : `in ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 365) return isPast ? `${days}d ago` : `in ${days}d`
  const years = (days / 365).toFixed(1)
  return isPast ? `${years} years ago` : `in ${years} years`
}

const tsDetails = computed(() => {
  const d = parsedDateFromTs.value
  if (!d || isNaN(d.getTime())) return null

  return {
    iso: d.toISOString(),
    local: d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }),
    utc: d.toUTCString(),
    relative: relativeTime(d),
    dayOfWeek: d.toLocaleDateString(undefined, { weekday: 'long' }),
    isLeapYear: new Date(d.getFullYear(), 1, 29).getDate() === 29
  }
})

// --- 3. Human Date to Timestamp ---
const localIsoNow = () => {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const datePickerValue = ref<string>(localIsoNow())

const parsedTsFromDate = computed(() => {
  if (!datePickerValue.value) return null
  const d = new Date(datePickerValue.value)
  if (isNaN(d.getTime())) return null
  return {
    seconds: Math.floor(d.getTime() / 1000),
    milliseconds: d.getTime(),
    iso: d.toISOString()
  }
})

const setDatePreset = (action: 'now' | 'startOfDay' | 'endOfDay' | 'addHour' | 'addDay' | 'addWeek') => {
  const base = new Date()
  switch (action) {
    case 'now':
      break
    case 'startOfDay':
      base.setHours(0, 0, 0, 0)
      break
    case 'endOfDay':
      base.setHours(23, 59, 59, 999)
      break
    case 'addHour':
      base.setTime(base.getTime() + 60 * 60 * 1000)
      break
    case 'addDay':
      base.setTime(base.getTime() + 24 * 60 * 60 * 1000)
      break
    case 'addWeek':
      base.setTime(base.getTime() + 7 * 24 * 60 * 60 * 1000)
      break
  }

  const pad = (n: number) => n.toString().padStart(2, '0')
  datePickerValue.value = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}:${pad(base.getSeconds())}`
}

// --- 4. World Timezones ---
interface TimezoneItem {
  city: string
  tz: string
  flag: string
}

const timezones: TimezoneItem[] = [
  { city: 'UTC (Coordinated Universal Time)', tz: 'UTC', flag: '🌐' },
  { city: 'Santiago (Chile)', tz: 'America/Santiago', flag: '🇨🇱' },
  { city: 'New York (EDT/EST)', tz: 'America/New_York', flag: '🇺🇸' },
  { city: 'San Francisco (PDT/PST)', tz: 'America/Los_Angeles', flag: '🇺🇸' },
  { city: 'London (BST/GMT)', tz: 'Europe/London', flag: '🇬🇧' },
  { city: 'Madrid (CEST/CET)', tz: 'Europe/Madrid', flag: '🇪🇸' },
  { city: 'Tokyo (JST)', tz: 'Asia/Tokyo', flag: '🇯🇵' },
  { city: 'Sydney (AEST)', tz: 'Australia/Sydney', flag: '🇦🇺' }
]

const getTimeInTz = (tz: string) => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(new Date(now.value))
  } catch {
    return 'Invalid TZ'
  }
}

onMounted(() => {
  tsInput.value = Math.floor(Date.now() / 1000).toString()
  startClock()
})

onUnmounted(() => {
  if (timerId !== null) {
    clearInterval(timerId)
    timerId = null
  }
})
</script>

<template>
  <div class="time-studio-container">
    <!-- Header Hero Banner -->
    <div class="time-header-card">
      <div class="header-left">
        <span class="header-icon">⏱️</span>
        <div>
          <h2 class="header-title">Unix Timestamp & Time Studio</h2>
          <p class="header-desc">Precision epoch counter, bi-directional timestamp converter, and developer timezone matrix.</p>
        </div>
      </div>

      <!-- Live Epoch Display -->
      <div class="live-epoch-box">
        <div class="epoch-label-row">
          <span class="pulse-indicator" :class="{ paused: isPaused }"></span>
          <span class="epoch-label">CURRENT UNIX EPOCH</span>
          <span class="epoch-tag">{{ isPaused ? 'PAUSED' : 'LIVE' }}</span>
        </div>
        <div class="epoch-numbers">
          <span class="epoch-sec">{{ currentSeconds }}</span>
          <span class="epoch-sub">.{{ currentMs.toString().slice(-3) }}s</span>
        </div>
        <div class="epoch-actions">
          <button class="btn btn-primary btn-sm" @click="copyToClipboard(currentSeconds.toString(), 'Epoch seconds copied!')">
            📋 Copy (s)
          </button>
          <button class="btn btn-secondary btn-sm" @click="copyToClipboard(currentMs.toString(), 'Epoch milliseconds copied!')">
            📋 Copy (ms)
          </button>
          <button class="btn btn-secondary btn-sm" @click="togglePause">
            {{ isPaused ? '▶️ Resume' : '⏸️ Pause' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Main Two-Column Converters Grid -->
    <div class="converters-grid">
      <!-- Card 1: Timestamp to Human Date -->
      <div class="card time-card">
        <div class="card-header">
          <div class="card-title-box">
            <span class="card-icon">🔢</span>
            <h3 class="card-title">Timestamp → Human Date</h3>
          </div>
          <span v-if="detectedUnit !== 'invalid'" class="card-badge">Unit: {{ detectedUnit }}</span>
        </div>

        <div class="input-field-group">
          <label class="field-label">Unix Timestamp (s, ms, μs, ns):</label>
          <div class="input-with-actions">
            <input
              v-model="tsInput"
              type="text"
              class="text-input"
              placeholder="e.g. 1774268400"
              spellcheck="false"
            />
            <button class="btn btn-secondary btn-sm" @click="tsInput = Math.floor(now / 1000).toString()">
              Now (s)
            </button>
            <button class="btn btn-secondary btn-sm" @click="tsInput = now.toString()">
              Now (ms)
            </button>
          </div>
        </div>

        <!-- Output Details -->
        <div v-if="tsDetails" class="results-table">
          <div class="result-row">
            <span class="result-key">ISO 8601 (UTC):</span>
            <div class="result-val-box">
              <span class="result-val code-font">{{ tsDetails.iso }}</span>
              <button class="copy-tiny" @click="copyToClipboard(tsDetails.iso)">📋</button>
            </div>
          </div>
          <div class="result-row">
            <span class="result-key">Local Time:</span>
            <div class="result-val-box">
              <span class="result-val">{{ tsDetails.local }}</span>
              <button class="copy-tiny" @click="copyToClipboard(tsDetails.local)">📋</button>
            </div>
          </div>
          <div class="result-row">
            <span class="result-key">RFC 2822:</span>
            <div class="result-val-box">
              <span class="result-val code-font">{{ tsDetails.utc }}</span>
              <button class="copy-tiny" @click="copyToClipboard(tsDetails.utc)">📋</button>
            </div>
          </div>
          <div class="result-row">
            <span class="result-key">Relative:</span>
            <span class="result-val highlight-val">{{ tsDetails.relative }}</span>
          </div>
          <div class="result-row">
            <span class="result-key">Day Info:</span>
            <span class="result-val text-muted">{{ tsDetails.dayOfWeek }} {{ tsDetails.isLeapYear ? '(Leap Year)' : '' }}</span>
          </div>
        </div>
        <div v-else class="empty-hint">
          Enter a valid integer timestamp above to calculate human dates.
        </div>
      </div>

      <!-- Card 2: Human Date to Timestamp -->
      <div class="card time-card">
        <div class="card-header">
          <div class="card-title-box">
            <span class="card-icon">📅</span>
            <h3 class="card-title">Date & Time → Timestamp</h3>
          </div>
          <span class="card-badge">Precision</span>
        </div>

        <div class="input-field-group">
          <label class="field-label">Select Date & Time (Local):</label>
          <input
            v-model="datePickerValue"
            type="datetime-local"
            step="1"
            class="datetime-input text-input"
          />
        </div>

        <!-- Presets Toolbar -->
        <div class="presets-row">
          <span class="presets-title">Presets:</span>
          <div class="preset-buttons">
            <button class="btn btn-secondary btn-xs" @click="setDatePreset('now')">Now</button>
            <button class="btn btn-secondary btn-xs" @click="setDatePreset('startOfDay')">00:00 Today</button>
            <button class="btn btn-secondary btn-xs" @click="setDatePreset('endOfDay')">23:59 Today</button>
            <button class="btn btn-secondary btn-xs" @click="setDatePreset('addHour')">+1 Hour</button>
            <button class="btn btn-secondary btn-xs" @click="setDatePreset('addDay')">+1 Day</button>
            <button class="btn btn-secondary btn-xs" @click="setDatePreset('addWeek')">+7 Days</button>
          </div>
        </div>

        <!-- Generated Timestamps -->
        <div v-if="parsedTsFromDate" class="results-table">
          <div class="result-row">
            <span class="result-key">Epoch Seconds:</span>
            <div class="result-val-box">
              <span class="result-val code-font highlight-val">{{ parsedTsFromDate.seconds }}</span>
              <button class="copy-tiny" @click="copyToClipboard(parsedTsFromDate.seconds.toString())">📋</button>
            </div>
          </div>
          <div class="result-row">
            <span class="result-key">Epoch Milliseconds:</span>
            <div class="result-val-box">
              <span class="result-val code-font">{{ parsedTsFromDate.milliseconds }}</span>
              <button class="copy-tiny" @click="copyToClipboard(parsedTsFromDate.milliseconds.toString())">📋</button>
            </div>
          </div>
          <div class="result-row">
            <span class="result-key">ISO Format:</span>
            <div class="result-val-box">
              <span class="result-val code-font">{{ parsedTsFromDate.iso }}</span>
              <button class="copy-tiny" @click="copyToClipboard(parsedTsFromDate.iso)">📋</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Timezones Matrix Section -->
    <div class="card time-card tz-card">
      <div class="card-header">
        <div class="card-title-box">
          <span class="card-icon">🌐</span>
          <h3 class="card-title">World Developer Timezones</h3>
        </div>
        <span class="card-badge">Live Sync</span>
      </div>

      <div class="tz-grid">
        <div
          v-for="item in timezones"
          :key="item.tz"
          class="tz-item"
        >
          <div class="tz-item-header">
            <span class="tz-flag">{{ item.flag }}</span>
            <span class="tz-name">{{ item.city }}</span>
          </div>
          <div class="tz-time-box">
            <span class="tz-time">{{ getTimeInTz(item.tz) }}</span>
            <button class="copy-tiny" title="Copy timezone string" @click="copyToClipboard(getTimeInTz(item.tz))">📋</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.time-studio-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
}

.time-header-card {
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

.live-epoch-box {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid var(--border-glow-red);
  border-radius: var(--radius-md);
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  box-shadow: 0 0 20px rgba(255, 30, 66, 0.15);
}

.epoch-label-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pulse-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--neon-red);
  box-shadow: 0 0 8px var(--neon-red);
  animation: pulse-glow 1.5s infinite;
}

.pulse-indicator.paused {
  background: var(--text-muted);
  box-shadow: none;
  animation: none;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.2); }
}

.epoch-label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.epoch-tag {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  background: rgba(255, 30, 66, 0.15);
  color: var(--neon-red);
  font-weight: 700;
}

.epoch-numbers {
  display: flex;
  align-items: baseline;
  font-family: var(--font-mono);
  font-weight: 800;
  line-height: 1;
}

.epoch-sec {
  font-size: 1.85rem;
  color: white;
  letter-spacing: 0.05em;
}

.epoch-sub {
  font-size: 1.1rem;
  color: var(--neon-red);
}

.epoch-actions {
  display: flex;
  gap: 0.4rem;
}

.converters-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1.5rem;
}

@media (min-width: 992px) {
  .converters-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.time-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  transition: var(--transition);
}

.time-card:hover {
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

.input-field-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.input-with-actions {
  display: flex;
  gap: 0.5rem;
}

.text-input {
  flex: 1;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.6rem 0.85rem;
  color: white;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  outline: none;
  transition: var(--transition);
}

.text-input:focus {
  border-color: var(--neon-red);
  box-shadow: 0 0 10px rgba(255, 30, 66, 0.2);
}

.datetime-input {
  color-scheme: dark;
}

.presets-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.presets-title {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
}

.preset-buttons {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.btn-xs {
  padding: 0.2rem 0.5rem;
  font-size: 0.7rem;
}

.results-table {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-sm);
  padding: 0.85rem 1rem;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.result-key {
  color: var(--text-muted);
  font-weight: 500;
}

.result-val-box {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.result-val {
  color: var(--text-primary);
  word-break: break-all;
}

.code-font {
  font-family: var(--font-mono);
}

.highlight-val {
  color: var(--neon-red);
  font-weight: 700;
}

.copy-tiny {
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.6;
  font-size: 0.8rem;
  padding: 0.1rem;
  transition: opacity 0.2s;
}

.copy-tiny:hover {
  opacity: 1;
}

.empty-hint {
  font-size: 0.82rem;
  color: var(--text-muted);
  font-style: italic;
  padding: 1rem;
  text-align: center;
}

/* Timezones Grid */
.tz-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 0.85rem;
}

@media (min-width: 640px) {
  .tz-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .tz-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.tz-item {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  transition: var(--transition);
}

.tz-item:hover {
  border-color: var(--border-glow-red);
  background: rgba(28, 15, 24, 0.6);
}

.tz-item-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.tz-flag {
  font-size: 1rem;
}

.tz-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tz-time-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tz-time {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  color: white;
}
</style>
