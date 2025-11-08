import React, { lazy, Suspense } from 'react';

// ✅ CORRIGÉ : Import nommé au lieu de default
const DiceBox3DInline = lazy(() => 
  import('./DiceBox3DInline').then(module => ({ 
    default: module.DiceBox3DInline 
  }))
);

interface DiceRollerLazyProps {
  isOpen: boolean;
  onClose: () => void;
  rollData: {
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  } | null;
}

export function DiceRollerLazy({ isOpen, onClose, rollData }: DiceRollerLazyProps) {
  if (!isOpen) return null;

  return (
    <Suspense fallback={
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-gray-900/95 backdrop-blur-xl rounded-xl border border-purple-500/50 p-4">
          <img 
            src="/icons/wmremove-transformed.png" 
            alt="Chargement..." 
            className="animate-spin h-8 w-8 object-contain"
            style={{ backgroundColor: 'transparent' }}
          />
        </div>
      </div>
    }>
      <DiceBox3DInline isOpen={isOpen} onClose={onClose} rollData={rollData} />
    </Suspense>
  );
}