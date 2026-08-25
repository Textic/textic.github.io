<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'

const { copyToClipboard, showToast } = useToast()

type Mode = 'encode' | 'decode'

const mode = ref<Mode>('encode')
const inputText = ref('')

// Async hashes state
const sha256Hash = ref('')
const sha512Hash = ref('')
const sha1Hash = ref('')

// --- Encoding / Decoding Implementations ---

// 1. Base64 (UTF-8 safe)
const base64Result = computed(() => {
  const text = inputText.value
  if (!text) return ''
  try {
    if (mode.value === 'encode') {
      return btoa(unescape(encodeURIComponent(text)))
    } else {
      return decodeURIComponent(escape(atob(text.trim())))
    }
  } catch {
    return '⚠️ Entrada no es Base64 válido'
  }
})

// 2. Base64 URL Safe
const base64UrlResult = computed(() => {
  const text = inputText.value
  if (!text) return ''
  try {
    if (mode.value === 'encode') {
      const b64 = btoa(unescape(encodeURIComponent(text)))
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    } else {
      let b64 = text.trim().replace(/-/g, '+').replace(/_/g, '/')
      while (b64.length % 4) b64 += '='
      return decodeURIComponent(escape(atob(b64)))
    }
  } catch {
    return '⚠️ Entrada no es Base64 URL válido'
  }
})

// 3. Hexadecimal
const hexResult = computed(() => {
  const text = inputText.value
  if (!text) return ''
  try {
    if (mode.value === 'encode') {
      const bytes = new TextEncoder().encode(text)
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ')
    } else {
      const cleanHex = text.replace(/0x|\s+/g, '')
      if (cleanHex.length % 2 !== 0) return '⚠️ Longitud impar de caracteres Hex'
      const bytes = new Uint8Array(cleanHex.length / 2)
      for (let i = 0; i < cleanHex.length; i += 2) {
        const byte = parseInt(cleanHex.substring(i, i + 2), 16)
        if (isNaN(byte)) return '⚠️ Carácter hexadecimal inválido'
        bytes[i / 2] = byte
      }
      return new TextDecoder().decode(bytes)
    }
  } catch {
    return '⚠️ Error procesando Hex'
  }
})

// 4. Binary (8-bit)
const binaryResult = computed(() => {
  const text = inputText.value
  if (!text) return ''
  try {
    if (mode.value === 'encode') {
      const bytes = new TextEncoder().encode(text)
      return Array.from(bytes).map(b => b.toString(2).padStart(8, '0')).join(' ')
    } else {
      const cleanBin = text.trim().split(/\s+/)
      const bytes = new Uint8Array(cleanBin.length)
      for (let i = 0; i < cleanBin.length; i++) {
        const item = cleanBin[i]
        if (!item || !/^[01]+$/.test(item)) return '⚠️ Bloque binario inválido'
        bytes[i] = parseInt(item, 2)
      }
      return new TextDecoder().decode(bytes)
    }
  } catch {
    return '⚠️ Error procesando Binario'
  }
})

// 5. URL Encode / Decode
const urlResult = computed(() => {
  const text = inputText.value
  if (!text) return ''
  try {
    if (mode.value === 'encode') {
      return encodeURIComponent(text)
    } else {
      return decodeURIComponent(text)
    }
  } catch {
    return '⚠️ Error procesando URL Encoding'
  }
})

