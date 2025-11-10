/**
 * Gestionnaire audio centralisé pour éviter la création excessive de WebMediaPlayer
 * Réutilise les instances Audio au lieu d'en créer de nouvelles à chaque fois
 */

class AudioManager {
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private maxInstances = 10; // Limite le nombre d'instances audio

  /**
   * Joue un son en réutilisant une instance existante ou en créant une nouvelle
   */
  play(src: string, volume: number = 0.5): void {
    try {
      let audio = this.audioCache.get(src);

      // Si l'audio n'existe pas, le créer
      if (!audio) {
        // Si on atteint la limite, supprimer la plus ancienne
        if (this.audioCache.size >= this.maxInstances) {
          const firstKey = this.audioCache.keys().next().value;
          const oldAudio = this.audioCache.get(firstKey);
          if (oldAudio) {
            oldAudio.pause();
            oldAudio.src = '';
            oldAudio.remove();
          }
          this.audioCache.delete(firstKey);
        }

        audio = new Audio(src);
        audio.volume = volume;
        this.audioCache.set(src, audio);

        // Nettoyer quand le son est terminé
        audio.addEventListener('ended', () => {
          audio!.currentTime = 0; // Réinitialiser pour pouvoir rejouer
        });
      }

      // Si l'audio est déjà en cours, la redémarrer
      if (!audio.paused) {
        audio.currentTime = 0;
      }

      audio.volume = volume;
      audio.play().catch(err => {
        console.warn(`[AudioManager] Erreur lecture "${src}":`, err.message);
      });
    } catch (error) {
      console.warn(`[AudioManager] Impossible de jouer "${src}":`, error);
    }
  }

  /**
   * Arrête tous les sons en cours
   */
  stopAll(): void {
    this.audioCache.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  /**
   * Libère toutes les ressources audio
   */
  cleanup(): void {
    this.audioCache.forEach(audio => {
      audio.pause();
      audio.src = '';
      audio.remove();
    });
    this.audioCache.clear();
  }
}

// Export une instance singleton
export const audioManager = new AudioManager();