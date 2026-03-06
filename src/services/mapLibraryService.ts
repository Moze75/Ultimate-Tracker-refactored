// Bibliothèque de cartes VTT — persistée dans Supabase (vtt_rooms.map_library)
// Fallback localStorage si roomId absent

import { supabase } from '../lib/supabase';

const LOCAL_KEY = 'vtt_map_library_v1';

export interface MapEntry {
  id: string;
  name: string;
  url: string;           // URL R2 ou externe
  folderId: string | null;
  addedAt: string;
  width?: number;
  height?: number;
}

export interface MapFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface MapLibrary {
  folders: MapFolder[];
  maps: MapEntry[];
}

// ── Helpers locaux ────────────────────────────────────────────────────────────
function loadLocal(): MapLibrary {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return { folders: [], maps: [] };
    return JSON.parse(raw) as MapLibrary;
  } catch {
    return { folders: [], maps: [] };
  }
}

function saveLocal(lib: MapLibrary): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(lib));
}

// ── API Supabase ──────────────────────────────────────────────────────────────
export async function fetchMapLibrary(roomId: string): Promise<MapLibrary> {
  const { data, error } = await supabase
    .from('vtt_rooms')
    .select('map_library')
    .eq('id', roomId)
    .maybeSingle();

  if (error || !data) return { folders: [], maps: [] };
  const lib = data.map_library as MapLibrary | null;
  return lib ?? { folders: [], maps: [] };
}

export async function saveMapLibrary(roomId: string, lib: MapLibrary): Promise<void> {
  // Sauvegarde Supabase (source de vérité)
  await supabase
    .from('vtt_rooms')
    .update({ map_library: lib })
    .eq('id', roomId);
  // Mise en cache local pour réactivité UI
  saveLocal(lib);
}

// ── Objet mapLibrary synchrone (lecture locale cache) ─────────────────────────
// Utilisé par VTTMapLibrary pour le rendu synchrone, couplé à fetchMapLibrary au montage
export const mapLibrary = {
  get(): MapLibrary {
    return loadLocal();
  },

  setCache(lib: MapLibrary): void {
    saveLocal(lib);
  },

  // ── Dossiers ────────────────────────────────────────────────────────────────
  createFolder(name: string): MapFolder {
    const lib = loadLocal();
    const folder: MapFolder = {
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
    const folder = lib.folders.find(f => f.id === folderId);
    if (folder) folder.name = name.trim();
    saveLocal(lib);
  },

  deleteFolder(folderId: string): void {
    const lib = loadLocal();
    lib.folders = lib.folders.filter(f => f.id !== folderId);
    lib.maps = lib.maps.map(m =>
      m.folderId === folderId ? { ...m, folderId: null } : m
    );
    saveLocal(lib);
  },

  // ── Cartes ──────────────────────────────────────────────────────────────────
  addMap(entry: Omit<MapEntry, 'id' | 'addedAt'>): MapEntry {
    const lib = loadLocal();
    const map: MapEntry = {
      ...entry,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    };
    lib.maps.push(map);
    saveLocal(lib);
    return map;
  },

  renameMap(mapId: string, name: string): void {
    const lib = loadLocal();
    const map = lib.maps.find(m => m.id === mapId);
    if (map) map.name = name.trim();
    saveLocal(lib);
  },

  moveMap(mapId: string, folderId: string | null): void {
    const lib = loadLocal();
    const map = lib.maps.find(m => m.id === mapId);
    if (map) map.folderId = folderId;
    saveLocal(lib);
  },

  deleteMap(mapId: string): void {
    const lib = loadLocal();
    lib.maps = lib.maps.filter(m => m.id !== mapId);
    saveLocal(lib);
  },
};