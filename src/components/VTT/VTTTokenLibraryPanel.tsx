import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FolderPlus, Folder, FolderOpen, Trash2, Upload, CreditCard as Edit2, Check, X, Link, Image as ImageIcon, Skull } from 'lucide-react';
import type { VTTToken } from '../../types/vtt';
import {
  tokenLibrary, fetchTokenLibrary, saveTokenLibrary,
  type TokenEntry, type TokenLibrary,
} from '../../services/tokenLibraryService';
import { VTTCustomMonsterModal } from './VTTCustomMonsterModal';
import { ImportMonsterModal } from '../Combat/ImportMonsterModal';
import type { Monster } from '../../types/campaign';

interface VTTTokenLibraryPanelProps {
  roomId: string;
  campaignId?: string;
  userId: string;
}

interface DragGhost {
  tokenId: string;
  label: string;
  imageUrl: string;
  x: number;
  y: number;
}

export function VTTTokenLibraryPanel({ roomId, campaignId }: VTTTokenLibraryPanelProps) {
const [lib, setLib] = useState<TokenLibrary>(() => tokenLibrary.get(roomId));
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [showMonsterModal, setShowMonsterModal] = useState(false);

  // gestion du monstre custom actuellement édité
  const [editingMonster, setEditingMonster] = useState<Monster | null>(null);

  // gestion de l'import JSON de monstres vers la bibliothèque de tokens
  const [showImportModal, setShowImportModal] = useState(false);

  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [addUrlMode, setAddUrlMode] = useState<string | null>(null);
  const [addUrlValue, setAddUrlValue] = useState('');
  const [addUrlName, setAddUrlName] = useState('');
  const [uploading, setUploading] = useState(false);

  // gestion du menu contextuel des tokens de bibliothèque
  const [contextMenu, setContextMenu] = useState<{
    tokenId: string;
    x: number;
    y: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileTargetFolderRef = useRef<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const dragTokenIdRef = useRef<string | null>(null);
  const dragOverTargetRef = useRef<string | null>(null);

  useEffect(() => {
    fetchTokenLibrary(roomId).then(fetched => {
tokenLibrary.setCache(roomId, fetched);
      setLib(fetched);
    });
  }, [roomId]);

  const persist = useCallback(() => {
const current = tokenLibrary.get(roomId);
    setLib(current);
    saveTokenLibrary(roomId, current);
  }, [roomId]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  useEffect(() => {
    if (!contextMenu) return;

    // gestion de la fermeture différée du menu contextuel
    const timeoutId = window.setTimeout(() => {
      const closeMenu = () => setContextMenu(null);
      const closeOnEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setContextMenu(null);
      };

      window.addEventListener('click', closeMenu);
      window.addEventListener('scroll', closeMenu, true);
      window.addEventListener('keydown', closeOnEscape);

      return () => {
        window.removeEventListener('click', closeMenu);
        window.removeEventListener('scroll', closeMenu, true);
        window.removeEventListener('keydown', closeOnEscape);
      };
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [contextMenu]);

  // -------------------
  // Gestion du drag interne
  // -------------------
  const startInternalDrag = useCallback((e: React.MouseEvent, entry: TokenEntry) => {
    e.preventDefault();
    e.stopPropagation();

    dragTokenIdRef.current = entry.id;
    dragOverTargetRef.current = null;

    setDragGhost({
      tokenId: entry.id,
      label: entry.name,
      imageUrl: entry.imageUrl,
      x: e.clientX,
      y: e.clientY,
    });

    const onMove = (ev: MouseEvent) => {
      setDragGhost(prev => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null);

      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      let target: string | null = null;

      if (el) {
        const folderEl = el.closest('[data-folder-drop]') as HTMLElement | null;
        if (folderEl) target = folderEl.dataset.folderDrop ?? null;
        else if (el.closest('[data-root-drop]')) target = 'root';
      }

      dragOverTargetRef.current = target;
      setDragOverTarget(target);
    };

    const onUp = () => {
      const tokenId = dragTokenIdRef.current;
      const target = dragOverTargetRef.current;

      if (tokenId && target !== null) {
tokenLibrary.moveToken(roomId, tokenId, target === 'root' ? null : target);
        persist();
      }

      dragTokenIdRef.current = null;
      dragOverTargetRef.current = null;
      setDragGhost(null);
      setDragOverTarget(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [persist]);

  // -------------------
  // Gestion des dossiers
  // -------------------
  const toggleFolder = (id: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
const folder = tokenLibrary.createFolder(roomId, newFolderName);
    setOpenFolders(prev => new Set([...prev, folder.id]));
    setNewFolderMode(false);
    setNewFolderName('');
    persist();
  };

  const handleRenameStart = (id: string, current: string) => {
    setRenamingId(id);
    setRenameValue(current);
  };

  const handleRenameConfirm = (type: 'folder' | 'token') => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }

if (type === 'folder') tokenLibrary.renameFolder(roomId, renamingId, renameValue);
else tokenLibrary.renameToken(roomId, renamingId, renameValue);

    setRenamingId(null);
    persist();
  };

  const handleDeleteFolder = (folderId: string) => {
    if (!window.confirm('Supprimer ce dossier ? Les tokens seront déplacés à la racine.')) return;
tokenLibrary.deleteFolder(roomId, folderId);
    persist();
  };

  // -------------------
  // Gestion de l'ajout de tokens
  // -------------------
  const handleAddUrl = (folderId: string | null) => {
    if (!addUrlValue.trim()) return;

    const url = addUrlValue.trim();

    tokenLibrary.addToken(roomId, {
      name: addUrlName.trim() || url.split('/').pop()?.split('?')[0] || 'Token',
      imageUrl: url,
      folderId,
      size: 1,
      color: '#3b82f6',
      showLabel: true,
      source: 'url',
      linkedMonsterId: null,
    });

    setAddUrlValue('');
    setAddUrlName('');
    setAddUrlMode(null);
    persist();
  }; 

  const handleFileUpload = async (file: File, folderId: string | null) => {
    const workerUrl = import.meta.env.VITE_CF_UPLOAD_WORKER_URL;
    setUploading(true);

    try {
      let imageUrl: string;

      if (workerUrl) {
        const { uploadVttAsset } = await import('../../services/vttStorageService');
imageUrl = await uploadVttAsset(file, 'tokens', userId, roomId);
      } else {
        imageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target!.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      // gestion de l'ajout d'un token image uploadé dans la bibliothèque
      tokenLibrary.addToken(roomId, {
        name: file.name.replace(/\.[^.]+$/, ''),
        imageUrl,
        folderId,
        size: 1,
        color: '#3b82f6',
        showLabel: true,
        source: 'upload',
        linkedMonsterId: null,
      });

      persist();
    } catch (err) {
      console.error('Erreur upload token:', err);
      alert("Erreur lors de l'upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    const entry = lib.tokens.find(t => t.id === tokenId);
    if (!entry) return;

    const workerUrl = import.meta.env.VITE_CF_UPLOAD_WORKER_URL;
    const uploadSecret = import.meta.env.VITE_CF_UPLOAD_SECRET;

    if (workerUrl && uploadSecret && entry.imageUrl.includes('.r2.dev/vtt/')) {
      try {
        const key = entry.imageUrl.split('.r2.dev/')[1];
        if (key) {
          const u = new URL(workerUrl);
          u.searchParams.set('action', 'delete');
          u.searchParams.set('key', key);
          await fetch(u.toString(), { headers: { 'X-Upload-Secret': uploadSecret } });
        }
      } catch (err) {
        console.warn('[TokenLib] Suppression R2 ignorée:', err);
      }
    }

  tokenLibrary.deleteToken(roomId, tokenId);
    persist();
  };

  // -------------------
  // Gestion de la conversion des monstres importés en tokens de bibliothèque
  // -------------------
  // gestion de l'ajout des monstres importés JSON dans la bibliothèque de tokens
  const addImportedMonsterToLibrary = useCallback(async (monster: Monster) => {
    const currentLib = await fetchTokenLibrary(roomId);
    tokenLibrary.setCache(roomId, currentLib);

    let targetFolder = currentLib.folders.find(f => f.name === 'Monstres customs');

    if (!targetFolder) {
      targetFolder = tokenLibrary.createFolder(roomId, 'Monstres customs');
    }

    tokenLibrary.addToken(roomId, {
      name: monster.name,
      imageUrl: monster.image_url || '',
      folderId: targetFolder.id,
      size:
        monster.size === 'TP' ? 0.5 :
        monster.size === 'P' ? 0.75 :
        monster.size === 'G' ? 2 :
        monster.size === 'TG' ? 3 :
        monster.size === 'Gig' ? 4 :
        1,
      color: '#ef4444',
      hp: monster.hit_points,
      maxHp: monster.hit_points,
      showLabel: true,
      source: 'monster-import',
      linkedMonsterId: monster.id ?? null,
    });

    const updated = tokenLibrary.get(roomId);
    await saveTokenLibrary(roomId, updated);

    const refreshed = await fetchTokenLibrary(roomId);
    tokenLibrary.setCache(roomId, refreshed);
    setLib(refreshed);

    const refreshedCustomFolder = refreshed.folders.find(f => f.name === 'Monstres customs');
    if (refreshedCustomFolder) {
      setOpenFolders(prev => new Set([...prev, refreshedCustomFolder.id]));
    }
  }, [roomId]);

  // -------------------
  // Construction du token drag vers canvas
  // -------------------
  const buildCanvasTokenData = (entry: TokenEntry): Omit<VTTToken, 'id'> => ({
    characterId: null,
    ownerUserId: '',
    label: entry.name,
    imageUrl: entry.imageUrl,
    position: { x: 60, y: 60 },
    size: entry.size ?? 1,
    rotation: 0,
    visible: true,
    color: entry.color ?? '#3b82f6',
    hp: entry.hp,
    maxHp: entry.maxHp,
    showLabel: entry.showLabel ?? true,
    visionMode: 'normal',
    visionRadius: 8,
    lightSource: 'none',
    lightRadius: 0,
  });

    function LibraryTokenRow({ entry }: { entry: TokenEntry }) {
    const rowRef = React.useRef<HTMLDivElement>(null);
    const isRenaming = renamingId === entry.id;
    const isDragging = dragGhost?.tokenId === entry.id;

    useEffect(() => {
      const node = rowRef.current;
      if (!node) return;

      const handleNativeContextMenu = (e: MouseEvent) => {
        // gestion native du clic droit pour éviter les conflits avec draggable
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
          tokenId: entry.id,
          x: e.clientX,
          y: e.clientY,
        });
      };

      node.addEventListener('contextmenu', handleNativeContextMenu);
      return () => {
        node.removeEventListener('contextmenu', handleNativeContextMenu);
      };
    }, [entry.id]);

    return (
      <div
        ref={rowRef}
        className={`group flex items-center gap-2 px-2 py-1.5 rounded-md transition-all select-none ${
          isDragging ? 'opacity-40' : 'opacity-100'
        } hover:bg-gray-800/40`}
      >
        <div
          className="relative shrink-0 cursor-grab active:cursor-grabbing"
          draggable
          onDragStart={e => {
            // gestion du drag direct sur le token
            e.dataTransfer.setData(
              'application/vtt-new-token',
              JSON.stringify(buildCanvasTokenData(entry))
            );
            e.dataTransfer.effectAllowed = 'copy';
          }}
        >
          {entry.imageUrl ? (
            <img
              src={entry.imageUrl}
              alt={entry.name}
              draggable={false}
              className="w-8 h-8 rounded-full object-cover border border-gray-700 pointer-events-none"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full border flex items-center justify-center text-[9px] font-bold text-white"
              style={{ backgroundColor: entry.color || '#374151', borderColor: entry.color || '#4b5563' }}
            >
              {entry.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <div className="flex items-center gap-1">
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRenameConfirm('token');
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                onClick={e => e.stopPropagation()}
                className="w-full px-2 py-0.5 bg-black/60 border border-amber-500 rounded text-white text-[11px] outline-none"
              />
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => handleRenameConfirm('token')}
                className="p-0.5 rounded bg-green-600/90 hover:bg-green-500 text-white"
              >
                <Check size={9} />
              </button>
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => setRenamingId(null)}
                className="p-0.5 rounded bg-gray-600/90 hover:bg-gray-500 text-white"
              >
                <X size={9} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] truncate font-medium text-gray-200" title={entry.name}>
                {entry.name}
              </span>
              {(entry.hp != null || entry.maxHp != null) && (
                <span className="text-[9px] text-gray-500 truncate">
                  {entry.hp ?? 0}/{entry.maxHp ?? 0} PV
                </span>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            // gestion d'un fallback d'ouverture du menu d'actions
            e.preventDefault();
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            console.log('open token menu', entry.id);
            setContextMenu({
              tokenId: entry.id,
              x: Math.round(rect.right - 8),
              y: Math.round(rect.bottom + 4),
            });
          }}
          className="shrink-0 px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-white hover:bg-gray-700/60 rounded transition-colors"
          title="Actions"
        >
          •••
        </button>
      </div>
    );
  }

  const renderToken = (entry: TokenEntry) => <LibraryTokenRow key={entry.id} entry={entry} />;
  
  const renderAddUrlForm = (folderId: string | null) => (
    <div className="mx-2 mt-1 mb-1 space-y-1 p-2 bg-gray-800/60 rounded-lg border border-gray-700">
      <input type="text" value={addUrlName} onChange={e => setAddUrlName(e.target.value)} placeholder="Nom (optionnel)" className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500" />
      <input autoFocus type="text" value={addUrlValue} onChange={e => setAddUrlValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddUrl(folderId); if (e.key === 'Escape') setAddUrlMode(null); }} placeholder="https://... (.png, .jpg, .webp)" className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500" />
      <div className="flex gap-1">
        <button onClick={() => handleAddUrl(folderId)} disabled={!addUrlValue.trim()} className="flex-1 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded text-xs transition-colors">Ajouter</button>
        <button onClick={() => { setAddUrlMode(null); setAddUrlValue(''); setAddUrlName(''); }} className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors">Annuler</button>
      </div>
    </div>
  );

  const renderAddButtons = (folderId: string | null) => {
    const key = folderId ?? 'root';
    if (addUrlMode === key) return renderAddUrlForm(folderId);

    return (
      <div className="flex gap-1 px-2 mt-1 mb-1">
        <button onClick={() => { setAddUrlMode(key); setAddUrlValue(''); setAddUrlName(''); }} className="flex-1 flex items-center justify-center gap-1 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-400 hover:text-white text-[10px] transition-colors" title="Ajouter par URL"><Link size={10} /></button>
        <button onClick={() => { fileTargetFolderRef.current = folderId; fileInputRef.current?.click(); }} disabled={uploading} className="flex-1 flex items-center justify-center gap-1 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-400 hover:text-white text-[10px] transition-colors disabled:opacity-40" title="Uploader un token"><Upload size={10} /></button>
      </div>
    );
  };

  const rootTokens = lib.tokens.filter(t => !t.folderId);

  return (
    <div className="flex flex-col h-full relative">
      {dragGhost && (
        <div
          className="fixed z-[9999] pointer-events-none opacity-90 shadow-2xl border-2 border-blue-500"
          style={{ left: dragGhost.x + 12, top: dragGhost.y - 30, width: 100 }}
        >
          {dragGhost.imageUrl && !dragGhost.imageUrl.startsWith('data:') ? (
            <img src={dragGhost.imageUrl} alt="" className="w-full h-16 object-cover block" draggable={false} />
          ) : (
            <div className="w-full h-16 bg-gray-700 flex items-center justify-center"><ImageIcon size={20} className="text-gray-400" /></div>
          )}
          <div className="bg-black/80 px-1.5 py-0.5 text-[10px] text-blue-300 truncate">{dragGhost.label}</div>
        </div>
      )}

      {/* -------------------
          Gestion de la bibliotheque de tokens
          -------------------
          Le titre est deja porte par le bandeau repliable du parent.
          On ne garde ici que l'action de creation de dossier.
      */}

      <div className="flex items-center justify-end gap-2 px-2 py-1.5">
        {/* gestion de l'import JSON vers des tokens dragables */}
        <button
          onClick={() => setShowImportModal(true)}
          disabled={!campaignId}
          className="flex items-center gap-1 px-2 py-1 bg-amber-900/40 hover:bg-amber-800/60 disabled:bg-gray-800 disabled:text-gray-600 disabled:border-gray-700 border border-amber-700/60 text-amber-300 hover:text-amber-100 rounded text-[10px] font-medium transition-colors"
          title={campaignId ? 'Importer des monstres JSON dans la bibliothèque' : 'Import disponible uniquement depuis une campagne'}
        >
          <Upload size={10} /> Importer
        </button>

        {/* gestion de la création d'un monstre custom dans la bibliothèque */}
        <button
          onClick={() => setShowMonsterModal(true)}
          className="flex items-center gap-1 px-2 py-1 bg-red-900/50 hover:bg-red-800/70 border border-red-700/60 text-red-400 hover:text-red-200 rounded text-[10px] font-medium transition-colors"
          title="Creer un monstre custom et l'ajouter a la bibliotheque"
        >
          <Skull size={10} /> + Monstre custom
        </button>

        {/* gestion de la création de dossiers dans la bibliothèque */}
        <button
          onClick={() => { setNewFolderMode(true); setNewFolderName(''); }}
          className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded text-[10px] font-medium transition-colors"
        >
          <FolderPlus size={10} /> Dossier
        </button>
      </div>

      {newFolderMode && (
        <div className="px-2 py-1.5 border-b border-gray-700/60 flex gap-1">
          <input autoFocus type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setNewFolderMode(false); }} placeholder="Nom du dossier" className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500" />
          <button onClick={handleCreateFolder} className="p-1 rounded bg-amber-600 hover:bg-amber-500 text-white"><Check size={12} /></button>
          <button onClick={() => setNewFolderMode(false)} className="p-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"><X size={12} /></button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {lib.folders.map(folder => {
          const isOpen = openFolders.has(folder.id);
          const folderTokens = lib.tokens.filter(t => t.folderId === folder.id);
          const isDragOver = dragOverTarget === folder.id;
          const isRenaming = renamingId === folder.id;

          return (
            <div key={folder.id}>
              <div
                data-folder-drop={folder.id}
                className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors ${
                  isDragOver ? 'bg-blue-500/30 border-y border-blue-500/50' : 'hover:bg-gray-800/60'
                }`}
                onClick={() => !isRenaming && toggleFolder(folder.id)}
              >
                {isOpen ? <FolderOpen size={13} className="text-amber-400 shrink-0" /> : <Folder size={13} className="text-amber-500 shrink-0" />}

                {isRenaming ? (
                  <input ref={renameInputRef} value={renameValue} onChange={e => setRenameValue(e.target.value)} onClick={e => e.stopPropagation()} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleRenameConfirm('folder'); if (e.key === 'Escape') setRenamingId(null); }} className="flex-1 px-1 py-0 bg-black/60 border border-amber-500 rounded text-white text-xs outline-none" />
                ) : (
                  <span className="flex-1 text-xs text-gray-300 truncate font-medium">
                    {folder.name}
                    <span className="ml-1 text-[9px] text-gray-600">({folderTokens.length})</span>
                  </span>
                )}

                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                  {isRenaming ? (
                    <>
                      <button onClick={() => handleRenameConfirm('folder')} className="p-0.5 rounded hover:bg-green-600/40 text-green-400"><Check size={10} /></button>
                      <button onClick={() => setRenamingId(null)} className="p-0.5 rounded hover:bg-gray-600 text-gray-400"><X size={10} /></button>
                    </>
                  ) : (
                    <button onClick={() => handleRenameStart(folder.id, folder.name)} className="p-0.5 rounded hover:bg-gray-600 text-gray-500 hover:text-white" title="Renommer"><Edit2 size={10} /></button>
                  )}
                  <button onClick={() => handleDeleteFolder(folder.id)} className="p-0.5 rounded hover:bg-red-900/40 text-gray-500 hover:text-red-400" title="Supprimer"><Trash2 size={10} /></button>
                </div>
              </div>

              {isOpen && (
                <div className="mb-1">
                  {folderTokens.length === 0 && (
                    <p className="text-[10px] text-gray-600 px-3 py-1 italic">Dossier vide — glissez un token ici</p>
                  )}
                  {folderTokens.map(renderToken)}
                  {renderAddButtons(folder.id)}
                </div>
              )}
            </div>
          );
        })}

        <div
          data-root-drop="true"
          className={`min-h-[8px] transition-colors ${
            dragOverTarget === 'root' ? 'bg-blue-500/10 border-y border-dashed border-blue-500/40' : ''
          }`}
        >
          {rootTokens.length === 0 && lib.folders.length === 0 && (
            <p className="text-[10px] text-gray-600 text-center py-3 italic px-2">Aucun token. Ajoutez-en un ci-dessous.</p>
          )}
          {rootTokens.map(renderToken)}
        </div>

        {renderAddButtons(null)}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, fileTargetFolderRef.current);
        }}
      />

        {contextMenu && createPortal(
        <div
          className="fixed inset-0 z-[10000]"
          onClick={() => setContextMenu(null)}
        >
          <div
            className="absolute min-w-[160px] rounded-md border border-gray-700 bg-gray-900 shadow-2xl overflow-hidden"
            style={{
              left: Math.max(8, Math.min(window.innerWidth - 168, contextMenu.x)),
              top: Math.max(8, Math.min(window.innerHeight - 120, contextMenu.y)),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* gestion de l'édition du token depuis le menu contextuel */}
            <button
              type="button"
              onClick={async () => {
                // gestion de l'ouverture de l'éditeur pour un token lié à un monstre custom
                const token = lib.tokens.find(t => t.id === contextMenu.tokenId);
                setContextMenu(null);

                if (!token?.linkedMonsterId || token.source !== 'custom-monster') {
                  return;
                }

                try {
                  const monster = await monsterService.getCampaignMonsterById(token.linkedMonsterId);
                  if (!monster) return;
                  setEditingMonster(monster);
                  setShowMonsterModal(true);
                } catch (err) {
                  console.error('Erreur chargement monstre custom:', err);
                }
              }}
              className="w-full px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-800 transition-colors"
            >
              Éditer
            </button>

            {/* gestion du renommage du token depuis le menu contextuel */}
            <button
              type="button"
              onClick={() => {
                const token = lib.tokens.find(t => t.id === contextMenu.tokenId);
                if (token) {
                  handleRenameStart(token.id, token.name);
                }
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-800 transition-colors"
            >
              Renommer
            </button>

            {/* gestion de la suppression du token depuis le menu contextuel */}
            <button
              type="button"
              onClick={() => {
                handleDeleteToken(contextMenu.tokenId);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-950/40 transition-colors"
            >
              Supprimer
            </button>
          </div>
        </div>,
        document.body
      )}

      {showMonsterModal && (
        <VTTCustomMonsterModal
          campaignId={campaignId ?? null}
          roomId={roomId}
          editMonster={editingMonster}
          onClose={() => {
            setShowMonsterModal(false);
            setEditingMonster(null);
          }}
          onSaved={() => {
            fetchTokenLibrary(roomId).then(fetched => {
              tokenLibrary.setCache(roomId, fetched);
              setLib(fetched);
              const customFolder = fetched.folders.find(f => f.name === 'Monstres customs');
              if (customFolder) {
                setOpenFolders(prev => new Set([...prev, customFolder.id]));
              }
            });
          }}
        />
      )}

            {showImportModal && campaignId && (
        <ImportMonsterModal
          campaignId={campaignId}
          existingMonsterNames={[]}
          onClose={() => setShowImportModal(false)}
          onImportComplete={async (monsters) => {
            try {
              // gestion de la conversion des monstres importés JSON en vrais tokens dragables
              for (const monster of monsters) {
                await addImportedMonsterToLibrary(monster);
              }
              setShowImportModal(false);
            } catch (err) {
              console.error('Erreur import tokens:', err);
            }
          }}
        />
      )}
    </div>
  );
}