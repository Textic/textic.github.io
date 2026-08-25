<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Point {
  x: number
  y: number
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const highScore = ref(0)
const isRunning = ref(false)
const isGameOver = ref(false)
const gameStarted = ref(false)

let ctx: CanvasRenderingContext2D | null = null
let snake: Point[] = []
let food: Point = { x: 0, y: 0 }
let dir: Point = { x: 1, y: 0 }
let nextDir: Point = { x: 1, y: 0 }
let speed = 100
let timer: number | null = null

const CELL_SIZE = 20
const CANVAS_SIZE = 400
const COLS = CANVAS_SIZE / CELL_SIZE
const ROWS = CANVAS_SIZE / CELL_SIZE

onMounted(() => {
  const saved = localStorage.getItem('snake_highscore')
  if (saved) {
    highScore.value = parseInt(saved, 10) || 0
  }

  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d')
    resetGame()
  }

  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  stopGame()
  window.removeEventListener('keydown', handleKeyDown)
})

const handleKeyDown = (e: KeyboardEvent) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault()
  }

  if (!isRunning.value && (e.key === ' ' || e.key === 'Enter')) {
    startGame()
    return
  }

  switch (e.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      if (dir.y === 0) nextDir = { x: 0, y: -1 }
      break
    case 'ArrowDown':
    case 's':
    case 'S':
      if (dir.y === 0) nextDir = { x: 0, y: 1 }
      break
    case 'ArrowLeft':
    case 'a':
    case 'A':
      if (dir.x === 0) nextDir = { x: -1, y: 0 }
      break
    case 'ArrowRight':
    case 'd':
    case 'D':
      if (dir.x === 0) nextDir = { x: 1, y: 0 }
      break
  }
}

const resetGame = () => {
  score.value = 0
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
  ]
  dir = { x: 1, y: 0 }
  nextDir = { x: 1, y: 0 }
  speed = 100
  isRunning.value = false
  isGameOver.value = false
  gameStarted.value = false

  spawnFood()
  draw()
}

const spawnFood = () => {
  let valid = false
  while (!valid) {
    food = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS)
    }
    valid = !snake.some(segment => segment.x === food.x && segment.y === food.y)
  }
}

const draw = () => {
  const c = ctx
  if (!c) return

  // Canvas background
  c.fillStyle = '#070507'
  c.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  // Retro grid
  c.strokeStyle = 'rgba(255, 30, 66, 0.04)'
  c.lineWidth = 1
  for (let i = 0; i < CANVAS_SIZE; i += CELL_SIZE) {
    c.beginPath()
    c.moveTo(i, 0)
    c.lineTo(i, CANVAS_SIZE)
    c.stroke()

    c.beginPath()
    c.moveTo(0, i)
    c.lineTo(CANVAS_SIZE, i)
    c.stroke()
  }

  // Draw Food (glowing orb)
  c.shadowBlur = 18
  c.shadowColor = '#ff1e42'
  c.fillStyle = '#ff1e42'
  c.beginPath()
  c.arc(food.x * CELL_SIZE + 10, food.y * CELL_SIZE + 10, 7, 0, Math.PI * 2)
  c.fill()

  // Draw Snake segments
  snake.forEach((seg, i) => {
    const isHead = i === 0
    c.shadowBlur = isHead ? 18 : 0
    c.shadowColor = '#ff1e42'
    
    if (isHead) {
      c.fillStyle = '#ff1e42'
    } else {
      const alpha = 1 - (i / snake.length) * 0.75
      c.fillStyle = `rgba(255, 30, 66, ${alpha})`
    }

    c.fillRect(seg.x * CELL_SIZE + 1, seg.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2)
  })

  c.shadowBlur = 0
}

const gameLoop = () => {
  if (!isRunning.value || snake.length === 0 || !snake[0]) return

  dir = nextDir
  const head: Point = {
    x: snake[0].x + dir.x,
    y: snake[0].y + dir.y
  }

  // Wall collisions
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    triggerGameOver()
    return
  }

  // Self collision
  if (snake.some((seg, idx) => idx > 0 && seg.x === head.x && seg.y === head.y)) {
    triggerGameOver()
    return
  }

  snake.unshift(head)

  // Eat food
  if (head.x === food.x && head.y === food.y) {
    score.value += 10
    if (score.value > highScore.value) {
      highScore.value = score.value
      localStorage.setItem('snake_highscore', highScore.value.toString())
    }
    spawnFood()

    // Increase speed slightly
    if (speed > 50) {
      speed -= 2
      if (timer) clearInterval(timer)
      timer = window.setInterval(gameLoop, speed)
    }
  } else {
    snake.pop()
  }

  draw()
}

