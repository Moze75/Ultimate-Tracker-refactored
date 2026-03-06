// Service d'upload des assets VTT vers Cloudflare R2
// Remplace le dataURL base64 stocké en BDD

const WORKER_URL = import.meta.env.VITE_CF_UPLOAD_WORKER_URL || '';
// Ex: https://vtt-upload.TON-COMPTE.workers.dev

type VttFolder = 'maps' | 'props' | 'tokens';

/**
 * Upload un fichier vers Cloudflare R2 via le Worker.
 * Retourne l'URL CDN publique.
 */
export async function uploadVttAsset(
  file: File,
  folder: VttFolder,
  authToken: string,
  roomId?: string
): Promise<string> {
  // Compression avant upload selon le type
  const compressed = await compressForVTT(file, folder);

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filename = `${roomId ? roomId + '_' : ''}${Date.now()}.${ext}`;

  const url = new URL(WORKER_URL);
  url.searchParams.set('folder', folder);
  url.searchParams.set('filename', filename);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': compressed.type,
    },
    body: compressed,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  const { url: cdnUrl } = await response.json();
  return cdnUrl;
}

/**
 * Compression adaptée selon l'usage :
 * - maps : qualité haute, max 4K
 * - props : qualité moyenne, max 1K
 * - tokens : qualité moyenne, max 512px (déjà compressé côté token)
 */
async function compressForVTT(
  file: File,
  folder: VttFolder
): Promise<Blob> {
  const config = {
    maps:   { maxPx: 4096, quality: 0.88 },
    props:  { maxPx: 1024, quality: 0.82 },
    tokens: { maxPx: 512,  quality: 0.80 },
  }[folder];

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, config.maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
          'image/jpeg',
          config.quality
        );
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Vérifie si une URL est déjà hébergée sur Cloudflare (R2 ou autre CDN externe)
 * Dans ce cas, pas besoin de ré-uploader.
 */
export function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Vérifie si une URL est un dataURL base64 (à éviter en BDD)
 */
export function isDataUrl(url: string): boolean {
  return url.startsWith('data:');
}