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
      parseError.value = 'Invalid JSON syntax'
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
    showToast('JSON formatted successfully (2 spaces)')
  } catch {
    showToast('Error: Could not format JSON (invalid syntax)', 'error')
  }
}

const minifyJson = () => {
  const text = rawJson.value.trim()
  if (!text) return

  try {
    const parsed = JSON.parse(text)
    rawJson.value = JSON.stringify(parsed)
    validateJson()
    showToast('JSON minified')
  } catch {
    showToast('Error: Could not minify JSON (invalid syntax)', 'error')
  }
}

const copyJson = () => {
  if (rawJson.value.trim()) {
    copyToClipboard(rawJson.value, 'JSON copied to clipboard!')
  }
}

const clearJson = () => {
  rawJson.value = ''
  validateJson()
}

const loadSample = () => {
  rawJson.value = JSON.stringify({
    project: "TexTools",
    version: "2.0.0",
    theme: "Dark & Crimson Red",
    features: ["CipherLab", "PassFort", "JSON Clean", "Snake", "Typing Blitz", "Minesweeper"],
    active: true,
    stats: {
      stars: 42,
      latencyMs: 12
    }
  }, null, 2)
  validateJson()
  showToast('JSON sample loaded')
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
        <span>{{ stats.lines }} lines</span>
        <span>•</span>
        <span>{{ stats.bytes }}</span>
      </div>
    </div>

    <p class="util-desc">
      Validates JSON syntax in real-time, beautifies with standard indentation, and minifies data payloads.
    </p>

    <!-- Editor Textarea -->
    <div class="editor-wrapper">
      <textarea
        v-model="rawJson"
        class="json-textarea"
        placeholder="Paste or type raw JSON here to inspect..."
        spellcheck="false"
        @input="validateJson"
      ></textarea>
    </div>

    <!-- Status Feedback Row -->
    <div class="status-row">
      <div v-if="isValid === true" class="status-tag status-ok">
        ● Valid JSON
      </div>
      <div v-else-if="isValid === false" class="status-tag status-err">
        ● {{ parseError }}
      </div>
      <div v-else class="status-tag status-idle">
        Waiting for input...
      </div>

      <div class="sample-actions">
        <button class="text-action-btn" @click="loadSample">Load Sample</button>
        <button v-if="rawJson" class="text-action-btn" @click="clearJson">Clear</button>
      </div>
    </div>

    <!-- Action Toolbar -->
    <div class="action-toolbar">
      <button class="btn btn-secondary action-btn" :disabled="!rawJson" @click="minifyJson">
        Minify
      </button>
      <button class="btn btn-secondary action-btn" :disabled="!rawJson" @click="formatJson">
        Format (2 spaces)
      </button>
      <button class="btn btn-red action-btn copy-btn" :disabled="!rawJson" @click="copyJson">
        📋 Copy
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
  height: 350px;
  min-height: 260px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.1rem;
  color: #fdf8f9;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  line-height: 1.6;
  resize: vertical;
  transition: var(--transition);
}

.json-textarea:focus {
  outline: none;
  border-color: var(--neon-red);
  box-shadow: var(--shadow-red);
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
.status-err { color: #ef4444; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
  color: var(--neon-red);
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
