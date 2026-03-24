/**
 * VTTWeatherOverlay
 * Canvas overlay — effets Nuages, Corbeaux, Braises & Brume.
 * Inspiré de FXMaster (gambit07) — https://github.com/gambit07/fxmaster
 *
 * Effets clouds / crows / embers : Canvas 2D pur, indépendant de PIXI/Foundry.
 * Effet fog : WebGL (approche Foundry-like), adaptatif selon les performances.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import type { VTTWeatherEffect } from '../../types/vtt';

// -------------------
// Gestion des assets FXMaster
// -------------------
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

// -------------------
// Gestion de l'animation corbeaux
// -------------------
const CROW_ANIM_SEQUENCE: number[] = [];
for (const { tex, count } of [
  { tex: 0, count: 20 },
  { tex: 1, count: 3 },
  { tex: 2, count: 2 },
  { tex: 3, count: 2 },
  { tex: 2, count: 2 },
  { tex: 1, count: 3 },
]) {
  for (let i = 0; i < count; i++) CROW_ANIM_SEQUENCE.push(tex);
}
const CROW_ANIM_TOTAL = CROW_ANIM_SEQUENCE.length;
const CROW_FRAMERATE  = 15;

// -------------------
// Gestion des types particules
// -------------------
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

interface RainParticle {
  type: 'rain';
  x: number; y: number;
  vx: number; vy: number;
  len: number;
  alpha: number;
  lifeNorm: number;
  lifeInc: number;
}

type AnyParticle = CloudParticle | CrowParticle | EmberParticle | RainParticle;

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

// -------------------
// Gestion des constantes clouds
// -------------------
const CLOUD_SPEED_MIN   = 30;
const CLOUD_SPEED_MAX   = 100;
const CLOUD_SCALE_MIN   = 0.08;
const CLOUD_SCALE_MAX   = 0.80;
const CLOUD_SPRITE_BASE = 600;
const CLOUD_ALPHA_MAX   = 0.5;

const CLOUD_ALPHA_LIST = [
  { time: 0,    value: 0 },
  { time: 0.05, value: CLOUD_ALPHA_MAX },
  { time: 0.95, value: CLOUD_ALPHA_MAX },
  { time: 1,    value: 0 },
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

function makeRain(w: number, h: number, speedFactor: number): RainParticle {
  // -------------------
  // gestion de la direction pluie : ciel -> sol (verticale avec légère dérive)
  // -------------------
  const drift = (Math.random() * 0.16 - 0.08); // petite inclinaison gauche/droite
  const fallY = (900 + Math.random() * 500) * speedFactor;
  const fallX = fallY * drift;

  return {
    type: 'rain',
    // spawn sur toute la largeur + marge pour inclinaison
    x: Math.random() * (w + 120) - 60,
    y: -Math.random() * (h * 0.35) - 20,
    vx: fallX,
    vy: fallY,
    len: 10 + Math.random() * 18,
    alpha: 0.55,
    lifeNorm: 0,
    lifeInc: 0
  };
}

// -------------------
// Gestion des constantes corbeaux
// -------------------
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
  { time: 0.1, value: CROW_SCALE_MID },
  { time: 0.9, value: CROW_SCALE_MID },
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
  else if (border === 2) { x = -50; y = Math.random() * h; }
  else                   { x = w + 50; y = Math.random() * h; }

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
    perpY: dirX,
  };
}

// -------------------
// Gestion des constantes braises
// -------------------
const EMBER_SPEED_MIN   = 24;
const EMBER_SPEED_MAX   = 40;
const EMBER_SPRITE_BASE = 120;

const EMBER_ALPHA_LIST = [
  { time: 0,    value: 0 },
  { time: 0.3,  value: 0.9 },
  { time: 0.95, value: 0.9 },
  { time: 1,    value: 0 },
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

// -------------------
// Gestion des helpers interpolation
// -------------------
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

// -------------------
// Gestion du build des layers particules
// -------------------
function buildLayer(effect: VTTWeatherEffect, w: number, h: number): WeatherLayer {
  const speedFactor   = effect.speed;
  const densityFactor = effect.density;
  let maxParticles: number;
  let frequency: number;

  if (effect.type === 'clouds') {
    maxParticles = Math.max(2, Math.round(densityFactor * 8));
    const avgSpeed = ((CLOUD_SPEED_MIN + CLOUD_SPEED_MAX) / 2) * speedFactor;
    const diagonal = Math.sqrt(w * w + h * h);
    frequency = (diagonal / avgSpeed) / maxParticles;
  } else if (effect.type === 'embers') {
    maxParticles = Math.max(4, Math.round(densityFactor * 40));
    frequency = (5 / speedFactor) / maxParticles;
  } else {
    maxParticles = Math.max(2, Math.round(densityFactor * 6));
    frequency = (30 / speedFactor) / maxParticles;
  }

const particles: AnyParticle[] = Array.from({ length: maxParticles }, () => {
  if (effect.type === 'clouds') return { ...makeCloud(w, h, speedFactor, false), lifeNorm: Math.random() };
  if (effect.type === 'embers') return makeEmber(w, h, speedFactor);
  if (effect.type === 'rain')   return makeRain(w, h, speedFactor);
  return { ...makeCrow(w, h, speedFactor), lifeNorm: Math.random() };
});

  return { effect, particles, maxParticles, frequency, spawnAccum: 0 };
}

// -------------------
// Gestion du mode performance fog
// -------------------
function detectPerformanceMode(): 0 | 1 | 2 {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const cores    = navigator.hardwareConcurrency ?? 4;
  if (isMobile || cores <= 2) return 0;
  if (cores <= 4) return 1;
  return 2;
}

// -------------------
// Gestion du vertex shader fog
// -------------------
const FOG_VERT_SRC = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// -------------------
// Gestion du fragment shader fog (Foundry-like)
// -------------------
function buildFogFragSrc(mode: 0 | 1 | 2): string {
  const octaves = mode === 0 ? 6 : mode === 1 ? 8 : 10; // proche rendu FXMaster, modulé perf

  return `
    precision mediump float;

    uniform float time;
    uniform float density;
    uniform float strength;
    uniform vec2  dimensions;
    uniform vec3  color;
    uniform float rotation;
    uniform vec2  uResolution;

    float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453123); }

    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      float a = rand(i + vec2(0.0,0.0));
      float b = rand(i + vec2(1.0,0.0));
      float c = rand(i + vec2(0.0,1.0));
      float d = rand(i + vec2(1.0,1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
    }

    float fbm(vec2 p){
      float v=0.0, a=0.5;
      vec2 shift=vec2(100.0);
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for(int i=0;i<10;i++){
        if (i >= ${octaves}) break;
        v = (sin(v*1.07)) + (a*noise(p));
        p = rot*p*1.9 + shift;
        a *= 0.5;
      }
      return v;
    }

    vec3 applyContrast(vec3 c, float contrast){
      float t=(1.0-contrast)*0.5;
      return c*contrast + vec3(t);
    }

    mat2 rot2(float a) {
      float c = cos(a), s = sin(a);
      return mat2(c, -s, s, c);
    }

    void main(void){
      vec2 uv = gl_FragCoord.xy / uResolution; // 0..1 écran
      uv.y = 1.0 - uv.y;

      // // gestion de l'ancrage "world-like"
      vec2 p = (uv * 8.0 - uv) * dimensions * 0.25;
      if (rotation != 0.0) p = rot2(rotation) * (p - 0.5) + 0.5;

      float t = time * 0.25;

      vec2 q;
      q.x = fbm(p);
      q.y = fbm(p);

      vec2 r;
      r.x = fbm(p*q + vec2(1.7, 9.2) + 0.15*t);
      r.y = fbm(p*q + vec2(9.3, 2.8) + 0.35*t);

      float f = fbm(p*0.2 + r*3.102);

// -------------------
// gestion des trous (version douce, visible)
// -------------------
// -------------------
// gestion densité = couverture (trous)
// -------------------
float d = clamp(density, 0.0, 1.0);      // slider densité
float s = clamp(strength, 0.0, 1.0);     // slider opacité

// bruit principal
float wisps = smoothstep(0.30, 0.85, f);
float breakup = noise(p * 3.0 + vec2(time * 0.03, -time * 0.02));

// seuil piloté par densité:
// - densité faible => seuil haut => beaucoup de trous
// - densité forte  => seuil bas => peu de trous
float coverageThreshold = mix(0.78, 0.32, d);
float coverage = smoothstep(coverageThreshold - 0.12, coverageThreshold + 0.12, wisps);

// micro variation pour casser l'uniformité
float micro = smoothstep(0.30, 0.80, breakup);
float mask = clamp(coverage * (0.80 + 0.20 * micro), 0.0, 1.0);

// couleur indépendante de la couverture
vec3 baseFog = mix(color, vec3(0.90), clamp(abs(r.x), 0.25, 0.70));
vec3 fogRGB  = applyContrast(baseFog * (0.65 + 0.55 * wisps), 1.25);

// opacité ne gère QUE l'intensité visuelle
float k = s * mask;

gl_FragColor = vec4(fogRGB, k);
    }
  `;
}
// -------------------
// Gestion des types internes fog WebGL
// -------------------
interface FogGLState {
  gl:       WebGLRenderingContext;
  program:  WebGLProgram;
uniforms: {
  time:        WebGLUniformLocation | null;
  density:     WebGLUniformLocation | null;
  strength:    WebGLUniformLocation | null;
  dimensions:  WebGLUniformLocation | null;
  color:       WebGLUniformLocation | null;
  rotation:    WebGLUniformLocation | null;
  uResolution: WebGLUniformLocation | null;
};
}

function useFogWebGL(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const glStateRef  = useRef<FogGLState | null>(null);
  const modeRef     = useRef<0 | 1 | 2>(detectPerformanceMode());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha:              true,
      premultipliedAlpha: false,
      antialias:          false,
    });

    if (!gl) {
      console.warn('[VTTFog] WebGL non disponible — effet fog désactivé.');
      return;
    }

    const mode = modeRef.current;

    // -------------------
    // gestion compilation shaders
    // -------------------
    const compileShader = (type: number, src: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('[VTTFog] Erreur compilation shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vert = compileShader(gl.VERTEX_SHADER, FOG_VERT_SRC);
    const frag = compileShader(gl.FRAGMENT_SHADER, buildFogFragSrc(mode));
    if (!vert || !frag) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    gl.deleteShader(vert);
    gl.deleteShader(frag);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[VTTFog] Erreur link program:', gl.getProgramInfoLog(program));
      return;
    }

    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]),
      gl.STATIC_DRAW
    );

    gl.useProgram(program);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.disable(gl.BLEND);

    glStateRef.current = {
      gl,
      program,
uniforms: {
  time:        gl.getUniformLocation(program, 'time'),
  density:     gl.getUniformLocation(program, 'density'),
  strength:    gl.getUniformLocation(program, 'strength'),
  dimensions:  gl.getUniformLocation(program, 'dimensions'),
  color:       gl.getUniformLocation(program, 'color'),
  rotation:    gl.getUniformLocation(program, 'rotation'),
  uResolution: gl.getUniformLocation(program, 'uResolution'),
},
    };

    console.debug(`[VTTFog] WebGL initialisé — mode performance ${mode} (${mode + 2} octaves)`);

    return () => {
      gl.deleteProgram(program);
      gl.deleteBuffer(quadBuf);
      glStateRef.current = null;
    };
  }, []);

  // -------------------
  // gestion du rendu fog
  // -------------------
  const render = useCallback((
    _dt:    number,
    fe:     VTTWeatherEffect,
    width:  number,
    height: number,
  ) => {
    const state = glStateRef.current;
    if (!state) return;
    const { gl, program, uniforms } = state;

    const hex = (fe.color ?? '#ffffff').replace('#', '');
    const tr  = parseInt(hex.slice(0, 2), 16) / 255;
    const tg  = parseInt(hex.slice(2, 4), 16) / 255;
    const tb  = parseInt(hex.slice(4, 6), 16) / 255;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    // -------------------
    // gestion des paramètres d'effet (FXMaster-like fog)
    // -------------------
    const speedVal    = Math.max(0, fe.speed ?? 0.5);
const densityVal  = Math.min(0.85, Math.max(0, fe.density ?? 0.35));
    const strengthVal = Math.min(1, Math.max(0, (fe as any).intensity ?? fe.alpha ?? 1));
    const scaleVal    = Math.max(0.05, (fe as any).scale ?? 1.0);
    const rotation    = (fe as any).rotation ?? 0.0;

    gl.uniform1f(uniforms.time,        (performance.now() / 1000) * speedVal);
    gl.uniform1f(uniforms.density,     densityVal);
    gl.uniform1f(uniforms.strength,    strengthVal);
    gl.uniform2f(uniforms.dimensions,  scaleVal, scaleVal);
    gl.uniform3f(uniforms.color,       tr, tg, tb);
    gl.uniform1f(uniforms.rotation,    rotation);
    gl.uniform2f(uniforms.uResolution, width, height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, []);

  const clear = useCallback((width: number, height: number) => {
    const state = glStateRef.current;
    if (!state) return;
    const { gl } = state;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }, []);

  return { render, clear }; 
}

// -------------------
// Gestion du composant principal
// -------------------
export function VTTWeatherOverlay({ effects, width, height }: VTTWeatherOverlayProps) {
const canvasScreenRef = useRef<HTMLCanvasElement>(null); // clouds
const canvasNormalRef = useRef<HTMLCanvasElement>(null); // crows
const canvasAddRef    = useRef<HTMLCanvasElement>(null); // embers
const canvasRainRef   = useRef<HTMLCanvasElement>(null); // rain
  const canvasFogARef   = useRef<HTMLCanvasElement>(null); // fog A
  const canvasFogBRef   = useRef<HTMLCanvasElement>(null); // fog B (optionnel, style maison)

  // -------------------
  // gestion des 2 couches fog
  // -------------------
const fogGLA = useFogWebGL(canvasFogARef);
const fogGLB = useFogWebGL(canvasFogBRef);

  const effectsRef  = useRef<VTTWeatherEffect[]>(effects);
  const layersRef   = useRef<WeatherLayer[]>([]);
  const rafRef      = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  effectsRef.current = effects;

  // -------------------
  // gestion de la synchro des layers particules
  // -------------------
  useEffect(() => {
    const activeTypes = effects.map(e => e.type);
    layersRef.current = layersRef.current.filter(l => activeTypes.includes(l.effect.type));

    for (const effect of effects) {
if (effect.type !== 'clouds' && effect.type !== 'crows' && effect.type !== 'embers' && effect.type !== 'rain') continue;

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
} else if (effect.type === 'rain') {
  const newMax = Math.max(40, Math.round(densityFactor * 220));
  existing.maxParticles = newMax;
  existing.frequency = (0.5 / Math.max(0.2, speedFactor)) / newMax;
} else {
          const newMax = Math.max(2, Math.round(densityFactor * 6));
          existing.maxParticles = newMax;
          existing.frequency    = (30 / speedFactor) / newMax;
        }

while (existing.particles.length < existing.maxParticles) {
  if (effect.type === 'clouds')      existing.particles.push(makeCloud(width, height, effect.speed, false));
  else if (effect.type === 'embers') existing.particles.push(makeEmber(width, height, effect.speed));
  else if (effect.type === 'rain')   existing.particles.push(makeRain(width, height, effect.speed));
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

  // -------------------
  // gestion de la boucle d'animation
  // -------------------
  useEffect(() => {
const animate = (time: number) => {
  try {
const ctxScreen = canvasScreenRef.current?.getContext('2d') ?? null;
const ctxNormal = canvasNormalRef.current?.getContext('2d') ?? null;
const ctxAdd    = canvasAddRef.current?.getContext('2d') ?? null;
const ctxRain   = canvasRainRef.current?.getContext('2d') ?? null;

      const dtMs = time - (lastTimeRef.current || time);
      lastTimeRef.current = time;
      const dt = Math.min(dtMs / 1000, 0.1);

ctxScreen?.clearRect(0, 0, width, height);
ctxNormal?.clearRect(0, 0, width, height);
ctxAdd?.clearRect(0, 0, width, height);
ctxRain?.clearRect(0, 0, width, height);

      // -------------------
      // gestion du rendu particules 2D
      // -------------------
      for (const layer of layersRef.current) {
        const { effect, particles } = layer;

        let ctx: CanvasRenderingContext2D | null;
if      (effect.type === 'clouds') ctx = ctxScreen;
else if (effect.type === 'embers') ctx = ctxAdd;
else if (effect.type === 'rain')   ctx = ctxRain;
else                               ctx = ctxNormal;
        if (!ctx) continue;

        layer.spawnAccum += dt;
while (layer.spawnAccum >= layer.frequency && particles.length < layer.maxParticles) {
  layer.spawnAccum -= layer.frequency;
  if (effect.type === 'clouds')      particles.push(makeCloud(width, height, effect.speed, true));
  else if (effect.type === 'embers') particles.push(makeEmber(width, height, effect.speed));
  else if (effect.type === 'rain')   particles.push(makeRain(width, height, effect.speed));
  else                               particles.push(makeCrow(width, height, effect.speed));
}
        if (layer.spawnAccum > layer.frequency * 2) layer.spawnAccum = 0;

        for (let i = particles.length - 1; i >= 0; i--) {
const p = particles[i];

// -------------------
// gestion du cycle de vie : rain en flux continu (pas de lifetime remove)
// -------------------
if (p.type !== 'rain') {
  p.lifeNorm += p.lifeInc * dt;

  if (p.lifeNorm >= 1) {
    particles.splice(i, 1);
    continue;
  }
}

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

          } else if (p.type === 'embers') {
            p.vx      = p.dirX * p.baseSpeed * effect.speed;
            p.vy      = p.dirY * p.baseSpeed * effect.speed;
            p.lifeInc = effect.speed / p.baseLifetimeSec;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rotation += p.rotSpeed * dt;
            p.alpha = fxAlpha(p.lifeNorm, effect.alpha, EMBER_ALPHA_LIST);
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

          } else if (p.type === 'rain') {
            p.x += p.vx * dt;
            p.y += p.vy * dt;

// reset quand sort écran (bas ou trop à gauche/droite)
if (p.y > height + 24 || p.x < -80 || p.x > width + 80) {
  const drift = (Math.random() * 0.16 - 0.08);
  const fallY = (900 + Math.random() * 500) * effect.speed;
  p.vy = fallY;
  p.vx = fallY * drift;

  p.x = Math.random() * (width + 120) - 60;
  p.y = -20 - Math.random() * 140;
}

            const a = Math.max(0.05, Math.min(1, effect.alpha ?? 0.7));
            const dropLen = p.len * (effect.scale ?? 1);
            const dx = (p.vx / Math.max(1, Math.abs(p.vy))) * dropLen;
            const dy = dropLen;

            ctx.save();
            ctx.globalAlpha = a;
            ctx.strokeStyle = effect.color ?? '#9ec5ff';
            ctx.lineWidth = Math.max(1, 1.1 * (effect.scale ?? 1));
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + dx, p.y + dy);
            ctx.stroke();
            ctx.restore();
          
            
          }
        }
      }

      // -------------------
      // gestion du rendu fog WebGL
      // -------------------
      const fe = effectsRef.current.find(e => e.type === 'fog');
      if (fe) {
fogGLA.render(dt, fe, width, height);
// fogGLB.render(dt, fe, width, height);
      } else {
        fogGLA.clear(width, height);
        fogGLB.clear(width, height);
      }

  rafRef.current = requestAnimationFrame(animate);
  } catch (err) {
    console.error('[VTTWeatherOverlay] animate crash:', err);
    rafRef.current = requestAnimationFrame(animate);
  }
};

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, fogGLA, fogGLB]);

  if (effects.length === 0) return null;

  return (
    <>
      {/* Fog couche A + B */}
      {effects.some(e => e.type === 'fog') && (
        <>
          <canvas
            ref={canvasFogARef}
            width={width}
            height={height}
            className="absolute inset-0 pointer-events-none z-10"
            style={{ mixBlendMode: 'screen' }}
          />
          <canvas
            ref={canvasFogBRef}
            width={width}
            height={height}
            className="absolute inset-0 pointer-events-none z-10"
            style={{ mixBlendMode: 'screen' }}
          />
        </>
      )}

      {/* Clouds : screen */}
      {effects.some(e => e.type === 'clouds') && (
        <canvas
          ref={canvasScreenRef}
          width={width}
          height={height}
          className="absolute inset-0 pointer-events-none z-10"
          style={{ mixBlendMode: 'screen' }}
        />
      )}

       {/* rain : screen */}
      {effects.some(e => e.type === 'rain') && (
        <canvas
          ref={canvasRainRef}
          width={width}
          height={height}
          className="absolute inset-0 pointer-events-none z-10"
          style={{ mixBlendMode: 'normal' }}
        />
      )}
      
      {/* Crows : normal */}
      {effects.some(e => e.type === 'crows') && (
        <canvas
          ref={canvasNormalRef}
          width={width}
          height={height}
          className="absolute inset-0 pointer-events-none z-10"
          style={{ mixBlendMode: 'normal' }}
        />
      )}

      {/* Embers : screen */}
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
