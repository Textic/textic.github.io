<script setup lang="ts">
import { ref } from 'vue'
import AppSidebar, { type ActiveViewId } from '@/components/layout/AppSidebar.vue'
import TopNavbar from '@/components/layout/TopNavbar.vue'
import ToastContainer from '@/components/layout/ToastContainer.vue'
import PassFort from '@/components/devtools/PassFort.vue'
import JsonClean from '@/components/devtools/JsonClean.vue'
import CyberSnake from '@/components/arcade/CyberSnake.vue'
import TypingBlitz from '@/components/arcade/TypingBlitz.vue'
import UsefulLinks from '@/components/links/UsefulLinks.vue'
import CdnDrawer from '@/components/layout/CdnDrawer.vue'

const activeView = ref<ActiveViewId>('arcade-snake')
const isCollapsed = ref(false)
const isMobileOpen = ref(false)
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
          <!-- 1. Cyber Snake Arcade -->
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

          <!-- 3. PassFort Password Generator -->
          <div v-else-if="activeView === 'dev-passfort'" key="passfort" class="view-wrapper">
            <div class="tool-max-width">
              <PassFort />
            </div>
          </div>

          <!-- 4. JSON Clean Formatter -->
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
        </Transition>
      </main>

      <!-- App Footer -->
      <footer class="workspace-footer">
        <div class="footer-left">
          <span class="footer-brand">Textic Arcade & Sandbox</span>
          <span class="footer-dot">•</span>
          <span class="footer-copy">&copy; 2026 Textic</span>
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
  min-height: 100vh;
  width: 100%;
  position: relative;
  background-color: var(--bg-main);
  overflow-x: hidden;
}

.workspace-container {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-width: 0; /* Prevents overflow issues in flexbox */
  min-height: 100vh;
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
  backdrop-filter: blur(16px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 720px;
}

.workspace-footer {
  padding: 1.5rem 2.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--text-muted);
  background: rgba(10, 14, 34, 0.4);
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
  color: var(--neon-cyan);
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
