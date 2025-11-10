import React, { lazy, Suspense, useEffect } from 'react';  // ✅ Ajouter useEffect ici
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
  // ✅ AJOUTER CE USEEFFECT ICI - précharge le module dès le montage
  useEffect(() => {
    console.log('🔄 [DiceRollerLazy] Préchargement du module DiceBox3D...');
    import('./DiceBox3D')
      .then(() => console.log('✅ [DiceRollerLazy] Module DiceBox3D préchargé'))
      .catch(err => console.error('❌ [DiceRollerLazy] Erreur préchargement:', err));
  }, []);

  if (!isOpen) return null;

  // ✅ Créer une clé basée sur les paramètres critiques des settings
  // Cela force React à détruire et recréer DiceBox3D quand ces paramètres changent
  const diceBoxKey = `${settings.theme}-${settings.themeMaterial}-${settings.themeColor}-${settings.scale}`;

  console.log('🔑 [DiceRollerLazy] Clé DiceBox:', diceBoxKey);

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