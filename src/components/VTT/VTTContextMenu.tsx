import { Pencil, Trash2, Eye, EyeOff, UserCheck, ScanEye, Flame, Swords, Crosshair } from 'lucide-react';
import type { VTTToken, VTTRole } from '../../types/vtt';

interface VTTContextMenuProps {
  token: VTTToken;
  x: number;
  y: number;
  role: VTTRole;
  userId: string;
  selectedTokens?: VTTToken[];
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  onToggleTorch: () => void;
  onManageBinding: () => void;
  onConfigureVision: () => void;
  onLaunchCombat?: (tokens: VTTToken[]) => void;
  // -------------------
  // Ciblage d'un token
  // -------------------
  // Accessible à tous les rôles (joueur et MJ).
  // Toggle : cibler / décibler.
  onToggleTarget?: () => void;
  onClose: () => void;
}

export function VTTContextMenu({
  token,
  x,
  y,
  role,
  userId,
  selectedTokens,
  onEdit,
  onDelete,
  onToggleVisibility,
  onToggleTorch,
  onManageBinding,
  onConfigureVision,
  onLaunchCombat,
  onToggleTarget,
  onClose,
}: VTTContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  // -------------------
  // Accès au menu contextuel
  // -------------------
  // Le MJ voit toujours le menu.
  // Un joueur voit le menu sur n'importe quel token (pour cibler),
  // mais les actions d'édition/suppression restent restreintes.
  const canEdit = role === 'gm' || (token.controlledByUserIds && token.controlledByUserIds.includes(userId));
  const isTargeted = token.targetedByUserIds?.includes(userId) ?? false;
  const multiSelected = selectedTokens && selectedTokens.length >= 1;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    left: x,
    top: y,
    transform: x > window.innerWidth - 180 ? 'translateX(-100%)' : undefined,
  };

   // -------------------
  // Le menu est visible pour tous (pour le ciblage),
  // même si le joueur ne contrôle pas le token.
  // -------------------
  // (on retire le early return canEdit)

  const boundCount = token.controlledByUserIds?.length || 0;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl py-1 min-w-[160px] overflow-hidden"
      style={menuStyle}
    >
      <div className="px-3 py-1.5 border-b border-gray-700/60 mb-1">
        {multiSelected ? (
          <p className="text-xs text-amber-400 truncate font-medium">{selectedTokens!.length} tokens sélectionnés</p>
        ) : (
          <p className="text-xs text-gray-400 truncate font-medium">{token.label}</p>
        )}
      </div>

      <MenuItem
        icon={<Pencil size={13} />}
        label="Editer"
        onClick={() => { onEdit(); onClose(); }}
      />

      <MenuItem
        icon={<Flame size={13} />}
        label={token.lightSource === 'torch' ? 'Éteindre la torche' : 'Allumer la torche'}
        onClick={() => { onToggleTorch(); onClose(); }}
      />
 
      {role === 'gm' && (
        <MenuItem
          icon={token.visible ? <EyeOff size={13} /> : <Eye size={13} />}
          label={token.visible ? 'Masquer' : 'Rendre visible'}
          onClick={() => { onToggleVisibility(); onClose(); }}
        />  
      )}

      {role === 'gm' && onManageBinding && (
        <MenuItem
          icon={<UserCheck size={13} />}
          label={`Assigner joueur${boundCount > 0 ? ` (${boundCount})` : ''}`}
          onClick={() => { onManageBinding(); onClose(); }}
        />
      )}

      {role === 'gm' && onConfigureVision && (
        <MenuItem
          icon={<ScanEye size={13} />}
          label={`Vision${token.visionMode && token.visionMode !== 'none' ? ` (${token.visionMode === 'darkvision' ? 'Nyctalopie' : 'Normale'})` : ''}`}
          onClick={() => { onConfigureVision(); onClose(); }}
        />
      )}

      {role === 'gm' && onLaunchCombat && multiSelected && (
        <div className="border-t border-gray-700/60 mt-1 pt-1">
          <MenuItem
            icon={<Swords size={13} />}
            label={selectedTokens!.length > 1 ? `Lancer combat (${selectedTokens!.length})` : 'Lancer le combat'}
            highlight
            onClick={() => { onLaunchCombat(selectedTokens!); onClose(); }}
          />
        </div>
      )}

      {role === 'gm' && (
        <div className="border-t border-gray-700/60 mt-1 pt-1">
          <MenuItem
            icon={<Trash2 size={13} />}
            label="Supprimer"
            danger
            onClick={() => { onDelete(); onClose(); }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon, label, danger, highlight, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
        danger
          ? 'text-red-400 hover:bg-red-900/30'
          : highlight
          ? 'text-amber-400 hover:bg-amber-900/30'
          : 'text-gray-300 hover:bg-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
