<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from '@/composables/useToast'

const props = withDefaults(
  defineProps<{
    alwaysOpen?: boolean
  }>(),
  {
    alwaysOpen: false
  }
)

const isOpen = ref(props.alwaysOpen)
const { copyToClipboard } = useToast()

const baseUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://textic.github.io'
})

interface CdnItem {
  title: string
  path: string
  description: string
  badge: string
}

const cdnFiles: CdnItem[] = [
  {
    title: 'Spanish Dictionary',
    path: 'assets/dictionary.json',
    description: 'Más de 646k palabras en español (~14.5 MB). Usado internamente por Typing Blitz.',
    badge: '14.5 MB'
  },
  {
    title: 'Gamer Nicknames',
    path: 'assets/names.json',
    description: 'Lista de alias y nombres de usuario para videojuegos y plataformas (~26 KB).',
    badge: '26 KB'
  },
  {
    title: 'Mock Test Users',
    path: 'assets/testUsers.json',
    description: 'Credenciales y datos de usuarios de prueba para prototipos de login (~365 B).',
    badge: '365 B'
  },
  {
    title: 'Asset Links Verification',
    path: '.well-known/assetlinks.json',
    description: 'Configuración oficial de Digital Asset Links para integración de apps Android.',
    badge: 'JSON'
  }
]

const copyEndpoint = (path: string) => {
  const url = `${baseUrl.value}/${path}`
  copyToClipboard(url, `Endpoint copiado: ${path}`)
}
</script>

<template>
  <div class="cdn-drawer" :class="{ 'full-page-mode': alwaysOpen }">
    <div class="cdn-header" @click="isOpen = !isOpen">
      <div class="cdn-title">
        <span class="title-icon">📡</span>
        <span class="title-text">CDN & Static Asset Endpoints</span>
        <span class="files-count">{{ cdnFiles.length }} endpoints</span>
      </div>
      <div class="cdn-arrow" :class="{ open: isOpen }">▼</div>
    </div>

    <div v-show="isOpen" class="cdn-body">
      <p class="cdn-desc">
        Tus archivos estáticos se hospedan y sirven públicamente a través de esta infraestructura.
        Cualquier aplicación externa o script puede consumirlos directamente vía HTTP GET sin autenticación.
        Haz clic en cualquier tarjeta o ruta para copiar la URL completa.
      </p>

      <div class="cdn-grid">
        <div
          v-for="item in cdnFiles"
          :key="item.path"
          class="cdn-card"
          @click="copyEndpoint(item.path)"
        >
          <div class="card-top">
            <h4 class="card-title">{{ item.title }}</h4>
            <span class="card-badge">{{ item.badge }}</span>
          </div>
          <code class="card-path">{{ baseUrl }}/{{ item.path }}</code>
          <p class="card-info">{{ item.description }}</p>
          <div class="card-copy-hint">📋 Clic para copiar endpoint</div>
        </div>
      </div>

      <div class="cdn-instructions">
        <div class="instruction-step">
          <div class="step-number">1</div>
          <div>
            <h5>Guardar Archivos</h5>
            <p>Ubica tus archivos dentro del directorio <code>public/assets/</code>.</p>
          </div>
        </div>
        <div class="instruction-step">
          <div class="step-number">2</div>
          <div>
            <h5>Hacer Git Push</h5>
            <p>Sube tus cambios a la rama principal (<code>main</code>).</p>
          </div>
        </div>
        <div class="instruction-step">
          <div class="step-number">3</div>
          <div>
            <h5>Consumir</h5>
            <p>Accede inmediatamente en <code>https://textic.github.io/assets/tu_archivo.json</code>.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cdn-drawer {
  margin-top: 4.5rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.5rem 1.75rem;
  backdrop-filter: blur(16px);
  transition: var(--transition);
}

.cdn-drawer.full-page-mode {
  margin-top: 0;
}

.cdn-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.cdn-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.15rem;
  font-weight: 700;
}

.title-icon {
  font-size: 1.3rem;
}

.files-count {
  font-size: 0.75rem;
  background: rgba(0, 240, 255, 0.1);
  color: var(--neon-cyan);
  border: 1px solid rgba(0, 240, 255, 0.3);
  padding: 0.15rem 0.6rem;
  border-radius: 50px;
  font-weight: 600;
}

.cdn-arrow {
  color: var(--text-secondary);
  font-size: 0.9rem;
  transition: var(--transition);
}

.cdn-arrow.open {
  transform: rotate(180deg);
  color: var(--neon-cyan);
}

.cdn-body {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  animation: fadeIn 0.3s ease;
}

.cdn-desc {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  max-width: 800px;
}

.cdn-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.cdn-card {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.2rem;
  cursor: pointer;
  transition: var(--transition);
  display: flex;
  flex-direction: column;
}

.cdn-card:hover {
  border-color: var(--border-glow-cyan);
  background: rgba(0, 240, 255, 0.03);
  transform: translateY(-2px);
  box-shadow: var(--shadow-cyan);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
}

.card-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: white;
}

.card-badge {
  font-size: 0.7rem;
  font-family: var(--font-mono);
  color: var(--neon-pink);
  background: rgba(255, 0, 127, 0.1);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 0, 127, 0.25);
}

.card-path {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--neon-cyan);
  background: rgba(0, 0, 0, 0.3);
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  margin-bottom: 0.65rem;
  word-break: break-all;
  display: block;
}

.card-info {
  font-size: 0.8rem;
  color: var(--text-secondary);
  flex-grow: 1;
  line-height: 1.5;
  margin-bottom: 0.75rem;
}

.card-copy-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.cdn-card:hover .card-copy-hint {
  color: var(--neon-cyan);
}

.cdn-instructions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-md);
  padding: 1.25rem;
}

.instruction-step {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
}

.step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--gradient-pink);
  color: white;
  font-weight: 700;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.instruction-step h5 {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.2rem;
}

.instruction-step p {
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.instruction-step code {
  font-family: var(--font-mono);
  color: var(--neon-cyan);
  font-size: 0.75rem;
}
</style>
