// Configuration centralisée des URLs d'assets
// Permet de basculer facilement entre Supabase et Cloudflare R2

const USE_CLOUDFLARE = import.meta.env.VITE_USE_CLOUDFLARE === 'true';
const CLOUDFLARE_R2_URL = import.meta.env.VITE_CLOUDFLARE_R2_URL || '';
const SUPABASE_STORAGE_URL = 'https://yumzqyyogwzrmlcpvnky.supabase.co/storage/v1/object/public';

// ✅ LOG TEMPORAIRE POUR DEBUG
console.log('🔍 [Assets Config]', {
  USE_CLOUDFLARE,
  CLOUDFLARE_R2_URL,
  SUPABASE_STORAGE_URL
});

// Helper pour construire l'URL selon la config
function getAssetUrl(path: string, forceCloudflare = false): string {
  if (forceCloudflare || USE_CLOUDFLARE) {
    return `${CLOUDFLARE_R2_URL}${path}`;
  }
  return `${SUPABASE_STORAGE_URL}${path}`;
}

export const ASSETS = {
  // Images statiques (migré vers R2)
  LOGIN_BACKGROUND: getAssetUrl('/static/tmpoofee5sh.png', true),
  CHARACTER_SILHOUETTE: getAssetUrl('/static/Silouete.png', true),
  
  // Images de classes (migré vers R2)
  CLASS_IMAGES: {
    Guerrier: getAssetUrl('/static/Guerrier.png', true),
    Magicien: getAssetUrl('/static/Magicien.png', true),
    Roublard: getAssetUrl('/static/Voleur.png', true),
    Clerc: getAssetUrl('/static/Clerc.png', true),
    Barbare: getAssetUrl('/static/Barbare.png', true),
    Barde: getAssetUrl('/static/Barde.png', true),
    Druide: getAssetUrl('/static/Druide.png', true),
    Rôdeur: getAssetUrl('/static/Rodeur.png', true),
    Moine: getAssetUrl('/static/Moine.png', true),
    Paladin: getAssetUrl('/static/Paladin.png', true),
    Ensorceleur: getAssetUrl('/static/Ensorceleur.png', true),
    Occultiste: getAssetUrl('/static/Occultiste.png', true),
  } as Record<string, string>,
  
  // Images de races (migré vers R2)
  RACE_IMAGES: {
    'Humain': getAssetUrl('/Races/Humain.png', true),
    'Elfe': getAssetUrl('/Races/Elfe.png', true),
    'Nain': getAssetUrl('/Races/Nain.png', true),
    'Halfelin': getAssetUrl('/Races/Halfelin.png', true),
    'Demi-Elfe': getAssetUrl('/Races/Demi-Elfe.png', true),
    'Demi-Orc': getAssetUrl('/Races/Demi-Orc.png', true),
    'Gnome': getAssetUrl('/Races/Gnome. png', true),
    'Tieffelin': getAssetUrl('/Races/Tieffelin.png', true),
    'Drakéide': getAssetUrl('/Races/Drakeide.png', true),
  } as Record<string, string>,
  
  // Avatars de joueurs (restent sur Supabase pour l'upload direct)
  AVATARS_BASE:  `${SUPABASE_STORAGE_URL}/avatars`,
};

// Helper pour récupérer l'image d'une classe
export function getClassImageUrl(className: string): string {
  return ASSETS. CLASS_IMAGES[className] || getAssetUrl('/static/default-class.png', true);
}

// Helper pour récupérer l'image d'une race
export function getRaceImageUrl(raceName: string): string {
  return ASSETS.RACE_IMAGES[raceName] || getAssetUrl('/Races/default-race.png', true);
}

export { getAssetUrl };