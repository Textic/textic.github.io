<template>
  <header class="app-header">
    <div class="header-tag">
      <span class="tag-icon">👾</span>
      <span class="tag-text">Textic Sandbox</span>
    </div>
    <h1 class="main-title">Developer Arcade</h1>
    <p class="subtitle">
      Un espacio de trabajo retro-futurista con mini-juegos arcade y utilidades esenciales para desarrolladores.
      Tus archivos estáticos se sirven como CDN en segundo plano.
    </p>
  </header>
</template>

<style scoped>
.app-header {
  text-align: center;
  margin-bottom: 3rem;
  padding-top: 0.5rem;
}

.header-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 1.1rem;
  border-radius: 50px;
  border: 1px solid var(--border-glow-pink);
  background: rgba(255, 0, 127, 0.06);
  color: var(--neon-pink);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 1.25rem;
  box-shadow: var(--shadow-pink);
  backdrop-filter: blur(10px);
}

.main-title {
  font-size: clamp(2.4rem, 5vw, 4rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 0.85rem;
  background: linear-gradient(90deg, #ffffff 30%, #a855f7 70%, #ff007f 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 40px rgba(255, 0, 127, 0.15);
}

.subtitle {
  font-size: clamp(0.95rem, 2vw, 1.15rem);
  color: var(--text-secondary);
  max-width: 650px;
  margin: 0 auto;
  line-height: 1.6;
}
</style>
