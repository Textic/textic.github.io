<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useToast } from '@/composables/useToast'

const { showToast } = useToast()

type Mode = 'words' | 'quotes' | 'time'
type Language = 'en' | 'es'

const mode = ref<Mode>('quotes')
const language = ref<Language>('en')
const wordCountOption = ref<number>(50)
const timeLimitOption = ref<number>(60)
const selectedQuoteIndex = ref<number>(0)

// Game State
const fullText = ref('')
const currentInput = ref('')
const isRunning = ref(false)
const isFinished = ref(false)
const startTime = ref<number | null>(null)
const endTime = ref<number | null>(null)
const timer = ref<number | null>(null)
const timeRemaining = ref<number>(60)
const activeAuthor = ref<string>('')
const activeTitle = ref<string>('')

// Statistics tracking
const totalKeystrokes = ref(0)
const errorKeystrokes = ref(0)

const inputRef = ref<HTMLInputElement | null>(null)
const displayAreaRef = ref<HTMLDivElement | null>(null)

// --- Preset Quotes & Poems Library ---
interface QuoteItem {
  title: string
  author: string
  text: string
}

const QUOTES_EN: QuoteItem[] = [
  {
    title: "The Road Not Taken (Complete)",
    author: "Robert Frost",
    text: "Two roads diverged in a yellow wood, and sorry I could not travel both and be one traveler, long I stood and looked down one as far as I could to where it bent in the undergrowth; then took the other, as just as fair, and having perhaps the better claim, because it was grassy and wanted wear; though as for that the passing there had worn them really about the same, and both that morning equally lay in leaves no step had trodden black. Oh, I kept the first for another day! Yet knowing how way leads on to way, I doubted if I should ever come back. I shall be telling this with a sigh somewhere ages and ages hence: Two roads diverged in a wood, and I—I took the one less traveled by, and that has made all the difference."
  },
  {
    title: "Hamlet: To Be or Not To Be",
    author: "William Shakespeare",
    text: "To be, or not to be, that is the question: whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles and by opposing end them. To die—to sleep, no more; and by a sleep to say we end the heart-ache and the thousand natural shocks that flesh is heir to: 'tis a consummation devoutly to be wish'd. To die, to sleep; to sleep, perchance to dream—ay, there's the rub: for in that sleep of death what dreams may come, when we have shuffled off this mortal coil, must give us pause. There's the respect that makes calamity of so long life."
  },
  {
    title: "The Raven (Opening Cantos)",
    author: "Edgar Allan Poe",
    text: "Once upon a midnight dreary, while I pondered, weak and weary, over many a quaint and curious volume of forgotten lore—while I nodded, nearly napping, suddenly there came a tapping, as of some one gently rapping, rapping at my chamber door. 'Tis some visitor,' I muttered, 'tapping at my chamber door—only this and nothing more.' Ah, distinctly I remember it was in the bleak December; and each separate dying ember wrought its ghost upon the floor. Eagerly I wished the morrow;—vainly I had sought to borrow from my books surcease of sorrow—sorrow for the lost Lenore—for the rare and radiant maiden whom the angels name Lenore—nameless here for evermore."
  },
  {
    title: "The Hacker Ethic & Free Software",
    author: "Richard Stallman & Linus Torvalds",
    text: "I consider that the golden rule requires that if I like a program I must share it with other people who like it. Software sellers want to divide the users and conquer them, making each user agree not to share with others. I refuse to break solidarity with other users in this way. So that I can continue to use computers without dishonor, I have decided to put together a sufficient body of free software so that I will be able to get along without any software that is not free. Talk is cheap. Show me the code. Software is like freedom: once you experience it, you can never go back."
  },
  {
    title: "Stay Hungry, Stay Foolish",
    author: "Steve Jobs",
    text: "Remembering that I'll be dead soon is the most important tool I've ever encountered to help me make the big choices in life. Because almost everything—all external expectations, all pride, all fear of embarrassment or failure—these things just fall away in the face of death, leaving only what is truly important. Remembering that you are going to die is the best way I know to avoid the trap of thinking you have something to lose. You are already naked. There is no reason not to follow your heart. Your time is limited, so don't waste it living someone else's life. Stay hungry. Stay foolish."
  },
  {
    title: "The Myth of Sisyphus",
    author: "Albert Camus",
    text: "The struggle itself toward the heights is enough to fill a man's heart. One must imagine Sisyphus happy. It is during that return, that pause, that Sisyphus interests me. A face that toils so close to stones is already stone itself! I see that man going back down with a heavy yet measured step toward the torment of which he will never know the end. That hour like a breathing-space which returns as surely as his suffering, that is the hour of consciousness. At each of those moments when he leaves the heights and gradually sinks toward the laves of the gods, he is superior to his fatal destiny."
  }
]

