<script setup lang="ts">
import { ref } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import NavigationTabs, { type TabId } from '@/components/layout/NavigationTabs.vue'
import CdnDrawer from '@/components/layout/CdnDrawer.vue'
import ToastContainer from '@/components/layout/ToastContainer.vue'
import PassFort from '@/components/devtools/PassFort.vue'
import JsonClean from '@/components/devtools/JsonClean.vue'
import CyberSnake from '@/components/arcade/CyberSnake.vue'
import TypingBlitz from '@/components/arcade/TypingBlitz.vue'
import UsefulLinks from '@/components/links/UsefulLinks.vue'

type ArcadeGame = 'snake' | 'typing'

const currentTab = ref<TabId>('arcade')
const activeGame = ref<ArcadeGame>('snake')

const arcadeGames: Array<{ id: ArcadeGame; title: string; icon: string; desc: string }> = [
  {
    id: 'snake',
    title: 'Cyber Snake',
    icon: '🐍',
    desc: 'Come nodos de neón y crece sin colisionar.'
  },
  {
    id: 'typing',
    title: 'Typing Blitz',
    icon: '⌨️',
    desc: 'Desafío de velocidad y precisión de 60s.'
  }
]
</script>

<template>
  <div class="app-root">
    <!-- Ambient Glow Orbs -->
    <div class="orb orb-pink"></div>
    <div class="orb orb-cyan"></div>

    <div class="container">
      <!-- Header -->
      <AppHeader />

      <!-- Navigation Tabs -->
      <NavigationTabs v-model:currentTab="currentTab" />

      <!-- Main Panels Content with Transition -->
      <main class="main-content">
        <!-- TAB 1: ARCADE GAMES -->
        <section v-show="currentTab === 'arcade'" class="panel-section" aria-label="Arcade">
          <div class="arcade-layout">
            <!-- Sidebar Game Cabinets Selector -->
            <aside class="arcade-sidebar">
              <span class="sidebar-heading">GABINETES ARCADE</span>
              <button
                v-for="game in arcadeGames"
                :key="game.id"
                class="cabinet-btn"
                :class="{ active: activeGame === game.id }"
                @click="activeGame = game.id"
              >
                <div class="cabinet-icon">{{ game.icon }}</div>
                <div class="cabinet-text">
                  <h4 class="cabinet-title">{{ game.title }}</h4>
                  <p class="cabinet-desc">{{ game.desc }}</p>
                </div>
              </button>
            </aside>

            <!-- Arcade Screen Display Frame -->
            <div class="arcade-display-frame">
              <div class="frame-header">
                <div class="window-dots">
                  <span class="dot dot-red"></span>
                  <span class="dot dot-yellow"></span>
                  <span class="dot dot-green"></span>
                </div>
                <div class="frame-title">
                  {{ activeGame === 'snake' ? 'cyber-snake.bin ~ arcade' : 'typing-blitz.bin ~ terminal' }}
                </div>
                <span class="frame-status">ONLINE</span>
              </div>

              <div class="frame-content">
                <CyberSnake v-if="activeGame === 'snake'" />
                <TypingBlitz v-else-if="activeGame === 'typing'" />
              </div>
            </div>
          </div>
        </section>

        <!-- TAB 2: DEV UTILITIES -->
        <section v-show="currentTab === 'devtools'" class="panel-section" aria-label="DevTools">
          <div class="devtools-grid">
            <PassFort />
            <JsonClean />
          </div>
        </section>

        <!-- TAB 3: USEFUL LINKS -->
        <section v-show="currentTab === 'links'" class="panel-section" aria-label="Enlaces útiles">
          <UsefulLinks />
        </section>
      </main>

      <!-- Collapsible Static CDN References Drawer -->
      <CdnDrawer />

      <!-- Footer -->
      <footer class="app-footer">
        <div class="footer-brand">Textic Sandbox & Arcade</div>
        <p class="footer-copy">&copy; 2026 Textic. Todos los derechos reservados.</p>
        <p class="footer-tech">Construido con Vue 3, TypeScript y desplegado automáticamente vía GitHub Actions.</p>
        <div class="footer-links">
          <a href="https://github.com/Textic/textic.github.io" target="_blank" rel="noopener noreferrer">
            Código en GitHub ↗
          </a>
          <a href="/.well-known/assetlinks.json" target="_blank" rel="noopener noreferrer">
            Digital Asset Links ↗
          </a>
        </div>
      </footer>
    </div>

    <!-- Reactive Toast Notifications -->
    <ToastContainer />
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
  position: relative;
}

.main-content {
  animation: fadeIn 0.35s ease;
}

.panel-section {
  animation: fadeIn 0.35s ease;
}

/* Arcade Layout */
.arcade-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.75rem;
}

@media (min-width: 900px) {
  .arcade-layout {
    grid-template-columns: 320px 1fr;
  }
}

.arcade-sidebar {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  height: fit-content;
}

.sidebar-heading {
  font-family: var(--font-retro);
  font-size: 0.65rem;
  color: var(--text-muted);
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}

.cabinet-btn {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1rem;
  text-align: left;
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
  display: flex;
  align-items: center;
  gap: 0.9rem;
  font-family: var(--font-sans);
}

.cabinet-btn:hover {
  background: rgba(0, 240, 255, 0.04);
  border-color: var(--border-glow-cyan);
  color: white;
  transform: translateX(3px);
}

.cabinet-btn.active {
  background: rgba(0, 240, 255, 0.08);
  border-color: var(--neon-cyan);
  color: white;
  box-shadow: var(--shadow-cyan);
}

.cabinet-icon {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
  transition: var(--transition);
}

.cabinet-btn.active .cabinet-icon {
  background: var(--gradient-cyan);
  color: white;
  border-color: transparent;
}

.cabinet-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 0.2rem;
}

.cabinet-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.4;
}

/* Arcade Display Frame */
.arcade-display-frame {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(16px);
  overflow: hidden;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  min-height: 520px;
}

.frame-header {
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--border-color);
  padding: 0.85rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.window-dots {
  display: flex;
  gap: 0.4rem;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.dot-red { background: #ef4444; }
.dot-yellow { background: #f59e0b; }
.dot-green { background: #10b981; }

.frame-title {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.frame-status {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--neon-cyan);
  background: rgba(0, 240, 255, 0.08);
  border: 1px solid rgba(0, 240, 255, 0.3);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
}

.frame-content {
  flex-grow: 1;
  padding: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* DevTools Grid */
.devtools-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.75rem;
}

@media (min-width: 850px) {
  .devtools-grid {
    grid-template-columns: 1fr 1fr;
  }
}

/* Footer */
.app-footer {
  text-align: center;
  padding: 4.5rem 1.5rem 2rem;
  border-top: 1px solid var(--border-color);
  margin-top: 5rem;
}

.footer-brand {
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: 1.15rem;
  margin-bottom: 0.4rem;
  background: var(--gradient-pink);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.footer-copy {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.footer-tech {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.35rem;
}

.footer-links {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 1.25rem;
}

.footer-links a {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.8rem;
  transition: var(--transition);
}

.footer-links a:hover {
  color: var(--neon-cyan);
}
</style>
