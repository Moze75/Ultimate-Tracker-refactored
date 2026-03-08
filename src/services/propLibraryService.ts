// Bibliothèque de props VTT — persistée dans Supabase (vtt_rooms.prop_library)
// Fallback localStorage si roomId absent

import { supabase } from '../lib/supabase';

const LOCAL_KEY = 'vtt_prop_library_v1';

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
function loadLocal(): PropLibrary {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return { folders: [], props: [] };
    return JSON.parse(raw) as PropLibrary;
  } catch {
    return { folders: [], props: [] };
  }
}

function saveLocal(lib: PropLibrary): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(lib));
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
  saveLocal(lib);
}

// ── Objet propLibrary synchrone (lecture locale cache) ───────────────────────
export const propLibrary = {
  get(): PropLibrary {
    return loadLocal();
  },

  setCache(lib: PropLibrary): void {
    saveLocal(lib);
  },

  // ── Dossiers ────────────────────────────────────────────────────────────────
  createFolder(name: string): PropFolder {
    const lib = loadLocal();
    const folder: PropFolder = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    lib.folders.push(folder);
    saveLocal(lib);
    return folder;
  },

  renameFolder(folderId: string, name: string): void {
    const lib = loadLocal();
    const f = lib.folders.find(f => f.id === folderId);
    if (f) f.name = name.trim();
    saveLocal(lib);
  },

  deleteFolder(folderId: string): void {
    const lib = loadLocal();
    lib.folders = lib.folders.filter(f => f.id !== folderId);
    lib.props = lib.props.map(p =>
      p.folderId === folderId ? { ...p, folderId: null } : p
    );
    saveLocal(lib);
  },

  // ── Props ────────────────────────────────────────────────────────────────────
  addProp(entry: Omit<PropEntry, 'id' | 'addedAt'>): PropEntry {
    const lib = loadLocal();
    const prop: PropEntry = {
      ...entry,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    };
    lib.props.push(prop);
    saveLocal(lib);
    return prop;
  },

  renameProp(propId: string, name: string): void {
    const lib = loadLocal();
    const p = lib.props.find(p => p.id === propId);
    if (p) p.name = name.trim();
    saveLocal(lib);
  },

  deleteProp(propId: string): void {
    const lib = loadLocal();
    lib.props = lib.props.filter(p => p.id !== propId);
    saveLocal(lib);
  },

  moveProp(propId: string, folderId: string | null): void {
    const lib = loadLocal();
    const p = lib.props.find(p => p.id === propId);
    if (p) p.folderId = folderId;
    saveLocal(lib);
  },
};

export function isVideoUrl(url: string): boolean {
  return /\.(webm|mp4|ogv)(\?.*)?$/i.test(url);
}