const QUOTES_ES: QuoteItem[] = [
  {
    title: "Don Quijote de la Mancha (Capítulo I)",
    author: "Miguel de Cervantes",
    text: "En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor. Una olla de algo más vaca que carnero, salpicón las más noches, duelos y quebrantos los sábados, lantejas los viernes, algún palomino de añadidura los domingos, consumían las tres partes de su hacienda. El resto della concluían sayo de velarte, calzas de velludo para las fiestas, con sus pantuflos de lo mesmo, y los días de entresemana se honraba con su vellorí de lo más fino. Tenía en su casa una ama que pasaba de los cuarenta, y una sobrina que no llegaba a los veinte, y un mozo de campo y plaza, que así ensillaba el rocín como tomaba la podadera."
  },
  {
    title: "Poema 20 (Veinte poemas de amor)",
    author: "Pablo Neruda",
    text: "Puedo escribir los versos más tristes esta noche. Escribir, por ejemplo: La noche está estrellada, y tiritan, azules, los astros, a lo lejos. El viento de la noche gira en el cielo y canta. Puedo escribir los versos más tristes esta noche. Yo la quise, y a veces ella también me quiso. En las noches como esta la tuve entre mis brazos. La besé tantas veces bajo el cielo infinito. Ella me quiso, a veces yo también la quería. Cómo no haber amado sus grandes ojos fijos. Puedo escribir los versos más tristes esta noche. Pensar que no la tengo. Sentir que la he perdido. Oír la noche inmensa, más inmensa sin ella. Y el verso cae al alma como al pasto el rocío."
  },
  {
    title: "El Aleph (Visión del Universo)",
    author: "Jorge Luis Borges",
    text: "En la parte inferior del escalón, hacia la derecha, vi una pequeña esfera tornasolada, de casi intolerable fulgor. Al principio la creí giratoria; luego comprendí que ese movimiento era una ilusión producida por los vertiginosos espectáculos que encerraba. El diámetro del Aleph sería de dos o tres centímetros, pero el espacio cósmico estaba ahí, sin disminución de tamaño. Cada cosa (la luna del espejo, digamos) era infinitas cosas, porque yo claramente la veía desde todos los puntos del universo. Vi el populoso mar, vi el alba y la tarde, vi las muchedumbres de América, vi una plateada telaraña en el centro de una negra pirámide, vi un laberinto roto que era Londres, vi interminables ojos inmediatos mirándose en mí como en un espejo."
  },
  {
    title: "Cien años de soledad (Comienzo legendario)",
    author: "Gabriel García Márquez",
    text: "Muchos años después, frente al pelotón de fusilamiento, el coronel Aureliano Buendía había de recordar aquella tarde remota en que su padre lo llevó a conocer el hielo. Macondo era entonces una aldea de veinte casas de barro y cañabrava construidas a la orilla de un río de aguas diáfanas que se precipitaban por un lecho de piedras pulidas, blancas y enormes como huevos prehistóricos. El mundo era tan reciente, que muchas cosas carecían de nombre, y para mencionarlas había que señalarlas con el dedo. Todos los años, por el mes de marzo, una familia de gitanos desarrapados plantaba su carpa cerca de la aldea, y con un grande alboroto de pitos y timbales daban a conocer los nuevos inventos de los sabios de oriente."
  },
  {
    title: "Romance Sonámbulo (Poema Completo)",
    author: "Federico García Lorca",
    text: "Verde que te quiero verde. Verde viento. Verdes ramas. El barco sobre la mar y el caballo en la montaña. Con la sombra en la cintura ella sueña en su baranda, verde carne, pelo verde, con ojos de fría plata. Verde que te quiero verde. Bajo la luna gitana, las cosas le están mirando y ella no puede mirarlas. Grandes estrellas de escarcha vienen con el pez de sombra que abre el camino del alba. La higuera frota su viento con la lija de sus ramas, y el monte, gato garduño, eriza sus pitas agrias. ¿Pero quién vendrá? ¿Y por dónde? Ella sigue en su baranda, verde carne, pelo verde, soñando en la mar amarga."
  },
  {
    title: "Rimas y Leyendas (El Monte de las Ánimas)",
    author: "Gustavo Adolfo Bécquer",
    text: "La noche de difuntos me despertó a no sé qué hora el doble de las campanas. Su tañido monótono y eterno me trajo a las mientes esta tradición que oí hace poco en Soria. Intenté dormir de nuevo. ¡Imposible! La imaginación, caldeada por historias fantásticas, perseguía sombras que flotaban en el aire. Las campanas doblaban, el viento zumbaba en los cristales del balcón, y las hojas secas crujían en el jardín. En aquel monte sagrado, las almas de los caballeros templarios se levantaban de sus tumbas cubiertas de musgo para perseguir a las fieras en una cacería espectral que duraba hasta el primer rayo del alba."
  }
]

