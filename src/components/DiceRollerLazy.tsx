import React, { lazy, Suspense } from 'react';

const DiceBox3D = lazy(() => import('./DiceBox3D').then(module => ({ default: module.DiceBox3D })));

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <div className="text-center">
          <img 
            src="/icons/wmremove-transformed.png" 
            alt="Chargement..." 
            className="animate-spin h-12 w-12 mx-auto mb-4 object-contain"
            style={{ backgroundColor: 'transparent' }}
          />
          <p className="text-white text-lg">Chargement des dés 3D...</p>
        </div>
      </div>
    }>
      <DiceBox3D isOpen={isOpen} onClose={onClose} rollData={rollData} />
    </Suspense>
  );
}