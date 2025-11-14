import React, { createContext, useContext, ReactNode } from 'react';
import { useDiceHistory } from './useDiceHistory';
import type { DiceRollHistoryEntry } from './useDiceHistory';

interface DiceHistoryContextType {
  history: DiceRollHistoryEntry[];
  addRoll: (entry: Omit<DiceRollHistoryEntry, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  removeEntry: (id: string) => void;
  isLoading: boolean;
}

const DiceHistoryContext = createContext<DiceHistoryContextType | undefined>(undefined);

export function DiceHistoryProvider({ children }: { children: ReactNode }) {
  const diceHistory = useDiceHistory();
  
  return (
    <DiceHistoryContext.Provider value={diceHistory}>
      {children}
    </DiceHistoryContext.Provider>
  );
}

export function useDiceHistoryContext() {
  const context = useContext(DiceHistoryContext);
  if (!context) {
    throw new Error('useDiceHistoryContext must be used within DiceHistoryProvider');
  }
  return context;
}