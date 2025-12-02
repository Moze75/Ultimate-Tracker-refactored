import { useState, useEffect, useCallback } from 'react';
import {
  getAvatarFromCache,
  cacheAvatar,
  invalidateAvatarCache,
} from '../services/avatarCacheService';

interface UseAvatarCacheResult {
  avatarSrc: string | null;
  isLoading: boolean;
  error: boolean;
  refresh: () => void;
}

/**
 * Hook pour charger un avatar avec cache local
 * @param playerId - ID du joueur
 * @param remoteUrl - URL Supabase de l'avatar
 * @returns { avatarSrc, isLoading, error, refresh }
 */
export function useAvatarCache(
  playerId: string | undefined,
  remoteUrl: string | null | undefined
): UseAvatarCacheResult {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadAvatar = useCallback(async () => {
    if (!playerId) {
      setAvatarSrc(null);
      setIsLoading(false);
      return;
    }

    // Pas d'URL = pas d'avatar
    if (!remoteUrl) {
      setAvatarSrc(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(false);

    // 1. Vérifier le cache local
    const cached = getAvatarFromCache(playerId);
    if (cached) {
      setAvatarSrc(cached);
      setIsLoading(false);
      return;
    }

    // 2. Télécharger et mettre en cache
    try {
      const base64 = await cacheAvatar(playerId, remoteUrl);
      if (base64) {
        setAvatarSrc(base64);
      } else {
        // Fallback : utiliser l'URL directe
        setAvatarSrc(remoteUrl);
      }
    } catch (e) {
      console. error('[useAvatarCache] Erreur:', e);
      setError(true);
      // Fallback : utiliser l'URL directe
      setAvatarSrc(remoteUrl);
    } finally {
      setIsLoading(false);
    }
  }, [playerId, remoteUrl]);

  useEffect(() => {
    loadAvatar();
  }, [loadAvatar]);

  const refresh = useCallback(() => {
    if (playerId) {
      invalidateAvatarCache(playerId);
      loadAvatar();
    }
  }, [playerId, loadAvatar]);

  return { avatarSrc, isLoading, error, refresh };
}

export default useAvatarCache;