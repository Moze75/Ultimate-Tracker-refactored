import { RefreshCw, Upload } from 'lucide-react';

interface VTTSettingsPanelProps {
  autoFocusCombatTurn?: boolean;
  onToggleAutoFocusCombatTurn?: () => void;
  onSaveScene?: () => Promise<void>;
  roomId: string;
  saving: boolean;
  saveOk: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setSaveOk: React.Dispatch<React.SetStateAction<boolean>>;
}

export function VTTSettingsPanel({
  autoFocusCombatTurn = true,
  onToggleAutoFocusCombatTurn,
  onSaveScene,
  roomId,
  saving,
  saveOk,
  setSaving,
  setSaveOk,
}: VTTSettingsPanelProps) {
  return (
    <div className="p-3 space-y-4">
      <section className="space-y-2">
        <p className="text-xs text-gray-200 font-medium">Combat</p>

        <button
          onClick={onToggleAutoFocusCombatTurn}
          className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-xs transition-colors border border-gray-700"
        >
          <span>Suivre automatiquement le token actif</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              autoFocusCombatTurn
                ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50'
                : 'bg-gray-700 text-gray-300 border border-gray-600'
            }`}
          >
            {autoFocusCombatTurn ? 'ON' : 'OFF'}
          </span>
        </button>

        <p className="text-[10px] text-gray-500 leading-relaxed">
          Le clic sur une ligne du tracker centre toujours la vue. Ce réglage contrôle uniquement le suivi
          automatique lors du passage des tours.
        </p>
      </section>

      {onSaveScene && (
        <section className="space-y-2">
          <p className="text-xs text-gray-200 font-medium">Scène</p>

          <button
            onClick={async () => {
              setSaving(true);
              setSaveOk(false);
              await onSaveScene();
              setSaving(false);
              setSaveOk(true);
              setTimeout(() => setSaveOk(false), 2500);
            }}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-medium transition-colors"
          >
            {saving ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : saveOk ? (
              <span className="text-green-100">✓ Sauvegardé !</span>
            ) : (
              <>
                <Upload size={12} />
                Enregistrer la scène
              </>
            )}
          </button>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-xs text-gray-200 font-medium">Salle</p>
        <div className="font-mono text-gray-300 text-xs break-all bg-gray-800 rounded px-2 py-1.5 border border-gray-700">
          {roomId}
        </div>
      </section>
    </div>
  );
}