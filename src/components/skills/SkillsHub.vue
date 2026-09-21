<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from '@/composables/useToast'

const { copyToClipboard } = useToast()

export interface SkillItem {
  id: string
  name: string
  source: string
  command: string
  category: string
  description: string
  tags: string[]
  global: boolean
  githubUrl?: string
  diagramTypes?: string[]
}

const skills = ref<SkillItem[]>([
  {
    id: 'archify',
    name: 'Archify',
    source: 'tt-a1i/archify',
    command: 'npx skills add tt-a1i/archify -g',
    category: 'Architecture & Diagrams',
    description: 'Generates interactive, verifiable technical diagrams (architecture, workflows, sequences, data-flow, lifecycles) from codebases or system descriptions. Integrates with Cursor, Claude Code, Codex CLI, and agentic workflows.',
    tags: ['Architecture', 'Diagrams', 'Visualization', 'System Design', 'Agent Skills'],
    global: true,
    githubUrl: 'https://github.com/tt-a1i/archify',
    diagramTypes: ['Architecture', 'Workflows', 'Sequences', 'Data-Flow', 'Lifecycles']
  },
  {
    id: 'textic-skills',
    name: 'Textic Skills',
    source: 'Textic/skills',
    command: 'npx skills add Textic/skills -g',
    category: 'Utilities & Tooling',
    description: 'Official Textic AI agent skills pack providing curated workflows, automation utilities, and developer productivity tools.',
    tags: ['Textic', 'Developer Tools', 'Workflows', 'Agent Skills', 'Automation'],
    global: true,
    githubUrl: 'https://github.com/Textic/skills'
  }
])

const searchQuery = ref('')
const selectedCategory = ref('All')
const copiedCommandId = ref<string | null>(null)

export type AgentId = 'auto' | 'claude-code' | 'cursor' | 'antigravity' | 'vscode' | 'all'

export interface AgentOption {
  id: AgentId
  label: string
  icon: string
  tip: string
}

// CLI Presets Configuration
const autoYes = ref(true) // Skip interactive confirmation prompts (-y)
const targetAgent = ref<AgentId>('auto')

const agentOptions: AgentOption[] = [
  { id: 'auto', label: 'Auto-Detect', icon: '🔍', tip: 'CLI auto-detects current active agent (no -a flag)' },
  { id: 'claude-code', label: 'Claude Code', icon: '🤖', tip: 'Targets Claude Code CLI (-a claude-code)' },
  { id: 'cursor', label: 'Cursor', icon: '💻', tip: 'Targets Cursor AI Editor (-a cursor)' },
  { id: 'antigravity', label: 'Antigravity', icon: '⚡', tip: 'Targets Google Antigravity (-a antigravity)' },
  { id: 'vscode', label: 'Codespaces', icon: '☁️', tip: 'Targets VS Code & Codespaces (-a vscode)' },
  { id: 'all', label: 'All Agents', icon: '🌐', tip: "Installs to all agents (-a '*')" }
]

const generateCommand = (source: string): string => {
  // Global (-g) is permanently active as requested
  let cmd = `npx skills add ${source} -g`
  if (autoYes.value) {
    cmd += ' -y'
  }
  if (targetAgent.value !== 'auto') {
    if (targetAgent.value === 'all') {
      cmd += " -a '*'"
    } else {
      cmd += ` -a ${targetAgent.value}`
    }
  }
  return cmd
}

// Antigravity Bridge Fix State & Logic
const selectedFixOs = ref<'windows' | 'unix'>('windows')
const copiedFix = ref(false)

const currentFixCommand = computed(() => {
  if (selectedFixOs.value === 'windows') {
    return 'New-Item -ItemType Junction -Force -Path "$HOME\\.gemini\\config\\skills" -Target "$HOME\\.agents\\skills"; \'{"entries":[{"path":"~/.agents/skills"}]}\' | Set-Content "$HOME\\.gemini\\config\\skills.json"'
  }
  return 'mkdir -p ~/.gemini/config ~/.agents/skills && ln -sfn ~/.agents/skills ~/.gemini/config/skills && echo \'{"entries":[{"path":"~/.agents/skills"}]}\' > ~/.gemini/config/skills.json'
})

