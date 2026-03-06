import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  FolderPlus, Folder, FolderOpen, Map as MapIcon, Trash2,
  Upload, ChevronRight, ChevronDown, Edit2, Check, X, Link
} from 'lucide-react';
import { mapLibrary, type MapEntry, type MapLibrary } from '../../services/mapLibraryService';

interface VTTMapLibraryProps {
  roomId: string;
  currentMapUrl: string;
  onLoadMap: (url: string, width?: number, height?: number) => void;
}

// ── Ghost de drag custom ─────────────────────────────────────────────────────
interface DragGhost {
  mapId: string;
  label: string;
  imgUrl: string;
  x: number;
  y: number;
}

export function VTTMapLibrary({ roomId, currentMapUrl, onLoadMap }: VTTMapLibraryProps) {
  const [lib, setLib] = useState<MapLibrary>(() => mapLibrary.get());
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null); // folderId | 'root' | null
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [addUrlMode, setAddUrlMode] = useState<string | null>(null);
  const [addUrlValue, setAddUrlValue] = useState('');
  const [addUrlName, setAddUrlName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileTargetFolderRef = useRef<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragMapIdRef = useRef<string | null>(null);
  const folderRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const refresh = useCallback(() => setLib(mapLibrary.get()), []);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // ── Drag custom (mousemove sur window) ───────────────────────────────────
  const startDrag = useCallback((e: React.MouseEvent, map: MapEntry) => {
    e.preventDefault();
    e.stopPropagation();
    dragMapIdRef.current = map.id;

    setDragGhost({
      mapId: map.id,
      label: map.name,
      imgUrl: map.url,
      x: e.clientX,
      y: e.clientY,
    });

    const onMouseMove = (ev: MouseEvent) => {
      setDragGhost(prev => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null);

      // Détecter la cible sous le curseur
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      let target: string | null = null;
      if (el) {
        const folderEl = el.closest('[data-folder-drop]') as HTMLElement | null;
        if (folderEl) {
          target = folderEl.dataset.folderDrop || 'root';
        } else if (el.closest('[data-root-drop]')) {
          target = 'root';
        }
      }
      setDragOverTarget(target);
    };

    const onMouseUp = () => {
      const mapId = dragMapIdRef.current;
      if (mapId && dragOverTarget !== null) {
        const folderId = dragOverTarget === 'root' ? null : dragOverTarget;
        mapLibrary.moveMap(mapId, folderId);
        refresh();
      }
      dragMapIdRef.current = null;
      setDragGhost(null);
      setDragOverTarget(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [dragOverTarget, refresh]);

  // ── Dossiers ──────────────────────────────────────────────────────────────
  const toggleFolder = (id: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const folder = mapLibrary.createFolder(newFolderName);
    setOpenFolders(prev => new Set([...prev, folder.id]));
    setNewFolderMode(false);
    setNewFolderName('');
    refresh();
  };

  const handleRenameStart = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const handleRenameConfirm = (type: 'folder' | 'map') => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    if (type === 'folder') mapLibrary.renameFolder(renamingId, renameValue);
    else mapLibrary.renameMap(renamingId, renameValue);
    setRenamingId(null);
    refresh();
  };

  const handleDeleteFolder = (folderId: string) => {
    if (!window.confirm('Supprimer ce dossier ? Les cartes seront déplacées à la racine.')) return;
    mapLibrary.deleteFolder(folderId);
    refresh();
  };

  // ── Cartes ────────────────────────────────────────────────────────────────
  const handleAddUrl = (folderId: string | null) => {
    if (!addUrlValue.trim()) return;
    mapLibrary.addMap({
      name: addUrlName.trim() || addUrlValue.split('/').pop() || 'Carte',
      url: addUrlValue.trim(),
      folderId,
    });
    setAddUrlValue('');
    setAddUrlName('');
    setAddUrlMode(null);
    refresh();
  };

  const handleFileUpload = async (file: File, folderId: string | null) => {
    const workerUrl = import.meta.env.VITE_CF_UPLOAD_WORKER_URL;
    setUploading(true);
    try {
      let url: string;
      let width: number | undefined;
      let height: number | undefined;

      if (workerUrl) {
        const { uploadVttAsset } = await import('../../services/vttStorageService');
        url = await uploadVttAsset(file, 'maps', roomId);
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => { width = img.naturalWidth; height = img.naturalHeight; resolve(); };
          img.onerror = () => resolve();
          img.src = url;
        });
      } else {
        const result = await new Promise<{ dataUrl: string; width: number; height: number }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
              const w = Math.round(img.width * scale);
              const h = Math.round(img.height * scale);
              const canvas = document.createElement('canvas');
              canvas.width = w; canvas.height = h;
              canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
              resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.82), width: w, height: h });
            };
            img.onerror = reject;
            img.src = e.target!.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        url = result.dataUrl;
        width = result.width;
        height = result.height;
      }

      mapLibrary.addMap({ name: file.name.replace(/\.[^.]+$/, ''), url, folderId, width, height });
      refresh();
    } catch (err) {
      console.error('Erreur upload carte:', err);
      alert('Erreur lors de l\'upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteMap = async (mapId: string) => {
    const map = lib.maps.find(m => m.id === mapId);
    if (!map) return;

    const workerUrl = import.meta.env.VITE_CF_UPLOAD_WORKER_URL;
    const uploadSecret = import.meta.env.VITE_CF_UPLOAD_SECRET;
    if (workerUrl && uploadSecret && map.url.includes('.r2.dev/vtt/')) {
      try {
        const key = map.url.split('.r2.dev/')[1];
        if (key) {
          const url = new URL(workerUrl);
          url.searchParams.set('action', 'delete');
          url.searchParams.set('key', key);
          await fetch(url.toString(), { headers: { 'X-Upload-Secret': uploadSecret } });
        }
      } catch (err) {
        console.warn('[MapLib] Suppression R2 ignorée:', err);
      }
    }

    mapLibrary.deleteMap(mapId);
    refresh();
  };

  const handleLoadMap = (map: MapEntry) => {
    onLoadMap(map.url, map.width, map.height);
  };

  // ── Rendu d'une carte (thumbnail pleine largeur) ──────────────────────────
  const renderMap = (map: MapEntry) => {
    const isActive = map.url === currentMapUrl;
    const isRenaming = renamingId === map.id;
    const isDragging = dragGhost?.mapId === map.id;

    return (
      <div
        key={map.id}
        className={`group relative w-full overflow-hidden transition-all select-none ${
          isDragging ? 'opacity-40' : 'opacity-100'
        } ${isActive ? 'ring-2 ring-inset ring-amber-500' : ''}`}
      >
        {/* Thumbnail — zone de drag */}
        <div
          className="w-full h-20 cursor-grab active:cursor-grabbing"
          onMouseDown={e => startDrag(e, map)}
        >
          {map.url && !map.url.startsWith('data:') ? (
            <img
              src={map.url}
              alt={map.name}
              draggable={false}
              className="w-full h-full object-cover block pointer-events-none"
            />
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <Map size={24} className="text-gray-600" />
            </div>
          )}
        </div>

        {/* Bandeau bas : nom + actions */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-1.5 py-1 flex items-end justify-between gap-1">
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameConfirm('map');
                if (e.key === 'Escape') setRenamingId(null);
              }}
              onClick={e => e.stopPropagation()}
              className="flex-1 px-1 py-0 bg-black/60 border border-amber-500 rounded text-white text-[10px] outline-none"
            />
          ) : (
            <span
              className={`flex-1 text-[10px] truncate font-medium leading-tight ${isActive ? 'text-amber-300' : 'text-gray-200'}`}
              title={map.name}
            >
              {map.name}
            </span>
          )}

          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => handleLoadMap(map)}
              className="p-0.5 rounded bg-amber-600/90 hover:bg-amber-500 text-white"
              title="Charger"
            >
              <ChevronRight size={10} />
            </button>
            {isRenaming ? (
              <>
                <button onMouseDown={e => e.stopPropagation()} onClick={() => handleRenameConfirm('map')} className="p-0.5 rounded bg-green-600/90 hover:bg-green-500 text-white"><Check size={10} /></button>
                <button onMouseDown={e => e.stopPropagation()} onClick={() => setRenamingId(null)} className="p-0.5 rounded bg-gray-600/90 hover:bg-gray-500 text-white"><X size={10} /></button>
              </>
            ) : (
              <button onMouseDown={e => e.stopPropagation()} onClick={() => handleRenameStart(map.id, map.name)} className="p-0.5 rounded bg-gray-600/90 hover:bg-gray-500 text-white" title="Renommer"><Edit2 size={10} /></button>
            )}
            <button onMouseDown={e => e.stopPropagation()} onClick={() => handleDeleteMap(map.id)} className="p-0.5 rounded bg-red-700/90 hover:bg-red-600 text-white" title="Supprimer"><Trash2 size={10} /></button>
          </div>
        </div>

        {isActive && (
          <div className="absolute top-1.5 left-1.5 px-1 py-0.5 bg-amber-500 rounded text-[8px] text-white font-bold leading-none pointer-events-none">
            EN COURS
          </div>
        )}
      </div>
    );
  };

  // ── Rendu boutons d'ajout ─────────────────────────────────────────────────
  const renderAddUrlForm = (folderId: string | null) => (
    <div className="mx-2 mt-1 mb-1 space-y-1 p-2 bg-gray-800/60 rounded-lg border border-gray-700">
      <input type="text" value={addUrlName} onChange={e => setAddUrlName(e.target.value)} placeholder="Nom (optionnel)" className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500" />
      <input autoFocus type="text" value={addUrlValue} onChange={e => setAddUrlValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddUrl(folderId); if (e.key === 'Escape') setAddUrlMode(null); }} placeholder="https://..." className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500" />
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
        <button onClick={() => { setAddUrlMode(key); setAddUrlValue(''); setAddUrlName(''); }} className="flex-1 flex items-center justify-center gap-1 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white rounded text-[10px] transition-colors"><Link size={9} /> URL</button>
        <button onClick={() => { fileTargetFolderRef.current = folderId; fileInputRef.current?.click(); }} disabled={uploading} className="flex-1 flex items-center justify-center gap-1 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white rounded text-[10px] transition-colors disabled:opacity-50"><Upload size={9} /> {uploading ? '...' : 'Fichier'}</button>
      </div>
    );
  };

  const rootMaps = lib.maps.filter(m => !m.folderId);

  return (
    <div ref={containerRef} className="flex flex-col h-full relative">

      {/* Ghost de drag custom */}
      {dragGhost && (
        <div
          className="fixed z-[9999] pointer-events-none opacity-90 shadow-2xl border-2 border-amber-500"
          style={{ left: dragGhost.x + 12, top: dragGhost.y - 30, width: 120 }}
        >
          {dragGhost.imgUrl && !dragGhost.imgUrl.startsWith('data:') ? (
            <img src={dragGhost.imgUrl} alt="" className="w-full h-16 object-cover block" draggable={false} />
          ) : (
            <div className="w-full h-16 bg-gray-700 flex items-center justify-center"><Map size={20} className="text-gray-400" /></div>
          )}
          <div className="bg-black/80 px-1.5 py-0.5 text-[10px] text-amber-300 truncate">{dragGhost.label}</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-700/60">
        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Bibliothèque</span>
        <button onClick={() => { setNewFolderMode(true); setNewFolderName(''); }} className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white rounded text-[10px] transition-colors">
          <FolderPlus size={10} /> Dossier
        </button>
      </div>

      {/* Formulaire nouveau dossier */}
      {newFolderMode && (
        <div className="px-2 py-1.5 border-b border-gray-700/60 flex gap-1">
          <input autoFocus type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setNewFolderMode(false); }} placeholder="Nom du dossier..." className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500" />
          <button onClick={handleCreateFolder} className="p-1 rounded bg-amber-600 hover:bg-amber-500 text-white"><Check size={12} /></button>
          <button onClick={() => setNewFolderMode(false)} className="p-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"><X size={12} /></button>
        </div>
      )}

      {/* Liste scrollable */}
      <div className="flex-1 overflow-y-auto py-1">

        {/* Dossiers */}
        {lib.folders.map(folder => {
          const isOpen = openFolders.has(folder.id);
          const folderMaps = lib.maps.filter(m => m.folderId === folder.id);
          const isDragOver = dragOverTarget === folder.id;
          const isRenaming = renamingId === folder.id;

          return (
            <div key={folder.id}>
              {/* En-tête dossier — zone de drop */}
              <div
                data-folder-drop={folder.id}
                className={`group flex items-center gap-1 px-2 py-1.5 cursor-pointer transition-colors ${
                  isDragOver ? 'bg-amber-500/30 border-y border-amber-500/50' : 'hover:bg-gray-800/60'
                }`}
                onClick={() => !isRenaming && toggleFolder(folder.id)}
              >
                {isOpen ? <ChevronDown size={10} className="text-gray-500 shrink-0" /> : <ChevronRight size={10} className="text-gray-500 shrink-0" />}
                {isOpen ? <FolderOpen size={12} className="text-amber-400 shrink-0" /> : <Folder size={12} className="text-amber-500 shrink-0" />}

                {isRenaming ? (
                  <input ref={renameInputRef} value={renameValue} onChange={e => setRenameValue(e.target.value)} onClick={e => e.stopPropagation()} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleRenameConfirm('folder'); if (e.key === 'Escape') setRenamingId(null); }} className="flex-1 px-1 py-0 bg-gray-700 border border-amber-500 rounded text-white text-xs outline-none" />
                ) : (
                  <span className="flex-1 text-xs text-gray-300 truncate font-medium">
                    {folder.name}
                    <span className="ml-1 text-[9px] text-gray-600">({folderMaps.length})</span>
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

              {/* Contenu du dossier — SANS border-l */}
              {isOpen && (
                <div className="mb-1">
                  {folderMaps.length === 0 && (
                    <p className="text-[10px] text-gray-600 px-3 py-1 italic">Dossier vide — glissez une carte ici</p>
                  )}
                  {folderMaps.map(renderMap)}
                  {renderAddButtons(folder.id)}
                </div>
              )}
            </div>
          );
        })}

        {/* Racine — zone de drop */}
        <div
          data-root-drop="true"
          className={`min-h-[8px] transition-colors ${
            dragOverTarget === 'root' ? 'bg-amber-500/10 border-y border-dashed border-amber-500/40' : ''
          }`}
        >
          {rootMaps.length === 0 && lib.folders.length === 0 && (
            <p className="text-[10px] text-gray-600 text-center py-3 italic px-2">Aucune carte. Ajoutez-en une ci-dessous.</p>
          )}
          {rootMaps.map(renderMap)}
        </div>

        {renderAddButtons(null)}
      </div>

      {/* Input fichier caché */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleFileUpload(file, fileTargetFolderRef.current); }} />
    </div>
  );
}