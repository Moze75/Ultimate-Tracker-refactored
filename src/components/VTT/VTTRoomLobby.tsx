import React, { useState, useEffect } from 'react';
import { Plus, Trash2, LogIn, Map, RefreshCw } from 'lucide-react';
import { createVTTRoom, listVTTRooms, deleteVTTRoom } from '../../services/vttService';

interface Room {
  id: string;
  name: string;
  gmUserId: string;
  createdAt: string;
}

interface VTTRoomLobbyProps {
  userId: string;
  authToken: string;
  onJoinRoom: (roomId: string) => void;
  onBack: () => void;
}

export function VTTRoomLobby({ userId, authToken, onJoinRoom, onBack }: VTTRoomLobbyProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joinRoomId, setJoinRoomId] = useState('');

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
      onJoinRoom(roomId);
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
              onClick={() => joinRoomId.trim() && onJoinRoom(joinRoomId.trim())}
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
                      onClick={() => onJoinRoom(room.id)}
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
    </div>
  );
}