// 6. HTML Entities
const htmlEntitiesResult = computed(() => {
  const text = inputText.value
  if (!text) return ''
  try {
    if (mode.value === 'encode') {
      return text.replace(/[\u00A0-\u9999<>&"']/g, c => '&#' + c.charCodeAt(0) + ';')
    } else {
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'text/html')
      return doc.documentElement.textContent || ''
    }
  } catch {
    return '⚠️ Error procesando HTML Entities'
  }
})

// 7. ROT13
const rot13Result = computed(() => {
  const text = inputText.value
  if (!text) return ''
  return text.replace(/[a-zA-Z]/g, c => {
    const code = c.charCodeAt(0)
    const base = code <= 90 ? 65 : 97
    return String.fromCharCode(((code - base + 13) % 26) + base)
  })
})

// 8. Atbash Cipher (A <-> Z, a <-> z)
const atbashResult = computed(() => {
  const text = inputText.value
  if (!text) return ''
  return text.replace(/[a-zA-Z]/g, c => {
    const code = c.charCodeAt(0)
    if (code >= 65 && code <= 90) return String.fromCharCode(90 - (code - 65))
    if (code >= 97 && code <= 122) return String.fromCharCode(122 - (code - 97))
    return c
  })
})

// 9. Morse Code
const MORSE_MAP: Record<string, string> = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..', '1': '.----', '2': '..---', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..',
  '9': '----.', '0': '-----', ' ': '/', '.': '.-.-.-', ',': '--..--',
  '?': '..--..', '!': '-.-.--', '@': '.--.-.'
}

const REVERSE_MORSE: Record<string, string> = Object.entries(MORSE_MAP).reduce(
  (acc, [k, v]) => { acc[v] = k; return acc },
  {} as Record<string, string>
)

const morseResult = computed(() => {
  const text = inputText.value
  if (!text) return ''
  try {
    if (mode.value === 'encode') {
      return text.toUpperCase().split('').map(char => MORSE_MAP[char] || char).join(' ')
    } else {
      const words = text.trim().split(/\s*\/\s*|\s{3,}/)
      return words.map(w => {
        const letters = w.trim().split(/\s+/)
        return letters.map(l => REVERSE_MORSE[l] || l).join('')
      }).join(' ')
    }
  } catch {
    return '⚠️ Error procesando Código Morse'
  }
})

// 10. Reverse String
const reverseResult = computed(() => {
  const text = inputText.value
  if (!text) return ''
  return text.split('').reverse().join('')
})

// Calculate Hashes using native Web Crypto API
const computeHashes = async (text: string) => {
  if (!text || mode.value === 'decode') {
    sha256Hash.value = ''
    sha512Hash.value = ''
    sha1Hash.value = ''
    return
  }

  const encoder = new TextEncoder()
  const data = encoder.encode(text)

  try {
    const sha256Buffer = await crypto.subtle.digest('SHA-256', data)
    sha256Hash.value = Array.from(new Uint8Array(sha256Buffer))
      .map(b => b.toString(16).padStart(2, '0')).join('')

    const sha512Buffer = await crypto.subtle.digest('SHA-512', data)
    sha512Hash.value = Array.from(new Uint8Array(sha512Buffer))
      .map(b => b.toString(16).padStart(2, '0')).join('')

    const sha1Buffer = await crypto.subtle.digest('SHA-1', data)
    sha1Hash.value = Array.from(new Uint8Array(sha1Buffer))
      .map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    sha256Hash.value = 'Error generando Hash'
  }
}

watch([inputText, mode], () => {
  computeHashes(inputText.value)
})

onMounted(() => {
  inputText.value = 'Textic Developer Arcade 2026'
  computeHashes(inputText.value)
})

const inputByteSize = computed(() => {
  return new Blob([inputText.value]).size
})

interface CipherCard {
  id: string
  title: string
  icon: string
  badge: string
  output: string
  isHash?: boolean
}

