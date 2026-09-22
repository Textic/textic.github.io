<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

type Difficulty = 'novice' | 'hacker' | 'cyberop'

interface DifficultyConfig {
  name: string
  rows: number
  cols: number
  mines: number
  badge: string
}

const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  novice: { name: 'Novice', rows: 9, cols: 9, mines: 10, badge: '9x9 (10 Mines)' },
  hacker: { name: 'Hacker', rows: 16, cols: 16, mines: 40, badge: '16x16 (40 Mines)' },
  cyberop: { name: 'Cyber Op', rows: 16, cols: 30, mines: 99, badge: '30x16 (99 Mines)' }
}

interface Cell {
  r: number
  c: number
  isMine: boolean
  isRevealed: boolean
  isFlagged: boolean
  count: number
  isExploded?: boolean
}

const currentDifficulty = ref<Difficulty>('novice')
const grid = ref<Cell[][]>([])
const isGameStarted = ref(false)
const isGameOver = ref(false)
const isVictory = ref(false)
const timer = ref(0)
let timerInterval: number | null = null

// Mobile mode toggle: 'reveal' or 'flag'
const actionMode = ref<'reveal' | 'flag'>('reveal')

// Audio synth context for retro sound effects
let audioCtx: AudioContext | null = null
const playTone = (freq: number, type: OscillatorType = 'sine', duration: number = 0.08) => {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtx = new AudioContextClass()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime)
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + duration)
  } catch {
    // Audio might be blocked by browser policy until interaction
  }
}

// Local storage records
const getBestTime = (diff: Difficulty): number | null => {
  if (typeof window === 'undefined') return null
  const val = localStorage.getItem(`cyber_mines_${diff}`)
  return val ? parseInt(val, 10) : null
}

const bestTime = ref<number | null>(getBestTime('novice'))

const initGrid = () => {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null
  timer.value = 0
  isGameStarted.value = false
  isGameOver.value = false
  isVictory.value = false
  bestTime.value = getBestTime(currentDifficulty.value)

  const config = DIFFICULTIES[currentDifficulty.value]
  const newGrid: Cell[][] = []
  for (let r = 0; r < config.rows; r++) {
    const row: Cell[] = []
    for (let c = 0; c < config.cols; c++) {
      row.push({
        r,
        c,
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        count: 0
      })
    }
    newGrid.push(row)
  }
  grid.value = newGrid
}

const changeDifficulty = (diff: Difficulty) => {
  currentDifficulty.value = diff
  initGrid()
}

// Plant mines ensuring safe first click area
const plantMines = (safeR: number, safeC: number) => {
  const config = DIFFICULTIES[currentDifficulty.value]
  let planted = 0

  while (planted < config.mines) {
    const r = Math.floor(Math.random() * config.rows)
    const c = Math.floor(Math.random() * config.cols)

    // Ensure not in safe zone around initial click
    const isSafeZone = Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1
    const cell = grid.value[r]?.[c]
    if (cell && !cell.isMine && !isSafeZone) {
      cell.isMine = true
      planted++
    }
  }

  // Calculate adjacent mine counts
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      const cell = grid.value[r]?.[c]
      if (!cell || cell.isMine) continue
      let count = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = r + dr
          const nc = c + dc
          if (grid.value[nr]?.[nc]?.isMine) count++
        }
      }
      cell.count = count
    }
  }
}

const startTimer = () => {
  if (timerInterval) return
  timerInterval = window.setInterval(() => {
    timer.value++
  }, 1000)
}

const remainingMines = computed(() => {
  const config = DIFFICULTIES[currentDifficulty.value]
  let flags = 0
  for (const row of grid.value) {
    for (const cell of row) {
      if (cell.isFlagged) flags++
    }
  }
  return config.mines - flags
})

