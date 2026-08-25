<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick } from 'vue'
import { useToast } from '@/composables/useToast'

const { showToast } = useToast()

const DEFAULT_WORDS = [
  "antigravity", "javascript", "developer", "keyboard", "cyberpunk", 
  "synthwave", "retrogaming", "canvas", "async", "variable", 
  "function", "stylesheet", "database", "payload", "connection", 
  "algorithm", "responsive", "terminal", "console", "programming",
  "interface", "application", "repository", "animation", "component",
  "typescript", "framework", "performance", "deployment", "pipeline"
]

const wordPool = ref<string[]>([...DEFAULT_WORDS])
const currentWord = ref('iniciar')
const userInput = ref('')
const isRunning = ref(false)
const isGameOver = ref(false)
const gameStarted = ref(false)
const timeLeft = ref(60)
const correctWordsCount = ref(0)
const totalCharsTyped = ref(0)
const correctCharsTyped = ref(0)
const isDictionaryLoaded = ref(false)
const isLoadingDictionary = ref(false)

const inputRef = ref<HTMLInputElement | null>(null)
let timer: number | null = null

onUnmounted(() => {
  stopGame()
})

const accuracy = computed(() => {
  if (totalCharsTyped.value === 0) return 100
  let progressCorrect = correctCharsTyped.value
  for (let i = 0; i < userInput.value.length; i++) {
    if (userInput.value[i] === currentWord.value[i]) {
      progressCorrect++
    }
  }
  const acc = Math.round((progressCorrect / totalCharsTyped.value) * 100)
  return Math.min(100, Math.max(0, acc))
})

const wpm = computed(() => {
  const elapsedMinutes = (60 - timeLeft.value) / 60
  if (elapsedMinutes <= 0) return 0
  return Math.round(correctWordsCount.value / elapsedMinutes)
})

const nextWord = () => {
  const pool = wordPool.value
  const idx = Math.floor(Math.random() * pool.length)
  currentWord.value = pool[idx] ?? DEFAULT_WORDS[0] ?? 'cyberpunk'
  userInput.value = ''
}

const handleInput = () => {
  if (!isRunning.value) return

  totalCharsTyped.value++
  const val = userInput.value

  if (val === currentWord.value) {
    correctWordsCount.value++
    correctCharsTyped.value += currentWord.value.length
    nextWord()
  }
}

const startGame = async () => {
  stopGame()
  timeLeft.value = 60
  correctWordsCount.value = 0
  totalCharsTyped.value = 0
  correctCharsTyped.value = 0
  isGameOver.value = false
  isRunning.value = true
  gameStarted.value = true

  nextWord()

  await nextTick()
  if (inputRef.value) {
    inputRef.value.focus()
  }

  timer = window.setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      triggerGameOver()
    }
  }, 1000)
}

