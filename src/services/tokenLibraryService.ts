// Bibliothèque de tokens VTT — persistée dans Supabase (vtt_rooms.token_library)
// Fallback localStorage si roomId absent

import { supabase } from '../lib/supabase';

const LOCAL_KEY = 'vtt_token_library_v1';

export interface TokenEntry {
  id: string;
  name: string;
  imageUrl: string;      // URL R2, externe ou dataURL
  folderId: string | null;
  addedAt: string;
  size?: number;
  color?: string;
  hp?: number;
  maxHp?: number;
  showLabel?: boolean;
}

export interface TokenFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface TokenLibrary {
  folders: TokenFolder[];
  tokens: TokenEntry[];
}

function loadLocal(): TokenLibrary {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return { folders: [], tokens: [] };
    return JSON.parse(raw) as TokenLibrary;
  } catch {
    return { folders: [], tokens: [] };
  }
}

function saveLocal(lib: TokenLibrary): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(lib));
}

export async function fetchTokenLibrary(roomId: string): Promise<TokenLibrary> {
  const { data, error } = await supabase
    .from('vtt_rooms')
    .select('token_library')
    .eq('id', roomId)
    .maybeSingle();

  if (error || !data) return { folders: [], tokens: [] };
  const lib = (data as Record<string, unknown>).token_library as TokenLibrary | null;
  return lib ?? { folders: [], tokens: [] };
}

export async function saveTokenLibrary(roomId: string, lib: TokenLibrary): Promise<void> {
  const { error } = await supabase
    .from('vtt_rooms')
    .update({ token_library: lib } as Record<string, unknown>)
    .eq('id', roomId);

  if (error) {
    console.error('[TokenLib] Erreur sauvegarde Supabase:', error.message);
  }

  saveLocal(lib);
}

export const tokenLibrary = {
  get(): TokenLibrary {
    return loadLocal();
  },

  setCache(lib: TokenLibrary): void {
    saveLocal(lib);
  },

  // -------------------
  // Gestion des dossiers
  // -------------------
  createFolder(name: string): TokenFolder {
    const lib = loadLocal();
    const folder: TokenFolder = {
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
    lib.tokens = lib.tokens.map(token =>
      token.folderId === folderId ? { ...token, folderId: null } : token
    );
    saveLocal(lib);
  },

  // -------------------
  // Gestion des tokens
  // -------------------
  addToken(entry: Omit<TokenEntry, 'id' | 'addedAt'>): TokenEntry {
    const lib = loadLocal();
    const token: TokenEntry = {
      ...entry,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    };
    lib.tokens.push(token);
    saveLocal(lib);
    return token;
  },

  renameToken(tokenId: string, name: string): void {
    const lib = loadLocal();
    const token = lib.tokens.find(t => t.id === tokenId);
    if (token) token.name = name.trim();
    saveLocal(lib);
  },

  moveToken(tokenId: string, folderId: string | null): void {
    const lib = loadLocal();
    const token = lib.tokens.find(t => t.id === tokenId);
    if (token) token.folderId = folderId;
    saveLocal(lib);
  },

  deleteToken(tokenId: string): void {
    const lib = loadLocal();
    lib.tokens = lib.tokens.filter(t => t.id !== tokenId);
    saveLocal(lib);
  },
};