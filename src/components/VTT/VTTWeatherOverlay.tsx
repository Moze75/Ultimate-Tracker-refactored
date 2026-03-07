/**
 * VTTWeatherOverlay
 * Canvas overlay pour les effets atmosphériques / météo.
 * Inspiré de FXMaster (gambit07) — https://github.com/gambit07/fxmaster
 * Implémentation Canvas 2D pure, indépendante de PIXI/Foundry.
 */
import { useEffect, useRef } from 'react';
import type { VTTWeatherEffect, VTTWeatherType } from '../../types/vtt';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  rotation: number;
  rotSpeed: number;
  color: string;
  wobble: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  spriteSrc?: string;
}

interface WeatherLayer {
  effect: VTTWeatherEffect;
  particles: Particle[];
}

interface VTTWeatherOverlayProps {
  effects: VTTWeatherEffect[];
  width: number;
  height: number;
}

// ─── Configs par type ───────────────────────────────────────────────────────

function getParticleConfig(type: VTTWeatherType, w: number, h: number, density: number, speed: number, alpha: number) {
  const count = Math.floor(density * 80);
  switch (type) {
    case 'rain':
      return { count, factory: (i: number): Particle => ({
        x: Math.random() * (w + 200) - 100,
        y: Math.random() * h,
        vx: -1.5 * speed, vy: (8 + Math.random() * 4) * speed,
        size: 6 + Math.random() * 6,
        alpha: (0.4 + Math.random() * 0.4) * alpha,
        life: Math.random(), maxLife: 1,
        rotation: Math.atan2(8 * speed, -1.5 * speed),
        rotSpeed: 0,
        color: '#a8c8ff',
        wobble: 0, wobbleSpeed: 0, wobbleAmp: 0,
        spriteSrc: DROP_SRC,
      })};
    case 'acid-rain':
      return { count, factory: (): Particle => ({
        x: Math.random() * (w + 200) - 100,
        y: Math.random() * h,
        vx: -1.5 * speed, vy: (8 + Math.random() * 4) * speed,
        size: 1 + Math.random() * 1.5,
        alpha: (0.5 + Math.random() * 0.4) * alpha,
        life: Math.random(), maxLife: 1,
        rotation: 0, rotSpeed: 0,
        color: '#39ff14',
        wobble: 0, wobbleSpeed: 0, wobbleAmp: 0,
      })};
    case 'sunshower':
      return { count: Math.floor(count * 0.4), factory: (): Particle => ({
        x: Math.random() * (w + 200) - 100,
        y: Math.random() * h,
        vx: -1 * speed, vy: (5 + Math.random() * 3) * speed,
        size: 0.8 + Math.random(),
        alpha: (0.25 + Math.random() * 0.3) * alpha,
        life: Math.random(), maxLife: 1,
        rotation: 0, rotSpeed: 0,
        color: '#ffe066',
        wobble: 0, wobbleSpeed: 0, wobbleAmp: 0,
      })};
    case 'snow':
      return { count: Math.floor(count * 0.6), factory: (): Particle => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (-0.5 + Math.random()) * speed,
        vy: (0.8 + Math.random() * 1.2) * speed,
        size: 2 + Math.random() * 3,
        alpha: (0.5 + Math.random() * 0.4) * alpha,
        life: Math.random(), maxLife: 1,
        rotation: 0, rotSpeed: 0,
        color: '#ffffff',
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.02,
        wobbleAmp: 0.5 + Math.random() * 1.5,
      })};
    case 'blizzard':
      return { count: Math.floor(count * 1.8), factory: (): Particle => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (-3 - Math.random() * 3) * speed,
        vy: (1.5 + Math.random() * 2) * speed,
        size: 1.5 + Math.random() * 2.5,
        alpha: (0.4 + Math.random() * 0.5) * alpha,
        life: Math.random(), maxLife: 1,
        rotation: 0, rotSpeed: 0,
        color: '#ddeeff',
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.04 + Math.random() * 0.04,
        wobbleAmp: 1 + Math.random() * 2,
      })};
    case 'fog':
      return { count: Math.floor(density * 12), factory: (): Particle => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (0.2 + Math.random() * 0.3) * speed,
        vy: (-0.05 + Math.random() * 0.1) * speed,
        size: 80 + Math.random() * 120,
        alpha: (0.04 + Math.random() * 0.06) * alpha,
        life: Math.random(), maxLife: 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.002,
        color: '#c8d8e8',
        wobble: 0, wobbleSpeed: 0, wobbleAmp: 0,
        spriteSrc: CLOUD_SRCS[Math.floor(Math.random() * CLOUD_SRCS.length)],
      })};
    case 'embers':
      return { count, factory: (): Particle => ({
        x: Math.random() * w,
        y: h + 10,
        vx: (-1 + Math.random() * 2) * speed,
        vy: -(1.5 + Math.random() * 3) * speed,
        size: 6 + Math.random() * 8,
        alpha: (0.6 + Math.random() * 0.4) * alpha,
        life: Math.random(), maxLife: 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        color: Math.random() > 0.5 ? '#ff6600' : '#ffaa00',
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.04 + Math.random() * 0.06,
        wobbleAmp: 1 + Math.random() * 2,
        spriteSrc: EMBER_SRC,
      })};
    case 'crows':
      return { count: Math.floor(density * 8), factory: (): Particle => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (1.2 + Math.random() * 1.5) * speed,
        vy: (-0.3 + Math.random() * 0.6) * speed,
        size: 20 + Math.random() * 25,
        alpha: 0,
        life: Math.random(), maxLife: 1,
        rotation: 0,
        rotSpeed: 0,
        color: '#222222',
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.5 + Math.random() * 0.5,
        wobbleAmp: 8 + Math.random() * 12,
        spriteSrc: CROW_SRCS[Math.floor(Math.random() * CROW_SRCS.length)],
      })};
    case 'clouds':
      return { count: Math.floor(density * 8), factory: (): Particle => ({
        x: -200 + Math.random() * (w + 400),
        y: Math.random() * h * 0.6,
        vx: (30 + Math.random() * 70) * speed / 60,
        vy: (-0.5 + Math.random()) * speed / 60,
        size: (80 + Math.random() * 200) * (0.08 + Math.random() * 0.72),
        alpha: 0,
        life: 0,
        maxLife: 1,
        rotation: 0,
        rotSpeed: 0,
        color: '#ffffff',
        wobble: 0, wobbleSpeed: 0, wobbleAmp: 0,
        spriteSrc: CLOUD_SRCS[Math.floor(Math.random() * CLOUD_SRCS.length)],
      })};
    case 'leaves':
    case 'leaves':
      return { count: Math.floor(count * 0.4), factory: (): Particle => ({
        x: Math.random() * w,
        y: -10,
        vx: (-1 + Math.random() * 2) * speed,
        vy: (0.8 + Math.random() * 1.5) * speed,
        size: 4 + Math.random() * 6,
        alpha: (0.6 + Math.random() * 0.4) * alpha,
        life: Math.random(), maxLife: 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        color: ['#c8520a', '#e87020', '#6aaa20', '#8b5e0a'][Math.floor(Math.random() * 4)],
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.03,
        wobbleAmp: 1.5 + Math.random() * 2,
      })};
    case 'sandstorm':
      return { count: Math.floor(count * 1.5), factory: (): Particle => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (3 + Math.random() * 4) * speed,
        vy: (-0.5 + Math.random()) * speed,
        size: 1 + Math.random() * 2,
        alpha: (0.3 + Math.random() * 0.4) * alpha,
        life: Math.random(), maxLife: 1,
        rotation: 0, rotSpeed: 0,
        color: '#d4a050',
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.02,
        wobbleAmp: 0.5 + Math.random(),
      })};
    case 'bubbles':
      return { count: Math.floor(count * 0.3), factory: (): Particle => ({
        x: Math.random() * w,
        y: h + 10,
        vx: (-0.3 + Math.random() * 0.6) * speed,
        vy: -(0.5 + Math.random() * 1.5) * speed,
        size: 3 + Math.random() * 8,
        alpha: (0.2 + Math.random() * 0.3) * alpha,
        life: Math.random(), maxLife: 1,
        rotation: 0, rotSpeed: 0,
        color: '#80c8ff',
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.03,
        wobbleAmp: 1 + Math.random() * 2,
      })};
    case 'spiderwebs':
      return { count: Math.floor(density * 6), factory: (): Particle => ({
        x: Math.random() * w,
        y: -20,
        vx: 0,
        vy: (0.2 + Math.random() * 0.5) * speed,
        size: 6 + Math.random() * 10,
        alpha: (0.3 + Math.random() * 0.4) * alpha,
        life: Math.random(), maxLife: 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.01,
        color: '#c8c8c8',
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.01,
        wobbleAmp: 0.5,
      })};
    case 'magiccrystals':
      return { count: Math.floor(count * 0.3), factory: (): Particle => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (-0.3 + Math.random() * 0.6) * speed,
        vy: (-0.5 - Math.random() * 0.5) * speed,
        size: 3 + Math.random() * 5,
        alpha: (0.4 + Math.random() * 0.5) * alpha,
        life: Math.random(), maxLife: 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.03,
        color: ['#a78bfa', '#c084fc', '#818cf8', '#38bdf8'][Math.floor(Math.random() * 4)],
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.02,
        wobbleAmp: 0.5 + Math.random(),
      })};
    case 'magicstars':
      return { count: Math.floor(count * 0.4), factory: (): Particle => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (-0.2 + Math.random() * 0.4) * speed,
        vy: (-0.2 + Math.random() * 0.4) * speed,
        size: 2 + Math.random() * 3,
        alpha: 0,
        life: Math.random(), maxLife: 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04,
        color: ['#fde68a', '#fbcfe8', '#bfdbfe', '#ffffff'][Math.floor(Math.random() * 4)],
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.03 + Math.random() * 0.03,
        wobbleAmp: 0,
      })};
    default:
      return { count: 0, factory: (): Particle => ({} as Particle) };
  }
}