const stopGame = () => {
  isRunning.value = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const triggerGameOver = () => {
  stopGame()
  isGameOver.value = true
  isRunning.value = false
}

const loadSpanishDictionary = async () => {
  if (isDictionaryLoaded.value || isLoadingDictionary.value) return

  isLoadingDictionary.value = true
  try {
    const res = await fetch('/assets/dictionary.json')
    if (!res.ok) throw new Error('No se pudo descargar el diccionario')
    const data = await res.json()

    if (data && Array.isArray(data.spanish)) {
      wordPool.value = data.spanish
        .filter((w: string) => w.length > 3 && w.length < 11)
        .map((w: string) => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
      
      isDictionaryLoaded.value = true
      showToast(`¡Diccionario en español cargado (${wordPool.value.length.toLocaleString()} palabras)!`)
    }
  } catch (err) {
    console.error(err)
    showToast('Error cargando el diccionario en español', 'error')
  } finally {
    isLoadingDictionary.value = false
  }
}
</script>

<template>
  <div class="typing-cabinet">
    <div class="typing-display-box">
      <!-- Overlay: Start screen -->
      <div v-if="!gameStarted" class="overlay-screen">
        <div class="overlay-badge">SPEED CHALLENGE</div>
        <h3 class="overlay-title">TYPING BLITZ</h3>
        <p class="overlay-desc">
          Escribe la mayor cantidad de palabras posible en 60 segundos manteniendo alta precisión.
        </p>
        <button class="btn btn-cyan" @click="startGame">
          <span>⚡</span> Iniciar Desafío
        </button>
      </div>

      <!-- Overlay: Game Over -->
      <div v-else-if="isGameOver" class="overlay-screen gameover">
        <h3 class="overlay-title gameover-title">TIEMPO CUMPLIDO</h3>
        <p class="overlay-desc">Estadísticas de tu sesión:</p>
        <div class="results-grid">
          <div class="result-card">
            <span class="result-label">VELOCIDAD</span>
            <span class="result-val cyan">{{ wpm }} <small>WPM</small></span>
          </div>
          <div class="result-card">
            <span class="result-label">PRECISIÓN</span>
            <span class="result-val pink">{{ accuracy }}%</span>
          </div>
          <div class="result-card">
            <span class="result-label">PALABRAS</span>
            <span class="result-val">{{ correctWordsCount }}</span>
          </div>
        </div>
        <button class="btn btn-pink" @click="startGame">
          <span>🔄</span> Reintentar Blitz
        </button>
      </div>

      <!-- Target Word with dynamic character feedback -->
      <div class="word-stage">
        <div class="target-word">
          <span
            v-for="(char, idx) in currentWord"
            :key="idx"
            :class="{
              'char-correct': idx < userInput.length && userInput[idx] === char,
              'char-wrong': idx < userInput.length && userInput[idx] !== char
            }"
          >{{ char }}</span>
        </div>
      </div>
    </div>

    <!-- Input text control -->
    <div class="input-wrapper">
      <input
        ref="inputRef"
        v-model="userInput"
        type="text"
        class="typing-input"
        placeholder="Escribe la palabra aquí..."
        :disabled="!isRunning"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        @input="handleInput"
      />
    </div>

    <!-- Live Stats Grid -->
    <div class="stats-row">
      <div class="stat-box">
        <span class="stat-title">Velocidad</span>
        <span class="stat-number cyan">{{ wpm }} <span class="stat-unit">WPM</span></span>
      </div>
      <div class="stat-box">
        <span class="stat-title">Precisión</span>
        <span class="stat-number">{{ accuracy }}%</span>
      </div>
      <div class="stat-box">
        <span class="stat-title">Tiempo</span>
        <span class="stat-number pink">{{ timeLeft }}s</span>
      </div>
    </div>

    <!-- Dictionary Loader Switch -->
    <div class="dict-options">
      <span class="dict-label">Diccionario:</span>
      <button
        class="btn btn-secondary dict-btn"
        :disabled="isDictionaryLoaded || isLoadingDictionary"
        @click="loadSpanishDictionary"
      >
        <span v-if="isLoadingDictionary" class="spinner-inline"></span>
        <span v-else-if="isDictionaryLoaded">✓ Español Activado (600k)</span>
        <span v-else>📥 Cargar Diccionario Español</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.typing-cabinet {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
}

.typing-display-box {
  position: relative;
  width: 100%;
  height: 200px;
  background: #03040b;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}

.typing-display-box::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
  background-size: 100% 4px;
  pointer-events: none;
  z-index: 10;
}

.word-stage {
  padding: 1.5rem;
  text-align: center;
}

.target-word {
  font-family: var(--font-mono);
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.char-correct {
  color: var(--neon-cyan);
  text-shadow: var(--shadow-cyan);
}

.char-wrong {
  color: var(--neon-pink);
  text-shadow: var(--shadow-pink);
  text-decoration: underline;
}

.overlay-screen {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(4, 6, 18, 0.94);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 20;
  padding: 1.5rem;
  text-align: center;
}

.overlay-badge {
  font-family: var(--font-retro);
  font-size: 0.6rem;
  color: var(--neon-cyan);
  background: rgba(0, 240, 255, 0.1);
  border: 1px solid rgba(0, 240, 255, 0.3);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  margin-bottom: 0.75rem;
}

.overlay-title {
  font-family: var(--font-retro);
  font-size: 1.3rem;
  color: var(--neon-cyan);
  text-shadow: var(--shadow-cyan);
  margin-bottom: 0.75rem;
}

.gameover-title {
  color: var(--neon-pink);
  text-shadow: var(--shadow-pink-strong);
}

.overlay-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  max-width: 320px;
  line-height: 1.5;
  margin-bottom: 1.2rem;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  width: 100%;
  max-width: 340px;
}

.result-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.5rem;
  text-align: center;
}

.result-label {
  display: block;
  font-size: 0.65rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
  margin-bottom: 0.2rem;
}

.result-val {
  font-size: 1.2rem;
  font-weight: 700;
  font-family: var(--font-mono);
}

.result-val.cyan { color: var(--neon-cyan); }
.result-val.pink { color: var(--neon-pink); }
.result-val small { font-size: 0.6rem; color: var(--text-muted); }

.input-wrapper {
  width: 100%;
}

.typing-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.4);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.9rem 1.5rem;
  font-size: 1.2rem;
  color: white;
  text-align: center;
  font-family: var(--font-mono);
  transition: var(--transition);
}

.typing-input:focus {
  outline: none;
  border-color: var(--neon-pink);
  box-shadow: var(--shadow-pink);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  width: 100%;
}

.stat-box {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.85rem;
  text-align: center;
}

.stat-title {
  display: block;
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.stat-number {
  font-size: 1.4rem;
  font-weight: 700;
  color: white;
  font-family: var(--font-mono);
}

.stat-number.cyan { color: var(--neon-cyan); }
.stat-number.pink { color: var(--neon-pink); }
.stat-unit { font-size: 0.65rem; color: var(--text-muted); font-weight: 400; }

.dict-options {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.dict-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.dict-btn {
  font-size: 0.8rem;
  padding: 0.45rem 1rem;
}
</style>
