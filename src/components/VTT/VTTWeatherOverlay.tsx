/**
 * VTTWeatherOverlay
 * Canvas overlay — effets Nuages, Corbeaux & Braises.
 * Inspiré de FXMaster (gambit07) — https://github.com/gambit07/fxmaster
 * Implémentation Canvas 2D pure, indépendante de PIXI/Foundry.
 */
import { useEffect, useRef } from 'react';
import type { VTTWeatherEffect, VTTWeatherType } from '../../types/vtt';

// ─── Assets FXMaster (crédits : gambit07/fxmaster) ───────────────────────────
const FXMASTER_BASE =
  'https://raw.githubusercontent.com/gambit07/fxmaster/main/assets/particle-effects/effects';

const CLOUD_SRCS = [1, 2, 3, 4].map(n => `${FXMASTER_BASE}/clouds/cloud${n}.webp`);
const CROW_SRCS  = [1, 2, 3, 4].map(n => `${FXMASTER_BASE}/crows/crow${n}.webp`);
const EMBER_SRC  = `${FXMASTER_BASE}/embers/ember.webp`;

const _imgCache = new Map<string, HTMLImageElement>();
function loadImg(src: string): HTMLImageElement {
  if (!_imgCache.has(src)) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    _imgCache.set(src, img);
  }
  return _imgCache.get(src)!;
}
[...CLOUD_SRCS, ...CROW_SRCS, EMBER_SRC].forEach(loadImg);

// ─── Séquence animation corbeaux [1×20, 2×3, 3×2, 4×2, 3×2, 2×3] à 15fps ───
const CROW_ANIM_SEQUENCE: number[] = [];
for (const { tex, count } of [
  { tex: 0, count: 20 },
  { tex: 1, count: 3  },
  { tex: 2, count: 2  },
  { tex: 3, count: 2  },
  { tex: 2, count: 2  },
  { tex: 1, count: 3  },
]) {
  for (let i = 0; i < count; i++) CROW_ANIM_SEQUENCE.push(tex);
}
const CROW_ANIM_TOTAL = CROW_ANIM_SEQUENCE.length; // 32 frames
const CROW_FRAMERATE  = 15;

// ─── Interfaces particules ────────────────────────────────────────────────────

interface CloudParticle {
  type: 'cloud';
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  lifeNorm: number;
  lifeInc: number;
  alpha: number;
  imgSrc: string;
}

interface CrowParticle {
  type: 'crow';
  x: number; y: number;
  vx: number; vy: number;
  baseSpeed: number;
  dirX: number; dirY: number;
  size: number;
  lifeNorm: number;
  lifeInc: number;
  baseLifetimeSec: number;
  alpha: number;
  animTime: number;
  wobblePhase: number;
  wobbleAmp: number;
  wobblePeriod: number;
  perpX: number; perpY: number;
}

interface EmberParticle {
  type: 'embers';
  x: number; y: number;
  vx: number; vy: number;
  baseSpeed: number;
  dirX: number; dirY: number;
  size: number;
  lifeNorm: number;
  lifeInc: number;
  baseLifetimeSec: number;
  alpha: number;
  rotation: number;
  rotSpeed: number;
  color: string;
}

type AnyParticle = CloudParticle | CrowParticle | EmberParticle;

interface WeatherLayer {
  effect: VTTWeatherEffect;
  particles: AnyParticle[];
  maxParticles: number;
  frequency: number;
  spawnAccum: number;
}

interface VTTWeatherOverlayProps {
  effects: VTTWeatherEffect[];
  width: number;
  height: number;
}

// ─── CLOUDS ──────────────────────────────────────────────────────────────────
const CLOUD_SPEED_MIN   = 30;
const CLOUD_SPEED_MAX   = 100;
const CLOUD_SCALE_MIN   = 0.08;
const CLOUD_SCALE_MAX   = 0.80;
// FXMaster _applyScaleToConfig : scale_value × (gridSize/100) × sprite_native
// En Canvas 2D pur (pas de grid), on applique scale directement comme multiplicateur
const CLOUD_SPRITE_BASE = 600;
const CLOUD_ALPHA_MAX   = 0.5;

