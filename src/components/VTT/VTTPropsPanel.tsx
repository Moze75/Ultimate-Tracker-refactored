import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  FolderPlus, Folder, FolderOpen, Trash2, Upload,
  Edit2, Check, X, Link, Film, Image as ImageIcon
} from 'lucide-react';
import {
  propLibrary, fetchPropLibrary, savePropLibrary,
  type PropEntry, type PropLibrary, isVideoUrl,
} from '../../services/propLibraryService';

interface VTTPropsPanelProps {
  props: import('../../types/vtt').VTTProp[];       // props actives sur le canvas (non utilisé ici pour la lib)
  selectedPropId: string | null;
  role: 'gm' | 'player';
  roomId: string;
  onSelectProp: (id: string | null) => void;
  onAddProp: (prop: Omit<import('../../types/vtt').VTTProp, 'id'>) => void;
  onRemoveProp: (propId: string) => void;
  onUpdateProp: (propId: string, changes: Partial<import('../../types/vtt').VTTProp>) => void;
}

interface DragGhost {
  propId: string;
  label: string;
  url: string;
  isVideo: boolean;
  x: number;
  y: number;
}

export function VTTPropsPanel({
  roomId,
  onAddProp,
}: VTTPropsPanelProps) {
  const [lib, setLib] = useState<PropLibrary>(() => propLibrary.get());
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileTargetFolderRef = useRef<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const dragPropIdRef = useRef<string | null>(null);
  const dragOverTargetRef = useRef<string | null>(null);

  // ── Chargement depuis Supabase au montage ─────────────────────────────────
  useEffect(() => {
    fetchPropLibrary(roomId).then(fetched => {
      propLibrary.setCache(fetched);
      setLib(fetched);
    });
  }, [roomId]);

  const persist = useCallback(() => {
    const current = propLibrary.get();
    setLib(current);
    savePropLibrary(roomId, current);
  }, [roomId]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // ── Drag custom réorganisation interne ────────────────────────────────────
  const startInternalDrag = useCallback((e: React.MouseEvent, prop: PropEntry) => {
    e.preventDefault();
    e.stopPropagation();
    dragPropIdRef.current = prop.id;
    dragOverTargetRef.current = null;
    setDragGhost({ propId: prop.id, label: prop.name, url: prop.url, isVideo: prop.isVideo ?? false, x: e.clientX, y: e.clientY });

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
      const propId = dragPropIdRef.current;
      const target = dragOverTargetRef.current;
      if (propId && target !== null) {
        propLibrary.moveProp(propId, target === 'root' ? null : target);
        persist();
      }
      dragPropIdRef.current = null;
      dragOverTargetRef.current = null;
      setDragGhost(null);
      setDragOverTarget(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [persist]);

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
    const folder = propLibrary.createFolder(newFolderName);
    setOpenFolders(prev => new Set([...prev, folder.id]));
    setNewFolderMode(false);
    setNewFolderName('');
    persist();
  };

  const handleRenameStart = (id: string, current: string) => {
    setRenamingId(id);
    setRenameValue(current);
  };

  const handleRenameConfirm = (type: 'folder' | 'prop') => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    if (type === 'folder') propLibrary.renameFolder(renamingId, renameValue);
    else propLibrary.renameProp(renamingId, renameValue);
    setRenamingId(null);
    persist();
  };

  const handleDeleteFolder = (folderId: string) => {
    if (!window.confirm('Supprimer ce dossier ? Les props seront déplacées à la racine.')) return;
    propLibrary.deleteFolder(folderId);
    persist();
  };

  // ── Props ─────────────────────────────────────────────────────────────────
  const handleAddUrl = (folderId: string | null) => {
    if (!addUrlValue.trim()) return;
    const url = addUrlValue.trim();
    propLibrary.addProp({
      name: addUrlName.trim() || url.split('/').pop()?.split('?')[0] || 'Prop',
      url,
      folderId,
      isVideo: isVideoUrl(url),
    });
    setAddUrlValue('');
    setAddUrlName('');
    setAddUrlMode(null);
    persist();
  };

  const handleFileUpload = async (file: File, folderId: string | null) => {
    const isVid = /\.(webm|mp4|ogv)$/i.test(file.name);
    const workerUrl = import.meta.env.VITE_CF_UPLOAD_WORKER_URL;
    setUploading(true);
    try {
      let url: string;
      if (workerUrl) {
        const { uploadVttAsset } = await import('../../services/vttStorageService');
        url = await uploadVttAsset(file, 'props', roomId);
      } else {
        url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target!.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      propLibrary.addProp({
        name: file.name.replace(/\.[^.]+$/, ''),
        url,
        folderId,
        isVideo: isVid,
      });
      persist();
    } catch (err) {
      console.error('Erreur upload prop:', err);
      alert("Erreur lors de l'upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteProp = async (propId: string) => {
    const entry = lib.props.find(p => p.id === propId);
    if (!entry) return;
    const workerUrl = import.meta.env.VITE_CF_UPLOAD_WORKER_URL;
    const uploadSecret = import.meta.env.VITE_CF_UPLOAD_SECRET;
    if (workerUrl && uploadSecret && entry.url.includes('.r2.dev/vtt/')) {
      try {
        const key = entry.url.split('.r2.dev/')[1];
        if (key) {
          const u = new URL(workerUrl);
          u.searchParams.set('action', 'delete');
          u.searchParams.set('key', key);
          await fetch(u.toString(), { headers: { 'X-Upload-Secret': uploadSecret } });
        }
      } catch (err) {
        console.warn('[PropLib] Suppression R2 ignorée:', err);
      }
    }
    propLibrary.deleteProp(propId);
    persist();
  };

  // Déposer sur le canvas via onAddProp (position centre-carte par défaut)
  const handlePlaceProp = (entry: PropEntry) => {
    const w = entry.isVideo ? 200 : 150;
    const h = entry.isVideo ? 200 : 150;
    onAddProp({
      label: entry.name,
      imageUrl: entry.url,
      position: { x: 300, y: 200 },
      width: w,
      height: h,
      opacity: 1,
      locked: false,
    });
  };

  // ── Thumbnail ──────────────────────────────────────────────────────────────
  const renderThumb = (entry: PropEntry, compact = false) => {
    const h = compact ? 'h-14' : 'h-20';
    if (entry.isVideo || isVideoUrl(entry.url)) {
      return (
        <video
          src={entry.url}
          autoPlay
          loop
          muted
          playsInline
          draggable={false}
          className={`w-full ${h} object-cover block pointer-events-none bg-gray-900`}
        />
      );
    }
    if (entry.url && !entry.url.startsWith('data:')) {
      return (
        <img
          src={entry.url}
          alt={entry.name}
          draggable={false}
          className={`w-full ${h} object-cover block pointer-events-none`}
        />
      );
    }
    return (
      <div className={`w-full ${h} bg-gray-800 flex items-center justify-center`}>
        <ImageIcon size={24} className="text-gray-600" />
      </div>
    );
  };

  // ── Rendu d'une prop ───────────────────────────────────────────────────────
  const renderProp = (entry: PropEntry) => {
    const isRenaming = renamingId === entry.id;
    const isDragging = dragGhost?.propId === entry.id;
    const isVid = entry.isVideo || isVideoUrl(entry.url);

    return (
      <div
        key={entry.id}
        className={`group relative w-full overflow-hidden transition-all select-none ${
          isDragging ? 'opacity-40' : 'opacity-100'
        }`}
      >
        {/* Zone thumbnail — drag HTML5 vers le canvas */}
        <div
          className="w-full h-20 relative"
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('application/vtt-prop-url', entry.url);
            e.dataTransfer.setData('application/vtt-prop-name', entry.name);
            e.dataTransfer.setData('application/vtt-prop-isvideo', String(isVid));
            e.dataTransfer.effectAllowed = 'copy';
          }}
        >
          {renderThumb(entry)}
          {isVid && (
            <div className="absolute top-1 left-1 p-0.5 bg-black/60 rounded">
              <Film size={9} className="text-purple-400" />
            </div>
          )}
          {/* Poignée de drag interne (réorganisation vers dossier) */}
          <div
            className="absolute top-1 right-1 p-0.5 bg-black/50 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
            title="Déplacer vers un dossier"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              startInternalDrag(e, entry);
            }}
          >
            <span className="text-gray-300 text-[10px] leading-none select-none">⠿</span>
          </div>
        </div>

        {/* Bandeau bas */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-1.5 py-1 flex items-end justify-between gap-1">
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameConfirm('prop');
                if (e.key === 'Escape') setRenamingId(null);
              }}
              onClick={e => e.stopPropagation()}
              className="flex-1 px-1 py-0 bg-black/60 border border-amber-500 rounded text-white text-[10px] outline-none"
            />
          ) : (
            <span className="flex-1 text-[10px] truncate font-medium leading-tight text-gray-200" title={entry.name}>
              {entry.name}
            </span>
          )}
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {/* Placer sur le canvas */}
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => handlePlaceProp(entry)}
              className="p-0.5 rounded bg-amber-600/90 hover:bg-amber-500 text-white"
              title="Placer sur le canvas"
            >
              <Check size={10} />
            </button>
            {isRenaming ? (
              <>
                <button onMouseDown={e => e.stopPropagation()} onClick={() => handleRenameConfirm('prop')} className="p-0.5 rounded bg-green-600/90 hover:bg-green-500 text-white"><Check size={10} /></button>
                <button onMouseDown={e => e.stopPropagation()} onClick={() => setRenamingId(null)} className="p-0.5 rounded bg-gray-600/90 hover:bg-gray-500 text-white"><X size={10} /></button>
              </>
            ) : (
              <button onMouseDown={e => e.stopPropagation()} onClick={() => handleRenameStart(entry.id, entry.name)} className="p-0.5 rounded bg-gray-600/90 hover:bg-gray-500 text-white" title="Renommer"><Edit2 size={10} /></button>
            )}
            <button onMouseDown={e => e.stopPropagation()} onClick={() => handleDeleteProp(entry.id)} className="p-0.5 rounded bg-red-700/90 hover:bg-red-600 text-white" title="Supprimer"><Trash2 size={10} /></button>
          </div>
        </div>
      </div>
    );
  };

  // ── Boutons d'ajout ────────────────────────────────────────────────────────
  const renderAddUrlForm = (folderId: string | null) => (
    <div className="mx-2 mt-1 mb-1 space-y-1 p-2 bg-gray-800/60 rounded-lg border border-gray-700">
      <input type="text" value={addUrlName} onChange={e => setAddUrlName(e.target.value)} placeholder="Nom (optionnel)" className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500" />
      <input autoFocus type="text" value={addUrlValue} onChange={e => setAddUrlValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddUrl(folderId); if (e.key === 'Escape') setAddUrlMode(null); }} placeholder="https://... (.webm, .png, ...)" className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500" />
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
        <button onClick={() => { fileTargetFolderRef.current = folderId; fileInputRef.current?.click(); }} disabled={uploading} className="flex-1 flex items-center justify-center gap-1 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-400 hover:text-white text-[10px] transition-colors disabled:opacity-40" title="Uploader un fichier (image ou .webm)"><Upload size={10} /></button>
      </div>
    );
  };

  const rootProps = lib.props.filter(p => !p.folderId);

  return (
    <div className="flex flex-col h-full relative">

      {/* Ghost drag interne */}
      {dragGhost && (
        <div
          className="fixed z-[9999] pointer-events-none opacity-90 shadow-2xl border-2 border-purple-500"
          style={{ left: dragGhost.x + 12, top: dragGhost.y - 30, width: 100 }}
        >
          {renderThumb({ id: dragGhost.propId, name: dragGhost.label, url: dragGhost.url, folderId: null, addedAt: '', isVideo: dragGhost.isVideo }, true)}
          <div className="bg-black/80 px-1.5 py-0.5 text-[10px] text-purple-300 truncate">{dragGhost.label}</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-700/60">
        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Bibliothèque de Props</span>
        <button onClick={() => { setNewFolderMode(true); setNewFolderName(''); }} className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white rounded text-[10px] transition-colors">
          <FolderPlus size={10} /> Dossier
        </button>
      </div>

      {/* Formulaire nouveau dossier */}
      {newFolderMode && (
        <div className="px-2 py-1.5 border-b border-gray-700/60 flex gap-1">
          <input autoFocus type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setNewFolderMode(false); }} placeholder="Nom du dossier" className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500" />
          <button onClick={handleCreateFolder} className="p-1 rounded bg-amber-600 hover:bg-amber-500 text-white"><Check size={12} /></button>
          <button onClick={() => setNewFolderMode(false)} className="p-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"><X size={12} /></button>
        </div>
      )}

      {/* Liste scrollable */}
      <div className="flex-1 overflow-y-auto py-1">

        {/* Dossiers */}
        {lib.folders.map(folder => {
          const isOpen = openFolders.has(folder.id);
          const folderProps = lib.props.filter(p => p.folderId === folder.id);
          const isDragOver = dragOverTarget === folder.id;
          const isRenaming = renamingId === folder.id;

          return (
            <div key={folder.id}>
              <div
                data-folder-drop={folder.id}
                className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors ${
                  isDragOver ? 'bg-purple-500/30 border-y border-purple-500/50' : 'hover:bg-gray-800/60'
                }`}
                onClick={() => !isRenaming && toggleFolder(folder.id)}
              >
                {/* Pas de flèche chevron devant l'icône dossier */}
                {isOpen
                  ? <FolderOpen size={13} className="text-amber-400 shrink-0" />
                  : <Folder size={13} className="text-amber-500 shrink-0" />
                }

                {isRenaming ? (
                  <input ref={renameInputRef} value={renameValue} onChange={e => setRenameValue(e.target.value)} onClick={e => e.stopPropagation()} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleRenameConfirm('folder'); if (e.key === 'Escape') setRenamingId(null); }} className="flex-1 px-1 py-0 bg-black/60 border border-amber-500 rounded text-white text-xs outline-none" />
                ) : (
                  <span className="flex-1 text-xs text-gray-300 truncate font-medium">
                    {folder.name}
                    <span className="ml-1 text-[9px] text-gray-600">({folderProps.length})</span>
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
                  {folderProps.length === 0 && (
                    <p className="text-[10px] text-gray-600 px-3 py-1 italic">Dossier vide — glissez une prop ici</p>
                  )}
                  {folderProps.map(renderProp)}
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
            dragOverTarget === 'root' ? 'bg-purple-500/10 border-y border-dashed border-purple-500/40' : ''
          }`}
        >
          {rootProps.length === 0 && lib.folders.length === 0 && (
            <p className="text-[10px] text-gray-600 text-center py-3 italic px-2">Aucune prop. Ajoutez-en une ci-dessous.</p>
          )}
          {rootProps.map(renderProp)}
        </div>

        {renderAddButtons(null)}
      </div>

      {/* Input fichier caché — accepte images ET vidéos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/webm,video/mp4"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, fileTargetFolderRef.current);
        }}
      />
    </div>
  );
}