const cards = computed<CipherCard[]>(() => {
  const list: CipherCard[] = [
    { id: 'b64', title: 'Base64', icon: '📦', badge: 'Standard', output: base64Result.value },
    { id: 'b64url', title: 'Base64 URL-Safe', icon: '🔗', badge: 'RFC 4648', output: base64UrlResult.value },
    { id: 'hex', title: 'Hexadecimal', icon: '🔢', badge: 'Base16', output: hexResult.value },
    { id: 'bin', title: 'Binario', icon: '⚡', badge: '8-bit', output: binaryResult.value },
    { id: 'url', title: 'URL Percent-Encoding', icon: '🌐', badge: 'URI', output: urlResult.value },
    { id: 'html', title: 'HTML Entities', icon: '🏷️', badge: 'Entities', output: htmlEntitiesResult.value },
    { id: 'rot13', title: 'ROT13', icon: '🌀', badge: 'Caesar', output: rot13Result.value },
    { id: 'atbash', title: 'Atbash Cipher', icon: '🔄', badge: 'A↔Z', output: atbashResult.value },
    { id: 'morse', title: 'Código Morse', icon: '📻', badge: 'ITU', output: morseResult.value },
    { id: 'rev', title: 'Texto Invertido', icon: '🪞', badge: 'Reverse', output: reverseResult.value },
  ]

  if (mode.value === 'encode') {
    list.push(
      { id: 'sha256', title: 'SHA-256 Hash', icon: '🛡️', badge: '256-bit', output: sha256Hash.value, isHash: true },
      { id: 'sha512', title: 'SHA-512 Hash', icon: '🔒', badge: '512-bit', output: sha512Hash.value, isHash: true },
      { id: 'sha1', title: 'SHA-1 Hash', icon: '🔑', badge: '160-bit', output: sha1Hash.value, isHash: true }
    )
  }

  return list
})

const copyCard = (card: CipherCard) => {
  if (card.output && !card.output.startsWith('⚠️')) {
    copyToClipboard(card.output, `¡${card.title} copiado!`)
  }
}

const clearInput = () => {
  inputText.value = ''
}

const loadSample = () => {
  if (mode.value === 'encode') {
    inputText.value = 'Textic Developer Arcade 2026 👾'
  } else {
    inputText.value = 'VGV4dGljIERldmVsb3BlciBBcmNhZGUgMjAyNiDwn56+'
  }
  showToast('Ejemplo cargado')
}
</script>

<template>
  <div class="cipher-container">
    <!-- Header Controls & Input Stage -->
    <div class="cipher-input-card">
      <div class="input-card-header">
        <div class="header-title-box">
          <span class="header-icon">🔐</span>
          <div>
            <h2 class="header-title">CipherLab</h2>
            <p class="header-desc">Codificador y decodificador multi-formato en tiempo real.</p>
          </div>
        </div>

        <!-- Mode Toggle Switch (Encode vs Decode) -->
        <div class="mode-switch-wrapper">
          <span class="mode-label" :class="{ active: mode === 'encode' }">Codificar</span>
          <button 
            class="switch-btn" 
            :class="{ decode: mode === 'decode' }"
            @click="mode = mode === 'encode' ? 'decode' : 'encode'"
          >
            <span class="switch-ball"></span>
          </button>
          <span class="mode-label" :class="{ active: mode === 'decode' }">Decodificar</span>
        </div>
      </div>

      <!-- Textarea Input Box -->
      <div class="textarea-wrapper">
        <textarea
          v-model="inputText"
          class="cipher-textarea"
          :placeholder="mode === 'encode' ? 'Escribe o pega el texto plano a codificar...' : 'Pega aquí el código (Base64, Hex, Binario...) a decodificar...'"
          spellcheck="false"
        ></textarea>
      </div>

      <!-- Toolbar bottom of input card -->
      <div class="input-card-footer">
        <div class="char-stats">
          <span>{{ inputText.length }} caracteres</span>
          <span>•</span>
          <span>{{ inputByteSize }} bytes</span>
        </div>

        <div class="input-actions">
          <button class="btn btn-secondary btn-sm" @click="loadSample">Cargar Ejemplo</button>
          <button v-if="inputText" class="btn btn-secondary btn-sm" @click="clearInput">Limpiar</button>
        </div>
      </div>
    </div>

    <!-- 3-Column Maximum Grid for Cipher Results -->
    <div class="cipher-grid">
      <div
        v-for="card in cards"
        :key="card.id"
        class="cipher-card"
        :class="{ 'is-hash-card': card.isHash }"
      >
        <div class="card-header">
          <div class="card-title-box">
            <span class="card-icon">{{ card.icon }}</span>
            <span class="card-title">{{ card.title }}</span>
          </div>
          <div class="card-meta">
            <span class="card-badge">{{ card.badge }}</span>
            <button
              class="btn-icon-copy"
              title="Copiar resultado"
              :disabled="!card.output || card.output.startsWith('⚠️')"
              @click="copyCard(card)"
            >
              📋
            </button>
          </div>
        </div>

        <div class="card-output-container">
          <div 
            class="card-output" 
            :class="{ 
              'has-error': card.output.startsWith('⚠️'),
              'is-empty': !card.output 
            }"
          >
            {{ card.output || 'Sin datos de entrada' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cipher-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
}

.cipher-input-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

.input-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-title-box {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.header-icon {
  font-size: 1.8rem;
  color: var(--neon-cyan);
  filter: drop-shadow(0 0 12px rgba(0, 240, 255, 0.4));
}

.header-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: white;
  line-height: 1.2;
}

.header-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.mode-switch-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.4rem 0.85rem;
  border-radius: 50px;
  border: 1px solid var(--border-color);
}

