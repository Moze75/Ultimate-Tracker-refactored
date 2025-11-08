import React, { useState, useEffect, useRef } from 'react';
import { Player } from '../types/dnd';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface NotesTabProps {
  player: Player;
  onUpdate: (player: Player) => void;
}

export function NotesTab({ player, onUpdate }: NotesTabProps) {
  const [notesJournal, setNotesJournal] = useState('');
  const [notesNPCs, setNotesNPCs] = useState('');
  const [notesQuests, setNotesQuests] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const LS_NOTES_KEY = `campaign_notes_${player.id}`;
  const notesCacheRef = useRef<{ journal: string; npcs: string; quests: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_NOTES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const journal = parsed.journal || '';
        const npcs = parsed.npcs || '';
        const quests = parsed.quests || '';
        setNotesJournal(journal);
        setNotesNPCs(npcs);
        setNotesQuests(quests);
        notesCacheRef.current = { journal, npcs, quests };
      }
    } catch {}
    loadNotes();
  }, [player.id]);

  const loadNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, notes_json')
        .eq('id', player.id)
        .single();

      if (error) {
        console.error('[Notes] SELECT error:', error);
        throw error;
      }

      const notes = data?.notes_json || {};
      const journal = typeof notes.journal === 'string' ? notes.journal : '';
      const npcs = typeof notes.npcs === 'string' ? notes.npcs : '';
      const quests = typeof notes.quests === 'string' ? notes.quests : '';

      setNotesJournal(journal);
      setNotesNPCs(npcs);
      setNotesQuests(quests);

      notesCacheRef.current = { journal, npcs, quests };
      try {
        localStorage.setItem(LS_NOTES_KEY, JSON.stringify({ journal, npcs, quests }));
      } catch {}
    } catch (err) {
      console.warn('[Notes] BDD indisponible, fallback localStorage.', err);
      try {
        const raw = localStorage.getItem(LS_NOTES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const journal = parsed.journal || '';
          const npcs = parsed.npcs || '';
          const quests = parsed.quests || '';

          setNotesJournal(journal);
          setNotesNPCs(npcs);
          setNotesQuests(quests);
          notesCacheRef.current = { journal, npcs, quests };
        }
      } catch (e) {
        console.error('[Notes] Fallback localStorage erreur:', e);
      }
    }
  };

  const saveNotes = async () => {
    if (savingNotes) return;
    setSavingNotes(true);

    const payload = {
      journal: notesJournal,
      npcs: notesNPCs,
      quests: notesQuests,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('players')
        .update({ notes_json: payload })
        .eq('id', player.id)
        .select('id, notes_json')
        .single();

      if (error) {
        console.error('[Notes] Supabase update error:', error);
        throw error;
      }

      try {
        localStorage.setItem(LS_NOTES_KEY, JSON.stringify({
          journal: payload.journal,
          npcs: payload.npcs,
          quests: payload.quests,
        }));
      } catch {}

      toast.success('Notes sauvegardées');
    } catch (e: any) {
      console.error('[Notes] Save failed, fallback localStorage. Reason:', e?.message || e);
      try {
        localStorage.setItem(LS_NOTES_KEY, JSON.stringify({
          journal: payload.journal,
          npcs: payload.npcs,
          quests: payload.quests,
        }));
        toast.success('Notes sauvegardées (localement)');
      } catch {
        toast.error('Impossible de sauvegarder les notes');
      }
    } finally {
      setSavingNotes(false);
    }
  };

return (
 <div className="absolute inset-0 pt-20 px-6 pb-6 overflow-y-auto space-y-4">
    <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">Journal de campagne</label>
        <textarea
          value={notesJournal}
          onChange={(e) => setNotesJournal(e.target.value)}
          className="input-dark w-full px-3 py-2 rounded-md"
          rows={6}
          placeholder="Écrivez ici le résumé des sessions, éléments marquants, récaps..."
        />
      </div>
 
      <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">PNJ rencontrés</label>
        <textarea
          value={notesNPCs}
          onChange={(e) => setNotesNPCs(e.target.value)}
          className="input-dark w-full px-3 py-2 rounded-md"
          rows={5}
          placeholder="Listez les PNJ, rôles, lieux, liens, indices..."
        />
      </div>

      <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">Quêtes et objectifs</label>
        <textarea
          value={notesQuests}
          onChange={(e) => setNotesQuests(e.target.value)}
          className="input-dark w-full px-3 py-2 rounded-md"
          rows={5}
          placeholder="Quêtes en cours, objectifs du groupe, pistes à suivre..."
        />
      </div>

      <div className="flex justify-end">
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