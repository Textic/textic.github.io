<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import AppSidebar, { type ActiveViewId } from '@/components/layout/AppSidebar.vue'
import TopNavbar from '@/components/layout/TopNavbar.vue'
import ToastContainer from '@/components/layout/ToastContainer.vue'
import PassFort from '@/components/devtools/PassFort.vue'
import JsonClean from '@/components/devtools/JsonClean.vue'
import CipherLab from '@/components/devtools/CipherLab.vue'
import CyberSnake from '@/components/arcade/CyberSnake.vue'
import TypingBlitz from '@/components/arcade/TypingBlitz.vue'
import CyberMinesweeper from '@/components/arcade/CyberMinesweeper.vue'
import UsefulLinks from '@/components/links/UsefulLinks.vue'
import CdnDrawer from '@/components/layout/CdnDrawer.vue'
import SkillsHub from '@/components/skills/SkillsHub.vue'
import DotfilesSetup from '@/components/dev/DotfilesSetup.vue'
import TimeStudio from '@/components/devtools/TimeStudio.vue'
import ColorStudio from '@/components/devtools/ColorStudio.vue'

const McpPlayground = defineAsyncComponent(() => import('@/components/playground/McpPlayground.vue'))

const VALID_VIEWS: ActiveViewId[] = [
  'arcade-typing',
  'arcade-snake',
  'arcade-minesweeper',
  'dev-cipher',
  'dev-time',
  'dev-colors',
  'dev-passfort',
  'dev-json',
  'dev-mcp-playground',
  'dev-dotfiles',
  'skills-catalog',
  'links-tools',
  'cdn-endpoints'
]

const STORAGE_KEY = 'textools_active_view'

// Initialize activeView from URL hash or localStorage
const getInitialView = (): ActiveViewId => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace(/^#\/?/, '') as ActiveViewId
    if (VALID_VIEWS.includes(hash)) {
      return hash
    }

    const saved = (localStorage.getItem(STORAGE_KEY) || localStorage.getItem('textic_active_view')) as ActiveViewId | null
    if (saved && VALID_VIEWS.includes(saved)) {
      return saved
    }
  }

  return 'arcade-typing'
}

const activeView = ref<ActiveViewId>(getInitialView())
const isCollapsed = ref(false)
const isMobileOpen = ref(false)

// Persist view changes to localStorage and synchronize with URL hash
watch(activeView, (newView) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, newView)
    if (window.location.hash.replace(/^#\/?/, '') !== newView) {
      window.location.hash = `#${newView}`
    }
  }
}, { immediate: true })

// Handle browser navigation (back / forward buttons)
const onHashChange = () => {
  const hash = window.location.hash.replace(/^#\/?/, '') as ActiveViewId
  if (VALID_VIEWS.includes(hash) && activeView.value !== hash) {
    activeView.value = hash
  }
}

onMounted(() => {
  window.addEventListener('hashchange', onHashChange)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange)
})
</script>

