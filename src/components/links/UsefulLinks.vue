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
    tag: 'GCHQ / Security',
    url: 'https://gchq.github.io/CyberChef/',
    description: 'La "navaja suiza cibernética". Herramienta web para cifrado, codificación (Base64, Hex), compresión, hashing y análisis forense de datos.'
  },
  {
    title: 'DevDocs',
    icon: '📚',
    tag: 'Documentación',
    url: 'https://devdocs.io/',
    description: 'Combina múltiples documentaciones de APIs y lenguajes (HTML, CSS, JS, Vue, Python, Docker) en una interfaz veloz con búsqueda instantánea y soporte offline.'
  },
  {
    title: 'RegExr',
    icon: '🔍',
    tag: 'RegEx Tool',
    url: 'https://regexr.com/',
    description: 'Aprende, construye, prueba y depura expresiones regulares con resaltado de coincidencias en tiempo real y chuleta explicativa.'
  },
  {
    title: 'Ray.so',
    icon: '📸',
    tag: 'Code Snippets',
    url: 'https://ray.so/',
    description: 'Genera imágenes elegantes y profesionales de fragmentos de código con fondos degradados listos para compartir.'
  },
  {
    title: 'Can I Use',
    icon: '🌐',
    tag: 'Web Standards',
    url: 'https://caniuse.com/',
    description: 'Tablas actualizadas de compatibilidad de características de HTML5, CSS y Web APIs en todos los navegadores modernos y móviles.'
  },
  {
    title: 'Transform Tools',
    icon: '⚡',
    tag: 'Converters',
    url: 'https://transform.tools/',
    description: 'Conversor políglota para desarrolladores: JSON a TypeScript, SVG a JSX, CSS a JS, GraphQL a TypeScript y más.'
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

      <a :href="tool.url" target="_blank" rel="noopener noreferrer" class="btn btn-cyan open-btn">
        <span>Abrir {{ tool.title }}</span>
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
  border-color: var(--border-glow-cyan);
  background: rgba(22, 28, 61, 0.75);
  transform: translateY(-3px);
  box-shadow: var(--shadow-cyan), 0 15px 35px rgba(0, 0, 0, 0.4);
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
  background: rgba(0, 240, 255, 0.06);
  border: 1px solid var(--border-glow-cyan);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
}

.card-tag {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--neon-pink);
  background: rgba(255, 0, 127, 0.08);
  border: 1px solid rgba(255, 0, 127, 0.25);
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
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.75rem;
  margin-bottom: 1.25rem;
}

.url-text {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: #a5b4fc;
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
