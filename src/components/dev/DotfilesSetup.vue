<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'

const { copyToClipboard } = useToast()

// Windows Command
const windowsCommand = 'irm https://raw.githubusercontent.com/Textic/dotfiles-windows/main/bootstrap.ps1 | iex'
const copiedWindows = ref(false)

const copyWindows = () => {
  copyToClipboard(windowsCommand, 'Copied Windows bootstrap command!')
  copiedWindows.value = true
  setTimeout(() => {
    copiedWindows.value = false
  }, 2000)
}

// Linux Commands
const linuxCommands = {
  processSub: 'bash -c "$(curl -fsSL https://raw.githubusercontent.com/Textic/dotfiles/main/bootstrap.sh)"',
  pipe: 'curl -fsSL https://raw.githubusercontent.com/Textic/dotfiles/main/bootstrap.sh | bash'
}

const activeLinuxTab = ref<'processSub' | 'pipe'>('processSub')
const copiedLinux = ref(false)

const copyLinux = () => {
  const cmd = linuxCommands[activeLinuxTab.value]
  copyToClipboard(cmd, 'Copied Linux bootstrap command!')
  copiedLinux.value = true
  setTimeout(() => {
    copiedLinux.value = false
  }, 2000)
}
</script>

<template>
  <div class="dotfiles-container">
    <!-- Header Hero Banner -->
    <div class="dotfiles-hero-card">
      <div class="hero-top-row">
        <div class="hero-brand">
          <span class="hero-icon">💻</span>
          <div>
            <div class="title-with-badge">
              <h2 class="hero-title">Dotfiles & Workstation Setup</h2>
              <span class="badge-official">OFFICIAL SUITE</span>
            </div>
            <p class="hero-desc">
              Automated bootstrapping scripts for Windows and Linux development workstations. Configure high-performance environments, package managers, terminal profiles, developer fonts, and system configs with 1-click remote execution.
            </p>
          </div>
        </div>

        <div class="hero-stats">
          <div class="stat-badge">
            <span class="stat-num">2</span>
            <span class="stat-label">OS Supported</span>
          </div>
          <div class="stat-badge">
            <span class="stat-num">1-Click</span>
            <span class="stat-label">Automated</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 1. WINDOWS SECTION (TOP) -->
    <div class="os-card windows-card">
      <div class="os-header">
        <div class="os-title-group">
          <span class="os-icon">🪟</span>
          <div>
            <div class="os-title-row">
              <h3 class="os-title">Windows 10 / 11</h3>
              <span class="os-badge badge-win">POWERSHELL</span>
              <span class="os-badge badge-sub">WINGET</span>
            </div>
            <p class="os-desc">
              Automated Windows workstation bootstrapper. Applies system tweaks, debloat, developer fonts, terminal profiles, and installs developer software via Winget.
            </p>
          </div>
        </div>

        <div class="os-links">
          <a
            href="https://raw.githubusercontent.com/Textic/dotfiles-windows/main/bootstrap.ps1"
            target="_blank"
            rel="noopener noreferrer"
            class="link-pill"
          >
            <span>📜</span> bootstrap.ps1
          </a>
          <a
            href="https://github.com/Textic/dotfiles-windows"
            target="_blank"
            rel="noopener noreferrer"
            class="link-pill repo-pill"
          >
            <span>🐙</span> GitHub Repo ↗
          </a>
        </div>
      </div>

      <!-- Windows Terminal Box -->
      <div class="terminal-box" @click="copyWindows">
        <div class="terminal-top-bar">
          <div class="terminal-dots">
            <span class="dot dot-red"></span>
            <span class="dot dot-yellow"></span>
            <span class="dot dot-green"></span>
          </div>
          <span class="terminal-title">Windows PowerShell (Admin)</span>
        </div>

        <div class="terminal-content">
          <span class="prompt-prefix">PS &gt;</span>
          <code class="command-code">{{ windowsCommand }}</code>
        </div>

        <div class="terminal-action-row">
          <button
            class="btn-copy"
            :class="{ copied: copiedWindows }"
            title="Copy Windows command"
            @click.stop="copyWindows"
          >
            <span v-if="copiedWindows">✓ Copied!</span>
            <span v-else>📋 Copy Command</span>
          </button>
        </div>
      </div>

      <!-- Windows Details Footnote -->
      <div class="os-footer-info">
        <span class="tip-icon">💡</span>
        <span class="tip-text">
          <strong>How it works:</strong> Downloads <code>bootstrap.ps1</code>, checks Administrator privileges, extracts repository files to a temporary workspace, and executes the installer suite.
        </span>
      </div>
    </div>

    <!-- 2. LINUX SECTION (BOTTOM) -->
    <div class="os-card linux-card">
      <div class="os-header">
        <div class="os-title-group">
          <span class="os-icon">🐧</span>
          <div>
            <div class="os-title-row">
              <h3 class="os-title">Arch Linux</h3>
              <span class="os-badge badge-linux">BASH</span>
              <span class="os-badge badge-sub">PACMAN & AUR</span>
            </div>
            <p class="os-desc">
              Automated Arch Linux bootstrapper and dotfiles deployer. Clones repository, installs prerequisite packages (git, base-devel), sets permissions, and transfers execution to the modular installer.
            </p>
          </div>
        </div>

        <div class="os-links">
          <a
            href="https://raw.githubusercontent.com/Textic/dotfiles/main/bootstrap.sh"
            target="_blank"
            rel="noopener noreferrer"
            class="link-pill"
          >
            <span>📜</span> bootstrap.sh
          </a>
          <a
            href="https://github.com/Textic/dotfiles"
            target="_blank"
            rel="noopener noreferrer"
            class="link-pill repo-pill"
          >
            <span>🐙</span> GitHub Repo ↗
          </a>
        </div>
      </div>

      <!-- Linux Command Tabs (Process Substitution vs Pipe) -->
      <div class="tab-select-row">
        <span class="tab-label">Execution Method:</span>
        <div class="tab-buttons">
          <button
            class="tab-btn"
            :class="{ active: activeLinuxTab === 'processSub' }"
            @click="activeLinuxTab = 'processSub'"
          >
            Process Substitution (Recommended)
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeLinuxTab === 'pipe' }"
            @click="activeLinuxTab = 'pipe'"
          >
            Pipe (curl | bash)
          </button>
        </div>
      </div>

      <!-- Linux Terminal Box -->
      <div class="terminal-box" @click="copyLinux">
        <div class="terminal-top-bar">
          <div class="terminal-dots">
            <span class="dot dot-red"></span>
            <span class="dot dot-yellow"></span>
            <span class="dot dot-green"></span>
          </div>
          <span class="terminal-title">Terminal (Standard User with sudo)</span>
        </div>

        <div class="terminal-content">
          <span class="prompt-prefix">$</span>
          <code class="command-code">{{ linuxCommands[activeLinuxTab] }}</code>
        </div>

        <div class="terminal-action-row">
          <button
            class="btn-copy"
            :class="{ copied: copiedLinux }"
            title="Copy Linux command"
            @click.stop="copyLinux"
          >
            <span v-if="copiedLinux">✓ Copied!</span>
            <span v-else>📋 Copy Command</span>
          </button>
        </div>
      </div>

      <!-- Linux Details Footnote -->
      <div class="os-footer-info">
        <span class="tip-icon">💡</span>
        <span class="tip-text">
          <strong>How it works:</strong> Reconnects stdin to <code>/dev/tty</code> for interactive prompts, validates that you are running as a non-root user with sudo, installs <code>git</code> and <code>base-devel</code> if missing, clones to <code>~/dotfiles</code>, and runs <code>./install.sh</code>.
        </span>
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

