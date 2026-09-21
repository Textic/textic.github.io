<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'

const { copyToClipboard } = useToast()

const length = ref(16)
const includeUpper = ref(true)
const includeLower = ref(true)
const includeNumbers = ref(true)
const includeSymbols = ref(true)
const excludeAmbiguous = ref(false)

const password = ref('')
const entropyBits = ref(0)

const CHARS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  ambiguous: 'il1Lo0O'
}

const generatePassword = () => {
  let upperPool = includeUpper.value ? CHARS.upper : ''
  let lowerPool = includeLower.value ? CHARS.lower : ''
  let numPool = includeNumbers.value ? CHARS.numbers : ''
  let symPool = includeSymbols.value ? CHARS.symbols : ''

  if (excludeAmbiguous.value) {
    const ambRegex = new RegExp(`[${CHARS.ambiguous}]`, 'g')
    upperPool = upperPool.replace(ambRegex, '')
    lowerPool = lowerPool.replace(ambRegex, '')
    numPool = numPool.replace(ambRegex, '')
  }

  const pool = upperPool + lowerPool + numPool + symPool

  if (!pool) {
    password.value = ''
    entropyBits.value = 0
    return
  }

  // Ensure at least one from each active category
  const requiredChars: string[] = []
  if (upperPool) requiredChars.push(getRandomChar(upperPool))
  if (lowerPool) requiredChars.push(getRandomChar(lowerPool))
  if (numPool) requiredChars.push(getRandomChar(numPool))
  if (symPool) requiredChars.push(getRandomChar(symPool))

  let result = ''
  for (let i = 0; i < length.value - requiredChars.length; i++) {
    result += getRandomChar(pool)
  }

  // Shuffle required characters into random positions
  requiredChars.forEach(char => {
    const idx = Math.floor(Math.random() * (result.length + 1))
    result = result.slice(0, idx) + char + result.slice(idx)
  })

  password.value = result
  entropyBits.value = Math.round(length.value * (Math.log(pool.length) / Math.log(2)))
}

const getRandomChar = (pool: string): string => {
  if (!pool) return ''
  const array = new Uint32Array(1)
  window.crypto.getRandomValues(array)
  const randIndex = (array[0] ?? 0) % pool.length
  return pool.charAt(randIndex)
}

const applyPreset = (preset: 'pin' | 'readable' | 'secure' | 'ultra') => {
  if (preset === 'pin') {
    length.value = 6
    includeUpper.value = false
    includeLower.value = false
    includeNumbers.value = true
    includeSymbols.value = false
    excludeAmbiguous.value = false
  } else if (preset === 'readable') {
    length.value = 14
    includeUpper.value = true
    includeLower.value = true
    includeNumbers.value = true
    includeSymbols.value = false
    excludeAmbiguous.value = true
  } else if (preset === 'secure') {
    length.value = 20
    includeUpper.value = true
    includeLower.value = true
    includeNumbers.value = true
    includeSymbols.value = true
    excludeAmbiguous.value = false
  } else if (preset === 'ultra') {
    length.value = 32
    includeUpper.value = true
    includeLower.value = true
    includeNumbers.value = true
    includeSymbols.value = true
    excludeAmbiguous.value = false
  }
  generatePassword()
}

const strengthInfo = computed(() => {
  if (entropyBits.value === 0) {
    return { label: 'None', percent: 0, color: 'var(--neon-red)' }
  }
  if (entropyBits.value < 40) {
    return { label: 'Weak (Vulnerable)', percent: 25, color: '#ef4444' }
  }
  if (entropyBits.value < 65) {
    return { label: 'Medium (Fair)', percent: 50, color: '#f59e0b' }
  }
  if (entropyBits.value < 90) {
    return { label: 'Strong (Secure)', percent: 75, color: '#e11d48' }
  }
  return { label: 'Very Strong (Military Grade)', percent: 100, color: '#10b981' }
})

const copyCurrentPassword = () => {
  if (password.value) {
    copyToClipboard(password.value, 'Password copied to clipboard!')
  }
}

onMounted(() => {
  generatePassword()
})
</script>

