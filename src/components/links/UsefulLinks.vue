<script setup lang="ts">
interface ToolLink {
  title: string
  icon: string
  tag: string
  url: string
  description: string
}

const tools: ToolLink[] = [
  {
    title: 'CyberChef',
    icon: '🍳',
    tag: 'Security & Forensics',
    url: 'https://gchq.github.io/CyberChef/',
    description: 'The "Cyber Swiss Army Knife". A web app for encryption, encoding, compression, data parsing, and forensic analysis.'
  },
  {
    title: 'DevDocs',
    icon: '📚',
    tag: 'Documentation',
    url: 'https://devdocs.io/',
    description: 'Combines multiple API documentations (HTML, CSS, JS, Vue, TypeScript, Python, Docker) in a fast, search-focused, offline-capable interface.'
  },
  {
    title: 'RegExr',
    icon: '🔍',
    tag: 'RegEx Tool',
    url: 'https://regexr.com/',
    description: 'An online tool to learn, build, test, and debug Regular Expressions with real-time match highlighting and reference cheat sheets.'
  },
  {
    title: 'Ray.so',
    icon: '📸',
    tag: 'Code Snippets',
    url: 'https://ray.so/',
    description: 'Create beautiful, shareable screenshots of your code snippets with customizable gradient backgrounds and dark themes.'
  },
  {
    title: 'Can I Use',
    icon: '🌐',
    tag: 'Web Standards',
    url: 'https://caniuse.com/',
    description: 'Up-to-date browser support tables for modern frontend web technologies, HTML5 features, and CSS properties across desktop and mobile.'
  },
  {
    title: 'Transform Tools',
    icon: '⚡',
    tag: 'Code Converters',
    url: 'https://transform.tools/',
    description: 'Polyglot web converter for developers: JSON to TypeScript, SVG to JSX, CSS to JS, GraphQL to TypeScript, and more.'
  }
]
</script>

<template>
  <div class="links-grid">
    <div
      v-for="tool in tools"
      :key="tool.title"
      class="link-card"
    >
      <div class="card-header">
        <div class="card-icon">{{ tool.icon }}</div>
        <span class="card-tag">{{ tool.tag }}</span>
      </div>

      <h3 class="card-title">{{ tool.title }}</h3>
      <p class="card-desc">{{ tool.description }}</p>

      <div class="url-badge">
        <span class="url-text">{{ tool.url.replace(/^https?:\/\//, '') }}</span>
      </div>

      <a :href="tool.url" target="_blank" rel="noopener noreferrer" class="btn btn-red open-btn">
        <span>Open {{ tool.title }}</span>
        <span>↗</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
}

.link-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(16px);
  transition: var(--transition);
}

.link-card:hover {
  border-color: var(--border-glow-red);
  background: rgba(28, 15, 24, 0.75);
  transform: translateY(-3px);
  box-shadow: var(--shadow-red), 0 15px 35px rgba(0, 0, 0, 0.4);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.card-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: rgba(255, 30, 66, 0.08);
  border: 1px solid var(--border-glow-red);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
}

.card-tag {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--neon-red);
  background: rgba(255, 30, 66, 0.08);
  border: 1px solid rgba(255, 30, 66, 0.25);
  padding: 0.2rem 0.6rem;
  border-radius: 50px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: white;
}

.card-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.6;
  flex-grow: 1;
  margin-bottom: 1.25rem;
}

.url-badge {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.75rem;
  margin-bottom: 1.25rem;
}

.url-text {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: #fda4af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.open-btn {
  justify-content: center;
  width: 100%;
}
</style>