/* Hero Header Card */
.dotfiles-hero-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
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
  gap: 1.25rem;
  flex: 1;
  min-width: 280px;
}

.hero-icon {
  font-size: 2.4rem;
  line-height: 1;
  color: var(--neon-red);
  filter: drop-shadow(0 0 14px rgba(255, 30, 66, 0.6));
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  margin-bottom: 0.35rem;
}

.hero-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: white;
}

.badge-official {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 700;
  background: rgba(255, 30, 66, 0.15);
  color: var(--neon-red);
  border: 1px solid var(--border-glow-red);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.hero-desc {
  font-size: 0.88rem;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 780px;
}

.hero-stats {
  display: flex;
  gap: 0.75rem;
}

.stat-badge {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.65rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 90px;
}

.stat-num {
  font-family: var(--font-mono);
  font-size: 1.25rem;
  font-weight: 800;
  color: white;
  line-height: 1.1;
}

.stat-label {
  font-size: 0.68rem;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.05em;
}

/* OS Cards (Windows & Linux) */
.os-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  transition: var(--transition);
}

.windows-card:hover {
  border-color: rgba(0, 164, 239, 0.4);
}

.linux-card:hover {
  border-color: var(--border-glow-red);
}

.os-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}

.os-title-group {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  flex: 1;
  min-width: 280px;
}

