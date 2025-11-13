import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface FireEffectProps {
  width: number;
  height: number;
  isActive: boolean;
}

export function FireEffect({ width, height, isActive }: FireEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !isActive) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current,
      alpha: true,
      antialias: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Fire shader
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float time;
      uniform vec2 resolution;
      varying vec2 vUv;

      // Noise functions
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        vec2 uv = vUv;
        
        // Create border mask
        float borderWidth = 0.15;
        float border = smoothstep(borderWidth, borderWidth + 0.05, uv.x) * 
                       smoothstep(borderWidth, borderWidth + 0.05, 1.0 - uv.x) *
                       smoothstep(borderWidth, borderWidth + 0.05, uv.y) * 
                       smoothstep(borderWidth, borderWidth + 0.05, 1.0 - uv.y);
        
        // Invert to keep only borders
        float mask = 1.0 - border;
        
        // Fire noise animation
        float noise = 0.0;
        vec2 pos = uv * 3.0;
        
        // Multiple octaves of noise
        noise += snoise(pos + vec2(0.0, time * 0.5)) * 0.5;
        noise += snoise(pos * 2.0 + vec2(0.0, time * 0.8)) * 0.25;
        noise += snoise(pos * 4.0 + vec2(0.0, time * 1.2)) * 0.125;
        
        // Add vertical gradient for flame shape
        float gradient = pow(1.0 - uv.y, 2.0);
        noise = noise * gradient + gradient * 0.5;
        
        // Fire colors
        vec3 color1 = vec3(1.0, 0.9, 0.2);  // Yellow
        vec3 color2 = vec3(1.0, 0.5, 0.0);  // Orange
        vec3 color3 = vec3(1.0, 0.1, 0.0);  // Red
        vec3 color4 = vec3(0.3, 0.0, 0.0);  // Dark red
        
        vec3 fireColor = mix(color4, color3, smoothstep(0.0, 0.3, noise));
        fireColor = mix(fireColor, color2, smoothstep(0.3, 0.6, noise));
        fireColor = mix(fireColor, color1, smoothstep(0.6, 1.0, noise));
        
        // Apply mask and intensity
        float intensity = smoothstep(0.2, 0.8, noise) * mask;
        
        gl_FragColor = vec4(fireColor, intensity);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(width, height) }
      },
      transparent: true,
      blending: THREE.AdditiveBlending
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    sceneRef.current = scene;
    rendererRef.current = renderer;
    materialRef.current = material;

    // Animation loop
    let animationId: number;
    const animate = () => {
      if (material.uniforms) {
        material.uniforms.time.value += 0.016;
      }
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [width, height, isActive]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        mixBlendMode: 'screen'
      }}
    />
  );
}