const copyFixCommand = () => {
  const osLabel = selectedFixOs.value === 'windows' ? 'Windows PowerShell' : 'macOS / Linux Bash'
  copyToClipboard(currentFixCommand.value, `Copied Antigravity bridge fix for ${osLabel}!`)
  copiedFix.value = true
  setTimeout(() => {
    copiedFix.value = false
  }, 2000)
}

const categories = computed(() => {
  const cats = new Set<string>()
  skills.value.forEach(s => cats.add(s.category))
  return ['All', ...Array.from(cats)]
})

const filteredSkills = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return skills.value.filter(item => {
    const matchesCategory = selectedCategory.value === 'All' || item.category === selectedCategory.value
    if (!matchesCategory) return false

    if (!q) return true
    const genCmd = generateCommand(item.source).toLowerCase()
    return (
      item.name.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q) ||
      item.command.toLowerCase().includes(q) ||
      genCmd.includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q))
    )
  })
})

const copySkillCommand = (skill: SkillItem) => {
  const cmd = generateCommand(skill.source)
  copyToClipboard(cmd, `Copied command: ${cmd}`)
  copiedCommandId.value = skill.id
  setTimeout(() => {
    if (copiedCommandId.value === skill.id) {
      copiedCommandId.value = null
    }
  }, 2000)
}
</script>