// --- Base Dictionary Pools for Random Words Mode ---
const BASE_WORDS_EN = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "it",
  "for", "not", "on", "with", "he", "as", "you", "do", "at", "this",
  "but", "his", "by", "from", "they", "we", "say", "her", "she", "or",
  "will", "an", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know",
  "take", "people", "into", "year", "your", "good", "some", "could",
  "them", "see", "other", "than", "then", "now", "look", "only", "come",
  "its", "over", "think", "also", "back", "after", "use", "two", "how",
  "our", "work", "first", "well", "way", "even", "new", "want", "because",
  "any", "these", "give", "day", "most", "us", "system", "code", "cyber",
  "matrix", "server", "future", "network", "signal", "digital", "terminal"
]

const BASE_WORDS_ES = [
  "de", "la", "que", "el", "en", "y", "a", "los", "se", "del", "las",
  "un", "por", "con", "no", "una", "su", "para", "es", "al", "lo", "como",
  "mas", "o", "pero", "sus", "le", "ha", "me", "si", "sin", "sobre",
  "este", "ya", "entre", "cuando", "todo", "esta", "ser", "son", "dos",
  "tambien", "fue", "habia", "era", "muy", "anos", "hasta", "desde",
  "esta", "mi", "porque", "cada", "vida", "tiempo", "mundo", "dia",
  "donde", "despues", "te", "algo", "noche", "ciudad", "hombre", "casa",
  "cielo", "camino", "mano", "palabra", "luz", "codigo", "sistema", "red",
  "pantalla", "futuro", "juego", "terminal", "desarrollo", "servidor"
]

// Extra Spanish words dynamically fetched
const extraSpanishWords = ref<string[]>([])
const isDictLoading = ref(false)

