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
  
  // ✅ Effets spéciaux
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
  fxVolume: 50,
  fireVolumetricEnabled: false,
};

// --- DÉFINITION DU CONTEXTE ---

interface DiceSettingsContextType {
  settings: DiceSettings;
  isLoading: boolean;
  saveSettings: (newSettings: DiceSettings) => void;
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
        
        if ('scale' in parsed && !('baseScale' in parsed)) {
          (parsed as any).baseScale = (parsed as any).scale;
          delete (parsed as any).scale;
        }
        delete (parsed as any).friction;
        delete (parsed as any).restitution;
        
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
      window.dispatchEvent(new CustomEvent('dice-settings-changed', { 
        detail: newSettings 
      }));
    } catch (error) {
      console.error('❌ Erreur sauvegarde settings:', error);
    }
  };

  // Mise à jour globale
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

  // Mise à jour d'une seule clé
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

  // ⚠️ MODIFICATION ICI : Utilisation de createElement au lieu de JSX pour éviter l'erreur dans un fichier .ts
  return React.createElement(
    DiceSettingsContext.Provider,
    {
      value: { 
        settings, 
        isLoading, 
        saveSettings: updateSettings, 
        updateSettings, 
        resetSettings, 
        updateSetting 
      }
    },
    children
  );
}

// --- HOOK ---

export function useDiceSettings() {
  const context = useContext(DiceSettingsContext);
  
  if (!context) {
    console.warn('⚠️ useDiceSettings utilisé hors du DiceSettingsProvider !');
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

// --- UTILITAIRES ---

export function useIsDiceSettingsDirty(current: DiceSettings): boolean {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
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

export function exportDiceSettings(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || JSON.stringify(DEFAULT_DICE_SETTINGS);
  } catch (error) {
    console.error('❌ Erreur lors de l\'export des paramètres:', error);
    return JSON.stringify(DEFAULT_DICE_SETTINGS);
  }
}

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
    window.dispatchEvent(new CustomEvent('dice-settings-changed', { detail: settings }));
    
    console.log('✅ Paramètres importés avec succès:', settings);
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'import des paramètres:', error);
    return false;
  }
} 