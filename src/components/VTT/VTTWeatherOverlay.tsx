/**
 * VTTWeatherOverlay
 * Canvas overlay — effets Nuages & Corbeaux.
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
// Préchargement
[...CLOUD_SRCS, ...CROW_SRCS].forEach(loadImg);

// ─── Séquence d'animation corbeaux (FXMaster animatedSingle) ─────────────────
// [1×20, 2×3, 3×2, 4×2, 3×2, 2×3] frames à 15fps
const CROW_ANIM_SEQUENCE: number[] = [];
for (const { tex, count } of [
  { tex: 0, count: 20 }, // crow1
  { tex: 1, count: 3  }, // crow2
  { tex: 2, count: 2  }, // crow3
  { tex: 3, count: 2  }, // crow4
  { tex: 2, count: 2  }, // crow3
  { tex: 1, count: 3  }, // crow2
]) {
  for (let i = 0; i < count; i++) CROW_ANIM_SEQUENCE.push(tex);
}
const CROW_ANIM_TOTAL  = CROW_ANIM_SEQUENCE.length; // 32 frames
const CROW_FRAMERATE   = 15; // fps

// ─── Types internes ───────────────────────────────────────────────────────────

interface CloudParticle {
  type: 'cloud';
  x: number; y: number;
  vx: number; vy: number;
  size: number;        // demi-côté sprite px
  lifeNorm: number;    // 0→1
  lifeInc: number;     // incrément/s = 1/lifetimeSec
  alpha: number;
  imgSrc: string;
}

interface CrowParticle {
  type: 'crow';
  x: number; y: number;
  vx: number; vy: number;
  baseSpeed: number;   // vitesse normalisée à speed=1 (px/s)
  dirX: number;        // vecteur direction normalisé
  dirY: number;
  size: number;
  lifeNorm: number;
  lifeInc: number;
  baseLifetimeSec: number;  // durée de vie à speed=1
  alpha: number;
  animTime: number;
  wobblePhase: number;
  wobbleAmp: number;
  wobblePeriod: number;
  perpX: number;
  perpY: number;
}

type AnyParticle = CloudParticle | CrowParticle;

interface WeatherLayer {
  effect: VTTWeatherEffect;
  particles: AnyParticle[];
  maxParticles: number;
  frequency: number;   // s entre spawns
  spawnAccum: number;
}

interface VTTWeatherOverlayProps {
  effects: VTTWeatherEffect[];
  width: number;
  height: number;
}

// ─── CLOUDS (FXMaster clouds.js) ─────────────────────────────────────────────
// moveSpeedStatic : min=30, max=100 px/s
// scaleStatic     : min=0.08, max=0.8 → size = scale × SPRITE_BASE
// alpha list      : [0@0, 0.5@0.05, 0.5@0.95, 0@1]

const CLOUD_SPEED_MIN   = 30;
const CLOUD_SPEED_MAX   = 100;
const CLOUD_SCALE_MIN   = 0.08;
const CLOUD_SCALE_MAX   = 0.80;
const CLOUD_SPRITE_BASE = 600;   // px base (Canvas 2D, pas de grid PIXI)
const CLOUD_ALPHA_MAX   = 0.5;

function makeCloud(w: number, h: number, speedFactor: number, spawnLeft: boolean): CloudParticle {
  const rawSpeed   = (CLOUD_SPEED_MIN + Math.random() * (CLOUD_SPEED_MAX - CLOUD_SPEED_MIN)) * speedFactor;
  const scale      = CLOUD_SCALE_MIN + Math.random() * (CLOUD_SCALE_MAX - CLOUD_SCALE_MIN);
  const size       = scale * CLOUD_SPRITE_BASE;
  const vx         = rawSpeed;
  const vy         = (-0.3 + Math.random() * 0.6) * rawSpeed * 0.05;
  const travelDist = w + size * 2;
  const lifeInc    = rawSpeed / travelDist; // = 1/lifetimeSec

  return {
    type: 'cloud',
    x: spawnLeft ? -size - 10 : -size + Math.random() * (w + size),
    y: Math.random() * h * 0.75,
    vx, vy, size,
    lifeNorm: spawnLeft ? 0 : Math.random(),
    lifeInc,
    alpha: 0,
    imgSrc: CLOUD_SRCS[Math.floor(Math.random() * CLOUD_SRCS.length)],
  };
}

// ─── CROWS (FXMaster crows.js) ───────────────────────────────────────────────
// moveSpeed : 90-100 px/s (minMult 0.6 → min 54px/s), lifetime 20-40s
// scale list: [0.03@0, 0.12@0.1, 0.12@0.9, 0.03@1] → size = scale × CROW_SPRITE_BASE
// alpha list: [0@0, 1@0.02, 1@0.98, 0@1]
// spawn : depuis les 4 bords (DefaultRectangleSpawnMixin)
// rotation : 0-359° → direction aléatoire

const CROW_SPEED_MIN    = 54;    // 90 × minMult=0.6
const CROW_SPEED_MAX    = 100;
const CROW_SPRITE_BASE  = 180;   // px base (0.12 × 180 = 22px demi-côté au plateau)
const CROW_SCALE_MID    = 0.12;  // valeur plateau (t 0.1→0.9)
const CROW_SCALE_EDGE   = 0.03;  // valeur aux bords

function makeCrow(w: number, h: number, speedFactor: number): CrowParticle {
  // baseSpeed = vitesse à speed=1, individuelle par particule (minMult 0.6)
  const baseSpeed = CROW_SPEED_MIN + Math.random() * (CROW_SPEED_MAX - CROW_SPEED_MIN);

  // Direction aléatoire (rotationStatic 0-359°)
  const angle = Math.random() * Math.PI * 2;
  const dirX  = Math.cos(angle);
  const dirY  = Math.sin(angle);

  // Vitesse appliquée au spawn avec le facteur courant
  const rawSpeed = baseSpeed * speedFactor;
  const vx = dirX * rawSpeed;
  const vy = dirY * rawSpeed;

  // Spawn depuis les bords (DefaultRectangleSpawnMixin)
  let x: number, y: number;
  const border = Math.floor(Math.random() * 4);
  if      (border === 0) { x = Math.random() * w; y = -50; }
  else if (border === 1) { x = Math.random() * w; y = h + 50; }
  else if (border === 2) { x = -50;               y = Math.random() * h; }
  else                   { x = w + 50;             y = Math.random() * h; }

  // Durée de vie de base (20-40s) — sera recalculée dynamiquement via speedFactor
  const baseLifetimeSec = 20 + Math.random() * 20;

  const wobblePeriod = 5 + Math.random() * 5;
  const perpX = -dirY;  // vecteur perpendiculaire
  const perpY =  dirX;

  return {
    type: 'crow',
    x, y, vx, vy,
    baseSpeed,
    dirX, dirY,
    size: CROW_SCALE_MID * CROW_SPRITE_BASE,
    lifeNorm: 0,
    lifeInc: 1 / (baseLifetimeSec / speedFactor),
    alpha: 0,
    animTime: Math.random() * (CROW_ANIM_TOTAL / CROW_FRAMERATE),
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp: 0,
    wobblePeriod,
    perpX, perpY,
  };
}

// ─── Calcul alpha FXMaster par courbe de keyframes ───────────────────────────

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

const CLOUD_ALPHA_LIST = [
  { time: 0,    value: 0   },
  { time: 0.05, value: CLOUD_ALPHA_MAX },
  { time: 0.95, value: CLOUD_ALPHA_MAX },
  { time: 1,    value: 0   },
];

const CROW_ALPHA_LIST = [
  { time: 0,    value: 0 },
  { time: 0.02, value: 1 },
  { time: 0.98, value: 1 },
  { time: 1,    value: 0 },
];

// ─── Calcul taille corbeau selon courbe de scale FXMaster ────────────────────
// [0.03@0, 0.12@0.1, 0.12@0.9, 0.03@1]

const CROW_SCALE_LIST = [
  { time: 0,   value: CROW_SCALE_EDGE },
  { time: 0.1, value: CROW_SCALE_MID  },
  { time: 0.9, value: CROW_SCALE_MID  },
  { time: 1,   value: CROW_SCALE_EDGE },
];

function interpScale(t: number): number {
  const list = CROW_SCALE_LIST;
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1];
    if (clamped >= a.time && clamped <= b.time) {
      const u = (clamped - a.time) / (b.time - a.time);
      return a.value + (b.value - a.value) * u;
    }
  }
  return CROW_SCALE_EDGE;
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
    const avgLifetime = diagonal / avgSpeed;
    frequency = avgLifetime / maxParticles;
  } else {
    // crows
    maxParticles = Math.max(2, Math.round(densityFactor * 6));
    const avgLifetime = (20 + 40) / 2 / speedFactor;
    frequency = avgLifetime / maxParticles;
  }

  // Init avec particules dispersées aléatoirement
  const particles: AnyParticle[] = Array.from({ length: maxParticles }, () =>
    effect.type === 'clouds'
      ? { ...makeCloud(w, h, speedFactor, false), lifeNorm: Math.random() }
      : { ...makeCrow(w, h, speedFactor),          lifeNorm: Math.random() }
  );

  return { effect, particles, maxParticles, frequency, spawnAccum: 0 };
}

// ─── Composant React ─────────────────────────────────────────────────────────

export function VTTWeatherOverlay({ effects, width, height }: VTTWeatherOverlayProps) {
  const canvasScreenRef = useRef<HTMLCanvasElement>(null); // clouds → screen 
  const canvasNormalRef = useRef<HTMLCanvasElement>(null); // crows  → normal
  const layersRef   = useRef<WeatherLayer[]>([]);
  const rafRef      = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  
  // Sync layers quand effects change
  useEffect(() => {
    const activeTypes = effects.map(e => e.type);

    // Supprimer les layers devenus inactifs
    layersRef.current = layersRef.current.filter(l => activeTypes.includes(l.effect.type));

    // Ajouter ou mettre à jour
    for (const effect of effects) {
      if (effect.type !== 'clouds' && effect.type !== 'crows') continue;

      const existing = layersRef.current.find(l => l.effect.type === effect.type);
      if (existing) {
        // Recalculer frequency/maxParticles si sliders ont changé
        const speedFactor   = effect.speed;
        const densityFactor = effect.density;
        existing.effect = effect;

        if (effect.type === 'clouds') {
          const newMax      = Math.max(2, Math.round(densityFactor * 8));
          const avgSpeed    = ((CLOUD_SPEED_MIN + CLOUD_SPEED_MAX) / 2) * speedFactor;
          const diagonal    = Math.sqrt(width * width + height * height);
          const avgLifetime = diagonal / avgSpeed;
          existing.maxParticles = newMax;
          existing.frequency    = avgLifetime / newMax;
        } else {
          const newMax      = Math.max(2, Math.round(densityFactor * 6));
          const avgLifetime = (20 + 40) / 2 / speedFactor;
          existing.maxParticles = newMax;
          existing.frequency    = avgLifetime / newMax;
        }
 
        // Ajuster le nombre de particules si density a changé
        while (existing.particles.length < existing.maxParticles) {
          existing.particles.push(
            effect.type === 'clouds'
              ? makeCloud(width, height, effect.speed, false)
              : makeCrow(width, height, effect.speed)
          );
        }
        if (existing.particles.length > existing.maxParticles) {
          existing.particles.splice(existing.maxParticles);
        }
      } else {
        layersRef.current.push(buildLayer(effect, width, height));
      }
    }
  }, [effects, width, height]);

  // Boucle d'animation
  useEffect(() => {
    const canvasScreen = canvasScreenRef.current;
    const canvasNormal = canvasNormalRef.current;
    // Au moins un canvas doit être monté
    if (!canvasScreen && !canvasNormal) return;
    const ctxScreen = canvasScreen?.getContext('2d') ?? null;
    const ctxNormal = canvasNormal?.getContext('2d') ?? null;
    if (!ctxScreen && !ctxNormal) return;
 
    const animate = (time: number) => {
      const dtMs = time - (lastTimeRef.current || time);
      lastTimeRef.current = time;
      const dt = Math.min(dtMs / 1000, 0.1); // secondes, max 100ms

      ctxScreen?.clearRect(0, 0, width, height);
      ctxNormal?.clearRect(0, 0, width, height);

      for (const layer of layersRef.current) {
        const { effect, particles } = layer;
        if (effect.type !== 'clouds' && effect.type !== 'crows') continue;
        // clouds → ctxScreen (mixBlendMode: screen)
        // crows  → ctxNormal (mixBlendMode: normal)
          const ctx = effect.type === 'clouds' ? ctxScreen : ctxNormal;
        if (!ctx) continue;

        // Spawn
        layer.spawnAccum += dt;
        while (layer.spawnAccum >= layer.frequency && particles.length < layer.maxParticles) {
          layer.spawnAccum -= layer.frequency;
          particles.push(
            effect.type === 'clouds'
              ? makeCloud(width, height, effect.speed, true)
              : makeCrow(width, height, effect.speed)
          );
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

          if (p.type === 'cloud') {
            // ── Cloud ──────────────────────────────────────────
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.alpha = fxAlpha(p.lifeNorm, effect.alpha, CLOUD_ALPHA_LIST);

            const img = loadImg(p.imgSrc);
            if (!img.complete || img.naturalWidth === 0) continue;

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
            ctx.drawImage(img, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
            ctx.restore();

                  } else {
            // ── Crow ─────��─────────────────────────────────────
            // FXMaster _applySpeedToConfig : vitesse × factor, lifetime / factor
            const currentSpeed = p.baseSpeed * effect.speed;
            p.vx = p.dirX * currentSpeed;
            p.vy = p.dirY * currentSpeed;
            // lifeInc recalculé dynamiquement (lifetime de base ÷ speed)
            // On stocke la baseLifetime dans lifeInc à speed=1, on la récupère
            p.lifeInc = effect.speed / (1 / p.lifeInc / (1 / effect.speed) * effect.speed);
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.animTime += dt;

            p.alpha = fxAlpha(p.lifeNorm, effect.alpha, CROW_ALPHA_LIST);

            // Taille selon la courbe de scale FXMaster
            const scaledSize = interpScale(p.lifeNorm) * CROW_SPRITE_BASE;

            // Frame d'animation (flipbook 32 frames à 15fps, en boucle)
            const frameIdx = Math.floor(p.animTime * CROW_FRAMERATE) % CROW_ANIM_TOTAL;
            const texIdx   = CROW_ANIM_SEQUENCE[frameIdx];
            const img      = loadImg(CROW_SRCS[texIdx]);
            if (!img.complete || img.naturalWidth === 0) continue;

            // Orientation selon la direction de vol
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            const angle = speed > 0 ? Math.atan2(p.vy, p.vx) : 0;

            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
            ctx.translate(p.x, p.y);
            ctx.rotate(angle);
            ctx.drawImage(img, -scaledSize, -scaledSize, scaledSize * 2, scaledSize * 2);
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
    </>
  );
} 