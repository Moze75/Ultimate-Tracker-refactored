import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Edit2, Check, X,
  Save, Eye, EyeOff, Loader2, FileText
} from 'lucide-react';
import { CampaignNote } from '../types/campaign';
import { campaignService } from '../services/campaignService';
import MarkdownLite from './MarkdownLite';
import toast from 'react-hot-toast';

interface CampaignNotesTabProps {
  campaignId: string;
}

interface NoteCardProps {
  note: CampaignNote;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (noteId: string, updates: Partial<Pick<CampaignNote, 'title' | 'content'>>) => void;
  onDelete: (noteId: string) => void;
  onDragStart: (e: React.DragEvent, noteId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetNoteId: string) => void;
  savingId: string | null;
}

function NoteCard({
  note,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  savingId,
}: NoteCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(note.title);
  const [contentValue, setContentValue] = useState(note.content);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef(note.content);

  useEffect(() => {
    setContentValue(note.content);
    lastSavedContentRef.current = note.content;
  }, [note.content]);

  useEffect(() => {
    setTitleValue(note.title);
  }, [note.title]);

  const scheduleAutoSave = useCallback((newContent: string) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    if (newContent !== lastSavedContentRef.current) {
      autoSaveTimerRef.current = setTimeout(() => {
        onUpdate(note.id, { content: newContent });
        lastSavedContentRef.current = newContent;
      }, 1500);
    }
  }, [note.id, onUpdate]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContentValue(newContent);
    scheduleAutoSave(newContent);
  };

  const handleTitleSave = () => {
    if (titleValue.trim() && titleValue !== note.title) {
      onUpdate(note.id, { title: titleValue.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setTitleValue(note.title);
      setIsEditingTitle(false);
    }
  };

  const adjustTextareaHeight = () => {
    if (contentRef.current) {
      contentRef.current.style.height = 'auto';
      contentRef.current.style.height = `${Math.max(150, contentRef.current.scrollHeight)}px`;
    }
  };

  useEffect(() => {
    if (isExpanded && contentRef.current) {
      adjustTextareaHeight();
    }
  }, [isExpanded, contentValue]);

  const isSaving = savingId === note.id;

  return (
    <div
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        onDragStart(e, note.id);
      }}
      onDragEnd={() => setIsDragging(false)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, note.id)}
      className={`group bg-gray-800/60 border border-gray-700/50 rounded-lg transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-[0.98]' : ''
      } hover:border-gray-600/50`}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => !isEditingTitle && onToggleExpand()}
      >
        <div
          className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={18} />
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="text-gray-400 hover:text-gray-200 transition-colors"
        >
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>

        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={handleTitleSave}
                autoFocus
                className="flex-1 bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-500/50"
              />
              <button
                onClick={handleTitleSave}
                className="p-1 text-green-400 hover:text-green-300"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => {
                  setTitleValue(note.title);
                  setIsEditingTitle(false);
                }}
                className="p-1 text-red-400 hover:text-red-300"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-gray-200 font-medium truncate">{note.title}</h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
                className="p-1 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Edit2 size={14} />
              </button>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-0.5">
            Modifie le {new Date(note.updated_at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSaving && (
            <div className="flex items-center gap-1 text-amber-400 text-xs">
              <Loader2 size={14} className="animate-spin" />
              <span>Sauvegarde...</span>
            </div>
          )}

          {!showDeleteConfirm ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className="p-2 text-gray-500 hover:text-red-400 transition-colors"
              title="Supprimer cette note"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs text-gray-400 mr-1">Supprimer ?</span>
              <button
                onClick={() => onDelete(note.id)}
                className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-1.5 bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700/30 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                showPreview
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-gray-700/50 text-gray-400 hover:text-gray-200'
              }`}
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPreview ? 'Editer' : 'Apercu'}
            </button>
            <span className="text-xs text-gray-500">
              Supporte le Markdown: **gras**, _italique_, listes, titres (## ou ###)
            </span>
          </div>

          {showPreview ? (
            <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-4 min-h-[150px]">
              {contentValue ? (
                <MarkdownLite content={contentValue} />
              ) : (
                <p className="text-gray-500 italic">Aucun contenu...</p>
              )}
            </div>
          ) : (
            <textarea
              ref={contentRef}
              value={contentValue}
              onChange={handleContentChange}
              onInput={adjustTextareaHeight}
              placeholder="Ecrivez vos notes ici... (Markdown supporte)"
              className="w-full bg-gray-900/50 border border-gray-700/30 rounded-lg p-4 text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:border-amber-500/30 min-h-[150px] font-mono text-sm"
            />
          )}
        </div>
      )}
    </div>
  );
}

export function CampaignNotesTab({ campaignId }: CampaignNotesTabProps) {
  const [notes, setNotes] = useState<CampaignNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingNote, setCreatingNote] = useState(false);
  const draggedNoteRef = useRef<string | null>(null);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await campaignService.getCampaignNotes(campaignId);
      setNotes(data);
    } catch (error) {
      console.error('Erreur chargement notes:', error);
      toast.error('Erreur lors du chargement des notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [campaignId]);

  const handleCreateNote = async () => {
    try {
      setCreatingNote(true);
      const newNote = await campaignService.createCampaignNote(campaignId);
      setNotes((prev) => [...prev, newNote]);
      setExpandedNotes((prev) => new Set([...prev, newNote.id]));
      toast.success('Note creee');
    } catch (error) {
      console.error('Erreur creation note:', error);
      toast.error('Erreur lors de la creation de la note');
    } finally {
      setCreatingNote(false);
    }
  };

  const handleUpdateNote = async (noteId: string, updates: Partial<Pick<CampaignNote, 'title' | 'content'>>) => {
    try {
      setSavingId(noteId);
      const updatedNote = await campaignService.updateCampaignNote(noteId, updates);
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? updatedNote : n))
      );
    } catch (error) {
      console.error('Erreur mise a jour note:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await campaignService.deleteCampaignNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setExpandedNotes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(noteId);
        return newSet;
      });
      toast.success('Note supprimee');
    } catch (error) {
      console.error('Erreur suppression note:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const toggleExpand = (noteId: string) => {
    setExpandedNotes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const handleDragStart = (e: React.DragEvent, noteId: string) => {
    draggedNoteRef.current = noteId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetNoteId: string) => {
    e.preventDefault();
    const draggedId = draggedNoteRef.current;
    if (!draggedId || draggedId === targetNoteId) return;

    const draggedIndex = notes.findIndex((n) => n.id === draggedId);
    const targetIndex = notes.findIndex((n) => n.id === targetNoteId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newNotes = [...notes];
    const [draggedNote] = newNotes.splice(draggedIndex, 1);
    newNotes.splice(targetIndex, 0, draggedNote);

    setNotes(newNotes);

    try {
      await campaignService.reorderCampaignNotes(
        campaignId,
        newNotes.map((n) => n.id)
      );
    } catch (error) {
      console.error('Erreur reordonnancement:', error);
      toast.error('Erreur lors du reordonnancement');
      loadNotes();
    }

    draggedNoteRef.current = null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Notes de campagne</h2>
          <span className="text-sm text-gray-500">({notes.length})</span>
        </div>
        <button
          onClick={handleCreateNote}
          disabled={creatingNote}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-lg transition-colors disabled:opacity-50"
        >
          {creatingNote ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Plus size={18} />
          )}
          Nouvelle note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-8 text-center">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-4">
            Aucune note pour cette campagne.
          </p>
          <button
            onClick={handleCreateNote}
            disabled={creatingNote}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-lg transition-colors"
          >
            <Plus size={18} />
            Creer votre premiere note
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isExpanded={expandedNotes.has(note.id)}
              onToggleExpand={() => toggleExpand(note.id)}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              savingId={savingId}
            />
          ))}
        </div>
      )}

      <div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Aide Markdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-500">
          <div>
            <code className="text-amber-400">**texte**</code> = <strong className="font-bold">gras</strong>
          </div>
          <div>
            <code className="text-amber-400">_texte_</code> = <em>italique</em>
          </div>
          <div>
            <code className="text-amber-400">## ou ###</code> = <span className="text-lg">Titre</span>
          </div>
          <div>
            <code className="text-amber-400">- item</code> = Liste
          </div>
        </div>
      </div>
    </div>
  );
}
