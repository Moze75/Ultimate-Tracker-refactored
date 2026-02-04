const HEALING_AURA = (() => {
  const PARTICLES_PER_HEAL = 8;
  const SPARKLES_PER_HEAL = 12;
  const MAX_PARTICLES = 80;
  const MAX_SPARKLES = 120;

  const RISE_MIN = 80;
  const RISE_MAX = 200;
  const SPREAD_X = 120;

  const PARTICLE_MS_MIN = 800;
  const PARTICLE_MS_MAX = 1200;
  const SPARKLE_MS = 600;
  const RING_MS = 1000;
  const GLOW_MS = 800;

  const PARTICLE_SIZE_MIN = 4;
  const PARTICLE_SIZE_MAX = 10;
  const SPARKLE_SIZE_MIN = 2;
  const SPARKLE_SIZE_MAX = 5;

  let cssInjected = false;
  let layerEl: HTMLElement | null = null;

  function injectCssOnce() {
    if (cssInjected) return;
    cssInjected = true;

    const st = document.createElement("style");
    st.id = "healing-aura-style";
    st.textContent = `
      :root {
        --heal-particle-core: rgba(80, 200, 120, 0.9);
        --heal-particle-edge: rgba(50, 180, 100, 0.7);
        --heal-particle-glow: rgba(100, 220, 140, 0.5);
        --heal-sparkle-core: rgba(180, 255, 200, 0.95);
        --heal-sparkle-edge: rgba(120, 230, 160, 0.6);
        --heal-ring-color: rgba(80, 200, 120, 0.4);
        --heal-glow-inner: rgba(100, 220, 140, 0.25);
        --heal-glow-outer: rgba(80, 200, 120, 0);
      }

      @keyframes heal-particle-rise {
        0% {
          transform: translate3d(0, 0, 0) scale(0.3);
          opacity: 0;
        }
        15% {
          transform: translate3d(var(--hpX1), var(--hpY1), 0) scale(1);
          opacity: 1;
        }
        70% {
          transform: translate3d(var(--hpX2), var(--hpY2), 0) scale(0.8);
          opacity: 0.8;
        }
        100% {
          transform: translate3d(var(--hpX3), var(--hpY3), 0) scale(0.2);
          opacity: 0;
        }
      }

      @keyframes heal-sparkle-twinkle {
        0% {
          transform: translate3d(0, 0, 0) scale(0) rotate(0deg);
          opacity: 0;
        }
        20% {
          transform: translate3d(var(--hsX1), var(--hsY1), 0) scale(1.2) rotate(90deg);
          opacity: 1;
        }
        50% {
          transform: translate3d(var(--hsX2), var(--hsY2), 0) scale(0.8) rotate(180deg);
          opacity: 0.9;
        }
        100% {
          transform: translate3d(var(--hsX3), var(--hsY3), 0) scale(0) rotate(360deg);
          opacity: 0;
        }
      }

      @keyframes heal-ring-expand {
        0% {
          transform: translate(-50%, -50%) scale(0.1);
          opacity: 0.6;
        }
        60% {
          transform: translate(-50%, -50%) scale(0.8);
          opacity: 0.3;
        }
        100% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 0;
        }
      }

      @keyframes heal-glow-pulse {
        0% {
          opacity: 0;
        }
        30% {
          opacity: 1;
        }
        100% {
          opacity: 0;
        }
      }

      .healing-layer {
        position: fixed;
        left: 0;
        top: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 9999;
        overflow: hidden;
      }

      .heal-particle {
        position: absolute;
        pointer-events: none;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, var(--heal-sparkle-core) 0%, var(--heal-particle-core) 40%, var(--heal-particle-edge) 70%);
        box-shadow: 0 0 6px var(--heal-particle-glow), 0 0 12px var(--heal-particle-glow);
        animation-name: heal-particle-rise;
        animation-timing-function: ease-out;
        animation-fill-mode: forwards;
      }

      .heal-sparkle {
        position: absolute;
        pointer-events: none;
        background: radial-gradient(circle, var(--heal-sparkle-core) 0%, var(--heal-sparkle-edge) 50%, transparent 70%);
        box-shadow: 0 0 4px var(--heal-sparkle-core);
        animation-name: heal-sparkle-twinkle;
        animation-timing-function: ease-in-out;
        animation-fill-mode: forwards;
      }

      .heal-sparkle::before,
      .heal-sparkle::after {
        content: '';
        position: absolute;
        background: inherit;
        border-radius: inherit;
      }

      .heal-sparkle::before {
        width: 100%;
        height: 30%;
        top: 35%;
        left: 0;
      }

      .heal-sparkle::after {
        width: 30%;
        height: 100%;
        top: 0;
        left: 35%;
      }

      .heal-ring {
        position: absolute;
        pointer-events: none;
        border: 2px solid var(--heal-ring-color);
        border-radius: 50%;
        box-shadow: 0 0 8px var(--heal-particle-glow), inset 0 0 8px var(--heal-particle-glow);
        animation-name: heal-ring-expand;
        animation-timing-function: ease-out;
        animation-fill-mode: forwards;
      }

      .heal-glow {
        position: fixed;
        left: 0;
        top: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 9998;
        background: radial-gradient(ellipse at 50% 60%, var(--heal-glow-inner) 0%, var(--heal-glow-outer) 50%);
        animation-name: heal-glow-pulse;
        animation-timing-function: ease-out;
        animation-fill-mode: forwards;
      }
    `;
    document.head.appendChild(st);
  }

  function ensureLayer() {
    if (layerEl && layerEl.isConnected) return layerEl;
    layerEl = document.createElement("div");
    layerEl.className = "healing-layer";
    document.body.appendChild(layerEl);
    return layerEl;
  }

  function rand(a: number, b: number) {
    return a + Math.random() * (b - a);
  }

  function getRandomOrigin() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: vw * (0.2 + Math.random() * 0.6),
      y: vh * (0.4 + Math.random() * 0.4)
    };
  }

  function spawnParticle(layer: HTMLElement, maxLifeMsRef: { ms: number }) {
    const el = document.createElement("div");
    el.className = "heal-particle";

    const origin = getRandomOrigin();
    const size = rand(PARTICLE_SIZE_MIN, PARTICLE_SIZE_MAX);
    el.style.width = size.toFixed(1) + "px";
    el.style.height = size.toFixed(1) + "px";

    const riseHeight = rand(RISE_MIN, RISE_MAX);
    const swayX = (Math.random() - 0.5) * SPREAD_X;

    el.style.setProperty("--hpX1", (swayX * 0.3).toFixed(1) + "px");
    el.style.setProperty("--hpY1", (-riseHeight * 0.2).toFixed(1) + "px");
    el.style.setProperty("--hpX2", (swayX * 0.7).toFixed(1) + "px");
    el.style.setProperty("--hpY2", (-riseHeight * 0.6).toFixed(1) + "px");
    el.style.setProperty("--hpX3", swayX.toFixed(1) + "px");
    el.style.setProperty("--hpY3", (-riseHeight).toFixed(1) + "px");

    el.style.left = origin.x.toFixed(1) + "px";
    el.style.top = origin.y.toFixed(1) + "px";

    const duration = rand(PARTICLE_MS_MIN, PARTICLE_MS_MAX);
    const delay = rand(0, 200);
    el.style.animationDuration = duration.toFixed(0) + "ms";
    el.style.animationDelay = delay.toFixed(0) + "ms";

    layer.appendChild(el);

    const totalTime = duration + delay;
    if (totalTime > maxLifeMsRef.ms) maxLifeMsRef.ms = totalTime;
  }

  function spawnSparkle(layer: HTMLElement, maxLifeMsRef: { ms: number }) {
    const el = document.createElement("div");
    el.className = "heal-sparkle";

    const origin = getRandomOrigin();
    const size = rand(SPARKLE_SIZE_MIN, SPARKLE_SIZE_MAX);
    el.style.width = size.toFixed(1) + "px";
    el.style.height = size.toFixed(1) + "px";

    const riseHeight = rand(RISE_MIN * 0.5, RISE_MAX * 0.7);
    const swayX = (Math.random() - 0.5) * SPREAD_X * 0.8;

    el.style.setProperty("--hsX1", (swayX * 0.4).toFixed(1) + "px");
    el.style.setProperty("--hsY1", (-riseHeight * 0.3).toFixed(1) + "px");
    el.style.setProperty("--hsX2", (swayX * 0.8).toFixed(1) + "px");
    el.style.setProperty("--hsY2", (-riseHeight * 0.7).toFixed(1) + "px");
    el.style.setProperty("--hsX3", swayX.toFixed(1) + "px");
    el.style.setProperty("--hsY3", (-riseHeight).toFixed(1) + "px");

    el.style.left = origin.x.toFixed(1) + "px";
    el.style.top = origin.y.toFixed(1) + "px";

    const delay = rand(0, 300);
    el.style.animationDuration = SPARKLE_MS + "ms";
    el.style.animationDelay = delay.toFixed(0) + "ms";

    layer.appendChild(el);

    const totalTime = SPARKLE_MS + delay;
    if (totalTime > maxLifeMsRef.ms) maxLifeMsRef.ms = totalTime;
  }

  function spawnRing(maxLifeMsRef: { ms: number }) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const el = document.createElement("div");
    el.className = "heal-ring";

    const size = Math.min(vw, vh) * rand(0.3, 0.5);
    el.style.width = size.toFixed(1) + "px";
    el.style.height = size.toFixed(1) + "px";

    el.style.left = (vw * 0.5).toFixed(1) + "px";
    el.style.top = (vh * 0.5).toFixed(1) + "px";

    el.style.animationDuration = RING_MS + "ms";

    document.body.appendChild(el);

    setTimeout(() => el.remove(), RING_MS + 100);

    if (RING_MS > maxLifeMsRef.ms) maxLifeMsRef.ms = RING_MS;
  }

  function spawnGlow() {
    const el = document.createElement("div");
    el.className = "heal-glow";
    el.style.animationDuration = GLOW_MS + "ms";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), GLOW_MS + 100);
  }

  function triggerBurst(healAmount: number) {
    if (!healAmount || healAmount <= 0) return;

    injectCssOnce();
    ensureLayer();

    const intensity = Math.min(healAmount / 10, 3);
    const wantParticles = Math.min(Math.floor(healAmount * PARTICLES_PER_HEAL * intensity * 0.5), MAX_PARTICLES);
    const wantSparkles = Math.min(Math.floor(healAmount * SPARKLES_PER_HEAL * intensity * 0.5), MAX_SPARKLES);
    const ringCount = Math.min(Math.ceil(intensity), 2);

    const maxLifeMsRef = { ms: 0 };

    spawnGlow();

    for (let i = 0; i < ringCount; i++) {
      setTimeout(() => spawnRing(maxLifeMsRef), i * 150);
    }

    for (let i = 0; i < wantParticles; i++) {
      spawnParticle(layerEl!, maxLifeMsRef);
    }

    for (let i = 0; i < wantSparkles; i++) {
      spawnSparkle(layerEl!, maxLifeMsRef);
    }

    const cleanupDelay = maxLifeMsRef.ms + 400;
    setTimeout(() => {
      if (!layerEl) return;
      while (layerEl.firstChild) {
        layerEl.removeChild(layerEl.firstChild);
      }
    }, cleanupDelay);
  }

  return {
    triggerBurst
  };
})();

export const triggerHealingAura = HEALING_AURA.triggerBurst;
