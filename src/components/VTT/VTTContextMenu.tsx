import React, { useEffect, useRef } from 'react';
import { Pencil, Trash2, Eye, EyeOff, UserCheck, ScanEye } from 'lucide-react';
import type { VTTToken, VTTRole } from '../../types/vtt';

interface VTTContextMenuProps {
  token: VTTToken;
  x: number;
  y: number;
  role: VTTRole;
  userId: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  onManageBinding?: () => void;
  onConfigureVision?: () => void;
  onClose: () => void;
}

export function VTTContextMenu({
  token,
  x,
  y,
  role,
  userId,
  onEdit,
  onDelete,
  onToggleVisibility,
  onManageBinding,
  onConfigureVision,
  onClose,
}: VTTContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const canEdit = role === 'gm' || (token.controlledByUserIds && token.controlledByUserIds.includes(userId));

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

  if (!canEdit) return null;

  const boundCount = token.controlledByUserIds?.length || 0;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl py-1 min-w-[160px] overflow-hidden"
      style={menuStyle}
    >
      <div className="px-3 py-1.5 border-b border-gray-700/60 mb-1">
        <p className="text-xs text-gray-400 truncate font-medium">{token.label}</p>
      </div>

      <MenuItem
        icon={<Pencil size={13} />}
        label="Editer"
        onClick={() => { onEdit(); onClose(); }}
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
  icon, label, danger, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
        danger
          ? 'text-red-400 hover:bg-red-900/30'
          : 'text-gray-300 hover:bg-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
