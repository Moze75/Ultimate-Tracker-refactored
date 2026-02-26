import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Player } from '../types/dnd';
import { supabase } from '../lib/supabase';
import { GripVertical, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

// =============================================
// Types
// =============================================
interface NoteBlock {
  id: string;
  title: string;
  content: string;
}

interface NotesTabProps {
  player: Player;
  onUpdate: (player: Player) => void;
}

// =============================================
// Helpers
// =============================================
const generateId = () => `block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Blocs par défaut pour un nouveau joueur */
const DEFAULT_BLOCKS: NoteBlock[] = [
  { id: generateId(), title: 'Journal de campagne', content: '' },
  { id: generateId(), title: 'PNJ rencontrés', content: '' },
  { id: generateId(), title: 'Quêtes et objectifs', content: '' },
];

const PLACEHOLDERS: Record<string, string> = {
  'Journal de campagne': 'Écrivez ici le résumé des sessions, éléments marquants, récaps...',
  'PNJ rencontrés': 'Listez les PNJ, rôles, lieux, liens, indices...',
  'Quêtes et objectifs': 'Quêtes en cours, objectifs du groupe, pistes à suivre...',
};

/** Migration : ancien format { journal, npcs, quests } → nouveau format { blocks } */
function migrateNotesJson(raw: any): NoteBlock[] {
  if (!raw) return DEFAULT_BLOCKS.map(b => ({ ...b, id: generateId() }));

  // Nouveau format
  if (Array.isArray(raw.blocks)) {
    return raw.blocks as NoteBlock[];
  }

  // Ancien format → migration
  const blocks: NoteBlock[] = [];
  if (typeof raw.journal === 'string' && raw.journal.trim()) {
    blocks.push({ id: generateId(), title: 'Journal de campagne', content: raw.journal });
  }
  if (typeof raw.npcs === 'string' && raw.npcs.trim()) {
    blocks.push({ id: generateId(), title: 'PNJ rencontrés', content: raw.npcs });
  }
  if (typeof raw.quests === 'string' && raw.quests.trim()) {
    blocks.push({ id: generateId(), title: 'Quêtes et objectifs', content: raw.quests });
  }

  // Si tout est vide, retourne les blocs par défaut
  if (blocks.length === 0) {
    return DEFAULT_BLOCKS.map(b => ({ ...b, id: generateId() }));
  }

  return blocks;
}

/** Sérialisation pour la BDD (rétrocompatible en lecture) */
function serializeBlocks(blocks: NoteBlock[]) {
  return {
    blocks,
    // Rétrocompatibilité : on écrit aussi les 3 premiers champs classiques
    journal: blocks.find(b => b.title === 'Journal de campagne')?.content || '',
    npcs: blocks.find(b => b.title === 'PNJ rencontrés')?.content || '',
    quests: blocks.find(b => b.title === 'Quêtes et objectifs')?.content || '',
    updated_at: new Date().toISOString(),
  };
}

// =============================================
// Composant principal
// =============================================
export function NotesTab({ player, onUpdate }: NotesTabProps) {
  const [blocks, setBlocks] = useState<NoteBlock[]>([]);
  const [savingNotes, setSavingNotes] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);

  // Drag & drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const LS_NOTES_KEY = `campaign_notes_${player.id}`;
  const cacheRef = useRef<NoteBlock[] | null>(null);

  // ---- Chargement ----
  useEffect(() => {
    // Hydrate immédiatement depuis localStorage
    try {
      const raw = localStorage.getItem(LS_NOTES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const migrated = migrateNotesJson(parsed);
        setBlocks(migrated);
        cacheRef.current = migrated;
      }
    } catch {}

    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id]);

  const loadNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, notes_json')
        .eq('id', player.id)
        .single();

      if (error) throw error;

      const migrated = migrateNotesJson(data?.notes_json);
      setBlocks(migrated);
      cacheRef.current = migrated;

      try {
        localStorage.setItem(LS_NOTES_KEY, JSON.stringify({ blocks: migrated }));
      } catch {}
    } catch (err) {
      console.warn('[Notes] BDD indisponible, fallback localStorage.', err);
      // Le useEffect a déjà hydraté depuis localStorage
    }
  };

  // ---- Sauvegarde ----
  const saveNotes = async () => {
    if (savingNotes) return;
    setSavingNotes(true);

    const payload = serializeBlocks(blocks);

    try {
      const { error } = await supabase
        .from('players')
        .update({ notes_json: payload })
        .eq('id', player.id)
        .select('id, notes_json')
        .single();

      if (error) throw error;

      try {
        localStorage.setItem(LS_NOTES_KEY, JSON.stringify({ blocks }));
      } catch {}

      toast.success('Notes sauvegardées');
    } catch (e: any) {
      console.error('[Notes] Save failed, fallback localStorage.', e?.message || e);
      try {
        localStorage.setItem(LS_NOTES_KEY, JSON.stringify({ blocks }));
        toast.success('Notes sauvegardées (localement)');
      } catch {
        toast.error('Impossible de sauvegarder les notes');
      }
    } finally {
      setSavingNotes(false);
    }
  };

  // ---- CRUD blocs ----
  const addBlock = () => {
    setBlocks(prev => [
      ...prev,
      { id: generateId(), title: 'Nouveau bloc', content: '' },
    ]);
  };

  const removeBlock = (id: string) => {
    if (blocks.length <= 1) {
      toast.error('Vous devez garder au moins un bloc');
      return;
    }
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const updateBlock = (id: string, field: 'title' | 'content', value: string) => {
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, [field]: value } : b)));
  };

  // ---- Déplacement par boutons ----
  const moveBlock = (id: string, direction: 'up' | 'down') => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx < 0) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[targetIdx]] = [copy[targetIdx], copy[idx]];
      return copy;
    });
  };

  // ---- Drag & Drop ----
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Nécessaire pour Firefox
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragEnter = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    dragCounter.current++;
    if (id !== draggedId) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = (_e: React.DragEvent) => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setDragOverId(null);
      dragCounter.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOverId(null);

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    setBlocks(prev => {
      const fromIdx = prev.findIndex(b => b.id === draggedId);
      const toIdx = prev.findIndex(b => b.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;

      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });

    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    dragCounter.current = 0;
  };

  // ---- Rendu ----
  return (
    <div className="space-y-4 h-full overflow-y-auto">
      {blocks.map((block, index) => {
        const isDragged = draggedId === block.id;
        const isDragOver = dragOverId === block.id;

        return (
          <div
            key={block.id}
            draggable
            onDragStart={(e) => handleDragStart(e, block.id)}
            onDragEnter={(e) => handleDragEnter(e, block.id)}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, block.id)}
            onDragEnd={handleDragEnd}
            className={`bg-gray-800/40 border rounded-lg p-4 transition-all ${
              isDragged
                ? 'opacity-40 border-purple-500/50 scale-[0.98]'
                : isDragOver
                ? 'border-purple-400 bg-purple-900/20 shadow-lg shadow-purple-500/10'
                : 'border-gray-700'
            }`}
          >
            {/* Header du bloc */}
            <div className="flex items-center gap-2 mb-2">
              {/* Poignée de drag */}
              <div
                className="cursor-grab active:cursor-grabbing p-1 text-gray-500 hover:text-gray-300 transition-colors"
                title="Glisser pour réorganiser"
              >
                <GripVertical size={18} />
              </div>

              {/* Titre éditable */}
              {editingTitleId === block.id ? (
                <input
                  autoFocus
                  value={block.title}
                  onChange={(e) => updateBlock(block.id, 'title', e.target.value)}
                  onBlur={() => setEditingTitleId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setEditingTitleId(null);
                  }}
                  className="flex-1 bg-gray-700/60 text-sm font-medium text-gray-200 px-2 py-1 rounded border border-purple-500/50 outline-none focus:border-purple-400"
                />
              ) : (
                <button
                  onClick={() => setEditingTitleId(block.id)}
                  className="flex-1 text-left text-sm font-medium text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-700/40 transition-colors"
                  title="Cliquer pour renommer"
                >
                  {block.title || 'Sans titre'}
                </button>
              )}

              {/* Boutons monter/descendre */}
              <button
                onClick={() => moveBlock(block.id, 'up')}
                disabled={index === 0}
                className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Monter"
              >
                <ChevronUp size={16} />
              </button>
              <button
                onClick={() => moveBlock(block.id, 'down')}
                disabled={index === blocks.length - 1}
                className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Descendre"
              >
                <ChevronDown size={16} />
              </button>

              {/* Supprimer */}
              <button
                onClick={() => removeBlock(block.id)}
                className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                title="Supprimer ce bloc"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Contenu */}
            <textarea
              value={block.content}
              onChange={(e) => updateBlock(block.id, 'content', e.target.value)}
              className="input-dark w-full px-3 py-2 rounded-md"
              rows={5}
              placeholder={PLACEHOLDERS[block.title] || 'Écrivez ici...'}
            />
          </div>
        );
      })}

      {/* Bouton ajouter */}
      <button
        onClick={addBlock}
        className="w-full border-2 border-dashed border-gray-600 hover:border-purple-500/50 rounded-lg p-4 text-gray-400 hover:text-purple-300 flex items-center justify-center gap-2 transition-all hover:bg-purple-900/10"
      >
        <Plus size={20} />
        Ajouter un bloc de notes
      </button>

      {/* Bouton sauvegarder */}
      <div className="flex justify-end pt-2 pb-4">
        <button
          onClick={saveNotes}
          disabled={savingNotes}
          className="btn-primary px-5 py-2 rounded-lg disabled:opacity-50"
        >
          {savingNotes ? 'Sauvegarde...' : 'Sauvegarder les notes'}
        </button>
      </div>
    </div>
  );
}