<script setup lang="ts">
import { ref } from 'vue'

export type ActiveViewId = 
  | 'arcade-snake' 
  | 'arcade-typing' 
  | 'arcade-minesweeper'
  | 'dev-passfort' 
  | 'dev-json' 
  | 'dev-cipher'
  | 'dev-time'
  | 'dev-colors'
  | 'dev-mcp-playground'
  | 'dev-dotfiles'
  | 'skills-catalog'
  | 'links-tools' 
  | 'cdn-endpoints'

defineProps<{
  activeView: ActiveViewId
  isCollapsed: boolean
  isMobileOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'update:activeView', id: ActiveViewId): void
  (e: 'update:isCollapsed', val: boolean): void
  (e: 'close-mobile'): void
}>()

interface NavCategory {
  id: string
  title: string
  icon: string
  isOpen: boolean
  items: Array<{
    id: ActiveViewId
    label: string
    icon: string
    badge?: string
  }>
}

const categories = ref<NavCategory[]>([
  {
    id: 'arcade',
    title: 'Arcade Games',
    icon: '🎮',
    isOpen: true,
    items: [
      { id: 'arcade-minesweeper', label: 'Minesweeper', icon: '💣', badge: 'TACTIC' },
      { id: 'arcade-typing', label: 'Typing Blitz', icon: '⌨️', badge: 'PRO' },
      { id: 'arcade-snake', label: 'Snake', icon: '🐍', badge: 'CANVAS' }
    ]
  },
  {
    id: 'devtools',
    title: 'Dev Utilities',
    icon: '🛠️',
    isOpen: true,
    items: [
      { id: 'dev-cipher', label: 'CipherLab', icon: '⚡', badge: 'CRYPTO' },
      { id: 'dev-time', label: 'Time Studio', icon: '⏱️', badge: 'EPOCH' },
      { id: 'dev-colors', label: 'Color & CSS Studio', icon: '🎨', badge: 'PALETTE' },
      { id: 'dev-passfort', label: 'PassFort Generator', icon: '🔐', badge: 'ENTROPY' },
      { id: 'dev-json', label: 'JSON Clean', icon: '💎', badge: 'FORMAT' },
      { id: 'skills-catalog', label: 'Skills', icon: '⚡', badge: 'CLI' }
    ]
  },
  {
    id: 'others',
    title: 'Others',
    icon: '📁',
    isOpen: true,
    items: [
      { id: 'dev-mcp-playground', label: 'MCP Playground', icon: '🌌', badge: '3D LAB' },
      { id: 'dev-dotfiles', label: 'Dotfiles', icon: '💻', badge: 'SETUP' }
    ]
  },
  {
    id: 'resources',
    title: 'Resources & CDN',
    icon: '🌐',
    isOpen: true,
    items: [
      { id: 'links-tools', label: 'Useful Pages', icon: '🔗' },
      { id: 'cdn-endpoints', label: 'CDN Endpoints', icon: '📡', badge: 'API' }
    ]
  }
])

const toggleCategory = (cat: NavCategory) => {
  cat.isOpen = !cat.isOpen
}

const selectItem = (id: ActiveViewId) => {
  emit('update:activeView', id)
  emit('close-mobile')
}
</script>

