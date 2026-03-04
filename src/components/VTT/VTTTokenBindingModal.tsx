import React, { useState } from 'react';
import { X, UserCheck, UserMinus } from 'lucide-react';
import type { VTTToken, VTTConnectedUser } from '../../types/vtt';

interface VTTTokenBindingModalProps {
  token: VTTToken;
  connectedUsers: VTTConnectedUser[];
  onSave: (controlledByUserIds: string[]) => void;
  onClose: () => void;
}

export function VTTTokenBindingModal({ token, connectedUsers, onSave, onClose }: VTTTokenBindingModalProps) {
  const [selected, setSelected] = useState<string[]>(token.controlledByUserIds || []);

  const players = connectedUsers.filter(u => u.role === 'player');

  const toggleUser = (uid: string) => {
    setSelected(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Assigner joueur(s)</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center overflow-hidden border-2 border-gray-600"
            >
              {token.imageUrl ? (
                <img src={token.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: token.color }}
                >
                  {token.label.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-white font-medium">{token.label}</p>
              <p className="text-[10px] text-gray-500">
                {selected.length === 0
                  ? 'Aucun joueur assigne'
                  : `${selected.length} joueur(s) assigne(s)`}
              </p>
            </div>
          </div>

          {players.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-xs">
              Aucun joueur connecte. Les joueurs doivent rejoindre la table pour apparaitre ici.
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-2">Joueurs connectes</p>
              {players.map(user => {
                const isAssigned = selected.includes(user.userId);
                return (
                  <button
                    key={user.userId}
                    onClick={() => toggleUser(user.userId)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                      isAssigned
                        ? 'border-blue-500/60 bg-blue-500/10'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{user.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono truncate">{user.userId.slice(0, 8)}...</p>
                    </div>
                    {isAssigned ? (
                      <UserMinus size={14} className="text-blue-400 shrink-0" />
                    ) : (
                      <UserCheck size={14} className="text-gray-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 pb-4">
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-400 rounded-lg text-xs transition-colors"
            >
              Tout retirer
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors">
            Annuler
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
