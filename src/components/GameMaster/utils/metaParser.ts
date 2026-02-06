export const META_PREFIX = '#meta:';

export function parseMeta(description: string | null | undefined): any {
  if (!description) return null;
  const lines = description.split('\n').map(l => l.trim());
  const metaLine = [...lines].reverse().find(l => l.startsWith(META_PREFIX));
  if (!metaLine) return null;
  try {
    return JSON.parse(metaLine.slice(META_PREFIX.length));
  } catch {
    return null;
  }
}

export function getVisibleDescription(description: string | null | undefined): string {
  if (!description) return '';
  return description
    .split('\n')
    .filter(line => !line.trim().startsWith(META_PREFIX))
    .join('\n')
    .trim();
}

export function stripMetaFromDescription(description: string | null | undefined): string {
  if (!description) return '';
  return description
    .split('\n')
    .filter(line => !line.trim().startsWith(META_PREFIX))
    .join('\n')
    .trim();
}

export function buildFullDescription(visibleDesc: string, meta: any): string {
  const metaLine = meta ? `${META_PREFIX}${JSON.stringify(meta)}` : null;
  const cleanVisible = (visibleDesc || '').trim();
  if (metaLine) {
    return cleanVisible ? `${cleanVisible}\n${metaLine}` : metaLine;
  }
  return cleanVisible;
}