const checkVictory = () => {
  const config = DIFFICULTIES[currentDifficulty.value]
  let revealedCount = 0
  for (const row of grid.value) {
    for (const cell of row) {
      if (cell.isRevealed && !cell.isMine) revealedCount++
    }
  }
  const totalSafeCells = config.rows * config.cols - config.mines
  if (revealedCount === totalSafeCells) {
    isVictory.value = true
    isGameOver.value = true
    if (timerInterval) clearInterval(timerInterval)
    playTone(600, 'triangle', 0.2)
    setTimeout(() => playTone(900, 'triangle', 0.3), 150)

    const prevBest = getBestTime(currentDifficulty.value)
    if (prevBest === null || timer.value < prevBest) {
      localStorage.setItem(`cyber_mines_${currentDifficulty.value}`, timer.value.toString())
      bestTime.value = timer.value
    }
  }
}

// Flood reveal empty spaces
const revealCell = (r: number, c: number) => {
  const cell = grid.value[r]?.[c]
  if (!cell || cell.isRevealed || cell.isFlagged) return

  cell.isRevealed = true

  if (cell.count === 0 && !cell.isMine) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        revealCell(r + dr, c + dc)
      }
    }
  }
}

const handleCellClick = (r: number, c: number) => {
  if (isGameOver.value) return

  // If mobile touch action is flag mode
  if (actionMode.value === 'flag') {
    handleRightClick(r, c)
    return
  }

  const cell = grid.value[r]?.[c]
  if (!cell || cell.isFlagged) return

  // First click setup
  if (!isGameStarted.value) {
    isGameStarted.value = true
    plantMines(r, c)
    startTimer()
  }

  // Chord click: already revealed cell with matching flags around
  if (cell.isRevealed) {
    if (cell.count > 0) {
      let flaggedAround = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          if (grid.value[r + dr]?.[c + dc]?.isFlagged) flaggedAround++
        }
      }
      if (flaggedAround === cell.count) {
        playTone(450, 'sine', 0.05)
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue
            const neighbor = grid.value[r + dr]?.[c + dc]
            if (neighbor && !neighbor.isRevealed && !neighbor.isFlagged) {
              if (neighbor.isMine) {
                triggerGameOver(neighbor)
                return
              } else {
                revealCell(r + dr, c + dc)
              }
            }
          }
        }
        checkVictory()
      }
    }
    return
  }

  // Regular click on unrevealed cell
  if (cell.isMine) {
    triggerGameOver(cell)
    return
  }

  playTone(320, 'sine', 0.04)
  revealCell(r, c)
  checkVictory()
}

const handleRightClick = (r: number, c: number, e?: MouseEvent) => {
  if (e) e.preventDefault()
  if (isGameOver.value) return

  const cell = grid.value[r]?.[c]
  if (!cell || cell.isRevealed) return

  cell.isFlagged = !cell.isFlagged
  playTone(cell.isFlagged ? 520 : 260, 'sawtooth', 0.05)
}

const triggerGameOver = (explodedCell: Cell) => {
  isGameOver.value = true
  explodedCell.isExploded = true
  if (timerInterval) clearInterval(timerInterval)
  playTone(120, 'sawtooth', 0.4)

  // Reveal all mines
  for (const row of grid.value) {
    for (const c of row) {
      if (c.isMine) c.isRevealed = true
    }
  }
}

// Initial grid creation
initGrid()

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})
</script>

