// Bibliothèque de cartes VTT — persistée dans Supabase (vtt_rooms.map_library)
// Fallback localStorage si roomId absent

import { supabase } from '../lib/supabase';

const localKey = (roomId: string) => `vtt_map_library_v1_${roomId}`;

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
function loadLocal(roomId: string): MapLibrary {
  try {
    const raw = localStorage.getItem(localKey(roomId));
    if (!raw) return { folders: [], maps: [] };
    return JSON.parse(raw) as MapLibrary;
  } catch {
    return { folders: [], maps: [] };
  }
}

function saveLocal(roomId: string, lib: MapLibrary): void {
  localStorage.setItem(localKey(roomId), JSON.stringify(lib));
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
  saveLocal(roomId, lib);
}

// ── Objet mapLibrary synchrone (lecture locale cache) ─────────────────────────
// Utilisé par VTTMapLibrary pour le rendu synchrone, couplé à fetchMapLibrary au montage
export const mapLibrary = {
  get(roomId: string): MapLibrary {
    return loadLocal(roomId);
  },

  setCache(roomId: string, lib: MapLibrary): void {
    saveLocal(roomId, lib);
  },

  // ── Dossiers ────────────────────────────────────────────────────────────────
  createFolder(roomId: string, name: string): MapFolder {
    const lib = loadLocal(roomId);
    const folder: MapFolder = {
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
    const folder = lib.folders.find(f => f.id === folderId);
    if (folder) folder.name = name.trim();
    saveLocal(roomId, lib);
  },

  deleteFolder(roomId: string, folderId: string): void {
    const lib = loadLocal(roomId);
    lib.folders = lib.folders.filter(f => f.id !== folderId);
    lib.maps = lib.maps.map(m =>
      m.folderId === folderId ? { ...m, folderId: null } : m
    );
    saveLocal(roomId, lib);
  },

  // ── Cartes ──────────────────────────────────────────────────────────────────
  addMap(roomId: string, entry: Omit<MapEntry, 'id' | 'addedAt'>): MapEntry {
    const lib = loadLocal(roomId);
    const map: MapEntry = {
      ...entry,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    };
    lib.maps.push(map);
    saveLocal(roomId, lib);
    return map;
  },

  renameMap(roomId: string, mapId: string, name: string): void {
    const lib = loadLocal(roomId);
    const map = lib.maps.find(m => m.id === mapId);
    if (map) map.name = name.trim();
    saveLocal(roomId, lib);
  },

  moveMap(roomId: string, mapId: string, folderId: string | null): void {
    const lib = loadLocal(roomId);
    const map = lib.maps.find(m => m.id === mapId);
    if (map) map.folderId = folderId;
    saveLocal(roomId, lib);
  },

  deleteMap(roomId: string, mapId: string): void {
    const lib = loadLocal(roomId);
    lib.maps = lib.maps.filter(m => m.id !== mapId);
    saveLocal(roomId, lib);
  },
};