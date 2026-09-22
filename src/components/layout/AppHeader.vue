<template>
  <header class="app-header">
    <div class="header-tag">
      <span class="tag-icon">⚡</span>
      <span class="tag-text">TexTools</span>
    </div>
    <h1 class="main-title">TexTools</h1>
    <p class="subtitle">
      A retro-futuristic workspace featuring essential developer utilities, tools, and retro games.
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
  border: 1px solid var(--border-glow-red);
  background: rgba(255, 30, 66, 0.08);
  color: var(--neon-red);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 1.25rem;
  box-shadow: var(--shadow-red);
  backdrop-filter: blur(10px);
}

.main-title {
  font-size: clamp(2.4rem, 5vw, 4rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 0.85rem;
  background: linear-gradient(90deg, #ffffff 30%, #ff1e42 70%, #991b1b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 40px rgba(255, 30, 66, 0.25);
}

.subtitle {
  font-size: clamp(0.95rem, 2vw, 1.15rem);
  color: var(--text-secondary);
  max-width: 650px;
  margin: 0 auto;
  line-height: 1.6;
}
</style>
