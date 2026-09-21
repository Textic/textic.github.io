<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'

const { copyToClipboard } = useToast()

const bootstrapCommand = 'irm https://raw.githubusercontent.com/Textic/dotfiles-windows/main/bootstrap.ps1 | iex'
const copied = ref(false)

const copyCommand = () => {
  copyToClipboard(bootstrapCommand, 'Copied Windows Dotfiles bootstrap command!')
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

interface SetupMode {
  id: string
  title: string
  badge: string
  badgeClass: string
  desc: string
  icon: string
}

const modes: SetupMode[] = [
  {
    id: 'semi',
    title: 'Semi-Unattended',
    badge: 'RECOMMENDED',
    badgeClass: 'badge-rec',
    desc: 'Auto-applies all system tweaks, debloat, fonts, and configs, but runs Winget package installations interactively.',
    icon: '🌟'
  },
  {
    id: 'full',
    title: 'Full Unattended',
    badge: 'SILENT / FAST',
    badgeClass: 'badge-silent',
    desc: '100% automated and silent. Installs all packages and applies tweaks without any user prompts or intervention.',
    icon: '⚡'
  },
  {
    id: 'attended',
    title: 'Attended Mode',
    badge: 'STEP-BY-STEP',
    badgeClass: 'badge-step',
    desc: 'Prompts for confirmation before executing each module, giving you complete manual control over the installation.',
    icon: '🔍'
  }
]
</script>

<template>
  <div class="dotfiles-container">
    <!-- Hero Header Card -->
    <div class="dotfiles-hero-card">
      <div class="hero-top-row">
        <div class="hero-brand">
          <span class="hero-icon">🪟</span>
          <div>
            <div class="title-with-badge">
              <h2 class="hero-title">Windows Dotfiles & Dev Setup</h2>
              <span class="badge-official">TEXTIC OFFICIAL</span>
            </div>
            <p class="hero-desc">
              Modular, automated Windows workstation bootstrapper. Configures high-performance developer environments with debloat, winget packages, terminal profiles, dev fonts, and system tweaks.
            </p>
          </div>
        </div>

        <div class="hero-stats">
          <div class="stat-badge">
            <span class="stat-num">3</span>
            <span class="stat-label">Modes</span>
          </div>
          <div class="stat-badge">
            <span class="stat-num">1-Click</span>
            <span class="stat-label">Installer</span>
          </div>
        </div>
      </div>

      <!-- Quick Command Terminal Box -->
      <div class="command-highlight-card">
        <div class="cmd-header">
          <div class="cmd-label-group">
            <span class="cmd-badge">⚡ REMOTE 1-CLICK BOOTSTRAPPER</span>
            <span class="cmd-hint">Run in Windows PowerShell (automatically prompts for Admin elevation if needed)</span>
          </div>
          <a
            href="https://github.com/Textic/dotfiles-windows"
            target="_blank"
            rel="noopener noreferrer"
            class="repo-link"
          >
            <span>🐙</span> GitHub Repo ↗
          </a>
        </div>

        <div class="terminal-box" @click="copyCommand">
          <div class="terminal-content">
            <span class="prompt-prefix">PS &gt;</span>
            <code class="command-code">{{ bootstrapCommand }}</code>
          </div>
          <button
            class="btn-copy"
            :class="{ copied }"
            title="Copy command"
            @click.stop="copyCommand"
          >
            <span v-if="copied">✓ Copied!</span>
            <span v-else>📋 Copy Command</span>
          </button>
        </div>

        <div class="cmd-footer">
          <span class="cmd-tip">
            💡 <strong>How it works:</strong> Downloads <code>bootstrap.ps1</code>, verifies Administrator rights, extracts the repository to temp, and executes <code>install.ps1</code>.
          </span>
        </div>
      </div>
    </div>

    <!-- Installation Modes Section -->
    <div class="modes-section">
      <div class="section-heading">
        <h3 class="section-title">Execution Modes</h3>
        <p class="section-subtitle">Choose how the installer executes when prompted in your PowerShell terminal</p>
      </div>

      <div class="modes-grid">
        <div
          v-for="mode in modes"
          :key="mode.id"
          class="mode-card"
        >
          <div class="mode-top">
            <span class="mode-icon">{{ mode.icon }}</span>
            <span class="mode-badge" :class="mode.badgeClass">{{ mode.badge }}</span>
          </div>
          <h4 class="mode-name">{{ mode.title }}</h4>
          <p class="mode-desc">{{ mode.desc }}</p>
        </div>
      </div>
    </div>

    <!-- Footer Action Card -->
    <div class="dotfiles-footer-card">
      <div class="footer-info">
        <span class="footer-icon">🛠️</span>
        <div>
          <h4 class="footer-title">Open Source & Modular</h4>
          <p class="footer-desc">Review and customize the dotfiles scripts, add your own Winget packages, or contribute improvements.</p>
        </div>
      </div>

      <div class="footer-actions">
        <a
          href="https://raw.githubusercontent.com/Textic/dotfiles-windows/main/bootstrap.ps1"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-secondary-action"
        >
          <span>📜</span> View bootstrap.ps1
        </a>
        <a
          href="https://github.com/Textic/dotfiles-windows"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-primary-action"
        >
          <span>🐙</span> Explore Repository
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dotfiles-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
  max-width: 1150px;
  margin: 0 auto;
}