// ─── Update particle position ────────────────────────────────────────────────

function updateParticle(p: Particle, type: VTTWeatherType, w: number, h: number, dt: number, speed: number, alpha: number) {
  p.wobble += p.wobbleSpeed * dt;
  const wobbleX = Math.sin(p.wobble) * p.wobbleAmp;
  p.x += (p.vx + wobbleX) * dt;
  p.y += p.vy * dt;
  p.rotation += p.rotSpeed * dt;
  p.life += dt / 60;

  // fade in/out pour magicstars (FXMaster : 0→0.9→0.9→0)
  if (type === 'magicstars') {
    const t = p.life % 1;
    p.alpha = t < 0.3 ? (t / 0.3) * alpha : t > 0.7 ? ((1 - t) / 0.3) * alpha : alpha;
  }
  // FXMaster CLOUDS_CONFIG alpha : 0→0.5→0.5→0 (times: 0, 0.05, 0.95, 1)
  if (type === 'clouds') {
    const t = p.life % 1;
    if (t < 0.05) p.alpha = (t / 0.05) * 0.5 * alpha;
    else if (t < 0.95) p.alpha = 0.5 * alpha;
    else p.alpha = ((1 - t) / 0.05) * 0.5 * alpha;
  }
  // Crows : fade in/out rapide (0→1→1→0 sur les bords)
  if (type === 'crows') {
    const t = p.life % 1;
    p.alpha = t < 0.05 ? (t / 0.05) * alpha : t > 0.95 ? ((1 - t) / 0.05) * alpha : alpha;
  }

  // respawn
  const margin = p.size + 10;
  if (p.y > h + margin || p.y < -margin || p.x > w + margin || p.x < -margin || p.life > 1) {
    respawn(p, type, w, h, speed, alpha);
  }
}

