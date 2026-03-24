/**
 * VTTWeatherOverlay
 * Canvas overlay — effets Nuages, Corbeaux, Braises & Brume.
 * Inspiré de FXMaster (gambit07) — https://github.com/gambit07/fxmaster
 *
 * Effets clouds / crows / embers : Canvas 2D pure, indépendante de PIXI/Foundry.
 * Effet fog : WebGL — port exact du FogShader de Foundry VTT (fog.mjs),
 *             adaptatif selon les performances détectées (mode 0/1/2).
 */
import { useEffect, useRef, useCallback } from 'react';
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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── WebGL Fog — port exact du FogShader Foundry VTT ─────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// Source originale : fog.mjs / FogShader extends AbstractWeatherShader (Foundry)
// Adaptation : remplacement des uniforms PIXI (vUvs, mask, tint…) par des
// équivalents WebGL vanilla. La logique GLSL est identique à l'original.
//
// Modes de performance (miroir de FogShader.OCTAVES / FogShader.FOG) :
//   mode 0 → 2 octaves, 1 passe  (appareils faibles / mobiles)
//   mode 1 → 3 octaves, 2 passes (appareils moyens)
//   mode 2 → 4 octaves, 2 passes (appareils puissants)

/**
 * Détecte le mode de performance à utiliser pour le fog shader.
 * Reproduit la logique de canvas.performance.mode de Foundry sans dépendre de PIXI.
 */
function detectPerformanceMode(): 0 | 1 | 2 {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const cores    = navigator.hardwareConcurrency ?? 4;
  if (isMobile || cores <= 2) return 0;
  if (cores <= 4)             return 1;
  return 2;
}

// Vertex shader minimal — quad plein écran en clip space
const FOG_VERT_SRC = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

/**
 * Construit le fragment shader GLSL en fonction du mode de performance.
 * Reproduction fidèle de FogShader.fragmentShader(mode) de Foundry VTT.
 */