const loadFullSpanishDictionary = async () => {
  if (extraSpanishWords.value.length > 0 || isDictLoading.value) return
  isDictLoading.value = true
  try {
    const res = await fetch('/assets/dictionary.json')
    if (!res.ok) return
    const data = await res.json()
    if (data && Array.isArray(data.spanish)) {
      extraSpanishWords.value = data.spanish
        .filter((w: string) => w.length >= 3 && w.length <= 9 && !w.includes(' '))
        .map((w: string) => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
    }
  } catch (e) {
    console.error("Dictionary load error:", e)
  } finally {
    isDictLoading.value = false
  }
}

// Generate text based on active mode & language
const generateTestText = () => {
  if (mode.value === 'quotes') {
    const list = language.value === 'en' ? QUOTES_EN : QUOTES_ES
    const item = list[selectedQuoteIndex.value % list.length] ?? list[0]
    if (item) {
      fullText.value = item.text
      activeTitle.value = item.title
      activeAuthor.value = item.author
    }
  } else if (mode.value === 'words') {
    activeTitle.value = `${wordCountOption.value} Words`
    activeAuthor.value = language.value === 'en' ? 'Random English Words' : 'Palabras Aleatorias'
    const pool = language.value === 'en' 
      ? BASE_WORDS_EN 
      : (extraSpanishWords.value.length > 0 ? extraSpanishWords.value : BASE_WORDS_ES)
    
    const words: string[] = []
    for (let i = 0; i < wordCountOption.value; i++) {
      const rand = pool[Math.floor(Math.random() * pool.length)] ?? 'code'
      words.push(rand)
    }
    fullText.value = words.join(' ')
  } else if (mode.value === 'time') {
    activeTitle.value = `${timeLimitOption.value}s Speed Rush`
    activeAuthor.value = language.value === 'en' ? 'Continuous Stream' : 'Flujo Continuo'
    const pool = language.value === 'en' 
      ? BASE_WORDS_EN 
      : (extraSpanishWords.value.length > 0 ? extraSpanishWords.value : BASE_WORDS_ES)
    
    const words: string[] = []
    for (let i = 0; i < 150; i++) {
      const rand = pool[Math.floor(Math.random() * pool.length)] ?? 'code'
      words.push(rand)
    }
    fullText.value = words.join(' ')
  }
}

const resetTest = () => {
  stopTimer()
  currentInput.value = ''
  isRunning.value = false
  isFinished.value = false
  startTime.value = null
  endTime.value = null
  totalKeystrokes.value = 0
  errorKeystrokes.value = 0
  timeRemaining.value = timeLimitOption.value
  generateTestText()
  
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus()
    }
  })
}

const selectQuote = (index: number) => {
  selectedQuoteIndex.value = index
  resetTest()
}

const setMode = (newMode: Mode) => {
  mode.value = newMode
  resetTest()
}

const setLanguage = (newLang: Language) => {
  language.value = newLang
  if (newLang === 'es') {
    loadFullSpanishDictionary()
  }
  resetTest()
}

const setWordCount = (count: number) => {
  wordCountOption.value = count
  resetTest()
}

const setTimeLimit = (seconds: number) => {
  timeLimitOption.value = seconds
  resetTest()
}

// Live Typing Handler
const handleKeyInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  const val = target.value

  if (!isRunning.value && !isFinished.value && val.length > 0) {
    startTest()
  }

  // Check last typed character correctness
  if (val.length > currentInput.value.length) {
    totalKeystrokes.value++
    const lastIndex = val.length - 1
    if (val[lastIndex] !== fullText.value[lastIndex]) {
      errorKeystrokes.value++
    }
  }

  currentInput.value = val

  // Auto scroll long text passages so active line is always visible
  nextTick(() => {
    if (displayAreaRef.value) {
      const cursorEl = displayAreaRef.value.querySelector('.char-cursor') as HTMLElement
      if (cursorEl) {
        const containerTop = displayAreaRef.value.getBoundingClientRect().top
        const cursorTop = cursorEl.getBoundingClientRect().top
        const relativeOffset = cursorTop - containerTop
        if (relativeOffset > 140) {
          displayAreaRef.value.scrollTop += (relativeOffset - 100)
        } else if (relativeOffset < 20) {
          displayAreaRef.value.scrollTop = 0
        }
      }
    }
  })

  // Complete test if typed all text in quotes or words mode
  if (mode.value !== 'time' && val.length >= fullText.value.length) {
    finishTest()
  }
}

const startTest = () => {
  isRunning.value = true
  startTime.value = Date.now()

  if (mode.value === 'time') {
    timeRemaining.value = timeLimitOption.value
    timer.value = window.setInterval(() => {
      timeRemaining.value--
      if (timeRemaining.value <= 0) {
        finishTest()
      }
    }, 1000)
  }
}

const stopTimer = () => {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
}

const finishTest = () => {
  stopTimer()
  isRunning.value = false
  isFinished.value = true
  endTime.value = Date.now()
}

// Live Calculations
const elapsedMinutes = computed(() => {
  if (!startTime.value) return 0
  const end = endTime.value || Date.now()
  return (end - startTime.value) / 60000
})

const correctCharsCount = computed(() => {
  let correct = 0
  const input = currentInput.value
  const target = fullText.value
  for (let i = 0; i < input.length; i++) {
    if (input[i] === target[i]) {
      correct++
    }
  }
  return correct
})

