import React, { useState, useEffect } from 'react';
import { X, User, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { VTTToken, VTTConnectedUser } from '../../types/vtt';

interface AddTokenModalProps {
  onConfirm: (token: Omit<VTTToken, 'id'>) => void;
  onClose: () => void;
  userId: string;
  onCharDragStart?: () => void;
  tokens?: VTTToken[];
  connectedUsers?: VTTConnectedUser[];
}

interface PlayerCharacter {
  id: string;
  name: string;
  avatar_url: string | null;
  class: string | null;
  level: number | null;
  current_hp: number | null;
  max_hp: number | null;
}

const TOKEN_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

export function AddTokenModal({
  onConfirm,
  onClose,
  userId,
  onCharDragStart,
  tokens = [],
  connectedUsers = [],
}: AddTokenModalProps) {
  const [characters, setCharacters] = useState<PlayerCharacter[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('players')
      .select('id, name, avatar_url, class, level, current_hp, max_hp')
      .eq('user_id', userId)
      .order('name')
      .then(({ data }) => {
        if (data) setCharacters(data);
      });
  }, [userId]);

  const selectCharacter = (char: PlayerCharacter) => {
    setSelectedCharId(char.id);
  };

const buildTokenData = (char: PlayerCharacter): Omit<VTTToken, 'id'> => ({
  characterId: char.id,
  ownerUserId: userId,
  label: char.name || 'Token',
  imageUrl: char.avatar_url || null,
  position: { x: 0, y: 0 },
  size: 1,
  rotation: 0,
  visible: true,
  color: TOKEN_COLORS[0],
  hp: char.current_hp ?? undefined,
  maxHp: char.max_hp ?? undefined,
  visionMode: 'normal',
  visionRadius: 8,
  lightSource: 'none',
  lightRadius: 0,
});

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm border border-gray-700 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <h3 className="text-white font-semibold">Ajouter un token</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {(characters.length > 0 || connectedUsers.length > 0) && (
            <div className="p-4 border-b border-gray-700 space-y-4">
              {characters.length > 0 && (
                <div>
                  {/* -------------------
                      Gestion de mes personnages
                      -------------------
                      Cette section permet de glisser un personnage personnel
                      directement sur la carte pour créer son token.
                  */}
                  <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Mes personnages</p>
                  <p className="text-[11px] text-amber-400/70 mb-2 flex items-center gap-1">
                    <GripVertical size={11} />
                    Glisser sur la carte pour placer directement
                  </p>
                  <div className="space-y-2">
                    {characters.map(char => (
                      <div
                        key={char.id}
                        draggable
                        onDragStart={e => {
                          const data = buildTokenData(char);
                          e.dataTransfer.setData('application/vtt-new-token', JSON.stringify(data));
                          e.dataTransfer.effectAllowed = 'copy';
                          setTimeout(() => onCharDragStart?.(), 0);
                        }}
                        onClick={() => selectCharacter(char)}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                          selectedCharId === char.id
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-gray-600 hover:border-gray-500 bg-gray-700/50 hover:bg-gray-700'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gray-600 flex items-center justify-center">
                          {char.avatar_url ? (
                            <img
                              src={char.avatar_url}
                              alt={char.name}
                              draggable={false}
                              className="w-full h-full object-cover pointer-events-none"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <User size={18} className="text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white font-medium truncate">{char.name}</p>
                          <p className="text-xs text-gray-400">
                            {[char.class, char.level ? `Niv. ${char.level}` : null].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <GripVertical size={14} className="text-gray-500 shrink-0" />
                        {selectedCharId === char.id && (
                          <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {connectedUsers.some(user => user.role !== 'gm') && (
                <div>
                  {/* -------------------
                      Gestion des personnages connectés
                      -------------------
                      Cette section affiche les tokens déjà contrôlés
                      par les joueurs connectés et permet au MJ
                      de les glisser directement sur la carte.
                  */}
                  <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Personnages connectés</p>
                  <p className="text-[11px] text-emerald-400/70 mb-2 flex items-center gap-1">
                    <GripVertical size={11} />
                    Glisser sur la carte pour repositionner un token connecté
                  </p>
                  <div className="space-y-2">
                    {connectedUsers
                      .filter(user => user.role !== 'gm')
                      .map(user => {
                        const connectedToken = tokens.find(token =>
                          token.controlledByUserIds?.includes(user.userId)
                        );

                        if (!connectedToken) return null;

                        return (
                          <div
                            key={user.userId}
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData('application/vtt-player-user-id', user.userId);
                              e.dataTransfer.effectAllowed = 'move';
                              setTimeout(() => onCharDragStart?.(), 0);
                            }}
                            className="w-full flex items-center gap-3 p-2 rounded-lg border border-emerald-700/40 bg-emerald-950/20 hover:bg-emerald-900/20 transition-all cursor-grab active:cursor-grabbing"
                            title={`Glisser ${connectedToken.label} sur la carte`}
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gray-600 flex items-center justify-center">
                              {connectedToken.imageUrl ? (
                                <img
                                  src={connectedToken.imageUrl}
                                  alt={connectedToken.label}
                                  draggable={false}
                                  className="w-full h-full object-cover pointer-events-none"
                                />
                              ) : (
                                <div
                                  className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white"
                                  style={{ backgroundColor: connectedToken.color || '#6b7280' }}
                                >
                                  {connectedToken.label.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-white font-medium truncate">{connectedToken.label}</p>
                              <p className="text-xs text-gray-400 truncate">{user.name || 'Joueur connecté'}</p>
                            </div>

                            <GripVertical size={14} className="text-gray-500 shrink-0" />
                          </div>
                        );
                      })}

                    {connectedUsers.filter(user =>
                      user.role !== 'gm' && tokens.some(token => token.controlledByUserIds?.includes(user.userId))
                    ).length === 0 && (
                      <div className="text-xs text-gray-500 italic">
                        Aucun token connecté disponible
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* -------------------
              Gestion de la fermeture du panneau
              -------------------
              La création manuelle de token est supprimée :
              le placement se fait désormais via les listes
              "Mes personnages" et "Personnages connectés".
          */}
          <div className="p-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
