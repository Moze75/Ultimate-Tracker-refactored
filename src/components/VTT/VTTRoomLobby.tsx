import React, { useState, useEffect } from 'react';
import { Plus, Trash2, LogIn, Map, RefreshCw, Shield, User, Users } from 'lucide-react';
import { createVTTRoom, listVTTRooms, deleteVTTRoom } from '../../services/vttService';
import { supabase } from '../../lib/supabase';
import type { VTTToken } from '../../types/vtt';

interface Room {
  id: string;
  name: string;
  gmUserId: string;
  createdAt: string;
}

interface RoomTokenInfo {
  label: string;
  imageUrl: string | null;
  color: string;
  id: string;
  controlledByUserIds?: string[];
}

interface VTTRoomLobbyProps {
  userId: string;
  authToken: string;
  onJoinRoom: (roomId: string, role: 'gm' | 'player', selectedTokenIds?: string[]) => void;
  onBack: () => void;
}

export function VTTRoomLobby({ userId, authToken, onJoinRoom, onBack }: VTTRoomLobbyProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);
  const [playerSelectStep, setPlayerSelectStep] = useState<{ roomId: string; tokens: RoomTokenInfo[] } | null>(null);
  const [selectedPlayerTokenIds, setSelectedPlayerTokenIds] = useState<string[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);

  const fetchRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listVTTRooms(userId, authToken);
      setRooms(list);
    } catch {
      setError('Impossible de contacter le serveur VTT. Vérifiez que le backend est démarré.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setCreating(true);
    try {
      const { roomId } = await createVTTRoom(newRoomName.trim(), userId, authToken);
      setNewRoomName('');
      await fetchRooms();
      onJoinRoom(roomId, 'gm');
    } catch {
      setError('Erreur lors de la création de la room.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (roomId: string) => {
    if (!window.confirm('Supprimer cette room ?')) return;
    try {
      await deleteVTTRoom(roomId, authToken);
      setRooms(r => r.filter(x => x.id !== roomId));
    } catch {
      setError('Erreur lors de la suppression.');
    }
  };

  const handleRoleSelect = async (roomId: string, role: 'gm' | 'player') => {
    setPendingJoinRoomId(null);
    if (role === 'gm') {
      onJoinRoom(roomId, 'gm');
      return;
    }

    setLoadingTokens(true);
    try {
      const { data } = await supabase
        .from('vtt_rooms')
        .select('state_json')
        .eq('id', roomId)
        .maybeSingle();

      if (!data?.state_json) {
        onJoinRoom(roomId, 'player');
        return;
      }

      const stateJson = data.state_json as { tokens?: VTTToken[] };
      const tokens = stateJson.tokens || [];

      if (tokens.length === 0) {
        onJoinRoom(roomId, 'player');
        return;
      }

      const tokenInfos: RoomTokenInfo[] = tokens.map(t => ({
        id: t.id,
        label: t.label,
        imageUrl: t.imageUrl,
        color: t.color,
        controlledByUserIds: t.controlledByUserIds,
      }));

setSelectedPlayerTokenIds([]);
      setPlayerSelectStep({ roomId, tokens: tokenInfos });
    } catch {
      onJoinRoom(roomId, 'player');
    } finally {
      setLoadingTokens(false);
    }
  };

const handlePlayerConfirm = () => {
  if (!playerSelectStep) return;

  const playerSessionId = crypto.randomUUID();
  sessionStorage.setItem(`vtt:playerSessionId:${playerSelectStep.roomId}`, playerSessionId);

  onJoinRoom(playerSelectStep.roomId, 'player', selectedPlayerTokenIds);
  setPlayerSelectStep(null);
  setSelectedPlayerTokenIds([]);
};

  const toggleTokenSelection = (tokenId: string) => {
    setSelectedPlayerTokenIds(prev =>
      prev.includes(tokenId)
        ? prev.filter(id => id !== tokenId)
        : [...prev, tokenId]
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
        >
          ← Retour
        </button>
        <Map className="text-amber-500" size={20} />
        <h1 className="text-lg font-bold">VTT Beta</h1>
        <span className="px-2 py-0.5 text-xs bg-amber-900/50 text-amber-400 rounded-full border border-amber-700/50">
          Beta fermée
        </span>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm text-red-300 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-300">✕</button>
          </div>
        )}

        <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Créer une nouvelle table</h2>
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              type="text"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              placeholder="Nom de la table..."
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
            <button
              type="submit"
              disabled={creating || !newRoomName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Créer
            </button>
          </form>
        </div>

        <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Rejoindre par ID</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinRoomId}
              onChange={e => setJoinRoomId(e.target.value)}
              placeholder="ID de la room..."
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
            <button
              onClick={() => joinRoomId.trim() && setPendingJoinRoomId(joinRoomId.trim())}
              disabled={!joinRoomId.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <LogIn size={16} />
              Rejoindre
            </button>
          </div>
        </div>

        <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">Mes tables</h2>
            <button
              onClick={fetchRooms}
              className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors text-gray-400"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Chargement...</div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Aucune table. Créez-en une pour commencer.
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map(room => (
                <div
                  key={room.id}
                  className="flex items-center gap-3 p-3 bg-gray-800/60 rounded-lg border border-gray-700/50 hover:border-amber-700/50 transition-colors"
                >
                  <Map size={18} className="text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{room.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{room.id}</p>
                  </div>
                  <div className="flex gap-1">
                    {room.gmUserId === userId && (
                      <button
                        onClick={() => handleDelete(room.id)}
                        className="p-1.5 hover:bg-red-900/40 rounded-lg transition-colors text-gray-500 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => setPendingJoinRoomId(room.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      <LogIn size={12} />
                      Ouvrir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
          <p className="text-xs text-blue-300">
            <strong>VTT Beta :</strong> Créez une table en tant que MJ et partagez l'ID avec vos joueurs.
            Les tokens, la carte et le brouillard de guerre sont synchronisés en temps réel.
          </p>
        </div>
      </div>

      {pendingJoinRoomId && !playerSelectStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-white mb-1">Rejoindre la table</h3>
            <p className="text-xs text-gray-400 mb-5">Choisissez votre role pour cette session.</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => handleRoleSelect(pendingJoinRoomId, 'gm')}
                disabled={loadingTokens}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-amber-900/30 border border-gray-700 hover:border-amber-600/50 rounded-xl transition-all group disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-amber-600/20 border border-amber-600/40 flex items-center justify-center group-hover:bg-amber-600/30 transition-colors">
                  <Shield size={20} className="text-amber-400" />
                </div>
                <span className="text-sm font-medium text-gray-200 group-hover:text-amber-300 transition-colors">Maitre du Jeu</span>
                <span className="text-[10px] text-gray-500 text-center leading-tight">Controle total de la table</span>
              </button>
              <button
                onClick={() => handleRoleSelect(pendingJoinRoomId, 'player')}
                disabled={loadingTokens}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-blue-900/30 border border-gray-700 hover:border-blue-600/50 rounded-xl transition-all group disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-600/40 flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                  <User size={20} className="text-blue-400" />
                </div>
                <span className="text-sm font-medium text-gray-200 group-hover:text-blue-300 transition-colors">Joueur</span>
                <span className="text-[10px] text-gray-500 text-center leading-tight">Vision limitee par le MJ</span>
              </button>
            </div>
            {loadingTokens && (
              <div className="text-center text-xs text-gray-400 mb-2">Chargement des tokens...</div>
            )}
            <button
              onClick={() => setPendingJoinRoomId(null)}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {playerSelectStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <Users size={18} className="text-blue-400" />
              <h3 className="text-base font-semibold text-white">Choisir vos tokens</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Selectionnez les tokens que vous allez controler durant la session. Vous ne pourrez deplacer que ces tokens.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {playerSelectStep.tokens.map(token => {
                const isSelected = selectedPlayerTokenIds.includes(token.id);
                const boundToOther = token.controlledByUserIds &&
                  token.controlledByUserIds.length > 0 &&
                  !token.controlledByUserIds.includes(userId);
                return (
                  <button
                    key={token.id}
                    onClick={() => toggleTokenSelection(token.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/15'
                        : boundToOther
                          ? 'border-gray-700 bg-gray-800/40 opacity-60'
                          : 'border-gray-700 bg-gray-800/60 hover:border-gray-500'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center overflow-hidden border-2"
                      style={{ borderColor: isSelected ? '#3b82f6' : '#4b5563' }}
                    >
                      {token.imageUrl ? (
                        <img
                          src={token.imageUrl}
                          alt={token.label}
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: token.color }}
                        >
                          {token.label.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{token.label}</p>
                      {boundToOther && (
                        <p className="text-[10px] text-gray-500">Deja assigne a un autre joueur</p>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setPlayerSelectStep(null); setSelectedPlayerTokenIds([]); }}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handlePlayerConfirm}
                disabled={selectedPlayerTokenIds.length === 0}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Confirmer ({selectedPlayerTokenIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
