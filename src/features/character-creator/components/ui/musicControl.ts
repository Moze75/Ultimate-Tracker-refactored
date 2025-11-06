// Service de contrôle de la musique du wizard

const MUSIC_SRC = '/Music/Skyrim8bits.mp3';
let globalAudio: HTMLAudioElement | null = null;
let globalIsPlaying = false;

// ✅ Fonction pour initialiser l'audio global
export function initWizardMusic() {
  if (!globalAudio) {
    globalAudio = new Audio(MUSIC_SRC);
    globalAudio.loop = true;
    globalAudio.volume = 0.35;
    console.log('[MusicControl] Audio global initialisé');
  }
  return globalAudio;
}

// ✅ Fonction pour arrêter ET DÉTRUIRE la musique
export function stopWizardMusic() {
  if (globalAudio) {
    try {
      globalAudio.pause();
      globalAudio.currentTime = 0;
      globalAudio.src = ''; // ✅ VIDER LA SOURCE
      globalAudio.load(); // ✅ FORCER LE RECHARGEMENT
      globalAudio = null; // ✅ DÉTRUIRE LA RÉFÉRENCE
      globalIsPlaying = false;
      console.log('[MusicControl] 🔇 Musique arrêtée et détruite');
    } catch (e) {
      console.warn('[MusicControl] ⚠️ Erreur lors de l\'arrêt de la musique:', e);
    }
  } else {
    console.log('[MusicControl] ℹ️ Aucune musique à arrêter');
  }
}

// ✅ Fonction pour démarrer la musique
export async function startWizardMusic(): Promise<boolean> {
  if (!globalAudio) {
    initWizardMusic();
  }
  
  if (!globalAudio) return false;

  // ✅ Ne pas démarrer si déjà en lecture
  if (globalIsPlaying) {
    console.log('[MusicControl] ℹ️ Musique déjà en lecture');
    return true;
  }

  try {
    await globalAudio.play();
    globalIsPlaying = true;
    console.log('[MusicControl] ✅ Musique démarrée');
    return true;
  } catch (e) {
    globalIsPlaying = false;
    console.log('[MusicControl] ⚠️ Autoplay bloqué par le navigateur');
    return false;
  }
}

// ✅ Fonction pour mettre en pause
export function pauseWizardMusic() {
  if (globalAudio && globalIsPlaying) {
    globalAudio.pause();
    globalIsPlaying = false;
    console.log('[MusicControl] ⏸️ Musique mise en pause');
  }
}

// ✅ Fonction pour reprendre
export async function resumeWizardMusic(): Promise<boolean> {
  if (!globalAudio) {
    // Réinitialiser si l'audio a été détruit
    return await startWizardMusic();
  }

  try {
    await globalAudio.play();
    globalIsPlaying = true;
    console.log('[MusicControl] ▶️ Musique reprise');
    return true;
  } catch {
    console.log('[MusicControl] ❌ Impossible de lire la musique');
    return false;
  }
}

// ✅ Getter pour savoir si la musique est en lecture
export function isWizardMusicPlaying(): boolean {
  return globalIsPlaying && globalAudio !== null;
}

// ✅ Getter pour l'instance audio (si besoin)
export function getWizardAudio(): HTMLAudioElement | null {
  return globalAudio;
}