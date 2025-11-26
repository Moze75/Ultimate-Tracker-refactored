import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const STORAGE_KEY = 'dice-settings';

export interface DiceSettings {
  theme: string;
  themeMaterial: 'none' | 'metal' | 'wood' | 'glass' | 'plastic';
  themeColor: string;
  soundsEnabled: boolean;
  
  baseScale: number;     // ✅ Taille des dés (3-10)
  gravity: number;       // ✅ Multiplicateur de gravité (0.5-2)
  strength: number;      // ✅ Force de lancer (0.5-3)
  volume: number;        // ✅ Volume sons physique dés (0-100)
  fxVolume: number;      // 🆕 Volume effets sonores UI/Magie (0-100)
}

export const DEFAULT_DICE_SETTINGS: DiceSettings = {
  theme: 'bronze', 
  themeMaterial: 'plastic',
  themeColor: '#8b5cf6',
  soundsEnabled: true,
  baseScale: 6,
  gravity: 1,
  strength: 2,
  volume: 100,
  fxVolume: 50, // Valeur par défaut
};

// Définition du type du contexte
interface DiceSettingsContextType {
  settings: DiceSettings;
  updateSettings: (newSettings: DiceSettings) => void;
  resetSettings: () => void;
  isLoading: boolean;
}

// Création du contexte
const DiceSettingsContext = createContext<DiceSettingsContextType | undefined>(undefined);

/**
 * Provider qui enveloppe l'application dans App.tsx
 * Il gère l'état global des paramètres.
 */
export function DiceSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DiceSettings>(DEFAULT_DICE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Chargement initial
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Nettoyage des anciennes clés obsolètes si nécessaire
        delete (parsed as any).friction;
        delete (parsed as any).restitution;
        delete (parsed as any).fireVolumetricEnabled; // Nettoyage
        
        // Fusion avec les défauts pour garantir que fxVolume existe
        setSettings({
          ...DEFAULT_DICE_SETTINGS,
          ...parsed,
        });
      }
    } catch (error) {
      console.error('❌ Erreur chargement settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction de mise à jour globale
  const updateSettings = useCallback((newSettings: DiceSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      
      // Dispatch event pour les composants non-React (ex: DiceBox3D engine)
      window.dispatchEvent(new CustomEvent('dice-settings-changed', { 
        detail: newSettings 
      }));
    } catch (error) {
      console.error('❌ Erreur sauvegarde settings:', error);
    }
  }, []);

  // Fonction de reset
  const resetSettings = useCallback(() => {
    updateSettings(DEFAULT_DICE_SETTINGS);
  }, [updateSettings]);

  return (
    <DiceSettingsContext.Provider value={{ settings, updateSettings, resetSettings, isLoading }}>
      {children}
    </DiceSettingsContext.Provider>
  );
}

/**
 * Hook pour utiliser les paramètres des dés n'importe où dans l'app.
 * Remplace l'ancien hook local.
 */
export function useDiceSettings() {
  const context = useContext(DiceSettingsContext);
  
  if (!context) {
    console.warn('⚠️ useDiceSettings utilisé hors du DiceSettingsProvider !');
    return {
      settings: DEFAULT_DICE_SETTINGS,
      updateSettings: () => {},
      resetSettings: () => {},
      isLoading: false
    };
  }

  // Rétro-compatibilité pour les composants qui utilisaient "saveSettings"
  return {
    ...context,
    saveSettings: context.updateSettings 
  };
}

/**
 * Utilitaire pour exporter les paramètres (optionnel)
 */
export function exportDiceSettings(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || JSON.stringify(DEFAULT_DICE_SETTINGS);
  } catch {
    return JSON.stringify(DEFAULT_DICE_SETTINGS);
  }
}

/**
 * Utilitaire pour importer les paramètres (optionnel)
 */
export function importDiceSettings(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    // Validation basique
    if (typeof parsed === 'object' && parsed !== null) {
      const merged = { ...DEFAULT_DICE_SETTINGS, ...parsed };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      // Forcer un reload pour appliquer (ou dispatcher l'event si on est dans le composant)
      window.dispatchEvent(new CustomEvent('dice-settings-changed', { detail: merged }));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}