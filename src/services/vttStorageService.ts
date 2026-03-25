import { supabase } from '../lib/supabase';

const WORKER_URL = import.meta.env.VITE_CF_UPLOAD_WORKER_URL || '';
const UPLOAD_SECRET = import.meta.env.VITE_CF_UPLOAD_SECRET || '';

const QUOTA_MB = 512;

export type VttFolder = 'maps' | 'props' | 'tokens';

export async function uploadVttAsset(
  file: File,
  folder: VttFolder,
  userId: string,
  roomId?: string
): Promise<string> {
  if (!WORKER_URL) throw new Error('VITE_CF_UPLOAD_WORKER_URL non configuré');
  if (!UPLOAD_SECRET) throw new Error('VITE_CF_UPLOAD_SECRET non configuré');

  // 1. Vérification quota AVANT compression/upload
  await checkQuotaBeforeUpload(userId);

  // 2. Compression
  const compressed = await compressForVTT(file, folder);

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const prefix = roomId ? `${roomId}_` : '';
  const filename = `${prefix}${Date.now()}.${ext}`;

  const url = new URL(WORKER_URL);
  url.searchParams.set('folder', folder);
  url.searchParams.set('filename', filename);
  if (roomId) url.searchParams.set('roomId', roomId);
  url.searchParams.set('userId', userId);

  // 3. Upload vers R2
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'X-Upload-Secret': UPLOAD_SECRET,
      'Content-Type': compressed.type || 'image/jpeg',
    },
    body: compressed,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Upload R2 échoué (${response.status}): ${text}`);
  }

  const { url: cdnUrl, key, sizeBytes } = await response.json() as {
    url: string;
    key: string;
    sizeBytes: number;
  };

  // 4. Tracking dans user_assets (non bloquant si échec)
  const { error } = await supabase
    .from('user_assets')
    .insert({
      user_id:    userId,
      r2_key:     key,
      cdn_url:    cdnUrl,
      folder:     folder,
      size_bytes: sizeBytes,
    });

  if (error) {
    // L'upload R2 a réussi — on log sans bloquer l'utilisateur
    console.warn('Tracking user_assets échoué:', error.message);
  }

  return cdnUrl;
}

async function checkQuotaBeforeUpload(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('user_storage_usage')
    .select('used_mb')
    .eq('user_id', userId)
    .maybeSingle(); // maybeSingle : pas d'erreur si le user n'a encore rien uploadé

  if (error) throw new Error('Impossible de vérifier le quota');

  const usedMb = Number(data?.used_mb ?? 0);
  if (usedMb >= QUOTA_MB) {
    throw new Error(`Quota de stockage atteint (${usedMb} MB / ${QUOTA_MB} MB)`);
  }
}

function compressForVTT(file: File, folder: VttFolder): Promise<Blob> {
  const config: Record<VttFolder, { maxPx: number; quality: number; mime: string }> = {
    maps:   { maxPx: 4096, quality: 0.88, mime: 'image/jpeg' },
    props:  { maxPx: 1024, quality: 0.82, mime: 'image/jpeg' },
    tokens: { maxPx: 512,  quality: 0.90, mime: 'image/png'  }, // PNG pour conserver la transparence
  };
  const { maxPx, quality, mime } = config[folder];

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Compression échouée')),
          mime,
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function isDataUrl(url: string): boolean {
  return url.startsWith('data:');
}