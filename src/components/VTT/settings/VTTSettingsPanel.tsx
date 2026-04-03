import { useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Upload } from 'lucide-react'; 

interface VTTSettingsPanelProps {
  autoFocusCombatTurn?: boolean;
  onToggleAutoFocusCombatTurn?: () => void;
  followCameraOnTokenMove?: boolean;
  onToggleFollowCameraOnTokenMove?: () => void;
  lockPlayerMovementOutsideTurn?: boolean;
  onToggleLockPlayerMovementOutsideTurn?: () => void;
  onSaveScene?: () => Promise<void>;
  roomId: string;
  saving: boolean;
  saveOk: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setSaveOk: React.Dispatch<React.SetStateAction<boolean>>;
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange?: () => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-xs text-gray-100">{label}</p>
        {description && (
          <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-emerald-600' : 'bg-gray-600'
        }`}
        title={checked ? 'Activé' : 'Désactivé'}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function SettingsSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
<section className="border-b border-gray-800 pb-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-800/40 transition-colors"
      >
        <span className="text-xs text-gray-200 font-medium">{title}</span>
        {open ? (
          <ChevronDown size={14} className="text-gray-500" />
        ) : (
          <ChevronRight size={14} className="text-gray-500" />
        )}
      </button>

      {open && (
        <div className="p-3 pt-0 space-y-2">
          {children}
        </div>
      )}
    </section>
  );
}

export function VTTSettingsPanel({
  autoFocusCombatTurn = true,
  onToggleAutoFocusCombatTurn,
  followCameraOnTokenMove = false,
  onToggleFollowCameraOnTokenMove,
  onSaveScene,
  roomId,
  saving,
  saveOk,
  setSaving,
  setSaveOk,
}: VTTSettingsPanelProps) {
  return (
    <div className="p-3 space-y-4">
           <SettingsSection title="Combat" defaultOpen>
        <div className="divide-y divide-gray-800">
          <ToggleSwitch
            checked={autoFocusCombatTurn}
            onChange={onToggleAutoFocusCombatTurn}
            label="Focus sur le token au passage de tour"
            description="Centre la vue une fois au changement de tour. Le clic sur une ligne du tracker centre toujours la vue."
          />

          <ToggleSwitch
            checked={followCameraOnTokenMove}
            onChange={onToggleFollowCameraOnTokenMove}
            label="Suivi du token par la caméra"
            description="Suit uniquement les déplacements locaux du token sur cette fenêtre."
          />
        </div>
      </SettingsSection>

      {onSaveScene && (
        <SettingsSection title="Scène" defaultOpen>
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
        </SettingsSection>
      )}

      <SettingsSection title="Salle" defaultOpen={false}>
        <div className="pt-3 border-t border-gray-800">
          <div className="font-mono text-gray-300 text-xs break-all">
            {roomId}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}