const CLOUD_ALPHA_LIST = [
  { time: 0,    value: 0              },
  { time: 0.05, value: CLOUD_ALPHA_MAX },
  { time: 0.95, value: CLOUD_ALPHA_MAX },
  { time: 1,    value: 0              },
];

function makeCloud(w: number, h: number, speedFactor: number, spawnLeft: boolean): CloudParticle {
  const rawSpeed   = (CLOUD_SPEED_MIN + Math.random() * (CLOUD_SPEED_MAX - CLOUD_SPEED_MIN)) * speedFactor;
  const scale      = CLOUD_SCALE_MIN + Math.random() * (CLOUD_SCALE_MAX - CLOUD_SCALE_MIN);
  const size       = scale * CLOUD_SPRITE_BASE * speedFactor; // speedFactor ici = scaleFactor passé
  const travelDist = w + size * 2;
  return {
    type: 'cloud',
    x: spawnLeft ? -size - 10 : -size + Math.random() * (w + size),
    y: Math.random() * h * 0.75,
    vx: rawSpeed,
    vy: (-0.3 + Math.random() * 0.6) * rawSpeed * 0.05,
    size,
    lifeNorm: spawnLeft ? 0 : Math.random(),
    lifeInc: rawSpeed / travelDist,
    alpha: 0,
    imgSrc: CLOUD_SRCS[Math.floor(Math.random() * CLOUD_SRCS.length)],
  };
}

// ─── CROWS ───────────────────────────────────────────────────────────────────
const CROW_SPEED_MIN   = 54;
const CROW_SPEED_MAX   = 100;
const CROW_SPRITE_BASE = 180;
const CROW_SCALE_MID   = 0.12;
const CROW_SCALE_EDGE  = 0.03;

const CROW_ALPHA_LIST = [
  { time: 0,    value: 0 },
  { time: 0.02, value: 1 },
  { time: 0.98, value: 1 },
  { time: 1,    value: 0 },
];

const CROW_SCALE_LIST = [
  { time: 0,   value: CROW_SCALE_EDGE },
  { time: 0.1, value: CROW_SCALE_MID  },
  { time: 0.9, value: CROW_SCALE_MID  },
  { time: 1,   value: CROW_SCALE_EDGE },
];

function makeCrow(w: number, h: number, speedFactor: number): CrowParticle {
  const baseSpeed       = CROW_SPEED_MIN + Math.random() * (CROW_SPEED_MAX - CROW_SPEED_MIN);
  const angle           = Math.random() * Math.PI * 2;
  const dirX            = Math.cos(angle);
  const dirY            = Math.sin(angle);
  const baseLifetimeSec = 20 + Math.random() * 20;
  let x: number, y: number;
  const border = Math.floor(Math.random() * 4);
  if      (border === 0) { x = Math.random() * w; y = -50; }
  else if (border === 1) { x = Math.random() * w; y = h + 50; }
  else if (border === 2) { x = -50;               y = Math.random() * h; }
  else                   { x = w + 50;             y = Math.random() * h; }
  return {
    type: 'crow',
    x, y,
    vx: dirX * baseSpeed * speedFactor,
    vy: dirY * baseSpeed * speedFactor,
    baseSpeed, dirX, dirY,
    size: CROW_SCALE_MID * CROW_SPRITE_BASE,
    lifeNorm: 0,
    lifeInc: speedFactor / baseLifetimeSec,
    baseLifetimeSec,
    alpha: 0,
    animTime: Math.random() * (CROW_ANIM_TOTAL / CROW_FRAMERATE),
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp: 0,
    wobblePeriod: 5 + Math.random() * 5,
    perpX: -dirY,
    perpY:  dirX,
  };
}

// ─── EMBERS ──────────────────────────────────────────────────────────────────
const EMBER_SPEED_MIN   = 24;
const EMBER_SPEED_MAX   = 40;
const EMBER_SPRITE_BASE = 120;

const EMBER_ALPHA_LIST = [
  { time: 0,    value: 0   },
  { time: 0.3,  value: 0.9 },
  { time: 0.95, value: 0.9 },
  { time: 1,    value: 0   },
];

const EMBER_SCALE_LIST = [
  { time: 0, value: 0.15 },
  { time: 1, value: 0.01 },
];

