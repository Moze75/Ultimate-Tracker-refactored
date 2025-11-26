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
  
  // ✅ Effets spéciaux (Gardé pour compatibilité types, même si on ne l'utilise plus dans l'UI)
  fireVolumetricEnabled?: boolean; 
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
  fireVolumetricEnabled: false,
};

// --- DÉFINITION DU CONTEXTE ---

interface DiceSettingsContextType {
  settings: DiceSettings;
  isLoading: boolean;
  saveSettings: (newSettings: DiceSettings) => void; // Alias pour updateSettings global
  updateSettings: (newSettings: DiceSettings) => void;
  resetSettings: () => void;
  updateSetting: <K extends keyof DiceSettings>(key: K, value: DiceSettings[K]) => void;
}

const DiceSettingsContext = createContext<DiceSettingsContextType | undefined>(undefined);

// --- PROVIDER ---

export function DiceSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DiceSettings>(DEFAULT_DICE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Chargement initial
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<DiceSettings>;
        
        // Migrations (conserver la logique du fichier original)
        if ('scale' in parsed && !('baseScale' in parsed)) {
          (parsed as any).baseScale = (parsed as any).scale;
          delete (parsed as any).scale;
        }
        delete (parsed as any).friction;
        delete (parsed as any).restitution;
        
        // Fusion avec les défauts
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

  // Fonction centrale de sauvegarde + notification
  const persistAndNotify = (newSettings: DiceSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      // Dispatch event pour les composants non-React (ex: moteur DiceBox3D)
      window.dispatchEvent(new CustomEvent('dice-settings-changed', { 
        detail: newSettings 
      }));
    } catch (error) {
      console.error('❌ Erreur sauvegarde settings:', error);
    }
  };

  // Mise à jour globale (remplace tout l'objet)
  const updateSettings = useCallback((newSettings: DiceSettings) => {
    setSettings(newSettings);
    persistAndNotify(newSettings);
  }, []);

  // Reset
  const resetSettings = useCallback(() => {
    const reset = DEFAULT_DICE_SETTINGS;
    setSettings(reset);
    persistAndNotify(reset);
  }, []);

  // Mise à jour d'une seule clé (Restauré du fichier original)
  const updateSetting = useCallback(<K extends keyof DiceSettings>(
    key: K,
    value: DiceSettings[K]
  ) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      persistAndNotify(updated);
      return updated;
    });
  }, []);

  return (
    <DiceSettingsContext.Provider value={{ 
      settings, 
      isLoading, 
      saveSettings: updateSettings, // Alias pour compatibilité
      updateSettings, 
      resetSettings, 
      updateSetting 
    }}>
      {children}
    </DiceSettingsContext.Provider>
  );
}

// --- HOOK ---

export function useDiceSettings() {
  const context = useContext(DiceSettingsContext);
  
  if (!context) {
    console.warn('⚠️ useDiceSettings utilisé hors du DiceSettingsProvider !');
    // Fallback pour éviter le crash complet si le provider manque
    return {
      settings: DEFAULT_DICE_SETTINGS,
      isLoading: false,
      saveSettings: () => {},
      updateSettings: () => {},
      resetSettings: () => {},
      updateSetting: () => {},
    };
  }

  return context;
}

// --- UTILITAIRES (Restaurés du fichier original) ---

/**
 * Hook pour vérifier si les paramètres ont été modifiés
 */
export function useIsDiceSettingsDirty(current: DiceSettings): boolean {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // Si rien n'est sauvegardé, comparer avec les valeurs par défaut
        const isDefault = JSON.stringify(current) === JSON.stringify(DEFAULT_DICE_SETTINGS);
        setIsDirty(!isDefault);
        return;
      }

      const parsed = JSON.parse(stored) as DiceSettings;
      const hasChanged = JSON.stringify(current) !== JSON.stringify(parsed);
      setIsDirty(hasChanged);
    } catch (error) {
      console.error('❌ Erreur lors de la vérification des changements:', error);
      setIsDirty(false);
    }
  }, [current]);

  return isDirty;
}

/**
 * Utilitaire pour exporter les paramètres
 */
export function exportDiceSettings(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || JSON.stringify(DEFAULT_DICE_SETTINGS);
  } catch (error) {
    console.error('❌ Erreur lors de l\'export des paramètres:', error);
    return JSON.stringify(DEFAULT_DICE_SETTINGS);
  }
}

/**
 * Utilitaire pour importer des paramètres
 */
export function importDiceSettings(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString) as Partial<DiceSettings>;
    
    const validKeys: (keyof DiceSettings)[] = [
      'theme',
      'themeMaterial',
      'themeColor',
      'soundsEnabled',
      'baseScale',
      'gravity',
      'strength',
      'volume',
      'fxVolume',
      'fireVolumetricEnabled',
    ];
    
    const settings: DiceSettings = {
      ...DEFAULT_DICE_SETTINGS,
      ...Object.fromEntries(
        Object.entries(parsed).filter(([key]) => validKeys.includes(key as keyof DiceSettings))
      ),
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // Dispatch event pour mise à jour immédiate
    window.dispatchEvent(new CustomEvent('dice-settings-changed', { detail: settings }));
    
    // Note: Pour que l'UI React se mette à jour immédiatement après un import externe,
    // idéalement on devrait appeler updateSettings via le context, mais comme c'est une fonction statique,
    // on compte sur le reload ou le prochain montage pour rafraîchir l'état React complet si nécessaire,
    // ou sur l'event window pour le moteur 3D.
    
    console.log('✅ Paramètres importés avec succès:', settings);
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'import des paramètres:', error);
    return false;
  }
} 