.mode-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  transition: var(--transition);
}

.mode-label.active {
  color: var(--neon-cyan);
  text-shadow: var(--shadow-cyan);
}

.switch-btn {
  width: 46px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid var(--border-color);
  border-radius: 50px;
  cursor: pointer;
  position: relative;
  transition: var(--transition);
  padding: 0;
}

.switch-ball {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--neon-cyan);
  box-shadow: var(--shadow-cyan);
  position: absolute;
  top: 2px;
  left: 3px;
  transition: var(--transition);
}

.switch-btn.decode {
  background: rgba(255, 0, 127, 0.15);
  border-color: var(--border-glow-pink);
}

.switch-btn.decode .switch-ball {
  left: 23px;
  background: var(--neon-pink);
  box-shadow: var(--shadow-pink);
}

.textarea-wrapper {
  width: 100%;
}

.cipher-textarea {
  width: 100%;
  height: 110px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1rem;
  color: white;
  font-family: var(--font-mono);
  font-size: 0.95rem;
  line-height: 1.5;
  resize: vertical;
  transition: var(--transition);
}

.cipher-textarea:focus {
  outline: none;
  border-color: var(--neon-cyan);
  box-shadow: var(--shadow-cyan);
}

.input-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.char-stats {
  display: flex;
  gap: 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.input-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.35rem 0.8rem;
  font-size: 0.75rem;
}

/* 3-Max Column Grid Layout */
.cipher-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1.25rem;
}

@media (min-width: 768px) {
  .cipher-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1150px) {
  .cipher-grid {
    grid-template-columns: repeat(3, 1fr); /* Exact max 3 columns */
  }
}

.cipher-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  transition: var(--transition);
}

.cipher-card:hover {
  border-color: var(--border-glow-cyan);
  background: rgba(22, 28, 61, 0.7);
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.is-hash-card {
  border-left: 3px solid var(--neon-purple);
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
  font-size: 1.15rem;
}

.card-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: white;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card-badge {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.btn-icon-copy {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.85rem;
  transition: var(--transition);
}

.btn-icon-copy:hover:not(:disabled) {
  background: rgba(0, 240, 255, 0.12);
  color: var(--neon-cyan);
  border-color: var(--neon-cyan);
  transform: scale(1.05);
}

.btn-icon-copy:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.card-output-container {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-sm);
  padding: 0.85rem;
  min-height: 72px;
  display: flex;
  align-items: center;
}

.card-output {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--text-primary);
  word-break: break-all;
  line-height: 1.45;
  width: 100%;
  max-height: 90px;
  overflow-y: auto;
}

.card-output.is-empty {
  color: var(--text-muted);
  font-style: italic;
}

.card-output.has-error {
  color: #ef4444;
  font-size: 0.75rem;
}
</style>