function respawn(p: Particle, type: VTTWeatherType, w: number, h: number, speed: number, alpha: number) {
  p.life = 0;
  switch (type) {
    case 'rain': case 'acid-rain': case 'sunshower':
      p.x = Math.random() * (w + 200) - 100; p.y = -10; break;
    case 'snow': case 'blizzard':
      p.x = Math.random() * (w + 100); p.y = -10; break;
    case 'fog':
      p.x = -p.size; p.y = Math.random() * h; break;
    case 'embers': case 'bubbles':
      p.x = Math.random() * w; p.y = h + 10; break;
    case 'leaves': case 'spiderwebs':
      p.x = Math.random() * w; p.y = -20; break;
    case 'sandstorm':
      p.x = -10; p.y = Math.random() * h; break;
    case 'clouds':
      p.x = -p.size - 10; p.y = Math.random() * h; break;
    case 'crows':
      p.x = -p.size - 10; p.y = Math.random() * h; break;
    case 'magiccrystals': case 'magicstars':
      p.x = Math.random() * w; p.y = Math.random() * h; break;
  }
}

// ─── Draw particle ───────────────────────────────────────────────────────────

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, type: VTTWeatherType) {
  // ── Rendu sprite webp si disponible (Moze75/Ultimate_Tracker assets) ──
  if (p.spriteSrc) {
    const img = loadImg(p.spriteSrc);
    if (img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.drawImage(img, -p.size, -p.size, p.size * 2, p.size * 2);
      ctx.restore();
      return; // skip rendu procédural
    }
    // image pas encore chargée → fallback procédural ci-dessous
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);

  switch (type) {
    case 'rain': case 'acid-rain': case 'sunshower': {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(p.vx * 0.8, p.vy * 0.8);
      ctx.stroke();
      break;
    }
    case 'snow': case 'blizzard': {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'fog': {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
      grad.addColorStop(0, p.color + 'ff');
      grad.addColorStop(1, p.color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'embers': {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, p.color);
      grad.addColorStop(1, p.color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'leaves': {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'sandstorm': {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bubbles': {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.stroke();
      // reflet
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'spiderwebs': {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 0.5;
      const r = p.size;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
      for (let ring = 1; ring <= 3; ring++) {
        const rr = (ring / 3) * r;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      break;
    }
    case 'magiccrystals': {
      ctx.fillStyle = p.color;
      ctx.shadowBlur = p.size * 2;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(p.size * 0.5, 0);
      ctx.lineTo(0, p.size);
      ctx.lineTo(-p.size * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case 'magicstars': {
      ctx.fillStyle = p.color;
      ctx.shadowBlur = p.size * 3;
      ctx.shadowColor = p.color;
      const spikes = 4;
      const outer = p.size, inner = p.size * 0.4;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? outer : inner;
        i === 0 ? ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
                : ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
  }
  ctx.restore();
}

// ─── Composant principal ─────────────────────────────────────────────────────

// ─── Assets sprites (Moze75/Ultimate_Tracker) ────────────────────────────────
const ASSETS = 'https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/';
const CLOUD_SRCS = [1, 2, 3].map(n => `${ASSETS}cloud${n}.webp`);
const CROW_SRCS  = [1, 3, 4].map(n => `${ASSETS}crow${n}.webp`);
const EMBER_SRC  = `${ASSETS}ember.webp`;
const DROP_SRC   = `${ASSETS}drop.webp`;

const _imgCache = new Map<string, HTMLImageElement>();
function loadImg(src: string): HTMLImageElement {
  if (!_imgCache.has(src)) {
    const img = new Image();
    img.src = src;
    _imgCache.set(src, img);
  }
  return _imgCache.get(src)!;
}

export function VTTWeatherOverlay({ effects, width, height }: VTTWeatherOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef<WeatherLayer[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Sync layers quand effects change
  useEffect(() => {
    layersRef.current = effects.map(effect => {
      const existing = layersRef.current.find(l => l.effect.type === effect.type);
      if (existing) {
        existing.effect = effect;
        return existing;
      }
      const cfg = getParticleConfig(effect.type, width, height, effect.density, effect.speed, effect.alpha);
      return {
        effect,
        particles: Array.from({ length: cfg.count }, (_, i) => cfg.factory(i)),
      };
    });
  }, [effects, width, height]);

  // Boucle d'animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = (time: number) => {
      const dt = Math.min((time - (lastTimeRef.current || time)) / 16.67, 3);
      lastTimeRef.current = time;

      ctx.clearRect(0, 0, width, height);

      for (const layer of layersRef.current) {
        const { effect, particles } = layer;
        for (const p of particles) {
          updateParticle(p, effect.type, width, height, dt, effect.speed, effect.alpha);
          drawParticle(ctx, p, effect.type);
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