/**
 * VTTWeatherOverlay
 * Canvas overlay — effet Nuages uniquement.
 * Inspiré de FXMaster (gambit07) — https://github.com/gambit07/fxmaster
 * Implémentation Canvas 2D pure, indépendante de PIXI/Foundry.
 */
import { useEffect, useRef } from 'react';
import type { VTTWeatherEffect, VTTWeatherType } from '../../types/vtt';

// ─── Assets FXMaster (crédits : gambit07/fxmaster) ───────────────────────────
const FXMASTER_BASE =
  'https://raw.githubusercontent.com/gambit07/fxmaster/main/assets/particle-effects/effects';
const CLOUD_SRCS = [1, 2, 3, 4].map(n => `${FXMASTER_BASE}/clouds/cloud${n}.webp`);

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
// Précharger les images au démarrage du module
CLOUD_SRCS.forEach(loadImg);

// ─── Types ───────────────────────────────────────────────────────────────────

interface CloudParticle {
  x: number;       // position px écran
  y: number;
  vx: number;      // vitesse px/s
  vy: number;
  size: number;    // demi-côté du sprite en px
  lifeNorm: number; // 0 → 1 (0 = spawn, 1 = mort)
  lifeInc: number; // incrément par seconde (= 1 / lifetimeSec)
  alpha: number;   // alpha calculé chaque frame
  imgSrc: string;
}

interface WeatherLayer {
  effect: VTTWeatherEffect;
  particles: CloudParticle[];
  // paramètres calculés depuis les sliders
  baseSpeedPx: number;   // vitesse px/s à density=1, speed=1
  maxParticles: number;
  frequency: number;     // s entre chaque spawn
  spawnAccum: number;    // accumulateur pour le spawn
}

interface VTTWeatherOverlayProps {
  effects: VTTWeatherEffect[];
  width: number;
  height: number;
}

// ─── FXMaster Clouds : valeurs de base (reproduites depuis clouds.js) ────────
// moveSpeedStatic : min=30, max=100 px/s (à scale=1, grid=100px)
// scaleStatic     : min=0.08, max=0.8 → taille sprite = scale * 1000px de base
// rotationStatic  : min=80, max=100° → direction ≈ 90° (gauche→droite)
// alpha list      : [0@0, 0.5@0.05, 0.5@0.95, 0@1]

const CLOUD_SPEED_MIN = 30;   // px/s
const CLOUD_SPEED_MAX = 100;  // px/s
const CLOUD_SCALE_MIN = 0.08;
const CLOUD_SCALE_MAX = 0.80;
const CLOUD_SPRITE_BASE = 600; // px de base pour scale=1 (ajusté pour Canvas 2D sans PIXI grid)
const CLOUD_ALPHA_MAX  = 0.5; // valeur max dans la liste alpha FXMaster

function makeCloudParticle(
  w: number,
  h: number,
  speedFactor: number,
  alphaFactor: number,
  spawnLeft: boolean,   // true = spawn hors écran à gauche, false = spawn aléatoire (init)
): CloudParticle {
  // vitesse individuelle (moveSpeedStatic min-max) × speed slider
  const rawSpeed = (CLOUD_SPEED_MIN + Math.random() * (CLOUD_SPEED_MAX - CLOUD_SPEED_MIN)) * speedFactor;

  // scale individuel (scaleStatic min-max) × density slider n'affecte pas la taille, juste le nombre
  const scale = CLOUD_SCALE_MIN + Math.random() * (CLOUD_SCALE_MAX - CLOUD_SCALE_MIN);
  const size  = scale * CLOUD_SPRITE_BASE;

  // direction ≈ 90° = cos(90°)=0, sin(90°)=1 → mais FXMaster oriente EN PIXELS/S horizontal
  // rotationStatic 80-100° dans PIXI = angle de déplacement en degrés (0°=droite, 90°=bas)
  // En pratique les nuages vont de gauche à droite (rotation 90° = est en PIXI coords)
  // On garde vx = rawSpeed, vy = petit bruit vertical
  const vx = rawSpeed;
  const vy = (-0.3 + Math.random() * 0.6) * rawSpeed * 0.05; // léger dérive verticale

  // durée de vie = distance à parcourir / vitesse (FXMaster calcule diagonal / avgSpeed)
  const travelDist = w + size * 2; // traversée complète
  const lifetimeSec = travelDist / rawSpeed;

  // position initiale
  let x: number, y: number;
  if (spawnLeft) {
    x = -size - 10;
    y = Math.random() * h * 0.75; // nuages dans les 3/4 supérieurs
  } else {
    // init : dispersion aléatoire sur toute la scène, life aléatoire
    x = -size + Math.random() * (w + size);
    y = Math.random() * h * 0.75;
  }

  return {
    x, y, vx, vy,
    size,
    lifeNorm: spawnLeft ? 0 : Math.random(),
    lifeInc: 1 / lifetimeSec,
    alpha: 0,
    imgSrc: CLOUD_SRCS[Math.floor(Math.random() * CLOUD_SRCS.length)],
  };
}