const startGame = () => {
  if (timer) clearInterval(timer)
  resetGame()
  isRunning.value = true
  gameStarted.value = true
  isGameOver.value = false
  timer = window.setInterval(gameLoop, speed)
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
</script>

<template>
  <div class="snake-cabinet">
    <div class="viewport-wrapper">
      <!-- Overlay: Start Screen -->
      <div v-if="!gameStarted" class="overlay-screen">
        <div class="overlay-badge">ARCADE EDITION</div>
        <h3 class="overlay-title">CYBER SNAKE</h3>
        <p class="overlay-desc">
          Recolecta los nodos de energía neón. Evita chocar contra los límites del tablero y tu propio cuerpo.
        </p>
        <div class="overlay-keys">
          <span>Controles:</span>
          <code>WASD</code> o <code>Flechas</code>
        </div>
        <button class="btn btn-cyan" @click="startGame">
          <span>🪙</span> Insert Coin & Jugar
        </button>
      </div>

      <!-- Overlay: Game Over -->
      <div v-else-if="isGameOver" class="overlay-screen gameover">
        <h3 class="overlay-title gameover-text">GAME OVER</h3>
        <p class="overlay-desc">Colisión estructural detectada.</p>
        <div class="final-score-box">
          <span>PUNTUACIÓN FINAL:</span>
          <span class="final-score-val">{{ score }}</span>
        </div>
        <button class="btn btn-pink" @click="startGame">
          <span>🔄</span> Jugar de Nuevo
        </button>
      </div>

      <!-- Canvas -->
      <canvas
        ref="canvasRef"
        :width="CANVAS_SIZE"
        :height="CANVAS_SIZE"
        class="snake-canvas"
      ></canvas>
    </div>

    <!-- Controls & Stats bar -->
    <div class="snake-stats-bar">
      <div class="stat-pill">
        <span class="stat-label">SCORE</span>
        <span class="stat-value">{{ String(score).padStart(3, '0') }}</span>
      </div>
      <div class="stat-pill hi-score">
        <span class="stat-label">HI-SCORE</span>
        <span class="stat-value">{{ String(highScore).padStart(3, '0') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.snake-cabinet {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.viewport-wrapper {
  position: relative;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.7);
  background: #03040b;
}

/* CRT scanlines effect */
.viewport-wrapper::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.3) 50%),
              linear-gradient(90deg, rgba(255, 0, 0, 0.05), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.05));
  background-size: 100% 4px, 6px 100%;
  pointer-events: none;
  z-index: 10;
}

.snake-canvas {
  display: block;
  max-width: 100%;
  aspect-ratio: 1 / 1;
}

.overlay-screen {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(4, 6, 18, 0.92);
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
  font-size: 1.4rem;
  color: var(--neon-cyan);
  text-shadow: var(--shadow-cyan);
  margin-bottom: 0.75rem;
  letter-spacing: 0.05em;
}

.gameover-text {
  color: var(--neon-pink);
  text-shadow: var(--shadow-pink-strong);
  animation: pulse 1.2s infinite;
}

.overlay-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  max-width: 280px;
  line-height: 1.5;
  margin-bottom: 1.2rem;
}

.overlay-keys {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

.overlay-keys code {
  font-family: var(--font-mono);
  color: var(--neon-cyan);
  background: rgba(255, 255, 255, 0.05);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.final-score-box {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  font-family: var(--font-retro);
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.final-score-val {
  font-size: 1.5rem;
  color: var(--neon-pink);
  text-shadow: var(--shadow-pink);
}

.snake-stats-bar {
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 400px;
  margin-top: 1.25rem;
  gap: 1rem;
}

.stat-pill {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.6rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-retro);
  font-size: 0.7rem;
}

.stat-label {
  color: var(--text-muted);
}

.stat-value {
  color: var(--neon-cyan);
  font-size: 0.85rem;
  text-shadow: var(--shadow-cyan);
}

.hi-score .stat-value {
  color: var(--neon-pink);
  text-shadow: var(--shadow-pink);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