function makeEmber(w: number, h: number, speedFactor: number): EmberParticle {
  const baseSpeed       = EMBER_SPEED_MIN + Math.random() * (EMBER_SPEED_MAX - EMBER_SPEED_MIN);
  const angle           = Math.random() * Math.PI * 2;
  const rawDirX         = Math.cos(angle);
  const rawDirY         = Math.sin(angle) * 0.4 - 0.6; // biais vers le haut
  const mag             = Math.sqrt(rawDirX * rawDirX + rawDirY * rawDirY);
  const dirX            = rawDirX / mag;
  const dirY            = rawDirY / mag;
  const baseLifetimeSec = 4 + Math.random() * 2;
  return {
    type: 'embers',
    x: Math.random() * w,
    y: Math.random() * h,
    vx: dirX * baseSpeed * speedFactor,
    vy: dirY * baseSpeed * speedFactor,
    baseSpeed, dirX, dirY,
    size: EMBER_SPRITE_BASE,
    lifeNorm: Math.random(),
    lifeInc: speedFactor / baseLifetimeSec,
    baseLifetimeSec,
    alpha: 0,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (1.74 + Math.random() * 1.74) * (Math.random() > 0.5 ? 1 : -1),
    color: '#f77300',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fxAlpha(t: number, alphaFactor: number, list: { time: number; value: number }[]): number {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1];
    if (clamped >= a.time && clamped <= b.time) {
      const u = (clamped - a.time) / (b.time - a.time);
      return (a.value + (b.value - a.value) * u) * alphaFactor;
    }
  }
  return 0;
}

function interpList(t: number, list: { time: number; value: number }[]): number {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1];
    if (clamped >= a.time && clamped <= b.time) {
      const u = (clamped - a.time) / (b.time - a.time);
      return a.value + (b.value - a.value) * u;
    }
  }
  return list[list.length - 1]?.value ?? 0;
}

// ─── Builder de layer ────────────────────────────────────────────────────────

function buildLayer(effect: VTTWeatherEffect, w: number, h: number): WeatherLayer {
  const speedFactor   = effect.speed;
  const densityFactor = effect.density;
  let maxParticles: number;
  let frequency: number;

  if (effect.type === 'clouds') {
    maxParticles = Math.max(2, Math.round(densityFactor * 8));
    const avgSpeed    = ((CLOUD_SPEED_MIN + CLOUD_SPEED_MAX) / 2) * speedFactor;
    const diagonal    = Math.sqrt(w * w + h * h);
    frequency = (diagonal / avgSpeed) / maxParticles;
  } else if (effect.type === 'embers') {
    maxParticles = Math.max(4, Math.round(densityFactor * 40));
    frequency = (5 / speedFactor) / maxParticles; // avgLifetime 5s
  } else {
    // crows
    maxParticles = Math.max(2, Math.round(densityFactor * 6));
    frequency = (30 / speedFactor) / maxParticles; // avgLifetime 30s
  }

  const particles: AnyParticle[] = Array.from({ length: maxParticles }, () => {
    if (effect.type === 'clouds') return { ...makeCloud(w, h, speedFactor, false), lifeNorm: Math.random() };
    if (effect.type === 'embers') return makeEmber(w, h, speedFactor);
    return { ...makeCrow(w, h, speedFactor), lifeNorm: Math.random() };
  });

  return { effect, particles, maxParticles, frequency, spawnAccum: 0 };
}

// ─── Composant React ─────────────────────────────────────────────────────────

