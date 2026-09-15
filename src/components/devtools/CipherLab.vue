<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import CryptoJS from 'crypto-js'
import { useToast } from '@/composables/useToast'

const { copyToClipboard, showToast } = useToast()

type Mode = 'encode' | 'decode'

const mode = ref<Mode>('encode')
const inputText = ref('')
const aesKey = ref('textic-secret-key')

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
    return '⚠️ Invalid Base64 string'
  }
})

// Helper: Base64 URL Safe encoding & decoding
const toBase64Url = (str: string) => {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

const fromBase64Url = (str: string) => {
  let b64 = str.trim().replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  return decodeURIComponent(escape(atob(b64)))
}

// 2. Base64 URL Safe
const base64UrlResult = computed(() => {
  const text = inputText.value
  if (!text) return ''
  try {
    if (mode.value === 'encode') {
      return toBase64Url(text)
    } else {
      return fromBase64Url(text)
    }
  } catch {
    return '⚠️ Invalid Base64 URL string'
  }
})

// 3. JWT (JSON Web Token) Decoder & Generator
const jwtResult = computed(() => {
  const text = inputText.value.trim()
  if (!text) return ''

  if (mode.value === 'encode') {
    try {
      let payloadObj: Record<string, unknown>
      try {
        payloadObj = JSON.parse(text)
      } catch {
        payloadObj = {
          sub: '1234567890',
          name: text,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400
        }
      }
      const headerObj = { alg: 'HS256', typ: 'JWT' }
      const encHeader = toBase64Url(JSON.stringify(headerObj))
      const encPayload = toBase64Url(JSON.stringify(payloadObj))
      const mockSignature = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      return `${encHeader}.${encPayload}.${mockSignature}`
    } catch {
      return '⚠️ Error generating JWT'
    }
  } else {
    // Decode mode
    try {
      const parts = text.split('.')
      if (parts.length < 2) {
        return '⚠️ Invalid JWT format (expected header.payload.signature)'
      }
      const headerRaw = fromBase64Url(parts[0] ?? '')
      const payloadRaw = fromBase64Url(parts[1] ?? '')
      
      const headerJson = JSON.parse(headerRaw)
      const payloadJson = JSON.parse(payloadRaw)

      let expStatus = ''
      if (typeof payloadJson.exp === 'number') {
        const expDate = new Date(payloadJson.exp * 1000)
        const isExpired = Date.now() > payloadJson.exp * 1000
        expStatus = isExpired
          ? `\n🔴 STATUS: Expired (${expDate.toLocaleString()})`
          : `\n🟢 STATUS: Active (Expires: ${expDate.toLocaleString()})`
      }

      return `HEADER:\n${JSON.stringify(headerJson, null, 2)}\n\nPAYLOAD:${expStatus}\n${JSON.stringify(payloadJson, null, 2)}`
    } catch {
      return '⚠️ Invalid JWT payload or malformed token'
    }
  }
})

// 4. AES-ECB (Electronic Codebook Mode)
const aesEcbResult = computed(() => {
  const text = inputText.value
  const key = aesKey.value
  if (!text) return ''
  if (!key) return '⚠️ Secret key is required'

  try {
    if (mode.value === 'encode') {
      const encrypted = CryptoJS.AES.encrypt(text, key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      })
      return encrypted.toString() // Standard Base64 AES-ECB ciphertext
    } else {
      const decrypted = CryptoJS.AES.decrypt(text.trim(), key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      })
      const str = decrypted.toString(CryptoJS.enc.Utf8)
      if (!str) {
        return '⚠️ Decryption failed (invalid key or ciphertext)'
      }
      return str
    }
  } catch {
    return '⚠️ Decryption failed (invalid ciphertext)'
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
      if (cleanHex.length % 2 !== 0) return '⚠️ Odd length hex string'
      const bytes = new Uint8Array(cleanHex.length / 2)
      for (let i = 0; i < cleanHex.length; i += 2) {
        const byte = parseInt(cleanHex.substring(i, i + 2), 16)
        if (isNaN(byte)) return '⚠️ Invalid hexadecimal character'
        bytes[i / 2] = byte
      }
      return new TextDecoder().decode(bytes)
    }
  } catch {
    return '⚠️ Hex decoding error'
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
        if (!item || !/^[01]+$/.test(item)) return '⚠️ Invalid binary block'
        bytes[i] = parseInt(item, 2)
      }
      return new TextDecoder().decode(bytes)
    }
  } catch {
    return '⚠️ Binary decoding error'
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
    return '⚠️ URL decoding error'
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
    return '⚠️ HTML Entity parsing error'
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
    return '⚠️ Morse code decoding error'
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
    sha256Hash.value = 'Hash computation error'
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
  hasKeyInput?: boolean
}

