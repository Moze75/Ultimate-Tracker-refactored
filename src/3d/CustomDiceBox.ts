import type { DiceSettings } from '../hooks/useDiceSettings';
import { VolumetricFireSystem } from '../utils/VolumetricFireSystem';

// On importe la DiceBox de la lib
// (nom exact à confirmer : tu utilises déjà `import('@3d-dice/dice-box-threejs')` dans DiceBox3D.tsx)
import DiceBoxCore from '@3d-dice/dice-box-threejs';

type DiceBoxInstance = any;

interface CustomDiceBoxConfig {
  assetPath: string;
  theme_colorset?: string;
  theme_texture?: string;
  theme_material?: string;
  theme_customColorset?: any;
  baseScale?: number;
  gravity_multiplier?: number;
  strength?: number;
  sounds?: boolean;
  volume?: number;
  onRollComplete?: (results: any) => void;
}

/**
 * Wrapper autour de DiceBox qui ajoute :
 * - un système de feu volumétrique pour les dés de feu
 * - l'accès aux settings pour savoir si l'effet est activé
 */
export class CustomDiceBox {
  private core: DiceBoxInstance;
  private volumetricFire?: VolumetricFireSystem;
  private fireEnabled: boolean;

  constructor(containerSelector: string, config: CustomDiceBoxConfig, settings: DiceSettings) {
    // On garde une trace du fait que l'effet feu volumétrique est activé
    this.fireEnabled = settings.fireVolumetricEnabled === true && config.theme_texture === 'fire';
    console.log(
      '[CustomDiceBox] constructor fireEnabled =',
      this.fireEnabled,
      'theme_texture =',
      config.theme_texture,
      'settings.fireVolumetricEnabled =',
      settings.fireVolumetricEnabled
    );

    // Instanciation de la DiceBox originale
    this.core = new DiceBoxCore(containerSelector, config);
    console.log('[CustomDiceBox] core instance créée, clés =', Object.keys(this.core));

    // On va initialiser le feu plus tard, quand la scène sera prête
    // (après `initialize`)
  }

  /**
   * Wrap d'initialize : une fois la scène prête, on installe VolumetricFireSystem
   */
  async initialize() {
    console.log('[CustomDiceBox] initialize() appelé');
    await this.core.initialize();
    console.log('[CustomDiceBox] core.initialize() terminé');

    // Debug: voir les clés principales de l'instance DiceBoxCore
    console.log('[CustomDiceBox] core keys =', Object.keys(this.core));

    // Si l'effet feu n'est pas activé, on ne fait rien de plus
    console.log('[CustomDiceBox] fireEnabled ?', this.fireEnabled);
    if (!this.fireEnabled) {
      return;
    }

    // Essayer plusieurs chemins possibles pour la scene
    const rawScene: any =
      (this.core as any).scene || // certaines versions
      ((this.core as any).scn && (this.core as any).scn.scene) || // éventuel wrapper
      ((this.core as any).world && (this.core as any).world.scene) || // si world contient scene
      null;

    console.log(
      '[CustomDiceBox] scene brute détectée ?',
      !!rawScene,
      rawScene ? 'children = ' + rawScene.children?.length : ''
    );

    if (!rawScene) {
      console.warn(
        '[CustomDiceBox] Impossible de trouver la scene Three.js pour le feu volumétrique.'
      );
      return;
    }

    this.volumetricFire = new VolumetricFireSystem(rawScene as any);
    console.log('[CustomDiceBox] VolumetricFireSystem créé', this.volumetricFire);

        // 🧪 Feu de zone "type sandbox" centré sous la zone de dés
    try {
      this.volumetricFire.attachAreaFire('dicebox_area_fire');
    } catch (e) {
      console.warn('[CustomDiceBox] Impossible d\'attacher le feu de zone:', e);
    }

    // Hook léger sur la boucle d'animation si possible
      const originalAnimate = (this.core as any).animate?.bind(this.core);

    if (originalAnimate && typeof originalAnimate === 'function') {
      const self = this;
      (this.core as any).animate = function (...args: any[]) {
        if (self.volumetricFire) {
          try {
            self.volumetricFire.update();
          } catch (e) {
            console.warn('[CustomDiceBox] Erreur update feu volumétrique:', e);
          }
        }
        // Debug minimal pour vérifier que animate tourne bien
        // console.log('[CustomDiceBox] animate() tick');
        return originalAnimate(...args);
      };
      console.log('[CustomDiceBox] animate() patché pour appeler update() du feu');
    } else {
      console.warn('[CustomDiceBox] Pas de animate() accessible, le feu ne sera pas animé.');
    }
  }

