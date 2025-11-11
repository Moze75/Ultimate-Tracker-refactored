// src/utils/bloodSplash.ts

const BLOOD_SPLASH = (() => {
  const BIG_PER_DAMAGE = 16 * 2;
  const MIST_PER_DAMAGE = 32 * 2;
  const MAX_PARTICLES = 200;

  const CHUNK_SPREAD_X = 140;
  const CHUNK_SPREAD_Y = 80;
  const POP_MIN_UP = 30;
  const POP_MAX_UP = 80;
  const FALL_MIN_DOWN = 140;
  const FALL_MAX_DOWN = 260;

  const CHUNK_AIR_MS_MIN = 900;
  const CHUNK_AIR_MS_MAX = 1300;
  const SPLAT_EXTRA_MS = 1800;
  const MIST_AIR_MS = 400;

  const SPLAT_SIZE_MIN = 16;
  const SPLAT_SIZE_MAX = 46;
  const SPLAT_CHANCE = 0.55;

  const MIST_SIZE_MIN = 2;
  const MIST_SIZE_MAX = 4;

  const MAX_SLASH_DEG = 60;
  const SHAKE_DURATION_MS = 200;
  const SHAKE_INTENSITY = 6;

  let cssInjected = false;
  let slashGeom: any = null;
  let shakeWrapper: HTMLElement | null = null;
  let layerEl: HTMLElement | null = null;

  function injectCssOnce() {
    if (cssInjected) return;
    cssInjected = true;

    const st = document.createElement("style");
    st.id = "blood-splash-style";
    st.textContent = `
      :root {
        --blood-chunk-edge: rgba(120,0,0,0.95);
        --blood-chunk-core: rgba(80,0,0,0.9);
        --blood-chunk-dry: rgba(40,0,0,0.85);
        --blood-glow-soft: rgba(100,0,0,0.6);
        --blood-glow-wide: rgba(40,0,0,0.4);
        --blood-mist-inner: rgba(140,0,0,0.9);
        --blood-mist-mid: rgba(60,0,0,0.7);
        --blood-splat-a: rgba(140,0,0,0.95);
        --blood-splat-b: rgba(90,0,0,0.9);
        --blood-splat-c: rgba(40,0,0,0.8);
        --blood-splat-shadow1: rgba(60,0,0,0.7);
        --blood-splat-shadow2: rgba(30,0,0,0.6);
        --blood-flash-inner: rgba(200,0,0,0.4);
        --blood-flash-outer: rgba(60,0,0,0.0);
        --blood-outline-1: rgba(60,0,0,0.8);
        --blood-outline-2: rgba(30,0,0,0.6);
        --blood-blend-mode: multiply;
        --blood-alpha: 1;
      }

      @keyframes blood-chunk-flight {
        0% { transform: translate3d(var(--sx0), var(--sy0), 0) rotate(var(--rot0)) scale(var(--sc0)); opacity:1; }
        30% { transform: translate3d(var(--sxMid), var(--syMid), 0) rotate(var(--rotMid)) scale(var(--scMid)); opacity:1; }
        70% { transform: translate3d(var(--sxEnd), var(--syEnd), 0) rotate(var(--rotEnd)) scale(var(--scEnd)); opacity:1; }
        100% { transform: translate3d(var(--sxEnd), var(--syEnd), 0) rotate(var(--rotEnd)) scale(calc(var(--scEnd) * 0.8)); opacity:0; }
      }

      @keyframes blood-mist-flight {
        0% { transform: translate3d(var(--mx0), var(--my0), 0) scale(var(--mScale)) rotate(var(--mRot)); opacity:1; }
        60% { transform: translate3d(var(--mx1), var(--my1), 0) scale(var(--mScale)) rotate(var(--mRot)); opacity:1; }
        100% { transform: translate3d(var(--mx1), var(--my1), 0) scale(calc(var(--mScale)*0.7)) rotate(var(--mRot)); opacity:0; }
      }

      @keyframes blood-splat-fade {
        0% { opacity:0; transform:scale(0.4) rotate(var(--rot2)); }
        15% { opacity:1; transform:scale(1) rotate(var(--rot2)); }
        80% { opacity:1; transform:scale(1) rotate(var(--rot2)); }
        100% { opacity:0; transform:scale(0.9) rotate(var(--rot2)); }
      }

      @keyframes blood-slash-flash-fade {
        0% { opacity:1; }
        100% { opacity:0; }
      }

      @keyframes blood-hit-shake {
        0% { transform: translate(0px, 0px); }
        20% { transform: translate(var(--shakeX1), var(--shakeY1)); }
        50% { transform: translate(var(--shakeX2), var(--shakeY2)); }
        80% { transform: translate(var(--shakeX3), var(--shakeY3)); }
        100% { transform: translate(0px, 0px); }
      }

      .blood-layer {
        position: fixed;
        left: 0;
        top: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 9999;
        overflow: visible;
      }

      .blood-chunk {
        position: absolute;
        pointer-events: none;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, var(--blood-chunk-edge) 0%, var(--blood-chunk-core) 50%, var(--blood-chunk-dry) 70%, var(--blood-chunk-dry) 75%);
        box-shadow: 0 0 4px var(--blood-glow-soft), 0 0 8px var(--blood-glow-wide);
        mix-blend-mode: var(--blood-blend-mode);
        opacity: var(--blood-alpha);
        animation-name: blood-chunk-flight;
        animation-timing-function: cubic-bezier(0.25,0,0.4,1);
        animation-fill-mode: forwards;
      }

      .blood-streak {
        position: absolute;
        pointer-events: none;
        border-radius: 40% / 70%;
        background: radial-gradient(ellipse at 30% 30%, var(--blood-chunk-edge) 0%, var(--blood-chunk-core) 40%, var(--blood-chunk-dry) 60%, var(--blood-chunk-dry) 75%);
        box-shadow: 0 0 4px var(--blood-outline-1), 0 0 8px var(--blood-outline-2);
        mix-blend-mode: var(--blood-blend-mode);
        opacity: var(--blood-alpha);
        animation-name: blood-chunk-flight;
        animation-timing-function: cubic-bezier(0.25,0,0.4,1);
        animation-fill-mode: forwards;
      }

      .blood-mist {
        position: absolute;
        pointer-events: none;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, var(--blood-mist-inner) 0%, var(--blood-mist-mid) 70%, var(--blood-mist-mid) 80%);
        box-shadow: 0 0 4px var(--blood-outline-1);
        mix-blend-mode: var(--blood-blend-mode);
        opacity: var(--blood-alpha);
        animation-name: blood-mist-flight;
        animation-timing-function: linear;
        animation-fill-mode: forwards;
      }

      .blood-splat {
        position: absolute;
        pointer-events: none;
        z-index: 9998;
        border-radius: 50% / 35%;
        background: radial-gradient(circle at 25% 25%, var(--blood-splat-a) 0%, var(--blood-splat-b) 50%, var(--blood-splat-c) 65%, var(--blood-splat-c) 75%);
        filter: drop-shadow(0 0 3px var(--blood-splat-shadow1)) drop-shadow(0 0 6px var(--blood-splat-shadow2));
        mix-blend-mode: var(--blood-blend-mode);
        opacity: var(--blood-alpha);
        animation-name: blood-splat-fade;
        animation-timing-function: linear;
        animation-fill-mode: forwards;
      }

      .blood-slash-flash {
        position: fixed;
        left: 0;
        top: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 10000;
        background: radial-gradient(ellipse at var(--fxX) var(--fxY), var(--blood-flash-inner) 0%, var(--blood-flash-outer) 60%);
        mix-blend-mode: var(--blood-blend-mode);
        opacity: var(--blood-alpha);
        animation-name: blood-slash-flash-fade;
        animation-duration: 280ms;
        animation-timing-function: ease-out;
        animation-fill-mode: forwards;
      }

      .blood-shake-wrapper.blood-shake-go {
        animation-name: blood-hit-shake;
        animation-duration: ${SHAKE_DURATION_MS}ms;
        animation-timing-function: cubic-bezier(.36,.07,.19,.97);
      }
    `;
    document.head.appendChild(st);
  }

  function ensureLayer() {
    if (layerEl && layerEl.isConnected) return layerEl;
    layerEl = document.createElement("div");
    layerEl.className = "blood-layer";
    document.body.appendChild(layerEl);
    return layerEl;
  }

   

  function triggerShake() {
    function jitter(n: number) {
      const x = ((Math.random() * 2 - 1) * n).toFixed(1) + "px";
      const y = ((Math.random() * 2 - 1) * n).toFixed(1) + "px";
      return { x, y };
    }

    const j1 = jitter(SHAKE_INTENSITY);
    const j2 = jitter(SHAKE_INTENSITY * 0.6);
    const j3 = jitter(SHAKE_INTENSITY * 0.3);

    // 🔧 CORRECTION : Chercher un conteneur existant ou utiliser le body
    const target = document.querySelector('.blood-shake-wrapper') as HTMLElement 
      || document.querySelector('#root') as HTMLElement 
      || document.body;

    target.style.setProperty("--shakeX1", j1.x);
    target.style.setProperty("--shakeY1", j1.y);
    target.style.setProperty("--shakeX2", j2.x);
    target.style.setProperty("--shakeY2", j2.y);
    target.style.setProperty("--shakeX3", j3.x);
    target.style.setProperty("--shakeY3", j3.y);

    // 🔧 CORRECTION : Ajouter la classe directement sans wrapper
    if (!target.classList.contains('blood-shake-wrapper')) {
      target.classList.add('blood-shake-wrapper');
    }

    target.classList.remove("blood-shake-go");
    void target.offsetWidth;
    target.classList.add("blood-shake-go");
  }

  const MAX_SLASH_RAD = (MAX_SLASH_DEG * Math.PI) / 180;

  function newSlashGeom() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const angle = Math.random() * 2 * MAX_SLASH_RAD - MAX_SLASH_RAD;

    const cx = vw * (0.4 + Math.random() * 0.2);
    const cy = vh * (0.3 + Math.random() * 0.4);

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const halfLen = Math.sqrt(vw * vw + vh * vh) * 0.6;

    const x1 = cx - dx * halfLen;
    const y1 = cy - dy * halfLen;
    const x2 = cx + dx * halfLen;
    const y2 = cy + dy * halfLen;
    return { x1, y1, x2, y2 };
  }

  function pickPointOnSlash() {
    if (!slashGeom) slashGeom = newSlashGeom();
    const { x1, y1, x2, y2 } = slashGeom;

    const t = Math.random();
    const baseX = x1 + (x2 - x1) * t;
    const baseY = y1 + (y2 - y1) * t;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const wobble = (Math.random() - 0.5) * 60;
    const jitterX = baseX + nx * wobble;
    const jitterY = baseY + ny * wobble;

    return {
      x: window.scrollX + jitterX,
      y: window.scrollY + jitterY,
      flashAnchor: { x: baseX, y: baseY }
    };
  }

  function rand(a: number, b: number) {
    return a + Math.random() * (b - a);
  }

  function spawnSplatAt(x: number, y: number, maxLifeMsRef: { ms: number }) {
    if (Math.random() > SPLAT_CHANCE) return;
    const s = document.createElement("div");
    s.className = "blood-splat";

    const w = rand(SPLAT_SIZE_MIN, SPLAT_SIZE_MAX);
    const h = w * rand(0.4, 0.8);
    s.style.width = w.toFixed(1) + "px";
    s.style.height = h.toFixed(1) + "px";

    s.style.setProperty("--rot2", rand(0, 360).toFixed(1) + "deg");

    s.style.left = (x - w * 0.5).toFixed(1) + "px";
    s.style.top = (y - h * 0.4).toFixed(1) + "px";

    const splatLife = rand(CHUNK_AIR_MS_MIN, CHUNK_AIR_MS_MAX) + SPLAT_EXTRA_MS;
    s.style.animationDuration = splatLife.toFixed(0) + "ms";

    document.body.appendChild(s);

    setTimeout(() => s.remove(), splatLife + 200);
    if (splatLife > maxLifeMsRef.ms) maxLifeMsRef.ms = splatLife;
  }

  function assignChunkFlightVars(
    el: HTMLElement,
    originX: number,
    originY: number,
    maxLifeMsRef: { ms: number }
  ) {
    const vx = (Math.random() - 0.5) * 2;
    const vy = (Math.random() - 0.5) * 2;

    const upPx = -rand(POP_MIN_UP, POP_MAX_UP);
    const midX = vx * CHUNK_SPREAD_X * 0.6;
    const midY = vy * CHUNK_SPREAD_Y * 0.2 + upPx * 0.5;

    const endX = vx * CHUNK_SPREAD_X * 0.4;
    const endY = rand(FALL_MIN_DOWN, FALL_MAX_DOWN) + vy * CHUNK_SPREAD_Y * 0.5;

    const rot0 = rand(0, 360).toFixed(1) + "deg";
    const rotMid = rand(0, 360).toFixed(1) + "deg";
    const rotEnd = rand(0, 360).toFixed(1) + "deg";

    const sc0 = rand(0.8, 1.2).toFixed(2);
    const scMid = (parseFloat(sc0) * rand(0.9, 1.1)).toFixed(2);
    const scEnd = (parseFloat(scMid) * rand(0.8, 1.05)).toFixed(2);

    const durMs = rand(CHUNK_AIR_MS_MIN, CHUNK_AIR_MS_MAX);

    el.style.setProperty("--sx0", "0px");
    el.style.setProperty("--sy0", "0px");
    el.style.setProperty("--sxMid", midX.toFixed(1) + "px");
    el.style.setProperty("--syMid", midY.toFixed(1) + "px");
    el.style.setProperty("--sxEnd", endX.toFixed(1) + "px");
    el.style.setProperty("--syEnd", endY.toFixed(1) + "px");

    el.style.setProperty("--rot0", rot0);
    el.style.setProperty("--rotMid", rotMid);
    el.style.setProperty("--rotEnd", rotEnd);

    el.style.setProperty("--sc0", sc0);
    el.style.setProperty("--scMid", scMid);
    el.style.setProperty("--scEnd", scEnd);

    el.style.animationDuration = durMs.toFixed(0) + "ms";

    el.style.left = originX + "px";
    el.style.top = originY + "px";

    const landX = originX + parseFloat(endX.toString());
    const landY = originY + parseFloat(endY.toString());
    spawnSplatAt(landX, landY, maxLifeMsRef);

    if (durMs > maxLifeMsRef.ms) maxLifeMsRef.ms = durMs;
  }

  function spawnChunk(layer: HTMLElement, origin: any, maxLifeMsRef: { ms: number }) {
    const el = document.createElement("div");
    el.className = "blood-chunk";

    const w = rand(6, 14);
    const h = rand(6, 14);
    el.style.width = w.toFixed(1) + "px";
    el.style.height = h.toFixed(1) + "px";

    assignChunkFlightVars(el, origin.x, origin.y, maxLifeMsRef);
    layer.appendChild(el);
  }

  function spawnStreak(layer: HTMLElement, origin: any, maxLifeMsRef: { ms: number }) {
    const el = document.createElement("div");
    el.className = "blood-streak";

    const longSide = rand(16, 34);
    const shortSide = rand(4, 10);
    if (Math.random() < 0.5) {
      el.style.width = longSide.toFixed(1) + "px";
      el.style.height = shortSide.toFixed(1) + "px";
    } else {
      el.style.width = shortSide.toFixed(1) + "px";
      el.style.height = longSide.toFixed(1) + "px";
    }

    assignChunkFlightVars(el, origin.x, origin.y, maxLifeMsRef);
    layer.appendChild(el);
  }

  function spawnMist(layer: HTMLElement, origin: any, maxLifeMsRef: { ms: number }) {
    const el = document.createElement("div");
    el.className = "blood-mist";

    const size = rand(MIST_SIZE_MIN, MIST_SIZE_MAX);
    el.style.width = size.toFixed(1) + "px";
    el.style.height = size.toFixed(1) + "px";

    const ang = Math.random() * Math.PI * 2;
    const dist = rand(20, 80);
    const mx1 = Math.cos(ang) * dist;
    const my1 = Math.sin(ang) * dist * 0.6;

    const rot = rand(0, 360).toFixed(1) + "deg";
    const scale = rand(0.7, 1.3).toFixed(2);

    el.style.setProperty("--mx0", "0px");
    el.style.setProperty("--my0", "0px");
    el.style.setProperty("--mx1", mx1.toFixed(1) + "px");
    el.style.setProperty("--my1", my1.toFixed(1) + "px");
    el.style.setProperty("--mRot", rot);
    el.style.setProperty("--mScale", scale);

    el.style.left = origin.x + "px";
    el.style.top = origin.y + "px";
    el.style.animationDuration = MIST_AIR_MS + "ms";

    layer.appendChild(el);

    if (MIST_AIR_MS > maxLifeMsRef.ms) maxLifeMsRef.ms = MIST_AIR_MS;
  }

  function spawnFlashOnce(anchor: { x: number; y: number }) {
    const fx = document.createElement("div");
    fx.className = "blood-slash-flash";
    fx.style.setProperty("--fxX", anchor.x + "px");
    fx.style.setProperty("--fxY", anchor.y + "px");
    document.body.appendChild(fx);
    setTimeout(() => fx.remove(), 300);
  }

  function triggerBurst(dmg: number) {
    if (!dmg || dmg <= 0) return;

    injectCssOnce();
 
    ensureLayer();
    slashGeom = newSlashGeom();

    const wantBig = Math.min(Math.floor(dmg * BIG_PER_DAMAGE), MAX_PARTICLES);
    const wantMist = Math.min(Math.floor(dmg * MIST_PER_DAMAGE), MAX_PARTICLES);

    let flashed = false;
    const maxLifeMsRef = { ms: 0 };

    for (let i = 0; i < wantBig; i++) {
      const origin = pickPointOnSlash();
      if (!flashed) {
        spawnFlashOnce(origin.flashAnchor);
        triggerShake();
        flashed = true;
      }
      if (Math.random() < 0.4) {
        spawnStreak(layerEl!, origin, maxLifeMsRef);
      } else {
        spawnChunk(layerEl!, origin, maxLifeMsRef);
      }
    }

    for (let i = 0; i < wantMist; i++) {
      const origin = pickPointOnSlash();
      spawnMist(layerEl!, origin, maxLifeMsRef);
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

export const triggerBloodSplash = BLOOD_SPLASH.triggerBurst;