<template>
  <!-- Mobile Backdrop Overlay -->
  <div 
    v-if="isMobileOpen" 
    class="sidebar-backdrop" 
    @click="emit('close-mobile')"
  ></div>

  <aside 
    class="app-sidebar" 
    :class="{ 
      collapsed: isCollapsed,
      'mobile-open': isMobileOpen 
    }"
  >
    <!-- Sidebar Header / Brand -->
    <div class="sidebar-header">
      <div class="brand-box" @click="selectItem('arcade-snake')">
        <span class="brand-icon">⚡</span>
        <div v-show="!isCollapsed" class="brand-text">
          <h2 class="brand-title">TexTools</h2>
        </div>
      </div>

      <button 
        class="collapse-toggle-btn desktop-only" 
        :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="emit('update:isCollapsed', !isCollapsed)"
      >
        <span>{{ isCollapsed ? '▶' : '◀' }}</span>
      </button>

      <button 
        class="mobile-close-btn mobile-only" 
        aria-label="Close sidebar"
        @click="emit('close-mobile')"
      >
        ✕
      </button>
    </div>

    <!-- Navigation Accordion -->
    <nav class="sidebar-nav">
      <div 
        v-for="cat in categories" 
        :key="cat.id" 
        class="nav-category"
      >
        <!-- Category Header Accordion Button -->
        <button 
          v-if="!isCollapsed" 
          class="category-header-btn" 
          @click="toggleCategory(cat)"
        >
          <span class="category-header-left">
            <span class="category-icon">{{ cat.icon }}</span>
            <span class="category-title">{{ cat.title }}</span>
          </span>
          <span class="category-arrow" :class="{ open: cat.isOpen }">▼</span>
        </button>

        <!-- Category Items List -->
        <div v-show="cat.isOpen || isCollapsed" class="category-items">
          <button
            v-for="item in cat.items"
            :key="item.id"
            class="nav-item-btn"
            :class="{ active: activeView === item.id }"
            :title="item.label"
            @click="selectItem(item.id)"
          >
            <span class="item-icon">{{ item.icon }}</span>
            <span v-show="!isCollapsed" class="item-label">{{ item.label }}</span>
            <span 
              v-if="!isCollapsed && item.badge" 
              class="item-badge"
            >
              {{ item.badge }}
            </span>
          </button>
        </div>
      </div>
    </nav>

    <!-- Sidebar Bottom Footer Info -->
    <div class="sidebar-footer">
      <a 
        href="https://github.com/Textic/textic.github.io" 
        target="_blank" 
        rel="noopener noreferrer" 
        class="sidebar-footer-link"
        :title="isCollapsed ? 'GitHub Repo' : ''"
      >
        <span class="footer-icon">🐙</span>
        <span v-show="!isCollapsed" class="footer-text">GitHub Repo</span>
        <span v-show="!isCollapsed" class="footer-arrow">↗</span>
      </a>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  width: 270px;
  min-width: 270px;
  background: rgba(14, 8, 12, 0.98);
  border-right: 1px solid var(--border-color);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
  z-index: 100;
  flex-shrink: 0;
  transition: width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  overflow-y: auto;
  overflow-x: hidden;
}

.app-sidebar.collapsed {
  width: 78px;
  min-width: 78px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  min-height: 72px;
}

.brand-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
}

.brand-icon {
  font-size: 1.6rem;
  filter: drop-shadow(0 0 12px rgba(255, 30, 66, 0.6));
}

.brand-title {
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: var(--gradient-red);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.2;
}

.brand-subtitle {
  font-size: 0.68rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.collapse-toggle-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.65rem;
  transition: var(--transition);
}

.collapse-toggle-btn:hover {
  color: var(--neon-red);
  border-color: var(--neon-red);
  background: rgba(255, 30, 66, 0.12);
}

.sidebar-nav {
  flex-grow: 1;
  padding: 1.25rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.nav-category {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.category-header-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: none;
  border: none;
  padding: 0.4rem 0.6rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.category-header-btn:hover {
  color: var(--text-secondary);
}

.category-header-left {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.category-arrow {
  font-size: 0.6rem;
  transition: transform 0.25s ease;
}

.category-arrow.open {
  transform: rotate(0deg);
}

.category-arrow:not(.open) {
  transform: rotate(-90deg);
}

.category-items {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.nav-item-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  text-align: left;
  width: 100%;
}

.nav-item-btn:hover {
  background: rgba(255, 30, 66, 0.06);
  color: white;
  border-color: rgba(255, 30, 66, 0.25);
  transform: translateX(2px);
}

.nav-item-btn.active {
  background: rgba(255, 30, 66, 0.12);
  color: white;
  border-color: var(--neon-red);
  box-shadow: var(--shadow-red);
  font-weight: 600;
}

.item-icon {
  font-size: 1.15rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
}

.item-label {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-badge {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--neon-red);
  background: rgba(255, 30, 66, 0.12);
  border: 1px solid rgba(255, 30, 66, 0.3);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.sidebar-footer-link {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.8rem;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.sidebar-footer-link:hover {
  color: var(--neon-red);
  background: rgba(255, 255, 255, 0.03);
}

.footer-icon {
  font-size: 1.1rem;
}

.footer-arrow {
  margin-left: auto;
  font-size: 0.8rem;
}

.mobile-only {
  display: none;
}

.desktop-only {
  display: flex;
}

/* Mobile Responsiveness */
@media (max-width: 850px) {
  .desktop-only {
    display: none;
  }

  .mobile-only {
    display: flex;
  }

  .app-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    transform: translateX(-100%);
    width: 280px;
    z-index: 1000;
    transition: transform 0.3s ease;
  }

  .app-sidebar.mobile-open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 999;
  }

  .mobile-close-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
  }
}
</style>