const cards = computed<CipherCard[]>(() => {
  const list: CipherCard[] = [
    { id: 'b64', title: 'Base64', icon: '📦', badge: 'Standard', output: base64Result.value },
    { id: 'hex', title: 'Hexadecimal', icon: '🔢', badge: 'Base16', output: hexResult.value },
    { id: 'bin', title: 'Binary', icon: '⚡', badge: '8-bit', output: binaryResult.value },
    { id: 'morse', title: 'Morse Code', icon: '📻', badge: 'ITU', output: morseResult.value },
    { id: 'jwt', title: 'JWT (JSON Web Token)', icon: '🛡️', badge: 'RFC 7519', output: jwtResult.value },
    { id: 'aes-ecb', title: 'AES-ECB', icon: '🔐', badge: 'PKCS7 / 128-256b', output: aesEcbResult.value, hasKeyInput: true },
    { id: 'b64url', title: 'Base64 URL-Safe', icon: '🔗', badge: 'RFC 4648', output: base64UrlResult.value },
    { id: 'url', title: 'URL Percent-Encoding', icon: '🌐', badge: 'URI', output: urlResult.value },
    { id: 'html', title: 'HTML Entities', icon: '🏷️', badge: 'Entities', output: htmlEntitiesResult.value },
    { id: 'rot13', title: 'ROT13', icon: '🌀', badge: 'Caesar', output: rot13Result.value },
    { id: 'atbash', title: 'Atbash Cipher', icon: '🔄', badge: 'A↔Z', output: atbashResult.value },
    { id: 'rev', title: 'Reversed Text', icon: '🪞', badge: 'Reverse', output: reverseResult.value },
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
    copyToClipboard(card.output, `${card.title} copied!`)
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
  showToast('Sample loaded')
}
</script>

<template>
  <div class="cipher-container">
    <!-- Header Controls & Input Stage -->
    <div class="cipher-input-card">
      <div class="input-card-header">
        <div class="header-title-box">
          <span class="header-icon">⚡</span>
          <div>
            <h2 class="header-title">CipherLab</h2>
            <p class="header-desc">Real-time multi-format text encoder and decoder.</p>
          </div>
        </div>

        <!-- Mode Toggle Switch (Encode vs Decode) -->
        <div class="mode-switch-wrapper">
          <span class="mode-label" :class="{ active: mode === 'encode' }">Encode</span>
          <button 
            class="switch-btn" 
            :class="{ decode: mode === 'decode' }"
            @click="mode = mode === 'encode' ? 'decode' : 'encode'"
          >
            <span class="switch-ball"></span>
          </button>
          <span class="mode-label" :class="{ active: mode === 'decode' }">Decode</span>
        </div>
      </div>

      <!-- Textarea Input Box -->
      <div class="textarea-wrapper">
        <textarea
          v-model="inputText"
          class="cipher-textarea"
          :placeholder="mode === 'encode' ? 'Type or paste raw text to encode...' : 'Paste encoded string (Base64, Hex, Binary...) to decode...'"
          spellcheck="false"
        ></textarea>
      </div>

      <!-- Toolbar bottom of input card -->
      <div class="input-card-footer">
        <div class="char-stats">
          <span>{{ inputText.length }} characters</span>
          <span>•</span>
          <span>{{ inputByteSize }} bytes</span>
        </div>

        <div class="input-actions">
          <button class="btn btn-secondary btn-sm" @click="loadSample">Load Sample</button>
          <button v-if="inputText" class="btn btn-secondary btn-sm" @click="clearInput">Clear</button>
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
              title="Copy result"
              :disabled="!card.output || card.output.startsWith('⚠️')"
              @click="copyCard(card)"
            >
              📋
            </button>
          </div>
        </div>

        <!-- Key Configuration Row (For AES-ECB) -->
        <div v-if="card.hasKeyInput" class="card-key-row">
          <span class="key-tag">🔑 Key:</span>
          <input
            v-model="aesKey"
            type="text"
            class="key-text-input"
            placeholder="Secret key..."
            spellcheck="false"
            @click.stop
          />
        </div>

        <div class="card-output-container">
          <div 
            class="card-output" 
            :class="{ 
              'has-error': card.output.startsWith('⚠️'),
              'is-empty': !card.output 
            }"
          >
            {{ card.output || 'No input data' }}
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
  color: var(--neon-red);
  filter: drop-shadow(0 0 12px rgba(255, 30, 66, 0.5));
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
  background: rgba(0, 0, 0, 0.4);
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
  color: var(--neon-red);
  text-shadow: var(--shadow-red);
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
  background: var(--neon-red);
  box-shadow: var(--shadow-red);
  position: absolute;
  top: 2px;
  left: 3px;
  transition: var(--transition);
}

.switch-btn.decode {
  background: rgba(255, 30, 66, 0.15);
  border-color: var(--border-glow-red);
}

.switch-btn.decode .switch-ball {
  left: 23px;
  background: var(--neon-ruby);
  box-shadow: var(--shadow-red);
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
  border-color: var(--neon-red);
  box-shadow: var(--shadow-red);
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

/* 3-Column Maximum Grid Layout */
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
  border-color: var(--border-glow-red);
  background: rgba(28, 15, 24, 0.7);
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.is-hash-card {
  border-left: 3px solid var(--neon-ruby);
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
  background: rgba(255, 30, 66, 0.15);
  color: var(--neon-red);
  border-color: var(--neon-red);
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
  white-space: pre-wrap;
  line-height: 1.45;
  width: 100%;
  max-height: 110px;
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

/* Key Configuration Row for AES */
.card-key-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.65rem;
  transition: var(--transition);
}

.card-key-row:focus-within {
  border-color: var(--neon-red);
  box-shadow: 0 0 10px rgba(255, 30, 66, 0.2);
}

.key-tag {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--neon-red);
  white-space: nowrap;
}

.key-text-input {
  background: transparent;
  border: none;
  color: white;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  outline: none;
  width: 100%;
}

.key-text-input::placeholder {
  color: var(--text-muted);
}
</style>
