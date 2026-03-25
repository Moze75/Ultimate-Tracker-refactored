// Bibliothèque de props VTT — persistée dans Supabase (vtt_rooms.prop_library)
// Fallback localStorage si roomId absent

import { supabase } from '../lib/supabase';

const localKey = (roomId: string) => `vtt_prop_library_v1_${roomId}`;

export interface PropEntry {
  id: string;
  name: string;
  url: string;           // URL R2, externe, ou dataURL
  folderId: string | null;
  addedAt: string;
  isVideo?: boolean;     // true pour .webm/.mp4 (particules/animations)
  width?: number;
  height?: number;
}

export interface PropFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface PropLibrary {
  folders: PropFolder[];
  props: PropEntry[];
}

// ── Helpers locaux ────────────────────────────────────────────────────────────
function loadLocal(roomId: string): PropLibrary {
  try {
    const raw = localStorage.getItem(localKey(roomId));
    if (!raw) return { folders: [], props: [] };
    return JSON.parse(raw) as PropLibrary;
  } catch {
    return { folders: [], props: [] };
  }
}

function saveLocal(roomId: string, lib: PropLibrary): void {
  localStorage.setItem(localKey(roomId), JSON.stringify(lib));
}

// ── API Supabase ──────────────────────────────────────────────────────────────
export async function fetchPropLibrary(roomId: string): Promise<PropLibrary> {
  const { data, error } = await supabase
    .from('vtt_rooms')
    .select('prop_library')
    .eq('id', roomId)
    .maybeSingle();

  if (error || !data) return { folders: [], props: [] };
  const lib = (data as Record<string, unknown>).prop_library as PropLibrary | null;
  return lib ?? { folders: [], props: [] };
}

export async function savePropLibrary(roomId: string, lib: PropLibrary): Promise<void> {
  const { error } = await supabase
    .from('vtt_rooms')
    .update({ prop_library: lib } as Record<string, unknown>)
    .eq('id', roomId);
  if (error) {
    console.error('[PropLib] Erreur sauvegarde Supabase:', error.message);
  }
  saveLocal(roomId, lib);
}

// ── Objet propLibrary synchrone (lecture locale cache) ───────────────────────
export const propLibrary = {
  get(roomId: string): PropLibrary {
    return loadLocal(roomId);
  },

  setCache(roomId: string, lib: PropLibrary): void {
    saveLocal(roomId, lib);
  },

  // ── Dossiers ────────────────────────────────────────────────────────────────
  createFolder(roomId: string, name: string): PropFolder {
    const lib = loadLocal(roomId);
    const folder: PropFolder = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    lib.folders.push(folder);
    saveLocal(roomId, lib);
    return folder;
  },

  renameFolder(roomId: string, folderId: string, name: string): void {
    const lib = loadLocal(roomId);
    const f = lib.folders.find(f => f.id === folderId);
    if (f) f.name = name.trim();
    saveLocal(roomId, lib);
  },

  deleteFolder(roomId: string, folderId: string): void {
    const lib = loadLocal(roomId);
    lib.folders = lib.folders.filter(f => f.id !== folderId);
    lib.props = lib.props.map(p =>
      p.folderId === folderId ? { ...p, folderId: null } : p
    );
    saveLocal(roomId, lib);
  },

  // ── Props ────────────────────────────────────────────────────────────────────
  addProp(roomId: string, entry: Omit<PropEntry, 'id' | 'addedAt'>): PropEntry {
    const lib = loadLocal(roomId);
    const prop: PropEntry = {
      ...entry,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    };
    lib.props.push(prop);
    saveLocal(roomId, lib);
    return prop;
  },

  renameProp(roomId: string, propId: string, name: string): void {
    const lib = loadLocal(roomId);
    const p = lib.props.find(p => p.id === propId);
    if (p) p.name = name.trim();
    saveLocal(roomId, lib);
  },

  deleteProp(roomId: string, propId: string): void {
    const lib = loadLocal(roomId);
    lib.props = lib.props.filter(p => p.id !== propId);
    saveLocal(roomId, lib);
  },

  moveProp(roomId: string, propId: string, folderId: string | null): void {
    const lib = loadLocal(roomId);
    const p = lib.props.find(p => p.id === propId);
    if (p) p.folderId = folderId;
    saveLocal(roomId, lib);
  },
};

export function isVideoUrl(url: string): boolean {
  return /\.(webm|mp4|ogv)(\?.*)?$/i.test(url);
}