const wpm = computed(() => {
  if (elapsedMinutes.value <= 0) return 0
  const wordsTyped = correctCharsCount.value / 5
  return Math.max(0, Math.round(wordsTyped / elapsedMinutes.value))
})

const accuracy = computed(() => {
  if (currentInput.value.length === 0) return 100
  const acc = (correctCharsCount.value / currentInput.value.length) * 100
  return Math.min(100, Math.max(0, Math.round(acc)))
})

const progressPercentage = computed(() => {
  if (mode.value === 'time') {
    return Math.max(0, Math.round(((timeLimitOption.value - timeRemaining.value) / timeLimitOption.value) * 100))
  }
  if (!fullText.value.length) return 0
  return Math.min(100, Math.round((currentInput.value.length / fullText.value.length) * 100))
})

const focusInput = () => {
  if (inputRef.value) {
    inputRef.value.focus()
  }
}

watch([mode, language, wordCountOption, timeLimitOption], () => {
  resetTest()
})

onMounted(() => {
  resetTest()
  window.addEventListener('keydown', handleGlobalKey)
})

onUnmounted(() => {
  stopTimer()
  window.removeEventListener('keydown', handleGlobalKey)
})

const handleGlobalKey = (e: KeyboardEvent) => {
  if (e.key === 'Tab') {
    e.preventDefault()
    resetTest()
  }
}
</script>