<template>
  <div class="skills-container">
    <!-- Header Hero Card -->
    <div class="skills-hero-card">
      <div class="hero-top-row">
        <div class="hero-brand">
          <span class="hero-icon">⚡</span>
          <div>
            <h2 class="hero-title">Agent Skills Hub</h2>
            <p class="hero-desc">Curated repository of CLI agent skills for coding environments, automation, and architecture.</p>
          </div>
        </div>

        <div class="skills-stats-badge">
          <span class="stat-num">{{ skills.length }}</span>
          <span class="stat-label">Available Skills</span>
        </div>
      </div>

      <!-- Search & Filters Toolbar -->
      <div class="hero-filters-row">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search skills by name, command, tag..."
            spellcheck="false"
          />
          <button v-if="searchQuery" class="search-clear-btn" @click="searchQuery = ''">✕</button>
        </div>

        <!-- Category Pills -->
        <div class="category-pills">
          <button
            v-for="cat in categories"
            :key="cat"
            class="cat-pill-btn"
            :class="{ active: selectedCategory === cat }"
            @click="selectedCategory = cat"
          >
            {{ cat }}
          </button>
        </div>
      </div>

      <!-- CLI Configuration Toolbar -->
      <div class="cli-config-card">
        <div class="cli-config-header">
          <div class="cli-config-title">
            <span class="cfg-badge">CLI PRESETS</span>
            <span class="cfg-hint">Configure flags applied automatically across all skill commands</span>
          </div>

          <!-- Active Flags Summary Pill -->
          <div class="cli-active-preview">
            <span class="preview-label">Active Flags:</span>
            <span class="flag-tag flag-global" title="Global mode is permanently enabled">-g GLOBAL</span>
            <span v-if="autoYes" class="flag-tag flag-yes" title="Auto-confirm enabled: skips interactive prompts">-y AUTO-YES</span>
            <span v-if="targetAgent !== 'auto'" class="flag-tag flag-agent" :title="'Target agent: ' + targetAgent">
              -a {{ targetAgent === 'all' ? "'*'" : targetAgent }}
            </span>
            <span v-else class="flag-tag flag-detect" title="Agent auto-detection active">AUTO-DETECT</span>
          </div>
        </div>

        <div class="cli-controls-grid">
          <!-- Flag Toggles -->
          <div class="control-section toggles-section">
            <span class="section-label">Options:</span>

            <!-- Global Scope (Permanently Active) -->
            <div class="toggle-pill locked-pill" title="Global mode is permanently active to install in ~/.agents/skills/ for all projects">
              <span class="toggle-icon">🌐</span>
              <span class="toggle-name">Global (-g)</span>
              <span class="lock-indicator">ACTIVE</span>
            </div>

            <!-- Auto-Accept (-y) Toggle -->
            <button
              class="toggle-item-btn"
              :class="{ active: autoYes }"
              title="Skip interactive prompts and menus automatically"
              @click="autoYes = !autoYes"
            >
              <div class="toggle-pill">
                <span class="toggle-icon">⚡</span>
                <span class="toggle-name">Auto-Accept (-y)</span>
                <span class="toggle-status">{{ autoYes ? 'ON' : 'OFF' }}</span>
              </div>
            </button>
          </div>

          <!-- Target Agent Selector -->
          <div class="control-section agents-section">
            <span class="section-label">Target Agent:</span>
            <div class="agent-pills-row">
              <button
                v-for="agent in agentOptions"
                :key="agent.id"
                class="agent-pill-btn"
                :class="{ active: targetAgent === agent.id }"
                :title="agent.tip"
                @click="targetAgent = agent.id"
              >
                <span class="agent-icon">{{ agent.icon }}</span>
                <span class="agent-name">{{ agent.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Antigravity Global Bridge Banner (Appears when Antigravity is selected) -->
      <div v-if="targetAgent === 'antigravity'" class="antigravity-fix-banner">
        <div class="fix-header">
          <div class="fix-title-group">
            <span class="fix-badge">⚡ ANTIGRAVITY GLOBAL BRIDGE</span>
            <h4 class="fix-title">Vincular Skills Globales con Google Antigravity</h4>
          </div>
          <div class="os-tabs">
            <button
              class="os-tab-btn"
              :class="{ active: selectedFixOs === 'windows' }"
              @click="selectedFixOs = 'windows'"
            >
              🪟 Windows (PowerShell)
            </button>
            <button
              class="os-tab-btn"
              :class="{ active: selectedFixOs === 'unix' }"
              @click="selectedFixOs = 'unix'"
            >
              🍎 macOS / 🐧 Linux (Bash)
            </button>
          </div>
        </div>

        <p class="fix-desc">
          La CLI oficial de Vercel Skills guarda las skills globales en <code>~/.agents/skills</code>. Ejecuta este comando de 1 línea una sola vez en tu terminal para sincronizarlas permanentemente con Google Antigravity (<code>.gemini/config/skills</code>):
        </p>

        <div class="fix-command-box" @click="copyFixCommand">
          <div class="terminal-prompt">
            <span class="prompt-symbol">$</span>
            <code class="command-code">{{ currentFixCommand }}</code>
          </div>
          <button
            class="btn-copy-cmd"
            :class="{ copied: copiedFix }"
            title="Copiar comando de vinculación"
            @click.stop="copyFixCommand"
          >
            <span v-if="copiedFix">✓ Copiado</span>
            <span v-else>📋 Copiar Fix</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Skills Grid -->
    <div v-if="filteredSkills.length > 0" class="skills-grid">
      <div
        v-for="skill in filteredSkills"
        :key="skill.id"
        class="skill-card"
      >
        <!-- Card Top Bar -->
        <div class="card-top-bar">
          <div class="skill-identity">
            <div class="skill-avatar">🧩</div>
            <div>
              <div class="skill-name-row">
                <h3 class="skill-name">{{ skill.name }}</h3>
                <span v-if="skill.global" class="badge-global" title="Global installation supported">-g GLOBAL</span>
              </div>
              <span class="skill-source">{{ skill.source }}</span>
            </div>
          </div>

          <span class="category-tag">{{ skill.category }}</span>
        </div>

        <!-- Card Description -->
        <p class="skill-description">{{ skill.description }}</p>

        <!-- Diagram Types Badges (If any) -->
        <div v-if="skill.diagramTypes" class="diagram-types-box">
          <span class="dt-label">Supported:</span>
          <div class="dt-chips">
            <span v-for="dt in skill.diagramTypes" :key="dt" class="dt-chip">{{ dt }}</span>
          </div>
        </div>

        <!-- Terminal Command Box -->
        <div class="command-box" @click="copySkillCommand(skill)">
          <div class="terminal-prompt">
            <span class="prompt-symbol">$</span>
            <code class="command-code">{{ generateCommand(skill.source) }}</code>
          </div>
          <button
            class="btn-copy-cmd"
            :class="{ copied: copiedCommandId === skill.id }"
            title="Copy install command"
            @click.stop="copySkillCommand(skill)"
          >
            <span v-if="copiedCommandId === skill.id">✓ Copied</span>
            <span v-else>📋 Copy</span>
          </button>
        </div>

        <!-- Card Tags & External Links -->
        <div class="card-footer">
          <div class="tag-list">
            <span v-for="tag in skill.tags" :key="tag" class="skill-tag">#{{ tag }}</span>
          </div>

          <div class="card-actions">
            <a
              v-if="skill.githubUrl"
              :href="skill.githubUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-action-link"
              title="View on GitHub"
            >
              <span>🐙</span> GitHub
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state-card">
      <span class="empty-icon">🔍</span>
      <h3>No skills found</h3>
      <p>No results matching "{{ searchQuery }}". Try clearing your search.</p>
      <button class="btn btn-secondary" @click="searchQuery = ''; selectedCategory = 'All'">Reset Search</button>
    </div>
  </div>
</template>

<style scoped>
.skills-container {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  width: 100%;
  max-width: 1150px;
  margin: 0 auto;
}

/* Hero Card */
.skills-hero-card {
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
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.hero-brand {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.hero-icon {
  font-size: 2rem;
  color: var(--neon-red);
  filter: drop-shadow(0 0 14px rgba(255, 30, 66, 0.6));
}

.hero-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: white;
  letter-spacing: -0.01em;
}

.hero-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
}

.skills-stats-badge {
  background: rgba(255, 30, 66, 0.08);
  border: 1px solid rgba(255, 30, 66, 0.25);
  border-radius: var(--radius-md);
  padding: 0.6rem 1.25rem;
  text-align: center;
}

.stat-num {
  display: block;
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--neon-red);
}

.stat-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hero-filters-row {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 768px) {
  .hero-filters-row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 450px;
}

.search-icon {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.85rem;
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.55rem 2.2rem 0.55rem 2.4rem;
  color: white;
  font-size: 0.85rem;
  outline: none;
  transition: var(--transition);
}

.search-input:focus {
  border-color: var(--neon-red);
  box-shadow: 0 0 10px rgba(255, 30, 66, 0.25);
}

.search-clear-btn {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.8rem;
}

.search-clear-btn:hover {
  color: white;
}

.category-pills {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.cat-pill-btn {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  border-radius: 50px;
  color: var(--text-muted);
  padding: 0.35rem 0.85rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.cat-pill-btn:hover {
  color: white;
  border-color: rgba(255, 255, 255, 0.2);
}

.cat-pill-btn.active {
  background: var(--gradient-red);
  color: white;
  border-color: transparent;
  box-shadow: var(--shadow-red);
}

/* CLI Configuration Toolbar */
.cli-config-card {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 30, 66, 0.2);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  transition: var(--transition);
}

.cli-config-card:hover {
  border-color: rgba(255, 30, 66, 0.35);
}

.cli-config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.cli-config-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.cfg-badge {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--neon-red);
  background: rgba(255, 30, 66, 0.12);
  border: 1px solid rgba(255, 30, 66, 0.35);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.cfg-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.cli-active-preview {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.preview-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 600;
}

.flag-tag {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.flag-global {
  background: rgba(255, 30, 66, 0.15);
  color: var(--neon-red);
  border: 1px solid rgba(255, 30, 66, 0.35);
}

.flag-yes {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.35);
}

.flag-agent {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.35);
}

.flag-detect {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.cli-controls-grid {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

@media (min-width: 900px) {
  .cli-controls-grid {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.control-section {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.section-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.toggles-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.toggle-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  transition: var(--transition);
}

.locked-pill {
  background: rgba(255, 30, 66, 0.1);
  border: 1px solid rgba(255, 30, 66, 0.3);
  color: #fff;
  cursor: default;
  user-select: none;
}

.lock-indicator {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  background: rgba(255, 30, 66, 0.22);
  color: var(--neon-red);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  font-weight: 800;
  letter-spacing: 0.03em;
}

.toggle-item-btn {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  outline: none;
}

.toggle-item-btn .toggle-pill {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
}

.toggle-item-btn .toggle-status {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-muted);
  font-weight: 800;
}

.toggle-item-btn.active .toggle-pill {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.35);
  color: #e5e7eb;
}

.toggle-item-btn.active .toggle-status {
  background: rgba(16, 185, 129, 0.25);
  color: #10b981;
}

.toggle-item-btn:hover .toggle-pill {
  border-color: rgba(255, 255, 255, 0.3);
}

.agent-pills-row {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.agent-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.agent-pill-btn:hover {
  color: white;
  border-color: rgba(255, 255, 255, 0.25);
}

.agent-pill-btn.active {
  background: rgba(255, 30, 66, 0.18);
  border-color: var(--neon-red);
  color: white;
  box-shadow: 0 0 10px rgba(255, 30, 66, 0.25);
}

/* Antigravity Global Bridge Banner */
.antigravity-fix-banner {
  background: linear-gradient(135deg, rgba(255, 30, 66, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%);
  border: 1px solid rgba(255, 30, 66, 0.3);
  border-radius: var(--radius-md);
  padding: 1.15rem 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  animation: fadeInDown 0.25s ease-out;
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fix-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.fix-title-group {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.fix-badge {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 800;
  color: var(--neon-red);
  background: rgba(255, 30, 66, 0.15);
  border: 1px solid rgba(255, 30, 66, 0.35);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.fix-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.os-tabs {
  display: flex;
  gap: 0.35rem;
  background: rgba(0, 0, 0, 0.4);
  padding: 0.2rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.os-tab-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.25rem 0.65rem;
  border-radius: 4px;
  cursor: pointer;
  transition: var(--transition);
}

.os-tab-btn:hover {
  color: #fff;
}

.os-tab-btn.active {
  background: rgba(255, 30, 66, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 30, 66, 0.4);
}

.fix-desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

.fix-desc code {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: #fb7185;
  background: rgba(255, 30, 66, 0.1);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  border: 1px solid rgba(255, 30, 66, 0.2);
}

.fix-command-box {
  background: #030204;
  border: 1px solid rgba(255, 30, 66, 0.25);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.9rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  cursor: pointer;
  transition: var(--transition);
}

.fix-command-box:hover {
  border-color: var(--neon-red);
  background: rgba(0, 0, 0, 0.8);
}

/* Skills Grid */
.skills-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

.skill-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  transition: var(--transition);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.skill-card:hover {
  border-color: var(--border-glow-red);
  box-shadow: 0 12px 30px rgba(255, 30, 66, 0.12);
}

.card-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.skill-identity {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.skill-avatar {
  font-size: 1.5rem;
  background: rgba(255, 30, 66, 0.1);
  border: 1px solid rgba(255, 30, 66, 0.25);
  border-radius: var(--radius-sm);
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skill-name-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.skill-name {
  font-size: 1.15rem;
  font-weight: 700;
  color: white;
}

.badge-global {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--neon-red);
  background: rgba(255, 30, 66, 0.12);
  border: 1px solid rgba(255, 30, 66, 0.3);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-weight: 700;
}

.skill-source {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.category-tag {
  font-size: 0.72rem;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  padding: 0.25rem 0.65rem;
  border-radius: 4px;
  white-space: nowrap;
}

.skill-description {
  font-size: 0.88rem;
  color: var(--text-secondary);
  line-height: 1.55;
}

.diagram-types-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.dt-label {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
}

.dt-chips {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.dt-chip {
  font-size: 0.7rem;
  color: #10b981;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

/* Terminal Command Box */
.command-box {
  background: #050406;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  cursor: pointer;
  transition: var(--transition);
}

.command-box:hover {
  border-color: var(--neon-red);
  background: rgba(0, 0, 0, 0.7);
}

.terminal-prompt {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  overflow-x: auto;
}

.prompt-symbol {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--neon-red);
  user-select: none;
}

.command-code {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: #f3f4f6;
  white-space: nowrap;
}

.btn-copy-cmd {
  background: rgba(255, 30, 66, 0.15);
  border: 1px solid rgba(255, 30, 66, 0.35);
  color: white;
  padding: 0.35rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: var(--transition);
}

.btn-copy-cmd:hover {
  background: var(--neon-red);
  box-shadow: var(--shadow-red);
}

.btn-copy-cmd.copied {
  background: #10b981;
  border-color: #10b981;
  color: white;
}

/* Card Footer */
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.tag-list {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.skill-tag {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.btn-action-link {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  transition: var(--transition);
}

.btn-action-link:hover {
  color: white;
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.05);
}

/* Empty State */
.empty-state-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 3rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.empty-icon {
  font-size: 2.2rem;
  color: var(--text-muted);
}
</style>
