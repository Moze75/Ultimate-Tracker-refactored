import React, { useState } from 'react';
import { Shield, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import type { VTTConnectedUser, VTTToken } from '../../types/vtt';

// -------------------
// Palette de couleurs pour les avatars des joueurs
// -------------------
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#f97316'];

// -------------------
// Génération d'une couleur unique par userId (hash simple)
// -------------------
function getColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

// -------------------
// Extraction du nom d'affichage
// - Si c'est le MJ → "MJ"
// - Si le name est un email (contient @) → partie avant le @
// - Sinon → le name tel quel
// -------------------
function getDisplayName(user: VTTConnectedUser): string {
  if (user.role === 'gm') return 'MJ';
  const name = user.name || 'Inconnu';
  if (name.includes('@')) return name.split('@')[0];
  return name;
}

interface VTTPlayerListProps {
  users: VTTConnectedUser[];
  tokens?: VTTToken[];
}

export function VTTPlayerList({ users, tokens = [] }: VTTPlayerListProps) {
  // -------------------
  // État replié/déplié de la liste des joueurs connectés
  // Repliée par défaut (false)
  // -------------------
  const [expanded, setExpanded] = useState(false);

  if (users.length === 0) return null;

  // -------------------
  // Handler drag & drop : permet de glisser un joueur connecté
  // sur le canvas pour y déplacer son token associé
  // -------------------
  const handleDragStart = (e: React.DragEvent, user: VTTConnectedUser) => {
    const userToken = tokens.find(t =>
      t.controlledByUserIds?.includes(user.userId)
    );
    e.dataTransfer.setData('application/vtt-player-user-id', user.userId);
    if (userToken) {
      e.dataTransfer.setData('application/vtt-player-token-image', userToken.imageUrl || '');
      e.dataTransfer.setData('application/vtt-player-token-label', userToken.label || '');
      e.dataTransfer.setData('application/vtt-player-token-color', userToken.color || '#3b82f6');
    }
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="absolute bottom-3 left-14 z-30 flex flex-col gap-1 pointer-events-auto">
      <div className="bg-gray-900/90 border border-gray-700/60 rounded-lg px-2.5 py-2 backdrop-blur-sm shadow-xl min-w-[140px]">

        {/* -------------------
            En-tête cliquable : replie / déplie la liste
            ------------------- */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center justify-between w-full text-[10px] text-gray-500 font-semibold uppercase tracking-wider hover:text-gray-300 transition-colors"
        >
          <span>En ligne ({users.length})</span>
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
 
        {/* -------------------
            Liste des joueurs connectés (visible uniquement si déplié)
            Chaque entrée est draggable si le joueur a un token assigné
            ------------------- */}
        {expanded && (
          <div className="space-y-1 mt-1.5">
            {users.map(u => {
              const displayName = getDisplayName(u);
              const hasToken = tokens.some(t => t.controlledByUserIds?.includes(u.userId));
              return (
                <div
                  key={u.userId}
                  className={`flex items-center gap-2 ${hasToken ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  draggable={hasToken}
                  onDragStart={hasToken ? (e) => handleDragStart(e, u) : undefined}
                >
                  {/* -------------------
                      Indicateur de drag si le joueur a un token
                      ------------------- */}
                  {hasToken && (
                    <GripVertical size={10} className="text-gray-600 shrink-0" />
                  )}
                  <div className="relative">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ backgroundColor: getColor(u.userId) }}
                    >
                      {displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-gray-900" />
                  </div>
                  <span className="text-xs text-gray-300 truncate max-w-[100px]">{displayName}</span>
                  {u.role === 'gm' && (
                    <Shield size={10} className="text-amber-400 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}