import React from 'react';
import { Shield } from 'lucide-react';
import type { VTTConnectedUser } from '../../types/vtt';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#f97316'];

function getColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface VTTPlayerListProps {
  users: VTTConnectedUser[];
}

export function VTTPlayerList({ users }: VTTPlayerListProps) {
  if (users.length === 0) return null;

  return (
    <div className="absolute bottom-3 left-14 z-30 flex flex-col gap-1 pointer-events-auto">
      <div className="bg-gray-900/90 border border-gray-700/60 rounded-lg px-2.5 py-2 backdrop-blur-sm shadow-xl min-w-[140px]">
        <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5">
          En ligne ({users.length})
        </div>
        <div className="space-y-1">
          {users.map(u => (
            <div key={u.userId} className="flex items-center gap-2">
              <div className="relative">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ backgroundColor: getColor(u.userId) }}
                >
                  {u.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-gray-900" />
              </div>
              <span className="text-xs text-gray-300 truncate max-w-[100px]">{u.name}</span>
              {u.role === 'gm' && (
                <Shield size={10} className="text-amber-400 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
