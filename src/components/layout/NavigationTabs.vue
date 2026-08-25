<script setup lang="ts">
export type TabId = 'arcade' | 'devtools' | 'links'

defineProps<{
  currentTab: TabId
}>()

const emit = defineEmits<{
  (e: 'update:currentTab', tab: TabId): void
}>()

const tabs: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'arcade', label: 'Arcade Games', icon: '🎮' },
  { id: 'devtools', label: 'Dev Utilities', icon: '🛠' },
  { id: 'links', label: 'Useful Pages', icon: '🔗' }
]
</script>

<template>
  <nav class="nav-row" aria-label="Navegación principal">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="nav-btn"
      :class="{ active: currentTab === tab.id }"
      @click="emit('update:currentTab', tab.id)"
    >
      <span class="nav-btn-icon">{{ tab.icon }}</span>
      <span class="nav-btn-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.nav-row {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
}

.nav-btn {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 0.85rem 1.8rem;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  backdrop-filter: blur(14px);
  font-family: var(--font-sans);
}

.nav-btn:hover {
  color: white;
  border-color: var(--border-glow-cyan);
  box-shadow: var(--shadow-cyan);
  background: rgba(0, 240, 255, 0.05);
  transform: translateY(-1px);
}

.nav-btn.active {
  color: white;
  border-color: var(--neon-pink);
  box-shadow: var(--shadow-pink);
  background: rgba(255, 0, 127, 0.1);
}

.nav-btn-icon {
  font-size: 1.15rem;
}
</style>