<template>
  <div class="blitz-container" @click="focusInput">
    <!-- Top Configuration Control Bar -->
    <div class="control-header-card">
      <div class="header-main-row">
        <!-- Title and Icon -->
        <div class="blitz-brand">
          <span class="blitz-icon">⌨️</span>
          <div>
            <h2 class="blitz-title">Typing Blitz Pro</h2>
            <p class="blitz-desc">Speed typing trainer with customizable literature, words, and timed challenges.</p>
          </div>
        </div>

        <!-- Language Switcher (EN / ES) -->
        <div class="config-pill-group language-switch">
          <button 
            class="config-pill-btn" 
            :class="{ active: language === 'en' }"
            @click.stop="setLanguage('en')"
          >
            🇺🇸 English
          </button>
          <button 
            class="config-pill-btn" 
            :class="{ active: language === 'es' }"
            @click.stop="setLanguage('es')"
          >
            🇪🇸 Español
          </button>
        </div>
      </div>

      <!-- Secondary Controls Bar: Mode selector & Sub-options -->
      <div class="modes-toolbar">
        <div class="config-pill-group mode-group">
          <button 
            class="config-pill-btn" 
            :class="{ active: mode === 'quotes' }"
            @click.stop="setMode('quotes')"
          >
            📜 Quotes & Poems
          </button>
          <button 
            class="config-pill-btn" 
            :class="{ active: mode === 'words' }"
            @click.stop="setMode('words')"
          >
            🔢 Words
          </button>
          <button 
            class="config-pill-btn" 
            :class="{ active: mode === 'time' }"
            @click.stop="setMode('time')"
          >
            ⏱️ Timed Rush
          </button>
        </div>

        <!-- Sub-Options: Word Count Selector -->
        <div v-if="mode === 'words'" class="config-pill-group sub-options">
          <span class="sub-label">Count:</span>
          <button 
            v-for="count in [25, 50, 100, 200]" 
            :key="count"
            class="config-pill-btn sub-pill"
            :class="{ active: wordCountOption === count }"
            @click.stop="setWordCount(count)"
          >
            {{ count }}
          </button>
        </div>

        <!-- Sub-Options: Time Limit Selector -->
        <div v-else-if="mode === 'time'" class="config-pill-group sub-options">
          <span class="sub-label">Time:</span>
          <button 
            v-for="secs in [15, 30, 60, 120]" 
            :key="secs"
            class="config-pill-btn sub-pill"
            :class="{ active: timeLimitOption === secs }"
            @click.stop="setTimeLimit(secs)"
          >
            {{ secs }}s
          </button>
        </div>

        <!-- Sub-Options: Quote / Poem Selector Dropdown -->
        <div v-else-if="mode === 'quotes'" class="quotes-selector-box">
          <span class="sub-label">Passage:</span>
          <select 
            :value="selectedQuoteIndex" 
            class="quote-dropdown"
            @change="selectQuote(Number(($event.target as HTMLSelectElement).value))"
          >
            <option 
              v-for="(q, idx) in (language === 'en' ? QUOTES_EN : QUOTES_ES)" 
              :key="idx" 
              :value="idx"
            >
              {{ q.title }} ({{ q.author }})
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Live Stats Bar (Above stage) -->
    <div class="stats-counter-bar">
      <div class="stat-item">
        <span class="stat-meta">SPEED</span>
        <span class="stat-digit red">{{ wpm }} <small>WPM</small></span>
      </div>
      <div class="stat-item">
        <span class="stat-meta">ACCURACY</span>
        <span class="stat-digit green">{{ accuracy }}%</span>
      </div>
      <div class="stat-item">
        <span class="stat-meta">{{ mode === 'time' ? 'TIME LEFT' : 'PROGRESS' }}</span>
        <span class="stat-digit">
          {{ mode === 'time' ? `${timeRemaining}s` : `${progressPercentage}%` }}
        </span>
      </div>
    </div>

    <!-- Interactive Typing Stage (Dark Background with Green / Red Character Feedback) -->
    <div class="typing-stage-card" :class="{ finished: isFinished }">
      <!-- Author / Title Header Badge -->
      <div class="stage-meta-header">
        <span class="passage-tag">{{ activeTitle }}</span>
        <span class="passage-author">{{ activeAuthor }}</span>
        <span class="keyboard-hint">Press <kbd>Tab</kbd> to restart</span>
      </div>

      <!-- Hidden Input Field that catches user keyboard typing -->
      <input
        ref="inputRef"
        :value="currentInput"
        type="text"
        class="hidden-typing-input"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        :disabled="isFinished"
        @input="handleKeyInput"
      />

      <!-- Multi-line Flowing Character Display Stage -->
      <div ref="displayAreaRef" class="text-display-box">
        <span
          v-for="(char, idx) in fullText"
          :key="idx"
          class="stage-char"
          :class="{
            'char-correct': idx < currentInput.length && currentInput[idx] === char,
            'char-wrong': idx < currentInput.length && currentInput[idx] !== char,
            'char-cursor': idx === currentInput.length && !isFinished,
            'char-pending': idx >= currentInput.length
          }"
        >{{ char }}</span>
      </div>

      <!-- Finished Summary Screen Overlay -->
      <div v-if="isFinished" class="finished-overlay">
        <div class="finished-modal">
          <div class="finished-badge">CHALLENGE COMPLETED</div>
          <h3 class="finished-title">Session Results</h3>
          
          <div class="results-stats-row">
            <div class="result-box">
              <span class="res-label">Net Speed</span>
              <span class="res-number red">{{ wpm }} <small>WPM</small></span>
            </div>
            <div class="result-box">
              <span class="res-label">Accuracy</span>
              <span class="res-number green">{{ accuracy }}%</span>
            </div>
            <div class="result-box">
              <span class="res-label">Keystrokes</span>
              <span class="res-number">{{ totalKeystrokes }}</span>
            </div>
            <div class="result-box">
              <span class="res-label">Errors</span>
              <span class="res-number error">{{ errorKeystrokes }}</span>
            </div>
          </div>

          <div class="finished-actions">
            <button class="btn btn-red" @click="resetTest">
              <span>🔄</span> Try Again (Tab)
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blitz-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  max-width: 1050px;
  margin: 0 auto;
}

/* Control Header Card */
.control-header-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.5rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.header-main-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.blitz-brand {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.blitz-icon {
  font-size: 1.8rem;
  color: var(--neon-red);
  filter: drop-shadow(0 0 12px rgba(255, 30, 66, 0.5));
}

.blitz-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: white;
  line-height: 1.2;
}

.blitz-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.modes-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 1rem;
}

.config-pill-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(0, 0, 0, 0.4);
  padding: 0.35rem 0.5rem;
  border-radius: 50px;
  border: 1px solid var(--border-color);
}

.config-pill-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.4rem 0.85rem;
  border-radius: 50px;
  cursor: pointer;
  transition: var(--transition);
}

.config-pill-btn:hover {
  color: white;
}

.config-pill-btn.active {
  background: var(--gradient-red);
  color: white;
  box-shadow: var(--shadow-red);
}

