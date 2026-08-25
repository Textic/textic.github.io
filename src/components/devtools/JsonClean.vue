<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from '@/composables/useToast'

const { copyToClipboard, showToast } = useToast()

const rawJson = ref('')
const parseError = ref<string | null>(null)
const isValid = ref<boolean | null>(null)

const validateJson = () => {
  const text = rawJson.value.trim()
  if (!text) {
    parseError.value = null
    isValid.value = null
    return
  }

  try {
    JSON.parse(text)
    parseError.value = null
    isValid.value = true
  } catch (err: unknown) {
    isValid.value = false
    if (err instanceof Error) {
      parseError.value = err.message
    } else {
      parseError.value = 'Sintaxis JSON inválida'
    }
  }
}

const formatJson = () => {
  const text = rawJson.value.trim()
  if (!text) return

  try {
    const parsed = JSON.parse(text)
    rawJson.value = JSON.stringify(parsed, null, 2)
    validateJson()
    showToast('JSON formateado correctamente con sangría')
  } catch {
    showToast('Error: No se pudo formatear el JSON (sintaxis inválida)', 'error')
  }
}

const minifyJson = () => {
  const text = rawJson.value.trim()
  if (!text) return

  try {
    const parsed = JSON.parse(text)
    rawJson.value = JSON.stringify(parsed)
    validateJson()
    showToast('JSON minificado')
  } catch {
    showToast('Error: No se pudo minificar el JSON (sintaxis inválida)', 'error')
  }
}

const copyJson = () => {
  if (rawJson.value.trim()) {
    copyToClipboard(rawJson.value, '¡JSON copiado al portapapeles!')
  }
}

const clearJson = () => {
  rawJson.value = ''
  validateJson()
}

const loadSample = () => {
  rawJson.value = JSON.stringify({
    project: "Textic Arcade & Sandbox",
    version: "2.0.0",
    features: ["PassFort", "JSON Clean", "Cyber Snake", "Typing Blitz"],
    active: true,
    stats: {
      stars: 42,
      latencyMs: 12
    }
  }, null, 2)
  validateJson()
  showToast('Ejemplo JSON cargado')
}

const stats = computed(() => {
  const text = rawJson.value
  const bytes = new Blob([text]).size
  const lines = text ? text.split('\n').length : 0
  return {
    chars: text.length,
    lines,
    bytes: bytes > 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`
  }
})
</script>

<template>
  <div class="util-card">
    <div class="util-title-bar">
      <div class="title-left">
        <span class="util-title-icon">💎</span>
        <h3 class="util-title-text">JSON Clean</h3>
      </div>
      <div class="stats-badge">
        <span>{{ stats.lines }} líneas</span>
        <span>•</span>
        <span>{{ stats.bytes }}</span>
      </div>
    </div>

    <p class="util-desc">
      Valida sintaxis en tiempo real, embellece y minifica objetos y arrays JSON al instante.
    </p>

    <!-- Editor Textarea -->
    <div class="editor-wrapper">
      <textarea
        v-model="rawJson"
        class="json-textarea"
        placeholder="Pega o escribe tu JSON aquí para analizarlo..."
        spellcheck="false"
        @input="validateJson"
      ></textarea>
    </div>

    <!-- Status Feedback Row -->
    <div class="status-row">
      <div v-if="isValid === true" class="status-tag status-ok">
        ● JSON Válido
      </div>
      <div v-else-if="isValid === false" class="status-tag status-err">
        ● {{ parseError }}
      </div>
      <div v-else class="status-tag status-idle">
        Esperando entrada...
      </div>

      <div class="sample-actions">
        <button class="text-action-btn" @click="loadSample">Cargar ejemplo</button>
        <button v-if="rawJson" class="text-action-btn" @click="clearJson">Limpiar</button>
      </div>
    </div>

    <!-- Action Toolbar -->
    <div class="action-toolbar">
      <button class="btn btn-secondary action-btn" :disabled="!rawJson" @click="minifyJson">
        Minificar
      </button>
      <button class="btn btn-secondary action-btn" :disabled="!rawJson" @click="formatJson">
        Formatear (2 spaces)
      </button>
      <button class="btn btn-cyan action-btn copy-btn" :disabled="!rawJson" @click="copyJson">
        📋 Copiar
      </button>
    </div>
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
  gap: 1.2rem;
  backdrop-filter: blur(16px);
  transition: var(--transition);
}

.util-card:hover {
  border-color: var(--border-glow-cyan);
  background: rgba(22, 28, 61, 0.7);
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
  color: var(--neon-cyan);
}

.util-title-text {
  font-size: 1.2rem;
  font-weight: 700;
}

.stats-badge {
  display: flex;
  gap: 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.util-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.editor-wrapper {
  position: relative;
  width: 100%;
}

.json-textarea {
  width: 100%;
  height: 200px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1rem;
  color: #f1f5f9;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.5;
  resize: vertical;
  transition: var(--transition);
}

.json-textarea:focus {
  outline: none;
  border-color: var(--neon-cyan);
  box-shadow: var(--shadow-cyan);
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  min-height: 22px;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.status-ok { color: var(--neon-green); }
.status-err { color: #ef4444; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status-idle { color: var(--text-muted); }

.sample-actions {
  display: flex;
  gap: 0.75rem;
}

.text-action-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  text-decoration: underline;
  transition: var(--transition);
}

.text-action-btn:hover {
  color: var(--neon-cyan);
}

.action-toolbar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.action-btn {
  flex: 1;
  justify-content: center;
  padding: 0.65rem 1rem;
  font-size: 0.85rem;
}

.copy-btn {
  flex: 1.2;
}
</style>