<template>
  <div class="dashboard-layout">
    <!-- Ambient Glow Orbs -->
    <div class="orb orb-pink"></div>
    <div class="orb orb-cyan"></div>

    <!-- Collapsible Sidebar Menu -->
    <AppSidebar
      v-model:activeView="activeView"
      v-model:isCollapsed="isCollapsed"
      :isMobileOpen="isMobileOpen"
      @close-mobile="isMobileOpen = false"
    />

    <!-- Main Full-Width Workspace -->
    <div class="workspace-container">
      <!-- Top Navigation Bar -->
      <TopNavbar
        :activeView="activeView"
        @toggle-mobile-sidebar="isMobileOpen = !isMobileOpen"
        @open-cdn="activeView = 'cdn-endpoints'"
      />

      <!-- Tool Workspace Area (Full Width) -->
      <main class="workspace-body">
        <Transition name="fade" mode="out-in">
          <!-- 1. Snake Arcade -->
          <div v-if="activeView === 'arcade-snake'" key="snake" class="view-wrapper arcade-view">
            <div class="arcade-card-frame">
              <CyberSnake />
            </div>
          </div>

          <!-- 2. Typing Blitz Arcade -->
          <div v-else-if="activeView === 'arcade-typing'" key="typing" class="view-wrapper arcade-view">
            <div class="arcade-card-frame">
              <TypingBlitz />
            </div>
          </div>

          <!-- 3. Minesweeper Arcade -->
          <div v-else-if="activeView === 'arcade-minesweeper'" key="minesweeper" class="view-wrapper arcade-view">
            <div class="arcade-card-frame">
              <CyberMinesweeper />
            </div>
          </div>

          <!-- 4. CipherLab Multi-Format Encoder / Decoder -->
          <div v-else-if="activeView === 'dev-cipher'" key="cipher" class="view-wrapper">
            <CipherLab />
          </div>

          <!-- 5. Unix Timestamp & Time Studio -->
          <div v-else-if="activeView === 'dev-time'" key="time" class="view-wrapper">
            <TimeStudio />
          </div>

          <!-- 6. Color & CSS Studio -->
          <div v-else-if="activeView === 'dev-colors'" key="colors" class="view-wrapper">
            <ColorStudio />
          </div>

          <!-- 4. PassFort Password Generator -->
          <div v-else-if="activeView === 'dev-passfort'" key="passfort" class="view-wrapper">
            <div class="tool-max-width">
              <PassFort />
            </div>
          </div>

          <!-- 5. JSON Clean Formatter -->
          <div v-else-if="activeView === 'dev-json'" key="json" class="view-wrapper">
            <div class="tool-max-width">
              <JsonClean />
            </div>
          </div>

          <!-- 5. Useful Links & Tools Directory -->
          <div v-else-if="activeView === 'links-tools'" key="links" class="view-wrapper">
            <UsefulLinks />
          </div>

          <!-- 6. Static CDN Endpoints Reference -->
          <div v-else-if="activeView === 'cdn-endpoints'" key="cdn" class="view-wrapper">
            <CdnDrawer :alwaysOpen="true" />
          </div>

          <!-- 7. Agent Skills Catalog -->
          <div v-else-if="activeView === 'skills-catalog'" key="skills" class="view-wrapper">
            <SkillsHub />
          </div>

          <!-- 8. Dotfiles & Dev Setup (Windows & Linux) -->
          <div v-else-if="activeView === 'dev-dotfiles'" key="dotfiles" class="view-wrapper">
            <DotfilesSetup />
          </div>

          <!-- 9. MCP Playground (WebMCP 3D Studio) -->
          <div v-else-if="activeView === 'dev-mcp-playground'" key="mcp-playground" class="view-wrapper">
            <McpPlayground />
          </div>
        </Transition>
      </main>

      <!-- App Footer -->
      <footer class="workspace-footer">
        <div class="footer-left">
          <span class="footer-brand">TexTools</span>
          <span class="footer-dot">•</span>
          <span class="footer-copy">&copy; 2026 TexTools</span>
        </div>
        <div class="footer-right">
          <a href="https://github.com/Textic/textic.github.io" target="_blank" rel="noopener noreferrer">
            GitHub ↗
          </a>
          <a href="/.well-known/assetlinks.json" target="_blank" rel="noopener noreferrer">
            Asset Links ↗
          </a>
        </div>
      </footer>
    </div>

    <!-- Reactive Toast Feedback -->
    <ToastContainer />
  </div>
</template>

<style scoped>
.dashboard-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  position: relative;
  background-color: var(--bg-main);
  overflow: hidden;
}

.workspace-container {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-width: 0; /* Prevents overflow issues in flexbox */
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  will-change: scroll-position;
  transform: translateZ(0);
  -webkit-overflow-scrolling: touch;
}

.workspace-body {
  flex-grow: 1;
  padding: 2.25rem 2.5rem;
  max-width: 1500px;
  width: 100%;
  margin: 0 auto;
}

.view-wrapper {
  animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  width: 100%;
}

.tool-max-width {
  max-width: 900px;
  margin: 0 auto;
}

.arcade-view {
  display: flex;
  justify-content: center;
  align-items: center;
}

.arcade-card-frame {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 2.5rem 2rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 720px;
}

.workspace-footer {
  margin-top: auto;
  padding: 1.5rem 2.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--text-muted);
  background: rgba(14, 8, 12, 0.85);
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.footer-brand {
  font-weight: 700;
  color: var(--text-secondary);
}

.footer-dot {
  color: rgba(255, 255, 255, 0.2);
}

.footer-right {
  display: flex;
  gap: 1.25rem;
}

.footer-right a {
  color: var(--text-secondary);
  text-decoration: none;
  transition: var(--transition);
}

.footer-right a:hover {
  color: var(--neon-red);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 850px) {
  .workspace-body {
    padding: 1.5rem 1rem;
  }

  .arcade-card-frame {
    padding: 1.5rem 1rem;
  }

  .workspace-footer {
    padding: 1.25rem 1rem;
    flex-direction: column;
    gap: 0.75rem;
    text-align: center;
  }
}
</style>
