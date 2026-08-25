<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts } = useToast()
</script>

<template>
  <div class="toast-container" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast-item"
        :class="`toast-${toast.type || 'success'}`"
      >
        <span class="toast-icon">
          <template v-if="toast.type === 'error'">✕</template>
          <template v-else-if="toast.type === 'info'">ℹ</template>
          <template v-else>✓</template>
        </span>
        <span class="toast-text">{{ toast.text }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  z-index: 9999;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  background: rgba(13, 17, 39, 0.95);
  border: 1px solid var(--neon-cyan);
  color: white;
  padding: 0.85rem 1.4rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-cyan), 0 10px 30px rgba(0, 0, 0, 0.6);
  font-size: 0.9rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  backdrop-filter: blur(12px);
}

.toast-error {
  border-color: var(--neon-pink);
  box-shadow: var(--shadow-pink), 0 10px 30px rgba(0, 0, 0, 0.6);
}

.toast-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 240, 255, 0.15);
  color: var(--neon-cyan);
  font-size: 0.75rem;
  font-weight: 700;
}

.toast-error .toast-icon {
  background: rgba(255, 0, 127, 0.15);
  color: var(--neon-pink);
}

/* Animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.9);
}
</style>
