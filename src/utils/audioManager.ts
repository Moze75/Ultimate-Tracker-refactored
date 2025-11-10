class AudioManager {
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private maxInstances = 10;
  private isUnlocked = false; // 🔧 AJOUTER

  /**
   * 🔧 Débloque l'audio sur mobile (nécessite une interaction utilisateur)
   */
  unlock(): void {
    if (this.isUnlocked) return;
    
    const dummyAudio = new Audio();
    const promise = dummyAudio.play();
    
    if (promise !== undefined) {
      promise
        .then(() => {
          dummyAudio.pause();
          dummyAudio.remove();
          this.isUnlocked = true;
          console.log('🔓 [AudioManager] Audio débloqué');
        })
        .catch(() => {
          console.warn('🔒 [AudioManager] Audio toujours bloqué (nécessite interaction utilisateur)');
        });
    }
  }

  play(src: string, volume: number = 0.5): void {
    // 🔧 Débloquer au premier appel
    if (!this.isUnlocked) {
      this.unlock();
    }

    try {
      let audio = this.audioCache.get(src);

      if (!audio) {
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

        audio.addEventListener('ended', () => {
          audio!.currentTime = 0;
        });
      }

      if (!audio.paused) {
        audio.currentTime = 0;
      }

      audio.volume = volume;
      audio.play().catch(err => {
        console.warn(`[AudioManager] Erreur lecture "${src}":`, err.message);
        // 🔧 Retry si bloqué
        if (err.name === 'NotAllowedError') {
          this.isUnlocked = false;
          console.warn('[AudioManager] Audio bloqué, réessayez après interaction utilisateur');
        }
      });
    } catch (error) {
      console.warn(`[AudioManager] Impossible de jouer "${src}":`, error);
    }
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