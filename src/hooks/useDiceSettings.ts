import { useState, useEffect, useCallback } from 'react';

export interface DiceSettings {
  theme: string;
  themeMaterial: 'none' | 'metal' | 'wood' | 'glass' | 'plastic';
  themeColor: string;
  soundsEnabled: boolean;
  
  baseScale: number;     // ✅ Taille des dés (3-10)
  gravity: number;       // ✅ Multiplicateur de gravité (0.5-2)
  strength: number;      // ✅ Force de lancer (0.5-3)
  volume: number;        // ✅ Volume sons module (0-100)
}

export const DEFAULT_DICE_SETTINGS: DiceSettings = {
  theme: '', // Pas de colorset prédéfini = couleur personnalisée
  themeMaterial: 'plastic',
  themeColor: '#8b5cf6',
  soundsEnabled: true,
  baseScale: 6,         // Taille moyenne des dés
  gravity: 1,           // Gravité normale (1x = 400 dans le module)
  strength: 1,          // Force normale
  volume: 100,          // Volume max des sons intégrés
};

const STORAGE_KEY = 'dice-settings';

/**
 * Hook pour gérer les paramètres des dés 3D
 * - Charge les paramètres depuis localStorage au montage
 * - Sauvegarde automatiquement les changements
 * - Fournit une fonction de reset
 */
export function useDiceSettings() {
  const [settings, setSettings] = useState<DiceSettings>(DEFAULT_DICE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Charger les paramètres depuis localStorage au montage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<DiceSettings>;
        
        // Migration : convertir scale -> baseScale si nécessaire
        if ('scale' in parsed && !('baseScale' in parsed)) {
          (parsed as any).baseScale = (parsed as any).scale;
          delete (parsed as any).scale;
        }
        
        // Migration : supprimer friction et restitution obsolètes
        delete (parsed as any).friction;
        delete (parsed as any).restitution;
        
        // Fusionner avec les valeurs par défaut pour gérer les nouvelles clés
        setSettings({
          ...DEFAULT_DICE_SETTINGS,
          ...parsed,
        });
        
        console.log('✅ Paramètres des dés chargés depuis localStorage:', parsed);
      } else {
        console.log('ℹ️ Aucun paramètre sauvegardé, utilisation des valeurs par défaut');
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des paramètres des dés:', error);
      // En cas d'erreur, on garde les valeurs par défaut
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sauvegarder les paramètres
  const saveSettings = useCallback((newSettings: DiceSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
      console.log('✅ Paramètres des dés sauvegardés:', newSettings);
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des paramètres des dés:', error);
      throw error;
    }
  }, []);

  // Réinitialiser aux valeurs par défaut
  const resetSettings = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSettings(DEFAULT_DICE_SETTINGS);
      console.log('✅ Paramètres des dés réinitialisés');
    } catch (error) {
      console.error('❌ Erreur lors de la réinitialisation des paramètres des dés:', error);
      throw error;
    }
  }, []);

  // Mettre à jour un paramètre spécifique
  const updateSetting = useCallback(<K extends keyof DiceSettings>(
    key: K,
    value: DiceSettings[K]
  ) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      
      // Sauvegarder automatiquement
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        console.log(`✅ Paramètre "${key}" mis à jour:`, value);
      } catch (error) {
        console.error(`❌ Erreur lors de la sauvegarde du paramètre "${key}":`, error);
      }
      
      return updated;
    });
  }, []);

  return {
    settings,
    saveSettings,
    resetSettings,
    updateSetting,
    isLoading,
  };
}

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
 * Utilitaire pour exporter les paramètres (pour debug ou partage)
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
 * Utilitaire pour importer des paramètres (pour debug ou partage)
 */
export function importDiceSettings(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString) as Partial<DiceSettings>;
    
    // Valider que les clés sont valides
    const validKeys: (keyof DiceSettings)[] = [
      'theme',
      'themeMaterial',
      'themeColor',
      'soundsEnabled',
      'baseScale',
      'gravity',
      'strength',
      'volume',
    ];
    
    const settings: DiceSettings = {
      ...DEFAULT_DICE_SETTINGS,
      ...Object.fromEntries(
        Object.entries(parsed).filter(([key]) => validKeys.includes(key as keyof DiceSettings))
      ),
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    console.log('✅ Paramètres importés avec succès:', settings);
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'import des paramètres:', error);
    return false;
  }
}