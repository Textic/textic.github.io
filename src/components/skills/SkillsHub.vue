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
  }
])

const searchQuery = ref('')
const selectedCategory = ref('All')
const copiedCommandId = ref<string | null>(null)

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
    return (
      item.name.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q) ||
      item.command.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q))
    )
  })
})

const copySkillCommand = (skill: SkillItem) => {
  copyToClipboard(skill.command, `Copied command: ${skill.command}`)
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
            <code class="command-code">{{ skill.command }}</code>
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

    <!-- Future Expansion Prompt Box -->
    <div class="expansion-notice-card">
      <div class="notice-icon">🚀</div>
      <div class="notice-content">
        <h4>Ready for More Skills</h4>
        <p>Drop more skills in the chat anytime to append them to your catalog.</p>
      </div>
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
  backdrop-filter: blur(16px);
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
  backdrop-filter: blur(16px);
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

/* Expansion Notice */
.expansion-notice-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.notice-icon {
  font-size: 1.6rem;
}

.notice-content h4 {
  font-size: 0.95rem;
  font-weight: 700;
  color: white;
}

.notice-content p {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
}
</style>
