// Service pour gérer le contexte de navigation de l'app

type AppContext = 'game' | 'wizard' | 'selection';

interface WizardSnapshot {
  currentStep: number;
  characterName: string;
  selectedRace: string;
  selectedClass: string;
  selectedBackground: string;
  selectedAlignment: string;
  selectedLanguages: string[];
  age: string;
  gender: string;
  characterHistory: string;
  backgroundEquipmentOption: 'A' | 'B' | '';
  selectedClassSkills: string[];
  selectedEquipmentOption: string;
  selectedCantrips: any[];
  selectedLevel1Spells: any[];
  abilities: Record<string, number>;
  effectiveAbilities: Record<string, number>;
  // Timestamp pour éviter de restaurer un snapshot trop ancien
  timestamp: number;
}

const APP_CONTEXT_KEY = 'ut:appContext';
const WIZARD_SNAPSHOT_KEY = 'ut:wizardSnapshot';
const SNAPSHOT_TTL = 24 * 60 * 60 * 1000; // 24 heures

export const appContextService = {
  // Contexte actuel
  setContext(context: AppContext) {
    try {
      localStorage.setItem(APP_CONTEXT_KEY, context);
    } catch (e) {
      console.warn('[AppContext] Impossible de sauvegarder le contexte:', e);
    }
  },

  getContext(): AppContext | null {
    try {
      return localStorage.getItem(APP_CONTEXT_KEY) as AppContext | null;
    } catch {
      return null;
    }
  },

  clearContext() {
    try {
      localStorage.removeItem(APP_CONTEXT_KEY);
    } catch {}
  },

  // Snapshot du wizard
  saveWizardSnapshot(snapshot: Omit<WizardSnapshot, 'timestamp'>) {
    try {
      const withTimestamp: WizardSnapshot = {
        ...snapshot,
        timestamp: Date.now(),
      };
      localStorage.setItem(WIZARD_SNAPSHOT_KEY, JSON.stringify(withTimestamp));
      this.setContext('wizard');
    } catch (e) {
      console.warn('[AppContext] Impossible de sauvegarder le wizard snapshot:', e);
    }
  },

  getWizardSnapshot(): WizardSnapshot | null {
    try {
      const saved = localStorage.getItem(WIZARD_SNAPSHOT_KEY);
      if (!saved) return null;

      const parsed: WizardSnapshot = JSON.parse(saved);
      
      // Vérifier si le snapshot n'est pas trop ancien
      if (Date.now() - parsed.timestamp > SNAPSHOT_TTL) {
        console.log('[AppContext] Snapshot wizard trop ancien, ignoré');
        this.clearWizardSnapshot();
        return null;
      }

      return parsed;
    } catch (e) {
      console.warn('[AppContext] Erreur lors de la lecture du wizard snapshot:', e);
      return null;
    }
  },

  clearWizardSnapshot() {
    try {
      localStorage.removeItem(WIZARD_SNAPSHOT_KEY);
    } catch {}
  },

  // Helpers
  isInWizard(): boolean {
    return this.getContext() === 'wizard';
  },

  isInGame(): boolean {
    return this.getContext() === 'game';
  },
};