.sub-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  padding-left: 0.5rem;
  font-weight: 600;
}

.sub-pill {
  padding: 0.25rem 0.65rem;
  font-family: var(--font-mono);
}

.quotes-selector-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.quote-dropdown {
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border-color);
  color: white;
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  outline: none;
  cursor: pointer;
  transition: var(--transition);
}

.quote-dropdown:focus {
  border-color: var(--neon-red);
}

/* Stats Counter Bar */
.stats-counter-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.stat-item {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  text-align: center;
}

.stat-meta {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  margin-bottom: 0.25rem;
}

.stat-digit {
  font-family: var(--font-mono);
  font-size: 1.8rem;
  font-weight: 800;
  color: white;
}

.stat-digit.red { color: var(--neon-red); text-shadow: var(--shadow-red); }
.stat-digit.green { color: #10b981; text-shadow: 0 0 14px rgba(16, 185, 129, 0.4); }
.stat-digit small { font-size: 0.8rem; color: var(--text-muted); }

/* Interactive Typing Stage Card */
.typing-stage-card {
  position: relative;
  background: #070507;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 2.25rem;
  min-height: 280px;
  cursor: text;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
  transition: border-color 0.25s ease;
}

.typing-stage-card:focus-within {
  border-color: var(--border-glow-red);
}

.stage-meta-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-bottom: 1.5rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.passage-tag {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--neon-red);
  background: rgba(255, 30, 66, 0.1);
  border: 1px solid rgba(255, 30, 66, 0.3);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
}

.passage-author {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.keyboard-hint {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.keyboard-hint kbd {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

/* Hidden typing input capturing keystrokes */
.hidden-typing-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  left: -9999px;
}

/* Text Display & Character Coloring */
.text-display-box {
  font-family: var(--font-mono);
  font-size: 1.35rem;
  line-height: 1.85;
  letter-spacing: 0.03em;
  user-select: none;
  word-break: break-word;
  white-space: pre-wrap;
  max-height: 280px;
  overflow-y: auto;
  scroll-behavior: smooth;
  padding-right: 0.5rem;
}

.stage-char {
  transition: color 0.1s ease;
}

/* 🟢 Correct Character: BRIGHT GREEN */
.char-correct {
  color: #10b981;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
}

/* 🔴 Wrong Character: BRIGHT RED */
.char-wrong {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.18);
  text-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
  border-radius: 2px;
}

/* ⚪ Pending Characters */
.char-pending {
  color: var(--text-muted);
  opacity: 0.6;
}

/* 📍 Blinking Caret Cursor (No white flash on letter) */
.char-cursor {
  position: relative;
  color: var(--text-muted);
  opacity: 0.85;
  border-left: 2.5px solid var(--neon-red);
  margin-left: -1px;
  animation: cursorBlink 0.9s infinite;
}

@keyframes cursorBlink {
  0%, 100% { border-color: var(--neon-red); }
  50% { border-color: transparent; }
}

/* Finished Overlay Modal */
.finished-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(7, 5, 7, 0.94);
  backdrop-filter: blur(10px);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  z-index: 50;
  animation: fadeIn 0.3s ease;
}

.finished-modal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  text-align: center;
  max-width: 500px;
  width: 100%;
}

.finished-badge {
  font-family: var(--font-retro);
  font-size: 0.65rem;
  color: var(--neon-red);
  background: rgba(255, 30, 66, 0.1);
  border: 1px solid rgba(255, 30, 66, 0.3);
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
}

.finished-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: white;
}

.results-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  width: 100%;
}

.result-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.85rem 0.5rem;
}

.res-label {
  display: block;
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.res-number {
  font-family: var(--font-mono);
  font-size: 1.3rem;
  font-weight: 800;
  color: white;
}

.res-number.red { color: var(--neon-red); text-shadow: var(--shadow-red); }
.res-number.green { color: #10b981; }
.res-number.error { color: #ef4444; }
.res-number small { font-size: 0.65rem; color: var(--text-muted); }

.finished-actions {
  margin-top: 0.5rem;
}

@media (max-width: 768px) {
  .results-stats-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .text-display-box {
    font-size: 1.15rem;
  }
}
</style>
