import * as THREE from 'three';

export interface VolumetricFireOptions {
  height?: number;
  radius?: number;
  segments?: number;
  color1?: THREE.Color;
  color2?: THREE.Color;
  color3?: THREE.Color;
  scale?: number;
}

/**
 * Système de feu volumétrique basé sur des shaders custom.
 * À intégrer avec une scène three.js (par ex. celle de dice-box-threejs).
 */
export class VolumetricFireSystem {
  private scene: THREE.Scene;
  private fireMeshes: Map<string, THREE.Mesh>;
  private clock: THREE.Clock;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.fireMeshes = new Map();
    this.clock = new THREE.Clock();
  }

  /** Vertex Shader pour le feu volumétrique */
  static getVertexShader(): string {
    return `
      varying vec2 vUv;
      varying float vDisplacement;
      
      uniform float time;
      uniform float scale;
      
      // Fonction de bruit 3D simplifiée
      float noise(vec3 p) {
        return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
      }
      
      void main() {
        vUv = uv;
        
        vec3 pos = position;
        
        // Animation de flamme qui monte
        float displacement = noise(pos * 2.0 + time * 0.5) * 0.3;
        displacement += noise(pos * 4.0 + time) * 0.15;
        
        // Plus de mouvement en haut
        float verticalFactor = (pos.y + 1.0) * 0.5;
        displacement *= verticalFactor;
        
        vDisplacement = displacement;
        
        pos.x += displacement * 0.3;
        pos.z += displacement * 0.3;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;
  }

  /** Fragment Shader pour le feu volumétrique */
  static getFragmentShader(): string {
    return `
      varying vec2 vUv;
      varying float vDisplacement;
      
      uniform float time;
      uniform vec3 color1; // Jaune
      uniform vec3 color2; // Orange
      uniform vec3 color3; // Rouge
      
      // Fonction de bruit pour texture
      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        
        for(int i = 0; i < 6; i++) {
          value += amplitude * noise(p);
          p *= 2.0;
          amplitude *= 0.5;
        }
        
        return value;
      }
      
      void main() {
        vec2 uv = vUv;
        
        // Animation de flamme qui monte
        uv.y -= time * 0.2;
        
        // Turbulence
        float turbulence = fbm(uv * 3.0 + time * 0.5);
        turbulence += fbm(uv * 6.0 - time * 0.3) * 0.5;
        
        // Forme de flamme (plus étroit en haut)
        float flameShape = 1.0 - abs(uv.x - 0.5) * 2.0;
        flameShape *= (1.0 - uv.y);
        flameShape = pow(flameShape, 2.0);
        
        // Intensité basée sur la turbulence et la forme
        float intensity = turbulence * flameShape;
        intensity = smoothstep(0.2, 0.8, intensity);
        
        // Dégradé de couleur basé sur la hauteur
        vec3 color;
        if(uv.y < 0.3) {
          color = mix(color1, color2, uv.y / 0.3); // Jaune -> Orange
        } else if(uv.y < 0.6) {
          color = mix(color2, color3, (uv.y - 0.3) / 0.3); // Orange -> Rouge
        } else {
          color = mix(color3, vec3(0.1, 0.0, 0.0), (uv.y - 0.6) / 0.4); // Rouge -> Noir
        }
        
        // Luminosité (boostée pour debug)
        float brightness = intensity * (1.5 - uv.y * 0.5);
        
        // Transparence (un peu plus opaque)
        float alpha = intensity * flameShape * (1.2 - uv.y);
        
        gl_FragColor = vec4(color * brightness, alpha);
      }
    `;
  }

  /**
   * Crée un mesh de feu volumétrique pour un dé
   */
   attachToDice(
    diceMesh: THREE.Mesh,
    diceId: string,
    options: VolumetricFireOptions = {}
  ): THREE.Mesh {
    // Flamme cylindrique simplifiée (géométrie + matériau basique orange)
     // 🧪 DEBUG : flamme bien plus grande pour qu'elle soit impossible à rater
    // 🧪 DEBUG : flamme GÉANTE pour être sûr qu'elle soit visible
    const height = options.height ?? 300;   // très haute
    const radius = options.radius ?? 120;   // très large

    const geometry = new THREE.CylinderGeometry(
      radius * 0.3,   // haut plus fin
      radius,         // bas plus large
      height,
      16,             // segments
      1,
      true
    );

    const material = new THREE.MeshBasicMaterial({
      color: 0xff8800,    // orange vif
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      wireframe: false,
      side: THREE.DoubleSide,
    });

    const fireMesh = new THREE.Mesh(geometry, material);

    // Position de départ : on copie la position du dé et on monte au-dessus
    fireMesh.position.copy(diceMesh.position as THREE.Vector3);
    // On place la flamme franchement AU-DESSUS du dé
    fireMesh.position.y += height; // une hauteur complète au-dessus

    // Offset pour suivre le dé pendant le roll
    fireMesh.userData = {
      diceId,
      diceMesh,
      offset: new THREE.Vector3(0, height, 0),
    };

    this.scene.add(fireMesh);
    console.log(
      '[VolumetricFireSystem] Flamme cylindrique ajoutée sur le dé',
      diceId,
      'position =',
      fireMesh.position
    );

    this.fireMeshes.set(diceId, fireMesh);
    return fireMesh;
  }

  /** Mise à jour (à appeler dans la boucle d’animation) */
   /** Mise à jour (à appeler dans la boucle d’animation) */
  update(): void {
    const elapsed = this.clock.getElapsedTime();

    this.fireMeshes.forEach((fireMesh) => {
      const diceMesh: THREE.Mesh | undefined = fireMesh.userData.diceMesh;
      if (!diceMesh) return;

      // Suivre la position du dé
      fireMesh.position.copy(diceMesh.position as THREE.Vector3);
      fireMesh.position.add(fireMesh.userData.offset as THREE.Vector3);

      // Pas de shader pour l'instant (MeshBasicMaterial), donc pas d'uniforms.time
      // Quand on repassera au ShaderMaterial, on réactivera un truc comme :
      // const mat = fireMesh.material as THREE.ShaderMaterial;
      // mat.uniforms.time.value = elapsed;
    });
  }

  /** Supprime le feu d’un dé */
  removeDiceFire(diceId: string): void {
    const fireMesh = this.fireMeshes.get(diceId);
    if (!fireMesh) return;

    this.scene.remove(fireMesh);
    fireMesh.geometry.dispose();
    (fireMesh.material as THREE.Material).dispose();
    this.fireMeshes.delete(diceId);
  }

  setVisible(diceId: string, visible: boolean): void {
    const fireMesh = this.fireMeshes.get(diceId);
    if (fireMesh) {
      fireMesh.visible = visible;
    }
  }

  /** Nettoie tout */
  dispose(): void {
    this.fireMeshes.forEach((_fireMesh, diceId) => {
      this.removeDiceFire(diceId);
    });
    this.fireMeshes.clear();
  }
}