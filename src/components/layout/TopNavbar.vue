<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { ActiveViewId } from './AppSidebar.vue'

defineProps<{
  activeView: ActiveViewId
}>()

const emit = defineEmits<{
  (e: 'toggle-mobile-sidebar'): void
  (e: 'open-cdn'): void
}>()

// PWA Install Prompt Handler
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const installPrompt = ref<BeforeInstallPromptEvent | null>(null)

const handleBeforeInstallPrompt = (e: Event) => {
  e.preventDefault()
  installPrompt.value = e as BeforeInstallPromptEvent
}

const installApp = async () => {
  if (!installPrompt.value) return
  await installPrompt.value.prompt()
  const choice = await installPrompt.value.userChoice
  if (choice.outcome === 'accepted') {
    installPrompt.value = null
  }
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
})

const getViewMetadata = (id: ActiveViewId) => {
  switch (id) {
    case 'arcade-snake':
      return { category: 'Arcade Games', title: 'Cyber Snake', icon: '🐍', tag: 'CANVAS MACHINE' }
    case 'arcade-typing':
      return { category: 'Arcade Games', title: 'Typing Blitz', icon: '⌨️', tag: 'SPEED CHALLENGE' }
    case 'arcade-minesweeper':
      return { category: 'Arcade Games', title: 'Cyber Minesweeper', icon: '💣', tag: 'TACTICAL MATRIX' }
    case 'dev-passfort':
      return { category: 'Dev Utilities', title: 'PassFort Generator', icon: '🔐', tag: 'ENTROPY SECURITY' }
    case 'dev-json':
      return { category: 'Dev Utilities', title: 'JSON Clean Formatter', icon: '💎', tag: 'VALIDATOR & MINIFIER' }
    case 'dev-cipher':
      return { category: 'Dev Utilities', title: 'CipherLab (Encoder & Decoder)', icon: '⚡', tag: 'MULTI-CIPHER' }
    case 'dev-time':
      return { category: 'Dev Utilities', title: 'Unix Timestamp & Time Studio', icon: '⏱️', tag: 'EPOCH CLOCK' }
    case 'dev-colors':
      return { category: 'Dev Utilities', title: 'Color & CSS Studio', icon: '🎨', tag: 'COLOR MATRIX' }
    case 'dev-dotfiles':
      return { category: 'Dev Utilities', title: 'Dotfiles & OS Setup', icon: '💻', tag: 'BOOTSTRAPPER' }
    case 'skills-catalog':
      return { category: 'Dev Utilities', title: 'Agent Skills Hub', icon: '⚡', tag: 'AI CLI SKILLS' }
    case 'links-tools':
      return { category: 'Resources', title: 'Useful Developer Tools', icon: '🔗', tag: 'DIRECTORY' }
    case 'cdn-endpoints':
      return { category: 'Resources', title: 'CDN & Static Asset Endpoints', icon: '📡', tag: 'PUBLIC REPO API' }
  }
}
</script>

<template>
  <header class="top-navbar">
    <div class="navbar-left">
      <!-- Mobile hamburger trigger -->
      <button 
        class="mobile-menu-btn mobile-only" 
        title="Open navigation menu"
        @click="emit('toggle-mobile-sidebar')"
      >
        <span>☰</span>
      </button>

      <!-- Active Tool Breadcrumb -->
      <div class="breadcrumb-box">
        <span class="breadcrumb-cat">{{ getViewMetadata(activeView).category }}</span>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-item">
          <span class="item-icon">{{ getViewMetadata(activeView).icon }}</span>
          <span class="item-title">{{ getViewMetadata(activeView).title }}</span>
        </span>
      </div>
    </div>

    <div class="navbar-right">
      <span class="active-badge">{{ getViewMetadata(activeView).tag }}</span>

      <!-- PWA Native Install Button -->
      <button 
        v-if="installPrompt"
        class="btn btn-primary btn-install-app"
        title="Install TexTools as a native app"
        @click="installApp"
      >
        <span>📲</span>
        <span class="desktop-label">Install App</span>
      </button>
      
      <button 
        v-if="activeView !== 'cdn-endpoints'"
        class="btn btn-secondary btn-cdn-quick"
        title="View static file CDN endpoints"
        @click="emit('open-cdn')"
      >
        <span>📡</span>
        <span class="desktop-label">CDN Files</span>
      </button>

      <a 
        href="https://github.com/Textic/textic.github.io" 
        target="_blank" 
        rel="noopener noreferrer" 
        class="btn-icon github-btn"
        title="View source code on GitHub"
      >
        🐙
      </a>
    </div>
  </header>
</template>

<style scoped>
.top-navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: rgba(10, 6, 9, 0.96);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 50;
  min-height: 72px;
  transform: translateZ(0);
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.mobile-menu-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: white;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  cursor: pointer;
  transition: var(--transition);
}

.mobile-menu-btn:hover {
  background: rgba(255, 30, 66, 0.12);
  border-color: var(--neon-red);
}

.breadcrumb-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
}

.breadcrumb-cat {
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 500;
}

.breadcrumb-separator {
  color: rgba(255, 255, 255, 0.15);
  font-size: 0.8rem;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: white;
  font-weight: 700;
}

.item-icon {
  font-size: 1.1rem;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.active-badge {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--neon-red);
  background: rgba(255, 30, 66, 0.08);
  border: 1px solid rgba(255, 30, 66, 0.3);
  padding: 0.25rem 0.65rem;
  border-radius: 4px;
  letter-spacing: 0.06em;
}

.btn-cdn-quick {
  padding: 0.45rem 0.9rem;
  font-size: 0.8rem;
  gap: 0.4rem;
}

.btn-install-app {
  padding: 0.45rem 0.9rem;
  font-size: 0.8rem;
  gap: 0.4rem;
  animation: install-pulse 2.5s infinite;
}

@keyframes install-pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(255, 30, 66, 0.4); }
  50% { box-shadow: 0 0 20px rgba(255, 30, 66, 0.8); }
}

.github-btn {
  font-size: 1.1rem;
  text-decoration: none;
}

.mobile-only {
  display: none;
}

@media (max-width: 850px) {
  .mobile-only {
    display: flex;
  }
  
  .desktop-label {
    display: none;
  }

  .active-badge {
    display: none;
  }

  .top-navbar {
    padding: 0.85rem 1rem;
  }
}
</style>
