const WORKER_URL = import.meta.env.VITE_CF_UPLOAD_WORKER_URL || '';
const UPLOAD_SECRET = import.meta.env.VITE_CF_UPLOAD_SECRET || '';

export type VttFolder = 'maps' | 'props' | 'tokens';

export async function uploadVttAsset(
  file: File,
  folder: VttFolder,
  roomId?: string
): Promise<string> {
  if (!WORKER_URL) throw new Error('VITE_CF_UPLOAD_WORKER_URL non configuré');
  if (!UPLOAD_SECRET) throw new Error('VITE_CF_UPLOAD_SECRET non configuré');

  const compressed = await compressForVTT(file, folder);

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const prefix = roomId ? `${roomId}_` : '';
  const filename = `${prefix}${Date.now()}.${ext}`;

  const url = new URL(WORKER_URL);
  url.searchParams.set('folder', folder);
  url.searchParams.set('filename', filename);

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

  const { url: cdnUrl } = await response.json() as { url: string; key: string };
  return cdnUrl;
}

function compressForVTT(file: File, folder: VttFolder): Promise<Blob> {
  const config: Record<VttFolder, { maxPx: number; quality: number }> = {
    maps:   { maxPx: 4096, quality: 0.88 },
    props:  { maxPx: 1024, quality: 0.82 },
    tokens: { maxPx: 512,  quality: 0.80 },
  };
  const { maxPx, quality } = config[folder];

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
          'image/jpeg',
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