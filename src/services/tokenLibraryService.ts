// Bibliothèque de tokens VTT — persistée dans Supabase (vtt_rooms.token_library)
// Fallback localStorage si roomId absent

import { supabase } from '../lib/supabase';

const localKey = (roomId: string) => `vtt_token_library_v1_${roomId}`;

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

  // gestion de l'origine du token de bibliothèque
  source?: 'upload' | 'url' | 'monster-import' | 'custom-monster';

  // gestion du lien vers un monstre de campagne éditable
  linkedMonsterId?: string | null;
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

function loadLocal(roomId: string): TokenLibrary {
  try {
    const raw = localStorage.getItem(localKey(roomId));
    if (!raw) return { folders: [], tokens: [] };
    return JSON.parse(raw) as TokenLibrary;
  } catch {
    return { folders: [], tokens: [] };
  }
}

function saveLocal(roomId: string, lib: TokenLibrary): void {
  localStorage.setItem(localKey(roomId), JSON.stringify(lib));
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

  saveLocal(roomId, lib);
}

export const tokenLibrary = {
  get(roomId: string): TokenLibrary {
    return loadLocal(roomId);
  },

  setCache(roomId: string, lib: TokenLibrary): void {
    saveLocal(roomId, lib);
  },

  // -------------------
  // Gestion des dossiers
  // -------------------
  createFolder(roomId: string, name: string): TokenFolder {
    const lib = loadLocal(roomId);
    const folder: TokenFolder = {
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
    lib.tokens = lib.tokens.map(token =>
      token.folderId === folderId ? { ...token, folderId: null } : token
    );
    saveLocal(roomId, lib);
  },

  // -------------------
  // Gestion des tokens
  // -------------------
  addToken(roomId: string, entry: Omit<TokenEntry, 'id' | 'addedAt'>): TokenEntry {
    const lib = loadLocal(roomId);
    const token: TokenEntry = {
      ...entry,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    };
    lib.tokens.push(token);
    saveLocal(roomId, lib);
    return token;
  },

  renameToken(roomId: string, tokenId: string, name: string): void {
    const lib = loadLocal(roomId);
    const token = lib.tokens.find(t => t.id === tokenId);
    if (token) token.name = name.trim();
    saveLocal(roomId, lib);
  },

  moveToken(roomId: string, tokenId: string, folderId: string | null): void {
    const lib = loadLocal(roomId);
    const token = lib.tokens.find(t => t.id === tokenId);
    if (token) token.folderId = folderId;
    saveLocal(roomId, lib);
  },

  deleteToken(roomId: string, tokenId: string): void {
    const lib = loadLocal(roomId);
    lib.tokens = lib.tokens.filter(t => t.id !== tokenId);
    saveLocal(roomId, lib);
  },
};