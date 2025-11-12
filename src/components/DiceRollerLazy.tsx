import React, { lazy, Suspense, useEffect, useState } from 'react';
import type { DiceSettings } from '../hooks/useDiceSettings';

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
  settings: DiceSettings;
}

export function DiceRollerLazy({ isOpen, onClose, rollData, settings }: DiceRollerLazyProps) {
  const [isModuleLoaded, setIsModuleLoaded] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false); // ✅ AJOUTER

  // Précharger le module au montage
  useEffect(() => {
    console.log('🔄 [DiceRollerLazy] Préchargement du module DiceBox3D...');
    import('./DiceBox3D')
      .then(() => {
        console.log('✅ [DiceRollerLazy] Module DiceBox3D préchargé');
        setIsModuleLoaded(true);
      })
      .catch(err => console.error('❌ [DiceRollerLazy] Erreur préchargement:', err));
  }, []);

  // ✅ Marquer qu'on a ouvert au moins une fois
  useEffect(() => {
    if (isOpen && !hasBeenOpened) {
      setHasBeenOpened(true);
    }
  }, [isOpen, hasBeenOpened]);

  // ✅ Afficher le loader seulement si jamais ouvert et module pas chargé
  if (!hasBeenOpened && !isModuleLoaded) {
    return null; // Ne rien afficher tant qu'on n'a pas ouvert
  }

  if (!isModuleLoaded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="text-center bg-gray-900/90 backdrop-blur-sm rounded-lg p-6 pointer-events-auto">
          <img 
            src="/icons/wmremove-transformed.png" 
            alt="Chargement..." 
            className="animate-spin h-12 w-12 mx-auto mb-4 object-contain"
            style={{ backgroundColor: 'transparent' }}
          />
          <p className="text-white text-lg">Chargement des dés 3D...</p>
        </div>
      </div>
    );
  }

  // ✅ IMPORTANT : Ne JAMAIS retourner null après le premier montage
  // Le composant reste monté mais caché via isOpen
  return (
    <Suspense fallback={null}>
      <DiceBox3D 
        isOpen={isOpen} 
        onClose={onClose} 
        rollData={rollData}
        settings={settings}
      />
    </Suspense>
  );
}