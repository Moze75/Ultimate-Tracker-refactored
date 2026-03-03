import React, { useEffect, useRef } from 'react';
import { Pencil, Trash2, Eye, EyeOff, Shield, Users, Globe } from 'lucide-react';
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
  onSetControlledBy?: (controlledBy: 'gm' | 'player' | 'all') => void;
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
  onSetControlledBy,
  onClose,
}: VTTContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const ctrl = token.controlledBy || 'all';
  const canEdit = role === 'gm' || (ctrl === 'all') || (ctrl === 'player' && token.ownerUserId === userId);

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
        label="Éditer"
        onClick={() => { onEdit(); onClose(); }}
      />

      {role === 'gm' && (
        <MenuItem
          icon={token.visible ? <EyeOff size={13} /> : <Eye size={13} />}
          label={token.visible ? 'Masquer' : 'Rendre visible'}
          onClick={() => { onToggleVisibility(); onClose(); }}
        />
      )}

      {role === 'gm' && onSetControlledBy && (
        <div className="border-t border-gray-700/60 mt-1 pt-1">
          <p className="px-3 py-1 text-[10px] text-gray-500 font-medium uppercase tracking-wide">Controle</p>
          <div className="flex gap-0.5 px-2 pb-1">
            {([
              { value: 'all' as const, icon: <Globe size={11} />, tip: 'Tous' },
              { value: 'player' as const, icon: <Users size={11} />, tip: 'Joueur' },
              { value: 'gm' as const, icon: <Shield size={11} />, tip: 'MJ' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => { onSetControlledBy(opt.value); onClose(); }}
                className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] transition-colors ${
                  (token.controlledBy || 'all') === opt.value
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                    : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300'
                }`}
                title={opt.tip}
              >
                {opt.icon}
                {opt.tip}
              </button>
            ))}
          </div>
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
