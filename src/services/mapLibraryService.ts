// Bibliothèque de cartes VTT — stockée en localStorage
// Aucune consommation Supabase

const STORAGE_KEY = 'vtt_map_library_v1';

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

function load(): MapLibrary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { folders: [], maps: [] };
    return JSON.parse(raw) as MapLibrary;
  } catch {
    return { folders: [], maps: [] };
  }
}

function save(lib: MapLibrary): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lib));
}

export const mapLibrary = {
  get(): MapLibrary {
    return load();
  },

  // ── Dossiers ────────────────────────────────────────────────────────────
  createFolder(name: string): MapFolder {
    const lib = load();
    const folder: MapFolder = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    lib.folders.push(folder);
    save(lib);
    return folder;
  },

  renameFolder(folderId: string, name: string): void {
    const lib = load();
    const folder = lib.folders.find(f => f.id === folderId);
    if (folder) folder.name = name.trim();
    save(lib);
  },

  deleteFolder(folderId: string): void {
    const lib = load();
    lib.folders = lib.folders.filter(f => f.id !== folderId);
    // Les cartes du dossier vont à la racine
    lib.maps = lib.maps.map(m =>
      m.folderId === folderId ? { ...m, folderId: null } : m
    );
    save(lib);
  },

  // ── Cartes ──────────────────────────────────────────────────────────────
  addMap(entry: Omit<MapEntry, 'id' | 'addedAt'>): MapEntry {
    const lib = load();
    const map: MapEntry = {
      ...entry,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    };
    lib.maps.push(map);
    save(lib);
    return map;
  },

  renameMap(mapId: string, name: string): void {
    const lib = load();
    const map = lib.maps.find(m => m.id === mapId);
    if (map) map.name = name.trim();
    save(lib);
  },

  moveMap(mapId: string, folderId: string | null): void {
    const lib = load();
    const map = lib.maps.find(m => m.id === mapId);
    if (map) map.folderId = folderId;
    save(lib);
  },

  deleteMap(mapId: string): void {
    const lib = load();
    lib.maps = lib.maps.filter(m => m.id !== mapId);
    save(lib);
  },
};