.os-icon {
  font-size: 2rem;
  line-height: 1;
}

.os-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.35rem;
}

.os-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: white;
}

.os-badge {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.badge-win {
  background: rgba(0, 164, 239, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(0, 164, 239, 0.3);
}

.badge-linux {
  background: rgba(255, 30, 66, 0.15);
  color: var(--neon-red);
  border: 1px solid var(--border-glow-red);
}

.badge-sub {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
}

.os-desc {
  font-size: 0.84rem;
  color: var(--text-secondary);
  line-height: 1.55;
  max-width: 680px;
}

.os-links {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.link-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.75rem;
  padding: 0.35rem 0.65rem;
  text-decoration: none;
  font-family: var(--font-mono);
  transition: var(--transition);
}

.link-pill:hover {
  background: rgba(255, 30, 66, 0.12);
  border-color: var(--neon-red);
  color: white;
}

.repo-pill {
  background: rgba(0, 0, 0, 0.4);
  font-weight: 600;
}

/* Linux Tabs */
.tab-select-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.tab-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
}

.tab-buttons {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.tab-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.72rem;
  padding: 0.25rem 0.65rem;
  cursor: pointer;
  transition: var(--transition);
}

.tab-btn:hover {
  color: white;
  border-color: rgba(255, 255, 255, 0.2);
}

.tab-btn.active {
  background: rgba(255, 30, 66, 0.15);
  border-color: var(--neon-red);
  color: white;
  font-weight: 700;
}

/* Terminal Box */
.terminal-box {
  background: #060205;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.15rem 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  cursor: pointer;
  transition: var(--transition);
}

.terminal-box:hover {
  border-color: var(--border-glow-red);
  box-shadow: 0 0 20px rgba(255, 30, 66, 0.15);
}

.terminal-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 0.5rem;
}

.terminal-dots {
  display: flex;
  gap: 0.35rem;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.dot-red { background: #ef4444; }
.dot-yellow { background: #f59e0b; }
.dot-green { background: #10b981; }

.terminal-title {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
}

.terminal-content {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 0.35rem 0;
}

.prompt-prefix {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--neon-red);
  user-select: none;
  white-space: nowrap;
}

.command-code {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  color: #f1f5f9;
  word-break: break-all;
  line-height: 1.5;
}

.terminal-action-row {
  display: flex;
  justify-content: flex-end;
}

.btn-copy {
  background: rgba(255, 30, 66, 0.12);
  border: 1px solid var(--border-glow-red);
  border-radius: var(--radius-sm);
  color: white;
  padding: 0.35rem 0.85rem;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition);
}

.btn-copy:hover {
  background: var(--neon-red);
  box-shadow: 0 0 10px rgba(255, 30, 66, 0.5);
}

.btn-copy.copied {
  background: #10b981;
  border-color: #10b981;
  color: white;
}

/* Details Footnotes */
.os-footer-info {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.5;
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.tip-icon {
  font-size: 0.95rem;
  line-height: 1.2;
}

.tip-text code {
  font-family: var(--font-mono);
  color: var(--neon-red);
  background: rgba(255, 30, 66, 0.08);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-size: 0.75rem;
}
</style>
