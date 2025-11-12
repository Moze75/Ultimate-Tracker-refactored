import type { DiceSettings } from '../hooks/useDiceSettings';

let diceBoxInstance: any = null;
let currentContainer: HTMLElement | null = null;

export async function getDiceBoxInstance(
  container: HTMLElement,
  settings: DiceSettings
) {
  // Si l'instance existe et le container n'a pas changé, réutiliser
  if (diceBoxInstance && currentContainer === container) {
    return diceBoxInstance;
  }

  // Importer le module
  const DiceBox = (await import('@3d-dice/dice-box-threejs')).default;

  // Créer la config
  const config = {
    assetPath: '/assets/dice-box/',
    theme_colorset: settings.theme || 'custom',
    // ... autres configs
  };

  // Nettoyer l'ancienne instance si nécessaire
  if (diceBoxInstance && typeof diceBoxInstance.clear === 'function') {
    diceBoxInstance.clear();
  }

  // Créer et initialiser
  const box = new DiceBox(container, config);
  await box.initialize();

  diceBoxInstance = box;
  currentContainer = container;

  return box;
}

export function updateDiceBoxSettings(settings: DiceSettings) {
  if (!diceBoxInstance) return;
  
  // Si le moteur supporte la mise à jour dynamique
  if (typeof diceBoxInstance.updateConfig === 'function') {
    diceBoxInstance.updateConfig({
      theme_colorset: settings.theme,
      baseScale: settings.baseScale * 100 / 6,
      // ...
    });
  } else {
    // Sinon, forcer la réinitialisation
    diceBoxInstance = null;
  }
}