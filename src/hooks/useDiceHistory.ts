import { useState, useEffect, useCallback } from 'react';

export interface DiceRollHistoryEntry {
  id: string;
  timestamp: number;
  attackName: string;
  diceFormula: string;
  modifier: number;
  total: number;
  rolls: number[];
  diceTotal: number;
}

const HISTORY_KEY = 'dice-roll-history';
const MAX_HISTORY_SIZE = 20;

/**
 * Hook pour gérer l'historique des jets de dés
 */
export function useDiceHistory() {
  const [history, setHistory] = useState<DiceRollHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Charger l'historique depuis localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DiceRollHistoryEntry[];
        setHistory(parsed.slice(0, MAX_HISTORY_SIZE)); // S'assurer de la limite
        console.log('✅ Historique des dés chargé:', parsed.length, 'entrées');
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement de l\'historique des dés:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Ajouter un jet à l'historique
  const addRoll = useCallback((entry: Omit<DiceRollHistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: DiceRollHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    setHistory(prev => {
      // Ajouter au début (plus récent en premier)
      const updated = [newEntry, ...prev].slice(0, MAX_HISTORY_SIZE);
      
      // Sauvegarder dans localStorage
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        console.log('✅ Jet ajouté à l\'historique:', newEntry);
      } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde de l\'historique:', error);
      }
      
      return updated;
    });
  }, []);

// Effacer tout l'historique
const clearHistory = useCallback(() => {
  try {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]); // ✅ Forcer le state à []
    console.log('✅ Historique des dés effacé');
  } catch (error) {
    console.error('❌ Erreur lors de l\'effacement de l\'historique:', error);
  }
}, []);

  // Supprimer une entrée spécifique
  const removeEntry = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(entry => entry.id !== id);
      
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        console.log('✅ Entrée supprimée de l\'historique:', id);
      } catch (error) {
        console.error('❌ Erreur lors de la suppression de l\'entrée:', error);
      }
      
      return updated;
    });
  }, []);

  return {
    history,
    addRoll,
    clearHistory,
    removeEntry,
    isLoading,
  };
}

/**
 * Utilitaire pour formater une date relative
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'À l\'instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;
  
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}