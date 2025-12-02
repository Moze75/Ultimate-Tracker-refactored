/**
 * Service de cache local pour les avatars
 * Stocke les images en base64 dans localStorage avec validation
 */

const AVATAR_CACHE_PREFIX = 'ut:avatar:';
const AVATAR_CACHE_TS_PREFIX = 'ut:avatar:ts:';
const AVATAR_CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 jours
const MAX_AVATAR_SIZE_BYTES = 500 * 1024; // 500KB max par avatar en base64

/**
 * Génère une clé de cache unique pour un avatar
 */
const getCacheKey = (playerId: string): string => {
  return `${AVATAR_CACHE_PREFIX}${playerId}`;
};

const getTimestampKey = (playerId: string): string => {
  return `${AVATAR_CACHE_TS_PREFIX}${playerId}`;
};

/**
 * Vérifie si un avatar est en cache et encore valide
 */
export const getAvatarFromCache = (playerId: string): string | null => {
  try {
    const cacheKey = getCacheKey(playerId);
    const tsKey = getTimestampKey(playerId);
    
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTs = localStorage. getItem(tsKey);
    
    if (! cachedData || ! cachedTs) {
      return null;
    }
    
    const age = Date.now() - parseInt(cachedTs, 10);
    
    // Cache expiré
    if (age > AVATAR_CACHE_TTL) {
      console.log(`[AvatarCache] ⏰ Cache expiré pour ${playerId}`);
      return null;
    }
    
    console.log(`[AvatarCache] ✅ Avatar trouvé en cache pour ${playerId}`);
    return cachedData;
  } catch (e) {
    console.warn('[AvatarCache] Erreur lecture cache:', e);
    return null;
  }
};

/**
 * Télécharge une image et la convertit en base64
 */
const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const blob = await response.blob();
    
    // Vérifier la taille
    if (blob. size > MAX_AVATAR_SIZE_BYTES) {
      console.warn(`[AvatarCache] ⚠️ Image trop grande (${Math.round(blob. size / 1024)}KB), compression... `);
      return await compressImage(blob);
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader. onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('[AvatarCache] Erreur fetch image:', e);
    return null;
  }
};

/**
 * Compresse une image pour réduire sa taille
 */
const compressImage = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img. onload = () => {
      URL.revokeObjectURL(url);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context non disponible'));
        return;
      }
      
      // Redimensionner à max 256x256 pour les avatars
      const maxSize = 256;
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas. height = height;
      
      ctx. drawImage(img, 0, 0, width, height);
      
      // Convertir en JPEG avec qualité 0.8
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve(dataUrl);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Erreur chargement image'));
    };
    
    img.src = url;
  });
};

/**
 * Sauvegarde un avatar dans le cache local
 */
export const cacheAvatar = async (
  playerId: string,
  imageUrl: string
): Promise<string | null> => {
  try {
    // Vérifier si déjà en cache avec la même URL
    const existingCache = localStorage.getItem(getCacheKey(playerId));
    if (existingCache) {
      const tsKey = getTimestampKey(playerId);
      const cachedTs = localStorage. getItem(tsKey);
      if (cachedTs) {
        const age = Date.now() - parseInt(cachedTs, 10);
        if (age < AVATAR_CACHE_TTL) {
          console. log(`[AvatarCache] 📦 Avatar déjà en cache pour ${playerId}`);
          return existingCache;
        }
      }
    }
    
    console.log(`[AvatarCache] 🔄 Téléchargement avatar pour ${playerId}...`);
    const base64 = await fetchImageAsBase64(imageUrl);
    
    if (!base64) {
      return null;
    }
    
    // Sauvegarder dans localStorage
    const cacheKey = getCacheKey(playerId);
    const tsKey = getTimestampKey(playerId);
    
    localStorage.setItem(cacheKey, base64);
    localStorage.setItem(tsKey, Date.now().toString());
    
    console.log(`[AvatarCache] 💾 Avatar mis en cache pour ${playerId}`);
    return base64;
  } catch (e) {
    console.error('[AvatarCache] Erreur mise en cache:', e);
    
    // Nettoyage en cas d'erreur de quota
    if (e instanceof DOMException && e. name === 'QuotaExceededError') {
      console.warn('[AvatarCache] ⚠️ Quota localStorage dépassé, nettoyage...');
      cleanOldAvatars();
    }
    
    return null;
  }
};

/**
 * Invalide le cache d'un avatar (après modification)
 */
export const invalidateAvatarCache = (playerId: string): void => {
  try {
    localStorage.removeItem(getCacheKey(playerId));
    localStorage. removeItem(getTimestampKey(playerId));
    console.log(`[AvatarCache] 🗑️ Cache invalidé pour ${playerId}`);
  } catch (e) {
    console.warn('[AvatarCache] Erreur invalidation:', e);
  }
};

/**
 * Nettoie les avatars les plus anciens pour libérer de l'espace
 */
const cleanOldAvatars = (): void => {
  try {
    const avatarKeys: { key: string; ts: number }[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?. startsWith(AVATAR_CACHE_PREFIX) && ! key.startsWith(AVATAR_CACHE_TS_PREFIX)) {
        const playerId = key.replace(AVATAR_CACHE_PREFIX, '');
        const tsKey = getTimestampKey(playerId);
        const ts = parseInt(localStorage.getItem(tsKey) || '0', 10);
        avatarKeys.push({ key, ts });
      }
    }
    
    // Trier par date (plus ancien en premier)
    avatarKeys.sort((a, b) => a.ts - b.ts);
    
    // Supprimer les 3 plus anciens
    const toDelete = avatarKeys. slice(0, 3);
    toDelete.forEach(({ key }) => {
      const playerId = key.replace(AVATAR_CACHE_PREFIX, '');
      invalidateAvatarCache(playerId);
    });
    
    console.log(`[AvatarCache] 🧹 ${toDelete.length} anciens avatars supprimés`);
  } catch (e) {
    console.warn('[AvatarCache] Erreur nettoyage:', e);
  }
};

/**
 * Précharge les avatars d'une liste de joueurs
 */
export const preloadAvatars = async (players: { id: string; avatar_url?: string | null }[]): Promise<void> => {
  const toLoad = players.filter(p => {
    if (!p.avatar_url) return false;
    const cached = getAvatarFromCache(p. id);
    return ! cached;
  });
  
  if (toLoad.length === 0) {
    console.log('[AvatarCache] ✅ Tous les avatars sont en cache');
    return;
  }
  
  console. log(`[AvatarCache] 📥 Préchargement de ${toLoad.length} avatars...`);
  
  // Charger en parallèle (max 3 à la fois)
  const batchSize = 3;
  for (let i = 0; i < toLoad.length; i += batchSize) {
    const batch = toLoad.slice(i, i + batchSize);
    await Promise.all(
      batch. map(p => cacheAvatar(p.id, p.avatar_url! ))
    );
  }
  
  console.log('[AvatarCache] ✅ Préchargement terminé');
};

export default {
  getAvatarFromCache,
  cacheAvatar,
  invalidateAvatarCache,
  preloadAvatars,
};