function buildCloudsLayer(
  effect: VTTWeatherEffect,
  w: number,
  h: number,
): WeatherLayer {
  const speedFactor  = effect.speed;   // slider 0.1 → 3
  const densityFactor = effect.density; // slider 0.1 → 3
  const alphaFactor  = effect.alpha;   // slider 0 → 1

  // FXMaster: maxParticles ∝ density
  const maxParticles = Math.max(2, Math.round(densityFactor * 8));

  // FXMaster: frequency = avgLifetime / maxParticles
  const avgSpeed    = ((CLOUD_SPEED_MIN + CLOUD_SPEED_MAX) / 2) * speedFactor;
  const diagonal    = Math.sqrt(w * w + h * h);
  const avgLifetime = diagonal / avgSpeed;
  const frequency   = avgLifetime / maxParticles; // secondes entre spawns

  // Créer les particules initiales avec life aléatoire (dispersion)
  const particles = Array.from({ length: maxParticles }, () =>
    makeCloudParticle(w, h, speedFactor, alphaFactor, false)
  );

  return {
    effect,
    particles,
    baseSpeedPx: avgSpeed,
    maxParticles,
    frequency,
    spawnAccum: 0,
  };
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function VTTWeatherOverlay({ effects, width, height }: VTTWeatherOverlayProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const layersRef  = useRef<WeatherLayer[]>([]);
  const rafRef     = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // ── Sync layers quand effects change ────────────────────────────────────
  useEffect(() => {
    const cloudsEffect = effects.find(e => e.type === 'clouds');

    if (!cloudsEffect) {
      layersRef.current = [];
      return;
    }

    const existing = layersRef.current.find(l => l.effect.type === 'clouds');
    if (existing) {
      // Mettre à jour les paramètres sans recréer les particules
      // FXMaster recalcule frequency/maxParticles à la volée
      const speedFactor   = cloudsEffect.speed;
      const densityFactor = cloudsEffect.density;
      const avgSpeed      = ((CLOUD_SPEED_MIN + CLOUD_SPEED_MAX) / 2) * speedFactor;
      const diagonal      = Math.sqrt(width * width + height * height);
      const avgLifetime   = diagonal / avgSpeed;
      const newMax        = Math.max(2, Math.round(densityFactor * 8));
      existing.effect     = cloudsEffect;
      existing.maxParticles = newMax;
      existing.frequency  = avgLifetime / newMax;
      // Ajuster le nombre de particules si density a changé
      while (existing.particles.length < newMax) {
        existing.particles.push(makeCloudParticle(width, height, speedFactor, cloudsEffect.alpha, false));
      }
      if (existing.particles.length > newMax) {
        existing.particles.splice(newMax);
      }
    } else {
      layersRef.current = [buildCloudsLayer(cloudsEffect, width, height)];
    }
  }, [effects, width, height]);

  // ── Boucle d'animation ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = (time: number) => {
      const dtMs = time - (lastTimeRef.current || time);
      lastTimeRef.current = time;
      const dt = Math.min(dtMs / 1000, 0.1); // dt en secondes, max 100ms

      ctx.clearRect(0, 0, width, height);

      for (const layer of layersRef.current) {
        if (layer.effect.type !== 'clouds') continue;

        const { effect, particles } = layer;
        const speedFactor = effect.speed;
        const alphaFactor = effect.alpha;

        // ── Spawn de nouvelles particules (FXMaster: frequency) ──────────
        layer.spawnAccum += dt;
        while (layer.spawnAccum >= layer.frequency && particles.length < layer.maxParticles) {
          layer.spawnAccum -= layer.frequency;
          particles.push(makeCloudParticle(width, height, speedFactor, alphaFactor, true));
        }
        if (layer.spawnAccum > layer.frequency) layer.spawnAccum = 0;

        // ── Update + Draw chaque particule ────────────────────────────────
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];

          // Avancer la vie (FXMaster: lifeNorm = elapsed / lifetime)
          p.lifeNorm += p.lifeInc * dt;

          // Si speed a changé via slider, recalculer la vitesse
          // (on ne recrée pas la particule mais on l'ajuste proportionnellement)
          // NB : la vitesse de base a été fixée au spawn → on applique juste le ratio

          // Déplacer
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          // Alpha selon la courbe FXMaster : [0@0, 0.5@0.05, 0.5@0.95, 0@1]
          const t = Math.min(1, Math.max(0, p.lifeNorm));
          let rawAlpha: number;
          if      (t < 0.05) rawAlpha = (t / 0.05) * CLOUD_ALPHA_MAX;
          else if (t < 0.95) rawAlpha = CLOUD_ALPHA_MAX;
          else               rawAlpha = ((1 - t) / 0.05) * CLOUD_ALPHA_MAX;
          p.alpha = rawAlpha * alphaFactor;

          // Mort : lifeNorm >= 1
          if (p.lifeNorm >= 1) {
            particles.splice(i, 1);
            continue;
          }

          // Draw
          const img = loadImg(p.imgSrc);
          if (!img.complete || img.naturalWidth === 0) continue; // pas encore chargée

          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
          ctx.drawImage(img, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
          ctx.restore();
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height]);

  if (effects.length === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}