/* Hero Card */
.dotfiles-hero-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

.hero-top-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1.25rem;
}

.hero-brand {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  flex: 1;
  min-width: 280px;
}

.hero-icon {
  font-size: 2.2rem;
  line-height: 1;
  filter: drop-shadow(0 0 14px rgba(255, 30, 66, 0.6));
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.hero-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: white;
  letter-spacing: -0.01em;
}

.badge-official {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 800;
  color: var(--neon-red);
  background: rgba(255, 30, 66, 0.12);
  border: 1px solid rgba(255, 30, 66, 0.35);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.hero-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.55;
  margin-top: 0.35rem;
  max-width: 750px;
}

.hero-stats {
  display: flex;
  gap: 0.75rem;
}

.stat-badge {
  background: rgba(255, 30, 66, 0.08);
  border: 1px solid rgba(255, 30, 66, 0.25);
  border-radius: var(--radius-md);
  padding: 0.6rem 1.15rem;
  text-align: center;
  min-width: 80px;
}

.stat-num {
  display: block;
  font-family: var(--font-mono);
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--neon-red);
}

.stat-label {
  font-size: 0.68rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Command Highlight Card */
.command-highlight-card {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 30, 66, 0.25);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.cmd-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.cmd-label-group {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.cmd-badge {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--neon-red);
  background: rgba(255, 30, 66, 0.15);
  border: 1px solid rgba(255, 30, 66, 0.35);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.cmd-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.repo-link {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  transition: var(--transition);
}

.repo-link:hover {
  color: white;
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.05);
}

.terminal-box {
  background: #030204;
  border: 1px solid rgba(255, 30, 66, 0.3);
  border-radius: var(--radius-sm);
  padding: 0.85rem 1.15rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  cursor: pointer;
  transition: var(--transition);
}

.terminal-box:hover {
  border-color: var(--neon-red);
  box-shadow: 0 0 16px rgba(255, 30, 66, 0.2);
}

.terminal-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  overflow-x: auto;
}

.prompt-prefix {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--neon-red);
  user-select: none;
}

.command-code {
  font-family: var(--font-mono);
  font-size: 0.88rem;
  color: #f3f4f6;
  white-space: nowrap;
}

.btn-copy {
  background: rgba(255, 30, 66, 0.18);
  border: 1px solid rgba(255, 30, 66, 0.4);
  color: white;
  padding: 0.45rem 0.9rem;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: var(--transition);
}

.btn-copy:hover {
  background: var(--neon-red);
  box-shadow: var(--shadow-red);
}

.btn-copy.copied {
  background: #10b981;
  border-color: #10b981;
  color: white;
}

.cmd-footer {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.cmd-tip code {
  font-family: var(--font-mono);
  color: #fb7185;
  background: rgba(255, 30, 66, 0.08);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
}

/* Sections */
.section-heading {
  margin-bottom: 1rem;
}

.section-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: white;
  letter-spacing: -0.01em;
}

.section-subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
}

/* Modes Grid */
.modes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
}

.mode-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: var(--transition);
}

.mode-card:hover {
  border-color: rgba(255, 30, 66, 0.4);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.mode-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mode-icon {
  font-size: 1.4rem;
}

.mode-badge {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.badge-rec {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.35);
}

.badge-silent {
  background: rgba(255, 30, 66, 0.15);
  color: var(--neon-red);
  border: 1px solid rgba(255, 30, 66, 0.35);
}

.badge-step {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.35);
}

.mode-name {
  font-size: 1rem;
  font-weight: 700;
  color: white;
}

.mode-desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Footer Card */
.dotfiles-footer-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.25rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.footer-info {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.footer-icon {
  font-size: 1.6rem;
}

.footer-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: white;
}

.footer-desc {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.btn-secondary-action {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  transition: var(--transition);
}

.btn-secondary-action:hover {
  color: white;
  border-color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
}

.btn-primary-action {
  background: rgba(255, 30, 66, 0.15);
  border: 1px solid rgba(255, 30, 66, 0.4);
  color: white;
  padding: 0.45rem 0.95rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  transition: var(--transition);
}

.btn-primary-action:hover {
  background: var(--neon-red);
  box-shadow: var(--shadow-red);
}
</style>