  /**
   * On intercepte la création des dés pour attacher le feu aux dés de feu.
   * (Actuellement inutilisé, la logique d'attache est gérée dans roll()).
   */
  private patchSpawnDiceForFire() {
    if (!this.fireEnabled || !this.volumetricFire) return;

    const core = this.core;

    const originalSpawnDice = core.spawnDice?.bind(core);
    if (!originalSpawnDice) {
      console.warn(
        '[CustomDiceBox] spawnDice() introuvable, impossible d\'attacher le feu aux dés.'
      );
      return;
    }

    const volumetricFire = this.volumetricFire;

    core.spawnDice = function (vectorData: any, reset = false) {
      const result = originalSpawnDice(vectorData, reset);

      try {
        if (Array.isArray(core.diceList)) {
          core.diceList.forEach((diceMesh: any) => {
            if (!diceMesh || !diceMesh.notation) return;

            const isFireTexture =
              core.theme_texture === 'fire' ||
              (core.colorData &&
                core.colorData.texture &&
                core.colorData.texture.name === 'fire');

            if (!isFireTexture) return;

            const diceId =
              diceMesh.userData?.id ||
              `dice_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

            diceMesh.userData = {
              ...(diceMesh.userData || {}),
              id: diceId,
            };

            volumetricFire.attachToDice(diceMesh, diceId);
          });
        }
      } catch (e) {
        console.warn(
          "[CustomDiceBox] Erreur lors de l'attachement du feu volumétrique:",
          e
        );
      }

      return result;
    };
  }

  /**
   * Proxies vers les méthodes utilisées dans DiceBox3D.tsx
   */

  get strength() {
    return this.core.strength;
  }

  set strength(val: number) {
    this.core.strength = val;
  }

  get world() {
    return this.core.world;
  }

  get DiceFactory() {
    return this.core.DiceFactory;
  }

  set DiceFactory(v: any) {
    this.core.DiceFactory = v;
  }

  get colorData() {
    return this.core.colorData;
  }

  set colorData(v: any) {
    this.core.colorData = v;
  }

  get theme_material() {
    return this.core.theme_material;
  }

  set theme_material(v: any) {
    this.core.theme_material = v;
  }

  get gravity_multiplier() {
    return this.core.gravity_multiplier;
  }

  set gravity_multiplier(v: number) {
    this.core.gravity_multiplier = v;
  }

  async updateConfig(opts: any) {
    if (this.core.updateConfig) {
      return this.core.updateConfig(opts);
    }
  }

  setDimensions(dim: { x: number; y: number }) {
    if (this.core.setDimensions) {
      this.core.setDimensions(dim);
    }
  }

  roll(notation: string) {
    console.log('[CustomDiceBox] roll() appelé avec', notation);
    if (!this.core.roll) {
      console.warn('[CustomDiceBox] core.roll() introuvable');
      return;
    }

    this.core.roll(notation);

    // Si pas d'effet feu, on s'arrête là
    if (!this.fireEnabled || !this.volumetricFire) {
      console.log(
        '[CustomDiceBox] Feu volumétrique désactivé ou non initialisé, on ne fait rien après roll.',
        'fireEnabled =',
        this.fireEnabled,
        'volumetricFire =',
        this.volumetricFire
      );
      return;
    }

    // Après un court délai, on tente d'attacher des flammes aux dés existants
    setTimeout(() => {
      try {
        const core: any = this.core;
        const diceList = core.diceList || core.meshes || [];
        console.log(
          "[CustomDiceBox] Tentative d'attacher le feu. diceList length =",
          diceList.length
        );

        diceList.forEach((diceMesh: any, index: number) => {
          if (!diceMesh) return;

          // On ne cible que les dés de feu : theme_texture === 'fire'
          const isFireTexture =
            core.theme_texture === 'fire' ||
            (core.colorData &&
              core.colorData.texture &&
              core.colorData.texture.name === 'fire');

          console.log(
            `[CustomDiceBox] Dice index=${index}, isFireTexture=${isFireTexture}`,
            diceMesh
          );

          if (!isFireTexture) return;

          const diceId =
            diceMesh.userData?.id ||
            `dice_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

          diceMesh.userData = {
            ...(diceMesh.userData || {}),
            id: diceId,
          };

          console.log(
            '[CustomDiceBox] Attachement feu (shader) sur dé',
            diceId
          );
          // On laisse VolumetricFireSystem gérer height/radius (defaults adaptés)
          this.volumetricFire!.attachToDice(diceMesh, diceId);
        });
      } catch (e) {
        console.warn(
          "[CustomDiceBox] Erreur lors de l'attachement du feu après roll:",
          e
        );
      }
    }, 300);
  }

  clearDice() {
    if (this.core.clearDice) {
      this.core.clearDice();
    }
  }
}