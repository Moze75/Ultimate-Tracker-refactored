import type { Player } from '../types/dnd';

const PREFIX = 'ut:playerSnapshot:';

function getKey(playerId: string) {
  return `${PREFIX}${playerId}`;
}

/**
 * Récupère le dernier snapshot complet du joueur pour ce device.
 * Si rien n'est stocké, retourne null.
 */
export function getPlayerSnapshot(playerId: string): Player | null {
  try {
    const raw = localStorage.getItem(getKey(playerId));
    if (!raw) return null;
    return JSON.parse(raw) as Player;
  } catch (e) {
    console.error('[playerLocalStore] Erreur lecture snapshot:', e);
    return null;
  }
}

/**
 * Sauvegarde le snapshot complet du joueur dans le storage local.
 * On stocke tout le Player, pas seulement les HP, pour faciliter de futures extensions.
 */
export function setPlayerSnapshot(player: Player): void {
  try {
    if (!player?.id) return;
    localStorage.setItem(getKey(player.id), JSON.stringify(player));
  } catch (e) {
    console.error('[playerLocalStore] Erreur écriture snapshot:', e);
  }
}

/**
 * Efface le snapshot local d’un joueur (utile en logout ou changement de personnage).
 */
export function clearPlayerSnapshot(playerId: string): void {
  try {
    localStorage.removeItem(getKey(playerId));
  } catch {
    // no-op
  }
}