<template>
  <div class="minesweeper-arcade-container">
    <!-- Top Control Console Bar -->
    <div class="mines-console">
      <div class="console-left">
        <span class="console-title">💣 Cyber Minesweeper</span>
        <!-- Difficulty Selectors -->
        <div class="diff-tabs">
          <button
            v-for="(cfg, key) in DIFFICULTIES"
            :key="key"
            class="diff-btn"
            :class="{ active: currentDifficulty === key }"
            @click="changeDifficulty(key)"
          >
            {{ cfg.name }}
          </button>
        </div>
      </div>

      <div class="console-right">
        <!-- Digital Indicators (LCD Vibe) -->
        <div class="lcd-readout">
          <div class="lcd-segment" title="Remaining mines">
            <span class="lcd-icon">🚩</span>
            <span class="lcd-digits">{{ String(remainingMines).padStart(3, '0') }}</span>
          </div>

          <!-- Reset Button Face -->
          <button class="reset-face-btn" title="Reset game" @click="initGrid">
            <span v-if="isVictory">😎</span>
            <span v-else-if="isGameOver">💥</span>
            <span v-else>🤖</span>
          </button>

          <div class="lcd-segment" title="Elapsed seconds">
            <span class="lcd-icon">⏱️</span>
            <span class="lcd-digits">{{ String(Math.min(999, timer)).padStart(3, '0') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile Touch Mode Switcher (Tap to reveal or flag) -->
    <div class="mobile-action-bar">
      <span class="mobile-action-label">Touch Mode:</span>
      <button
        class="action-toggle-btn"
        :class="{ active: actionMode === 'reveal' }"
        @click="actionMode = 'reveal'"
      >
        ⚡ Reveal
      </button>
      <button
        class="action-toggle-btn flag-btn"
        :class="{ active: actionMode === 'flag' }"
        @click="actionMode = 'flag'"
      >
        🚩 Flag
      </button>
    </div>

    <!-- Main Minefield Grid Board -->
    <div class="board-wrapper">
      <div
        class="minefield"
        :class="`cols-${DIFFICULTIES[currentDifficulty].cols}`"
      >
        <template v-for="(row, r) in grid" :key="`row-${r}`">
          <button
            v-for="(cell, c) in row"
            :key="`cell-${r}-${c}`"
            class="mine-cell"
            :class="{
              revealed: cell.isRevealed,
              'has-mine': cell.isRevealed && cell.isMine,
              exploded: cell.isExploded,
              flagged: cell.isFlagged && !cell.isRevealed,
              [`count-${cell.count}`]: cell.isRevealed && cell.count > 0 && !cell.isMine
            }"
            @click="handleCellClick(r, c)"
            @contextmenu.prevent="handleRightClick(r, c, $event)"
          >
            <!-- Content of Cell -->
            <template v-if="cell.isRevealed">
              <span v-if="cell.isMine" class="mine-symbol">💣</span>
              <span v-else-if="cell.count > 0" class="count-number">{{ cell.count }}</span>
            </template>
            <template v-else-if="cell.isFlagged">
              <span class="flag-symbol">🚩</span>
            </template>
          </button>
        </template>
      </div>
    </div>

    <!-- Game Status & Record Footer -->
    <div class="mines-footer">
      <div class="status-msg">
        <span v-if="isVictory" class="victory-banner">🎉 SYSTEM UNLOCKED! Target Cleared in {{ timer }}s</span>
        <span v-else-if="isGameOver" class="gameover-banner">⚠️ CONNECTION SEVERED! Mine Detonated</span>
        <span v-else class="normal-status">Neutralize hostile subroutines. First node is always clear.</span>
      </div>

      <div class="best-record">
        <span class="record-label">BEST RECORD:</span>
        <span class="record-val">{{ bestTime !== null ? `${bestTime}s` : '---' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.minesweeper-arcade-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
}

.mines-console {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
}

.console-left {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.console-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: white;
  letter-spacing: 0.05em;
}

.diff-tabs {
  display: flex;
  gap: 0.35rem;
}

.diff-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.75rem;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  transition: var(--transition);
}

.diff-btn:hover {
  background: rgba(255, 30, 66, 0.15);
  color: white;
}

.diff-btn.active {
  background: var(--neon-red);
  color: white;
  border-color: var(--neon-red);
  box-shadow: 0 0 10px rgba(255, 30, 66, 0.4);
  font-weight: 700;
}

/* Digital Readouts */
.lcd-readout {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.85rem;
}

.lcd-segment {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.lcd-icon {
  font-size: 0.9rem;
}

.lcd-digits {
  font-family: var(--font-mono);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--neon-red);
  letter-spacing: 0.1em;
  text-shadow: 0 0 8px rgba(255, 30, 66, 0.6);
}

.reset-face-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  cursor: pointer;
  transition: transform 0.15s;
}

