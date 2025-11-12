import type { DiceSettings } from '../hooks/useDiceSettings';

let diceBoxInstance: any = null;
let isInitializing = false;

const COLORSET_TEXTURES: Record<string, string> = {
  'fire': 'fire',
  'ice': 'ice',
  'poison': 'cloudy',
  'acid': 'marble',
  'thunder': 'cloudy',
  'lightning': 'ice',
  'air': 'cloudy',
  'water': 'water',
  'earth': 'speckles',
  'force': 'stars',
  'psychic': 'speckles',
  'necrotic': 'skulls',
  'radiant': 'paper',
  'bronze': 'bronze01',
  'dragons': 'dragon',
  'tigerking': 'tiger',
  'birdup': 'bird',
  'astralsea': 'astral',
  'glitterparty': 'glitter',
  'starynight': 'stars',
  'bloodmoon': 'marble',
  'pinkdreams': 'skulls',
  'breebaby': 'marble',
  'inspired': 'none',
  'black': 'none',
  'white': 'none',
  'rainbow': 'stars',
  'covid': 'skulls',
};

export async function getDiceBoxInstance(
  containerId: string,
  settings: DiceSettings
) {
  // Si déjà initialisé, retourner l'instance existante
  if (diceBoxInstance) {
    console.log('♻️ Réutilisation de l\'instance DiceBox existante');
    return diceBoxInstance;
  }

  // Éviter les initialisations simultanées
  if (isInitializing) {
    console.log('⏳ Initialisation en cours, attente...');
    await new Promise(resolve => setTimeout(resolve, 100));
    return getDiceBoxInstance(containerId, settings);
  }

  isInitializing = true;
  console.log('🎲 Création de l\'instance DiceBox (UNE SEULE FOIS)');

  try {
    const DiceBox = (await import('@3d-dice/dice-box-threejs')).default;

    const textureForTheme = settings.theme 
      ? (COLORSET_TEXTURES[settings.theme] || '')
      : 'none';

    const config = {
      assetPath: '/assets/dice-box/',
      theme_colorset: settings.theme || 'custom',
      theme_texture: textureForTheme,
      theme_customColorset: !settings.theme ? {
        name: 'custom',
        foreground: '#ffffff',
        background: settings.themeColor,
        outline: settings.themeColor,
        edge: settings.themeColor,
        texture: 'none',
        material: settings.themeMaterial
      } : undefined,
      theme_material: settings.themeMaterial || "plastic",
      baseScale: settings.baseScale * 100 / 6,
      gravity_multiplier: settings.gravity * 400,
      strength: settings.strength,
      sounds: settings.soundsEnabled,
      volume: settings.soundsEnabled ? settings.volume : 0,
      onRollComplete: () => {}, // Sera overridé dans DiceBox3D
    };

    const box = new DiceBox(containerId, config);
    await box.initialize();

    diceBoxInstance = box;
    isInitializing = false;

    console.log('✅ Instance DiceBox créée et prête');
    return box;

  } catch (error) {
    isInitializing = false;
    console.error('❌ Erreur création DiceBox:', error);
    throw error;
  }
}

export async function updateDiceBoxSettings(settings: DiceSettings) {
  if (!diceBoxInstance) {
    console.warn('⚠️ Aucune instance à mettre à jour');
    return;
  }

  console.log('🔧 Mise à jour des settings DiceBox...');

  const textureForTheme = settings.theme 
    ? (COLORSET_TEXTURES[settings.theme] || '')
    : 'none';

  // Utiliser la méthode updateConfig() du code original
  await diceBoxInstance.updateConfig({
    theme_colorset: settings.theme || 'custom',
    theme_texture: textureForTheme,
    theme_material: settings.themeMaterial || "plastic",
    theme_customColorset: !settings.theme ? {
      name: 'custom',
      foreground: '#ffffff',
      background: settings.themeColor,
      outline: settings.themeColor,
      edge: settings.themeColor,
      texture: 'none',
      material: settings.themeMaterial
    } : undefined,
    baseScale: settings.baseScale * 100 / 6,
    gravity_multiplier: settings.gravity * 400,
    strength: settings.strength,
    sounds: settings.soundsEnabled,
    volume: settings.soundsEnabled ? settings.volume : 0,
  });

  console.log('✅ Settings mis à jour sans réinitialisation');
}

// ✅ AJOUTER : Fonction pour nettoyer les dés entre les lancers
export function clearDiceBoxDice() {
  if (!diceBoxInstance) return;
  
  // Utiliser la méthode clearDice() du code original (ligne 850-858)
  if (typeof diceBoxInstance.clearDice === 'function') {
    console.log('🧹 Nettoyage des dés de la scène');
    diceBoxInstance.clearDice();
  }
}

export function clearDiceBoxInstance() {
  if (diceBoxInstance && typeof diceBoxInstance.clearDice === 'function') {
    diceBoxInstance.clearDice();
  }
  diceBoxInstance = null;
  isInitializing = false;
}