function buildFogFragSrc(mode: 0 | 1 | 2): string {
  const octaves = mode + 2;

  // fogGLSL : domain warp statique depuis uvW (= uvBase * warpFreq).
  // Les fbm() du warp reçoivent uvW → la forme change avec warpFreq (c'est voulu).
  // MAIS fbm() interne utilise un uvAnim séparé qui ne contient PAS warpFreq
  // → speed n'interagit plus avec scale.
  const fogGLSL = mode === 0
    ? `vec2 uvW = uvBase * warpFreq;
       vec2 mv = vec2(
         fbm(uvW + vec2(seedX,       1.7 + seedY)) - 0.5,
         fbm(uvW + vec2(5.2 + seedX, seedY      )) - 0.5
       ) * 1.6;
       mist += fbm(uvW + mv);`
    : `vec2 uvW = uvBase * warpFreq;
       vec2 mv0 = vec2(
         fbm(uvW + vec2(seedX,         1.7 + seedY)) - 0.5,
         fbm(uvW + vec2(5.2 + seedX,   seedY      )) - 0.5
       ) * 1.6;
       mist += fbm(uvW + mv0) * 0.5;
       vec2 mv1 = vec2(
         fbm(uvW + vec2(seedX + 250.0, 251.7 + seedY)) - 0.5,
         fbm(uvW + vec2(255.2 + seedX, 250.0 + seedY)) - 0.5
       ) * 1.6;
       mist += fbm(uvW + mv1) * 0.5;`;

  return `
    precision mediump float;

    uniform float time;
    uniform float speed;
    uniform float intensity;
    uniform float slope;
    uniform float warpFreq;
    uniform float seedX;
    uniform float seedY;
    uniform float rotation;
    uniform vec3  tint;
    uniform vec2  uResolution;

    float random(in vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
    }
    mat2 rot(float a) {
      float c = cos(a), s = sin(a);
      return mat2(c, -s, s, c);
    }
    float perceivedBrightness(vec3 col) {
      return sqrt(0.299*col.r*col.r + 0.587*col.g*col.g + 0.114*col.b*col.b);
    }
    float fnoise(in vec2 coords) {
      vec2 i  = floor(coords);
      vec2 f  = fract(coords);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 cb = f * f * (3.0 - 2.0 * f);
      return mix(a,b,cb.x) + (c-a)*cb.y*(1.0-cb.x) + (d-b)*cb.x*cb.y;
    }

    // FBM : phase/freq dérivés de uvNorm (= uvBase normalisé, SANS warpFreq)
    // → les vortex locaux sont indépendants de la taille → speed n'affecte pas la densité.
    float fbm(in vec2 uvSpatial) {
      // uvNorm : basse fréquence fixe pour le champ de phase/vitesse
      // On divise par warpFreq pour revenir à l'espace [-1,1] de base
      vec2 uvNorm = uvSpatial / warpFreq;
      float phase = fnoise(uvNorm * 0.6 + vec2(seedX * 0.01, seedY * 0.01)) * 6.28318;
      float freq  = (0.035 + fnoise(uvNorm * 0.4 + vec2(seedX * 0.01 + 3.7, seedY * 0.01 + 1.9)) * 0.055) * speed;

      float r = 0.0, sc = 1.0;
      vec2 uv = uvSpatial * 2.0;
      for (int i = 0; i < ${octaves}; i++) {
        float fi = float(i);
        vec2 disp = vec2(
          sin(time * freq + phase + fi * 2.399) * 0.45,
          cos(time * freq * 1.29  + phase + fi * 1.618) * 0.45
        );
        r  += fnoise(uv + disp) * sc;
        uv *= 3.0;
        sc *= 0.3;
      }
      return r;
    }

    vec3 mistColor(in vec2 uvBase) {
      float mist = 0.0;
      ${fogGLSL}
      return vec3(1.0, 0.98, 0.95) * mist;
    }

    void main() {
      vec2 vUvs = gl_FragCoord.xy / uResolution;
      vUvs.y = 1.0 - vUvs.y;
      vec2 ruv = vUvs;
      if (rotation != 0.0) {
        ruv  = vUvs - 0.5;
        ruv  = rot(rotation) * ruv;
        ruv += 0.5;
      }

      vec2 uvBase = ruv * 2.0 - 1.0;
      vec3 col = mistColor(uvBase) * 1.8;

      float pb = perceivedBrightness(col);
      // slope [0.05 → 2.5] : seuil du smoothstep.
      // Haut = seules les crêtes passent (fog épars). Bas = tout passe (nappe dense).
      // Plage de smoothstep élargie : transition douce entre zones denses et creuses.
      // Avant : slope+0.001 → quasi binaire (0 ou 1).
      // Maintenant : slope*1.5 → large dégradé → opacité variable, aspect organique.
      float spatial = fnoise(uvBase * 0.4 + vec2(seedX * 0.07, seedY * 0.07));
      float slopeLo = slope * (0.2 + spatial * 0.4);
      float slopeHi = slope * (0.9 + spatial * 0.8);
      pb = smoothstep(slopeLo, slopeHi, pb);

      // Fond noir + mixBlendMode:screen côté CSS :
      //   screen(rgb_canvas, rgb_fond=0) = rgb_canvas
      // → zones noires (rgb=0) = invisibles, zones claires = lumineuses.
      // C'est le RGB qui porte l'intensité — alpha=1 partout (canvas opaque).
      // Deux couches screen superposées : screen(A,B) = 1-(1-A)(1-B)
      // → là où les deux couches ont des crêtes → très lumineux (hétérogénéité !)
      vec3 fogColor = tint * pb * intensity;
      gl_FragColor  = vec4(fogColor, 1.0);
    }
  `;
}


// ─── Types internes WebGL ─────────────────────────────────────────────────────

interface FogGLState {
  gl:       WebGLRenderingContext;
  program:  WebGLProgram;
  uniforms: {
    time:        WebGLUniformLocation | null;
    speed:       WebGLUniformLocation | null;
    intensity:   WebGLUniformLocation | null;
    slope:       WebGLUniformLocation | null;
    warpFreq:    WebGLUniformLocation | null;
    seedX:       WebGLUniformLocation | null;
    seedY:       WebGLUniformLocation | null;
    rotation:    WebGLUniformLocation | null;
    tint:        WebGLUniformLocation | null;
    uResolution: WebGLUniformLocation | null;
  };
}

/**
 * Hook React qui initialise un contexte WebGL sur le canvas fog et expose
 * une fonction render() à appeler depuis la boucle RAF principale.
 *
 * Drop-in replacement de la section fog Canvas 2D de VTTWeatherOverlay.
 */
interface FogLayerConfig {
  seedX: number;      // décalage seed — donne un pattern unique à chaque couche
  seedY: number;
  warpScale?: number; // multiplicateur d'échelle (couche B = 0.6 → plus grande) 
  slopeOffset?: number; // décalage du seuil de densité (couche B légèrement différente)
}

