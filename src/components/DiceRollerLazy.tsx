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
  // ✅ État pour savoir si le module est chargé
  const [isModuleLoaded, setIsModuleLoaded] = useState(false);

  // ✅ Précharger le module dès le montage du composant (en arrière-plan)
  useEffect(() => {
    console.log('🔄 [DiceRollerLazy] Préchargement du module DiceBox3D...');
    import('./DiceBox3D')
      .then(() => {
        console.log('✅ [DiceRollerLazy] Module DiceBox3D préchargé');
        setIsModuleLoaded(true);
      })
      .catch(err => console.error('❌ [DiceRollerLazy] Erreur préchargement:', err));
  }, []);

  // ✅ Si la modale n'est pas ouverte, ne rien afficher
  if (!isOpen) return null;

  // ✅ Si le module n'est pas encore chargé, afficher un loader SANS fond noir
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

  // ✅ Créer une clé unique pour forcer le remontage si les settings changent
  const diceBoxKey = `${settings.theme}-${settings.themeMaterial}-${settings.themeColor}-${settings.scale}`;

  console.log('🔑 [DiceRollerLazy] Clé DiceBox:', diceBoxKey);

  // ✅ Le module est chargé, on peut afficher le DiceBox3D
  // Le fallback est "null" car le module est déjà préchargé
  return (
    <Suspense fallback={null}>
      <DiceBox3D 
        key={diceBoxKey} 
        isOpen={isOpen} 
        onClose={onClose} 
        rollData={rollData}
        settings={settings}
      />
    </Suspense>
  );
}