.reset-face-btn:hover {
  transform: scale(1.1);
  border-color: var(--neon-red);
}

.reset-face-btn:active {
  transform: scale(0.95);
}

/* Mobile Action Bar */
.mobile-action-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  justify-content: center;
}

@media (min-width: 768px) {
  .mobile-action-bar {
    display: none;
  }
}

.mobile-action-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.action-toggle-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  padding: 0.35rem 0.85rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.action-toggle-btn.active {
  background: var(--neon-red);
  color: white;
  border-color: var(--neon-red);
}

.action-toggle-btn.flag-btn.active {
  background: #f59e0b;
  border-color: #f59e0b;
}

/* Board & Cells */
.board-wrapper {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  display: flex;
  justify-content: center;
  overflow-x: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.minefield {
  display: grid;
  gap: 3px;
  user-select: none;
}

.minefield.cols-9 {
  grid-template-columns: repeat(9, 36px);
}

.minefield.cols-16 {
  grid-template-columns: repeat(16, 32px);
}

.minefield.cols-30 {
  grid-template-columns: repeat(30, 28px);
}

.mine-cell {
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  font-family: var(--font-mono);
  font-weight: 800;
  font-size: 0.88rem;
  transition: background 0.1s;
}

.mine-cell:hover:not(.revealed) {
  background: rgba(255, 30, 66, 0.2);
  border-color: var(--neon-red);
}

.mine-cell.revealed {
  background: rgba(0, 0, 0, 0.45);
  border-color: rgba(255, 255, 255, 0.04);
  cursor: default;
}

.mine-cell.has-mine {
  background: rgba(239, 68, 68, 0.3);
}

.mine-cell.exploded {
  background: #ef4444;
  animation: glitch-blast 0.25s infinite;
}

@keyframes glitch-blast {
  0% { transform: translate(0, 0); }
  25% { transform: translate(-2px, 2px); }
  50% { transform: translate(2px, -1px); }
  75% { transform: translate(-1px, -2px); }
  100% { transform: translate(0, 0); }
}

.mine-cell.flagged {
  border-color: rgba(245, 158, 11, 0.5);
  background: rgba(245, 158, 11, 0.1);
}

.flag-symbol {
  font-size: 0.95rem;
}

.mine-symbol {
  font-size: 1rem;
}

/* Number Colors */
.count-number {
  line-height: 1;
}

.count-1 { color: #00dfd8; text-shadow: 0 0 5px rgba(0, 223, 216, 0.4); }
.count-2 { color: #10b981; text-shadow: 0 0 5px rgba(16, 185, 129, 0.4); }
.count-3 { color: #ff1e42; text-shadow: 0 0 5px rgba(255, 30, 66, 0.4); }
.count-4 { color: #8b5cf6; text-shadow: 0 0 5px rgba(139, 92, 246, 0.4); }
.count-5 { color: #f59e0b; text-shadow: 0 0 5px rgba(245, 158, 11, 0.4); }
.count-6 { color: #ec4899; text-shadow: 0 0 5px rgba(236, 72, 153, 0.4); }
.count-7 { color: #e2e8f0; }
.count-8 { color: #94a3b8; }

/* Status and Records Footer */
.mines-footer {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.85rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.normal-status {
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.victory-banner {
  font-size: 0.85rem;
  font-weight: 800;
  color: #10b981;
}

.gameover-banner {
  font-size: 0.85rem;
  font-weight: 800;
  color: #ef4444;
}

.best-record {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.record-label {
  color: var(--text-muted);
}

.record-val {
  color: var(--neon-red);
  font-weight: 800;
}
</style>