function useFogWebGL(canvasRef: React.RefObject<HTMLCanvasElement>, cfg: FogLayerConfig) {
  const glStateRef  = useRef<FogGLState | null>(null);
  const fogTimeRef  = useRef<number>(0);
  const modeRef     = useRef<0 | 1 | 2>(detectPerformanceMode());

  // ── Initialisation WebGL (une seule fois au montage) ──────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha:              true,   // canvas transparent pour composition CSS
      premultipliedAlpha: false,  // canvas RGB pur — alpha=1 partout, screen CSS fait le blend
      antialias:          false,  // inutile pour un shader procédural plein écran
    });

    if (!gl) {
      console.warn('[VTTFog] WebGL non disponible — effet fog désactivé.');
      return;
    }

    const mode = modeRef.current;

    // Compilation des shaders
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

    const vert = compileShader(gl.VERTEX_SHADER,   FOG_VERT_SRC);
    const frag = compileShader(gl.FRAGMENT_SHADER, buildFogFragSrc(mode));
    if (!vert || !frag) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    // Les shaders compilés peuvent être supprimés après link
    gl.deleteShader(vert);
    gl.deleteShader(frag);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[VTTFog] Erreur link program:', gl.getProgramInfoLog(program));
      return;
    }

    // Quad plein écran : 2 triangles couvrant le clip space [-1,1]
    // Triangle strip : BL → BR → TL → TR
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

    // Blending alpha standard (le canvas lui-même est composité en CSS via mixBlendMode)
    gl.enable(gl.BLEND);
    // Sur fond noir + screen CSS : le canvas est opaque (alpha=1), le RGB porte l'intensité
    gl.disable(gl.BLEND); // pas de blend interne — un seul quad opaque plein écran

    glStateRef.current = {
      gl,
      program,
      uniforms: {
        time:        gl.getUniformLocation(program, 'time'),
        speed:       gl.getUniformLocation(program, 'speed'),
        intensity:   gl.getUniformLocation(program, 'intensity'),
        slope:       gl.getUniformLocation(program, 'slope'),
        warpFreq:    gl.getUniformLocation(program, 'warpFreq'),
        seedX:       gl.getUniformLocation(program, 'seedX'),
        seedY:       gl.getUniformLocation(program, 'seedY'),
        rotation:    gl.getUniformLocation(program, 'rotation'),
        tint:        gl.getUniformLocation(program, 'tint'),
        uResolution: gl.getUniformLocation(program, 'uResolution'),
      },
    };

    console.debug(`[VTTFog] WebGL initialisé — mode performance ${mode} (${mode + 2} octaves)`);

    return () => {
      gl.deleteProgram(program);
      gl.deleteBuffer(quadBuf);
      glStateRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── render() : appelé chaque frame depuis la boucle RAF ───────────────────
  /**
   * Effectue un rendu WebGL du fog pour la frame courante.
   * @param dt      Delta time en secondes
   * @param fe      Paramètres de l'effet fog (speed, alpha, color, density…)
   * @param width   Largeur du canvas en pixels
   * @param height  Hauteur du canvas en pixels
   */
  const render = useCallback((
    dt:     number,
    fe:     VTTWeatherEffect,
    width:  number,
    height: number,
  ) => {
    const state = glStateRef.current;
    if (!state) return;
    const { gl, program, uniforms } = state;

    // time passé via uniform directement dans render

    // Parse couleur hex → vec3 normalisé
    const hex = (fe.color ?? '#ffffff').replace('#', '');
    const tr  = parseInt(hex.slice(0, 2), 16) / 255;
    const tg  = parseInt(hex.slice(2, 4), 16) / 255;
    const tb  = parseInt(hex.slice(4, 6), 16) / 255;

    // Rendu
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    const opacity  = Math.min(1,   Math.max(0,   fe.alpha   ?? 1));
    const density  = Math.min(2,   Math.max(0,   fe.density ?? 1));
    const scale    = Math.min(4,   Math.max(0.5, (fe as any).scale ?? 1));
    const speedVal = Math.min(3.0, Math.max(0.1, fe.speed   ?? 1));

    // warpFreq : contrôle la taille des nappes de brume.
    // Slider taille : 0 → 3x.
    // IMPORTANT : jamais en dessous de 3.0 — en dessous ça donne un effet "eau/marbre"
    //   scale=0.5 → warpFreq=9.0  (filaments fins)
    //   scale=1.0 → warpFreq=5.9  (nappes moyennes)
    //   scale=2.0 → warpFreq=3.85 (grandes nappes)
    //   scale=3.0 → warpFreq=3.0  (max taille, encore du fog pas de l'eau)
    // Formule : 5.884 * scale^(-0.613), clamp [3.0, 9.0]
    const warpScale = cfg.warpScale ?? 1.0;
    const warpFreq = Math.min(9.0, Math.max(3.0, 5.884 * Math.pow(Math.max(scale, 0.1), -0.613) * warpScale));

    // slope : density=0 → 2.5 (quasi vide), density=1 → 0.68, density=2 → 0.05
    // Monotone décroissant sur tout [0,2] → jamais de pic puis disparition
    // slopeOffset décale le seuil de densité de la couche B :
    // couche A = zones de brume "principales", couche B = nappes plus légères
    // → là où A est dense, B peut être creuse et vice versa → vraie hétérogénéité
    const slopeOff = cfg.slopeOffset ?? 0;
    const slope = Math.max(0.05, 2.5 - density * 1.225 + slopeOff);

    // intensity : pas de ×0.55 — on laisse le shader gérer via col directement
    // Deux couches screen : screen(a,a) = 1-(1-a)² → à opacity=0.7 par couche
    // screen résultat ≈ 0.91, suffisamment opaque
    gl.uniform1f(uniforms.time,        performance.now() / 1000);
    gl.uniform1f(uniforms.speed,       speedVal);
    gl.uniform1f(uniforms.intensity,   opacity);
    gl.uniform1f(uniforms.slope,       slope);
    gl.uniform1f(uniforms.warpFreq,    warpFreq);
    gl.uniform1f(uniforms.seedX,       cfg.seedX);
    gl.uniform1f(uniforms.seedY,       cfg.seedY);
    gl.uniform1f(uniforms.rotation,    (fe as any).rotation ?? 0.0);
    gl.uniform3f(uniforms.tint,        tr, tg, tb);
    gl.uniform2f(uniforms.uResolution, width, height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, []);

  /**
   * Efface le canvas WebGL (utilisé quand l'effet fog est désactivé).
   */
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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Composant React ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export function VTTWeatherOverlay({ effects, width, height }: VTTWeatherOverlayProps) {
  const canvasScreenRef = useRef<HTMLCanvasElement>(null); // clouds → screen
  const canvasNormalRef = useRef<HTMLCanvasElement>(null); // crows  → normal
  const canvasAddRef    = useRef<HTMLCanvasElement>(null); // embers → screen
  const canvasFogARef   = useRef<HTMLCanvasElement>(null); // fog couche A
  const canvasFogBRef   = useRef<HTMLCanvasElement>(null); // fog couche B

  // Deux couches fog indépendantes superposées en screen blend.
  // Couche A : drift vers droite-bas (driftX+, driftY+)
  // Couche B : drift vers gauche-haut (driftX-, driftY-) + seed décalé
  // → les deux couches se croisent → mouvement organique sans direction dominante.
  // Deux couches avec seeds très différents → vortex locaux complètement indépendants
  const fogGLA = useFogWebGL(canvasFogARef, { seedX: 0.0,  seedY: 0.0,  warpScale: 1.0,  slopeOffset: 0.0  });
  // Couche B : échelle 60% plus grande + seuil de densité décalé de +0.35
  // → les nappes denses de B ne coïncident PAS avec celles de A → vraie hétérogénéité
  const fogGLB = useFogWebGL(canvasFogBRef, { seedX: 47.3, seedY: 83.1, warpScale: 0.6, slopeOffset: 0.35 });

  const effectsRef  = useRef<VTTWeatherEffect[]>(effects);
  const layersRef   = useRef<WeatherLayer[]>([]);
  const rafRef      = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Garde effectsRef synchronisé sans déclencher de re-render dans la boucle RAF
  effectsRef.current = effects;

  // ── Sync layers (clouds / crows / embers) ────────────────────────────────
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

  // ── Boucle d'animation ────────────────────────────────────────────────────
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

      // ── Layers particles (clouds / crows / embers) — Canvas 2D inchangé ──
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

          // ── Cloud ────────────────────────────────────────────────────────
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

          // ── Crow ─────────────────────────────────────────────────────────
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

          // ── Embers ───────────────────────────────────────────────────────
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

      // ── FOG — rendu WebGL (FogShader Foundry VTT) ────────────────────────
      // Remplace intégralement l'ancienne implémentation Canvas 2D
      // (gradients radiaux, FogBlobs, FogCloudParticles).
      const fe = effectsRef.current.find(e => e.type === 'fog');
      if (fe) {
        fogGLA.render(dt, fe, width, height);
        fogGLB.render(dt, fe, width, height);
      } else {
        fogGLA.clear(width, height);
        fogGLB.clear(width, height);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, fogGLA, fogGLB]);

  if (effects.length === 0) return null;

  return (
    <>
      {/* Fog couche A + B — screen blend sur fond noir : zones noires disparaissent */}
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