export function VTTWeatherOverlay({ effects, width, height }: VTTWeatherOverlayProps) {
  const canvasScreenRef = useRef<HTMLCanvasElement>(null); // clouds → screen
  const canvasNormalRef = useRef<HTMLCanvasElement>(null); // crows  → normal
  const canvasAddRef    = useRef<HTMLCanvasElement>(null); // embers → screen (ADD)
  const layersRef       = useRef<WeatherLayer[]>([]);
  const rafRef          = useRef<number>(0);
  const lastTimeRef     = useRef<number>(0);

  // ── Sync layers ────────────────────────────────────────────────────────────
  useEffect(() => {
    const activeTypes = effects.map(e => e.type);
    layersRef.current = layersRef.current.filter(l => activeTypes.includes(l.effect.type));

    for (const effect of effects) {
      if (effect.type !== 'clouds' && effect.type !== 'crows' && effect.type !== 'embers') continue;

      const existing = layersRef.current.find(l => l.effect.type === effect.type);
      if (existing) {
        const speedFactor   = effect.speed;
        const densityFactor = effect.density;
        existing.effect = effect;

        if (effect.type === 'clouds') {
          const newMax   = Math.max(2, Math.round(densityFactor * 8));
          const avgSpeed = ((CLOUD_SPEED_MIN + CLOUD_SPEED_MAX) / 2) * speedFactor;
          const diagonal = Math.sqrt(width * width + height * height);
          existing.maxParticles = newMax;
          existing.frequency    = (diagonal / avgSpeed) / newMax;
        } else if (effect.type === 'embers') {
          const newMax = Math.max(4, Math.round(densityFactor * 40));
          existing.maxParticles = newMax;
          existing.frequency    = (5 / speedFactor) / newMax;
        } else {
          const newMax = Math.max(2, Math.round(densityFactor * 6));
          existing.maxParticles = newMax;
          existing.frequency    = (30 / speedFactor) / newMax;
        }

        while (existing.particles.length < existing.maxParticles) {
          if (effect.type === 'clouds')      existing.particles.push(makeCloud(width, height, effect.speed, false));
          else if (effect.type === 'embers') existing.particles.push(makeEmber(width, height, effect.speed));
          else                               existing.particles.push(makeCrow(width, height, effect.speed));
        }
        if (existing.particles.length > existing.maxParticles) {
          existing.particles.splice(existing.maxParticles);
        }
      } else {
        layersRef.current.push(buildLayer(effect, width, height));
      }
    }
  }, [effects, width, height]);

  // ── Boucle d'animation ──────────────��──────────────────────────────────────
  useEffect(() => {
    const canvasScreen = canvasScreenRef.current;
    const canvasNormal = canvasNormalRef.current;
    const canvasAdd    = canvasAddRef.current;
    if (!canvasScreen && !canvasNormal && !canvasAdd) return;

    const ctxScreen = canvasScreen?.getContext('2d') ?? null;
    const ctxNormal = canvasNormal?.getContext('2d') ?? null;
    const ctxAdd    = canvasAdd?.getContext('2d')    ?? null;
    if (!ctxScreen && !ctxNormal && !ctxAdd) return;

    const animate = (time: number) => {
      const dtMs = time - (lastTimeRef.current || time);
      lastTimeRef.current = time;
      const dt = Math.min(dtMs / 1000, 0.1);

      ctxScreen?.clearRect(0, 0, width, height);
      ctxNormal?.clearRect(0, 0, width, height);
      ctxAdd?.clearRect(0, 0, width, height);

      for (const layer of layersRef.current) {
        const { effect, particles } = layer;

        // Sélection du contexte canvas par effet
        let ctx: CanvasRenderingContext2D | null;
        if      (effect.type === 'clouds') ctx = ctxScreen;
        else if (effect.type === 'embers') ctx = ctxAdd;
        else                               ctx = ctxNormal;
        if (!ctx) continue;

        // Spawn
        layer.spawnAccum += dt;
        while (layer.spawnAccum >= layer.frequency && particles.length < layer.maxParticles) {
          layer.spawnAccum -= layer.frequency;
          if (effect.type === 'clouds')      particles.push(makeCloud(width, height, effect.speed, true));
          else if (effect.type === 'embers') particles.push(makeEmber(width, height, effect.speed));
          else                               particles.push(makeCrow(width, height, effect.speed));
        }
        if (layer.spawnAccum > layer.frequency * 2) layer.spawnAccum = 0;

        // Update + Draw
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.lifeNorm += p.lifeInc * dt;

          if (p.lifeNorm >= 1) {
            particles.splice(i, 1);
            continue;
          }

          // ── Cloud ────────────────────────────────────────────
          if (p.type === 'cloud') {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.alpha = fxAlpha(p.lifeNorm, effect.alpha, CLOUD_ALPHA_LIST);
            const img = loadImg(p.imgSrc);
            if (!img.complete || img.naturalWidth === 0) continue;
                       const drawSize = p.size * (effect.scale ?? 1);
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
            ctx.drawImage(img, p.x - drawSize, p.y - drawSize, drawSize * 2, drawSize * 2);
            ctx.restore();

          // ── Crow ─────────────────────────────────────────────
          } else if (p.type === 'crow') {
            // FXMaster _applySpeedToConfig : speed × factor, lifetime / factor
            p.vx      = p.dirX * p.baseSpeed * effect.speed;
            p.vy      = p.dirY * p.baseSpeed * effect.speed;
            p.lifeInc = effect.speed / p.baseLifetimeSec;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.animTime += dt;
            p.alpha = fxAlpha(p.lifeNorm, effect.alpha, CROW_ALPHA_LIST);
                     const scaledSize = interpList(p.lifeNorm, CROW_SCALE_LIST) * CROW_SPRITE_BASE * effect.scale;
            const frameIdx   = Math.floor(p.animTime * CROW_FRAMERATE) % CROW_ANIM_TOTAL;
            const img        = loadImg(CROW_SRCS[CROW_ANIM_SEQUENCE[frameIdx]]);
            if (!img.complete || img.naturalWidth === 0) continue;
            const flyAngle = Math.atan2(p.vy, p.vx);
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
            ctx.translate(p.x, p.y);
            ctx.rotate(flyAngle);
            ctx.drawImage(img, -scaledSize, -scaledSize, scaledSize * 2, scaledSize * 2);
            ctx.restore();

          // ── Embers ───────────────────────────────────────────
          } else if (p.type === 'embers') {
            // FXMaster _applySpeedToConfig
            p.vx      = p.dirX * p.baseSpeed * effect.speed;
            p.vy      = p.dirY * p.baseSpeed * effect.speed;
            p.lifeInc = effect.speed / p.baseLifetimeSec;
            p.x        += p.vx * dt;
            p.y        += p.vy * dt;
            p.rotation += p.rotSpeed * dt;
            p.alpha     = fxAlpha(p.lifeNorm, effect.alpha, EMBER_ALPHA_LIST);
            const scaleFactor = interpList(p.lifeNorm, EMBER_SCALE_LIST);
                   const eSize       = scaleFactor * EMBER_SPRITE_BASE * effect.scale;
            // Couleur interpolée orange→rouge (#f77300 → #f72100)
            const tc = Math.min(1, Math.max(0, p.lifeNorm));
            const g  = Math.round(0x73 + (0x21 - 0x73) * tc); // 115→33
            p.color  = `rgb(247,${g},0)`;
            const img = loadImg(EMBER_SRC);
            if (!img.complete || img.naturalWidth === 0) continue;
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            // Teinte orange→rouge
            ctx.filter = `sepia(1) saturate(5) hue-rotate(${Math.round(tc * -20)}deg)`;
            ctx.drawImage(img, -eSize, -eSize, eSize * 2, eSize * 2);
            ctx.filter = 'none';
            ctx.restore();
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height]);

  if (effects.length === 0) return null;

  return (
    <>
      {/* Clouds : mode screen (sprites blancs) */}
      {effects.some(e => e.type === 'clouds') && (
        <canvas
          ref={canvasScreenRef}
          width={width}
          height={height}
          className="absolute inset-0 pointer-events-none z-10"
          style={{ mixBlendMode: 'screen' }}
        />
      )}
      {/* Crows : mode normal (sprites sombres) */}
      {effects.some(e => e.type === 'crows') && (
        <canvas
          ref={canvasNormalRef}
          width={width}
          height={height}
          className="absolute inset-0 pointer-events-none z-10"
          style={{ mixBlendMode: 'normal' }}
        />
      )}
      {/* Embers : mode screen (sprites lumineux, ADD en canvas) */}
      {effects.some(e => e.type === 'embers') && (
        <canvas
          ref={canvasAddRef}
          width={width}
          height={height}
          className="absolute inset-0 pointer-events-none z-10"
          style={{ mixBlendMode: 'screen' }}
        />
      )}
    </>
  );
}