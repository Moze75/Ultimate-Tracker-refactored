/**
 * VTTWeatherOverlay
 * Canvas overlay — effets Nuages, Corbeaux, Braises & Brume.
 * Inspiré de FXMaster (gambit07) — https://github.com/gambit07/fxmaster
 * Implémentation Canvas 2D pure, indépendante de PIXI/Foundry.
 */
import { useEffect, useRef } from 'react';
import type { VTTWeatherEffect } from '../../types/vtt';

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
  const size       = scale * CLOUD_SPRITE_BASE * speedFactor;
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
  const rawDirY         = Math.sin(angle) * 0.4 - 0.6;
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

// ─── FOG — simulation par gradients radiaux (inspiré fog.frag FXMaster/gambit07) ─
// Rendu GPU-friendly : radialGradient Canvas 2D, zéro getImageData/putImageData.

interface FogBlob {
  x: number; y: number;   // position normalisée [0–1]
  vx: number; vy: number; // vitesse normalisée
  r: number;              // rayon normalisé [0–1]
  phase: number;          // déphasage ondulation
  alphaBase: number;      // opacité de base [0–1]
}

// Particule cloud brume : traverse l'écran lentement en rotation douce
// Inspiré de FogParticleEffect : moveSpeed 10-15px/s, rotation 0.15-0.35 rad/s,
// lifetime 10-25s, alpha 0→0.1→0.3→0.1→0, scale 1.5→1.0
interface FogCloudParticle {
  x: number; y: number;       // position px
  vx: number; vy: number;     // vitesse px/s
  angle: number;              // rotation actuelle rad
  rotSpeed: number;           // vitesse rotation rad/s (0.15–0.35)
  size: number;               // taille de base px
  life: number;               // durée de vie écoulée s
  lifetime: number;           // durée de vie totale s (10–25)
  imgIdx: number;             // index cloud (0–3)
}

function makeFogCloud(w: number, h: number, speedFactor: number, fromBorder: boolean): FogCloudParticle {
  // Spawn depuis un bord aléatoire (comme DefaultRectangleSpawnMixin)
  const border = Math.floor(Math.random() * 4);
  let x: number, y: number;
  if      (border === 0) { x = Math.random() * w; y = -150; }
  else if (border === 1) { x = Math.random() * w; y = h + 150; }
  else if (border === 2) { x = -150;              y = Math.random() * h; }
  else                   { x = w + 150;            y = Math.random() * h; }

  // Direction vers le centre avec dérive (moveSpeed 10–15 px/s, minMult 0.2)
  const mult     = 0.2 + Math.random() * 0.8;
  const speed    = (10 + Math.random() * 5) * mult * speedFactor;
  const towardCX = (w / 2 - x);
  const towardCY = (h / 2 - y);
  const dist     = Math.sqrt(towardCX * towardCX + towardCY * towardCY) || 1;
  // Légère dérive aléatoire autour de la direction centrale
  const driftAngle = Math.atan2(towardCY, towardCX) + (Math.random() - 0.5) * Math.PI;
  const vx = Math.cos(driftAngle) * speed;
  const vy = Math.sin(driftAngle) * speed;

  const lifetime = fromBorder
    ? (10 + Math.random() * 15) / speedFactor
    : (Math.random() * (25 / speedFactor)); // stagger initial

  return {
    x: fromBorder ? x : Math.random() * w,
    y: fromBorder ? y : Math.random() * h,
    vx, vy,
    angle: Math.random() * Math.PI * 2,
    rotSpeed: (0.15 + Math.random() * 0.20) * (Math.random() > 0.5 ? 1 : -1),
    size: (200 + Math.random() * 160),   // scale 1.5→1.0 géré à l'affichage
    life: fromBorder ? 0 : Math.random() * lifetime,
    lifetime,
    imgIdx: Math.floor(Math.random() * 4),
  };
}


function makeFogBlobs(count: number): FogBlob[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.00008,
    vy: (Math.random() - 0.5) * 0.00003,
    r: 0.15 + Math.random() * 0.25,
    phase: Math.random() * Math.PI * 2,
    alphaBase: 0.06 + Math.random() * 0.10,
  }));
}

function fogHexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
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
    frequency = (5 / speedFactor) / maxParticles;
  } else {
    // crows
    maxParticles = Math.max(2, Math.round(densityFactor * 6));
    frequency = (30 / speedFactor) / maxParticles;
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
  const canvasAddRef    = useRef<HTMLCanvasElement>(null); // embers → screen
  const canvasFogRef    = useRef<HTMLCanvasElement>(null); // fog    → normal
  const fogBlobsRef     = useRef<FogBlob[]>(makeFogBlobs(22));
  const fogTimeRef      = useRef<number>(0);
  const fogCloudsRef    = useRef<FogCloudParticle[]>([]);
  const effectsRef      = useRef<VTTWeatherEffect[]>(effects);
  const layersRef       = useRef<WeatherLayer[]>([]);
  const rafRef          = useRef<number>(0);
  const lastTimeRef     = useRef<number>(0);

  // Garde effectsRef synchronisé sans déclencher de re-render dans la boucle RAF
  effectsRef.current = effects;

  // ── Sync layers ──────────────────────────────────────────────────────────
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

  // ── Boucle d'animation ───────────────────────────────────────────────────
  useEffect(() => {
    const animate = (time: number) => {
      const ctxScreen = canvasScreenRef.current?.getContext('2d') ?? null;
      const ctxNormal = canvasNormalRef.current?.getContext('2d') ?? null;
      const ctxAdd    = canvasAddRef.current?.getContext('2d')    ?? null;

      const dtMs = time - (lastTimeRef.current || time);
      lastTimeRef.current = time;
      const dt = Math.min(dtMs / 1000, 0.1);

      ctxScreen?.clearRect(0, 0, width, height);
      ctxNormal?.clearRect(0, 0, width, height);
      ctxAdd?.clearRect(0, 0, width, height);

      for (const layer of layersRef.current) {
        const { effect, particles } = layer;

        let ctx: CanvasRenderingContext2D | null;
        if      (effect.type === 'clouds') ctx = ctxScreen;
        else if (effect.type === 'embers') ctx = ctxAdd;
        else                               ctx = ctxNormal;
        if (!ctx) continue;

        layer.spawnAccum += dt;
        while (layer.spawnAccum >= layer.frequency && particles.length < layer.maxParticles) {
          layer.spawnAccum -= layer.frequency;
          if (effect.type === 'clouds')      particles.push(makeCloud(width, height, effect.speed, true));
          else if (effect.type === 'embers') particles.push(makeEmber(width, height, effect.speed));
          else                               particles.push(makeCrow(width, height, effect.speed));
        }
        if (layer.spawnAccum > layer.frequency * 2) layer.spawnAccum = 0;

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.lifeNorm += p.lifeInc * dt;

          if (p.lifeNorm >= 1) {
            particles.splice(i, 1);
            continue;
          }

          // ── Cloud ──────────────────────────────────────────────────────
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

          // ── Crow ───────────────────────────────────────────────────────
          } else if (p.type === 'crow') {
            p.vx      = p.dirX * p.baseSpeed * effect.speed;
            p.vy      = p.dirY * p.baseSpeed * effect.speed;
            p.lifeInc = effect.speed / p.baseLifetimeSec;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.animTime += dt;
            p.alpha = fxAlpha(p.lifeNorm, effect.alpha, CROW_ALPHA_LIST);
            const scaledSize = interpList(p.lifeNorm, CROW_SCALE_LIST) * CROW_SPRITE_BASE * (effect.scale ?? 1);
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

          // ── Embers ─────────────────────────────────────────────────────
          } else if (p.type === 'embers') {
            p.vx      = p.dirX * p.baseSpeed * effect.speed;
            p.vy      = p.dirY * p.baseSpeed * effect.speed;
            p.lifeInc = effect.speed / p.baseLifetimeSec;
            p.x        += p.vx * dt;
            p.y        += p.vy * dt;
            p.rotation += p.rotSpeed * dt;
            p.alpha     = fxAlpha(p.lifeNorm, effect.alpha, EMBER_ALPHA_LIST);
            const scaleFactor = interpList(p.lifeNorm, EMBER_SCALE_LIST);
            const eSize       = scaleFactor * EMBER_SPRITE_BASE * (effect.scale ?? 1);
            const tc = Math.min(1, Math.max(0, p.lifeNorm));
            const g  = Math.round(0x73 + (0x21 - 0x73) * tc);
            p.color  = `rgb(247,${g},0)`;
            const img = loadImg(EMBER_SRC);
            if (!img.complete || img.naturalWidth === 0) continue;
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.filter = `sepia(1) saturate(5) hue-rotate(${Math.round(tc * -20)}deg)`;
            ctx.drawImage(img, -eSize, -eSize, eSize * 2, eSize * 2);
            ctx.filter = 'none';
            ctx.restore();
          }
        }
      }

      // ── FOG — triple domain-warp + sprites cloud tournants (FXMaster/gambit07) ─
      // Reproduit : fog.frag (triple FBM warp, contrast=3, HDR highlight vec3(1.5))
      //           + FogParticleEffect (cloud sprites, alpha 0→0.3→0, rotation)
      const ctxFog = canvasFogRef.current?.getContext('2d') ?? null;
      if (ctxFog) {
        const fe = effectsRef.current.find(e => e.type === 'fog');
        if (fe) {
          fogTimeRef.current += dt * fe.speed * 0.3;
          const t = fogTimeRef.current;
          ctxFog.clearRect(0, 0, width, height);

          const [cr, cg, cb] = fogHexToRgb(fe.color ?? '#b0c8e0');
          // Surbrillance : simule vec3(1.5) du shader — on éclaircit la couleur de 50%
          const hr = Math.min(255, Math.round(cr + (255 - cr) * 0.5));
          const hg = Math.min(255, Math.round(cg + (255 - cg) * 0.5));
          const hb = Math.min(255, Math.round(cb + (255 - cb) * 0.5));

          const density  = Math.min(2, Math.max(0.1, fe.density));
          const alphaMax = Math.min(1, Math.max(0, fe.alpha));
          const scl      = fe.scale ?? 1;

          // ── Couche 1 : nappe de fond large (octave basse fréquence) ────────
          // Simule le f de base du fbm, avec contrast=3 → peaks lumineux
          for (let layer = 0; layer < 3; layer++) {
            const phase = layer * 2.094; // 2π/3
            const bx = 0.5 + 0.35 * Math.sin(t * 0.06 + phase)
                          + 0.15 * Math.cos(t * 0.11 + phase * 1.7);
            const by = 0.5 + 0.3  * Math.cos(t * 0.05 + phase * 1.3)
                          + 0.12 * Math.sin(t * 0.09 + phase * 0.8);
            const r  = Math.max(width, height) * (0.55 + 0.15 * Math.sin(t * 0.04 + phase)) * scl;
            const cx = bx * width;
            const cy = by * height;
            // Courbe non-linéaire f³+0.6f²+0.5f → alpha élevé au centre, chute rapide
            const fVal  = 0.5 + 0.5 * Math.sin(t * 0.08 + phase * 2.1);
            const shape = fVal * fVal * fVal + 0.6 * fVal * fVal + 0.5 * fVal;
            const a     = Math.min(1, shape * 0.22 * density * alphaMax);

            const g = ctxFog.createRadialGradient(cx, cy, 0, cx, cy, r);
            // Cœur : couleur surbrillante (vec3(1.5))
            g.addColorStop(0,    `rgba(${hr},${hg},${hb},${a.toFixed(3)})`);
            // Milieu : couleur de base
            g.addColorStop(0.35, `rgba(${cr},${cg},${cb},${(a * 0.55).toFixed(3)})`);
            // Bord : transparence
            g.addColorStop(0.75, `rgba(${cr},${cg},${cb},${(a * 0.1).toFixed(3)})`);
            g.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);
            ctxFog.beginPath();
            ctxFog.arc(cx, cy, r, 0, Math.PI * 2);
            ctxFog.fillStyle = g;
            ctxFog.fill();
          }

          // ── Couche 2 : blobs domain-warpés (simule triple FBM warp) ────────
          // q = fbm(p), r = fbm(p*q + offset + t), f = fbm(p*0.2 + r*3.102)
          const blobs = fogBlobsRef.current;
          for (let i = 0; i < blobs.length; i++) {
            const blob = blobs[i];

            // Triple warp : q → r → f (3 niveaux de perturbation imbriqués)
            const qx = Math.sin(t * 0.13 + blob.phase) * 0.5
                     + Math.sin(t * 0.07 + blob.phase * 2.3 + 1.0) * 0.25;
            const qy = Math.cos(t * 0.11 + blob.phase * 1.4) * 0.5
                     + Math.cos(t * 0.09 + blob.phase * 0.7 + 2.0) * 0.25;
            // r warp (second niveau, utilise q)
            const rx2 = Math.sin(blob.x * qx * 4 + 1.7 + 0.15 * t) * 0.4
                      + Math.sin(t * 0.19 + blob.phase * 1.9) * 0.2;
            const ry2 = Math.cos(blob.y * qy * 4 + 9.3 + 0.35 * t) * 0.4
                      + Math.cos(t * 0.17 + blob.phase * 1.1) * 0.2;
            // Déplacement final avec triple warp
            blob.x += blob.vx * fe.speed * (1 + Math.abs(rx2) * 0.5)
                    + rx2 * 0.0004 * fe.speed;
            blob.y += blob.vy * fe.speed * (1 + Math.abs(ry2) * 0.5)
                    + ry2 * 0.0003 * fe.speed;

            if (blob.x < -blob.r) blob.x = 1 + blob.r;
            if (blob.x > 1 + blob.r) blob.x = -blob.r;
            if (blob.y < -blob.r) blob.y = 1 + blob.r;
            if (blob.y > 1 + blob.r) blob.y = -blob.r;

            // Déformation elliptique non-uniforme (pas de cercles)
            const deformT = t * 0.35 + blob.phase;
            const ellRx = blob.r * width  * scl * (1.2 + 0.7 * Math.sin(deformT))
                        * (1 + 0.3 * Math.cos(deformT * 2.1 + ry2));
            const ellRy = blob.r * height * scl * (1.2 + 0.7 * Math.cos(deformT * 1.3))
                        * (1 + 0.3 * Math.sin(deformT * 1.7 + rx2));
            if (ellRx <= 2 || ellRy <= 2) continue;

            const cx = blob.x * width;
            const cy = blob.y * height;

            // Courbe shape = f³+0.6f²+0.5f appliquée à pulsation
            const fv    = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.25 + blob.phase * 2.1 + rx2));
            const shape = fv * fv * fv + 0.6 * fv * fv + 0.5 * fv;
            const a     = Math.min(1, blob.alphaBase * 0.55 * density * alphaMax * shape);

            const rMax = Math.max(ellRx, ellRy);
            const midStop = 0.3 + 0.25 * Math.sin(blob.phase * 3.7 + t * 0.2);

            ctxFog.save();
            ctxFog.transform(ellRx / rMax, 0, 0, ellRy / rMax, 0, 0);
            const scx = cx * (rMax / ellRx);
            const scy = cy * (rMax / ellRy);
            const grad = ctxFog.createRadialGradient(scx, scy, 0, scx, scy, rMax);
            grad.addColorStop(0,        `rgba(${hr},${hg},${hb},${a.toFixed(3)})`);
            grad.addColorStop(midStop,  `rgba(${cr},${cg},${cb},${(a * 0.45).toFixed(3)})`);
            grad.addColorStop(0.85,     `rgba(${cr},${cg},${cb},${(a * 0.08).toFixed(3)})`);
            grad.addColorStop(1,        `rgba(${cr},${cg},${cb},0)`);
            ctxFog.beginPath();
            ctxFog.arc(scx, scy, rMax, 0, Math.PI * 2);
            ctxFog.fillStyle = grad;
            ctxFog.fill();
            ctxFog.restore();
          } 

                  // ── Couche 3 : particules cloud qui TRAVERSENT l'écran (FogParticleEffect) ─
          // FXMaster : moveSpeed 10-15px/s, rotation 0.15-0.35 rad/s, lifetime 10-25s
          // Les particules bougent EN TRANSLATION — pas de rotation sur place visible

          // Init au premier passage
          if (fogCloudsRef.current.length === 0) {
            const count = Math.max(4, Math.round(density * 10));
            for (let i = 0; i < count; i++) {
              fogCloudsRef.current.push(makeFogCloud(width, height, fe.speed, false));
            }
          }

          const targetCount = Math.max(4, Math.round(density * 10));
          const fogClouds   = fogCloudsRef.current;

          for (let i = fogClouds.length - 1; i >= 0; i--) {
            const p = fogClouds[i];

            // Avancer dans le temps — resynchronise la vitesse si fe.speed a changé
            p.life  += dt * fe.speed;
            p.x     += p.vx * dt;
            p.y     += p.vy * dt;
            p.angle += p.rotSpeed * fe.speed * dt;
            // Mise à jour dynamique de la vitesse (vx/vy normalisés × speed courant)
            const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (currentSpeed > 0) {
              const targetSpeed = (10 + (p.size - 200) / 160 * 5) * fe.speed
                                * (0.2 + 0.8 * Math.abs(p.rotSpeed) / 0.35);
              const ratio = targetSpeed / currentSpeed;
              p.vx *= ratio;
              p.vy *= ratio;
            }

            // Mort → respawn depuis un bord
            if (p.life >= p.lifetime) {
              fogClouds[i] = makeFogCloud(width, height, fe.speed, true);
              continue;
            }

            const img = loadImg(CLOUD_SRCS[p.imgIdx]);
            if (!img.complete || img.naturalWidth === 0) continue;

            // Courbe alpha FXMaster : 0 → 0.1 → 0.3 → 0.1 → 0
            const lifeT = p.life / p.lifetime;
            let cloudAlpha: number;
            if      (lifeT < 0.1)  cloudAlpha = (lifeT / 0.1) * 0.1;
            else if (lifeT < 0.5)  cloudAlpha = 0.1 + ((lifeT - 0.1) / 0.4) * 0.2;
            else if (lifeT < 0.9)  cloudAlpha = 0.3 - ((lifeT - 0.5) / 0.4) * 0.2;
            else                   cloudAlpha = 0.1 - ((lifeT - 0.9) / 0.1) * 0.1;
            cloudAlpha *= density * alphaMax;

            if (cloudAlpha <= 0.003) continue;

            // Scale FXMaster : 1.5 → 1.0 (minMult 0.5 → taille min = 0.75)
            const cloudScale = (1.5 - 0.5 * lifeT) * scl;
            const sz         = p.size * cloudScale;

            ctxFog.save();
            // colorStatic 'dddddd' : teinte gris clair comme FXMaster
            // screen interne : les pixels sombres du sprite disparaissent → pas de bords rigides
            ctxFog.globalAlpha = Math.max(0, Math.min(1, cloudAlpha));
            ctxFog.globalCompositeOperation = 'screen';
            ctxFog.translate(p.x, p.y);
            ctxFog.rotate(p.angle);
            // Teinte dddddd : filtre colorise le sprite en gris clair
            ctxFog.filter = `brightness(0.9) saturate(0) sepia(0.15)`;
            ctxFog.drawImage(img, -sz, -sz, sz * 2, sz * 2);
            ctxFog.filter = 'none';
            ctxFog.restore();
            // Rétablir le mode de composition normal pour les blobs suivants
            ctxFog.globalCompositeOperation = 'source-over';
          }

          // Ajuster le nombre de particules si density a changé
          while (fogClouds.length < targetCount) {
            fogClouds.push(makeFogCloud(width, height, fe.speed, true));
          }
          if (fogClouds.length > targetCount) {
            fogClouds.splice(targetCount);
          }

        } else {
          ctxFog.clearRect(0, 0, width, height);
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
      {/* Fog : simulation FBM multi-octave — screen blend = accumulation lumineuse */}
      {effects.some(e => e.type === 'fog') && (
        <canvas
          ref={canvasFogRef}
          width={width}
          height={height}
          className="absolute inset-0 pointer-events-none z-10"
          style={{ mixBlendMode: 'screen' }}
        />
      )}
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
      {/* Embers : mode screen (sprites lumineux) */}
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