<template>
  <div class="util-card">
    <div class="util-title-bar">
      <div class="title-left">
        <span class="util-title-icon">🔐</span>
        <h3 class="util-title-text">PassFort</h3>
      </div>
      <span class="entropy-badge">{{ entropyBits }} bits</span>
    </div>

    <p class="util-desc">
      Generates cryptographically secure random passwords with real-time Shannon entropy calculation in your browser.
    </p>

    <!-- Password Display Output -->
    <div class="passgen-output-container">
      <div class="passgen-output" :class="{ empty: !password }">
        {{ password || 'Select at least one character set' }}
      </div>
      <button
        class="btn-icon passgen-btn-copy"
        title="Copy Password"
        :disabled="!password"
        @click="copyCurrentPassword"
      >
        📋
      </button>
    </div>

    <!-- Strength Meter -->
    <div class="strength-box">
      <div class="strength-text">
        <span>Security Strength:</span>
        <span :style="{ color: strengthInfo.color, fontWeight: '700' }">{{ strengthInfo.label }}</span>
      </div>
      <div class="strength-meter-bar">
        <div
          class="strength-fill"
          :style="{ width: strengthInfo.percent + '%', backgroundColor: strengthInfo.color }"
        ></div>
      </div>
    </div>

    <!-- Presets Row -->
    <div class="presets-row">
      <span class="presets-label">Presets:</span>
      <button class="preset-btn" @click="applyPreset('pin')">PIN (6)</button>
      <button class="preset-btn" @click="applyPreset('readable')">Readable (14)</button>
      <button class="preset-btn" @click="applyPreset('secure')">Secure (20)</button>
      <button class="preset-btn" @click="applyPreset('ultra')">Ultra (32)</button>
    </div>

    <!-- Length Slider -->
    <div class="control-group">
      <div class="control-label-row">
        <span>Character Length</span>
        <span class="length-display">{{ length }}</span>
      </div>
      <input
        v-model.number="length"
        type="range"
        min="6"
        max="64"
        @input="generatePassword"
      />
    </div>

    <!-- Character Options Checkboxes -->
    <div class="checkbox-grid">
      <label class="checkbox-label">
        <input v-model="includeUpper" type="checkbox" @change="generatePassword" />
        <span>Uppercase letters (A-Z)</span>
      </label>
      <label class="checkbox-label">
        <input v-model="includeLower" type="checkbox" @change="generatePassword" />
        <span>Lowercase letters (a-z)</span>
      </label>
      <label class="checkbox-label">
        <input v-model="includeNumbers" type="checkbox" @change="generatePassword" />
        <span>Numbers (0-9)</span>
      </label>
      <label class="checkbox-label">
        <input v-model="includeSymbols" type="checkbox" @change="generatePassword" />
        <span>Special symbols (!@#$%)</span>
      </label>
      <label class="checkbox-label" style="grid-column: 1 / -1;">
        <input v-model="excludeAmbiguous" type="checkbox" @change="generatePassword" />
        <span>Avoid ambiguous characters (1, l, I, 0, O)</span>
      </label>
    </div>

    <!-- Action Button -->
    <button class="btn btn-red btn-generate" @click="generatePassword">
      <span>🔄</span> Generate New Password
    </button>
  </div>
</template>

<style scoped>
.util-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  transition: var(--transition);
}

.util-card:hover {
  border-color: var(--border-glow-red);
  background: rgba(28, 15, 24, 0.7);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.util-title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 0.85rem;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.util-title-icon {
  font-size: 1.3rem;
  color: var(--neon-red);
}

.util-title-text {
  font-size: 1.2rem;
  font-weight: 700;
}

.entropy-badge {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--neon-red);
  background: rgba(255, 30, 66, 0.08);
  border: 1px solid rgba(255, 30, 66, 0.3);
  padding: 0.2rem 0.6rem;
  border-radius: 50px;
}

.util-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.passgen-output-container {
  position: relative;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.9rem 3.2rem 0.9rem 1.1rem;
  display: flex;
  align-items: center;
  min-height: 52px;
}

.passgen-output {
  font-family: var(--font-mono);
  font-size: 1.1rem;
  color: #fdf8f9;
  overflow-x: auto;
  white-space: nowrap;
  width: 100%;
}

.passgen-output.empty {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-family: var(--font-sans);
}

.passgen-btn-copy {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
}

.strength-box {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.strength-text {
  font-size: 0.8rem;
  color: var(--text-secondary);
  display: flex;
  justify-content: space-between;
}

.strength-meter-bar {
  height: 5px;
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  transition: var(--transition);
}

.presets-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.presets-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 600;
}

.preset-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  padding: 0.25rem 0.65rem;
  font-size: 0.75rem;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: var(--transition);
}

.preset-btn:hover {
  background: rgba(255, 30, 66, 0.12);
  border-color: var(--neon-red);
  color: white;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.control-label-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.length-display {
  font-weight: 700;
  color: var(--neon-red);
  font-family: var(--font-mono);
}

.checkbox-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  accent-color: var(--neon-red);
  width: 16px;
  height: 16px;
}

.btn-generate {
  width: 100%;
  justify-content: center;
  padding: 0.85rem;
  font-size: 0.95rem;
}
</style>
