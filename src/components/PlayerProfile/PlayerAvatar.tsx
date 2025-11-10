import React from 'react';
import { Menu } from 'lucide-react';
import { Avatar } from '../Avatar';

interface PlayerAvatarProps {
  player: {
    id: string;
    avatar_url: string | null;
    adventurer_name?: string;
    name: string;
    class?: string;
    level?: number;
    secondary_class?: string | null;
    secondary_level?: number | null;
  };
  onEdit: () => void;
  onOpenDiceSettings?: () => void; // ✅ Ajouter
}

export function PlayerAvatar({ player, onEdit, onOpenDiceSettings }: PlayerAvatarProps) {
  return (
    <div className="relative w-full min-w-0 aspect-[7/10] sm:aspect-[2/3] md:aspect-[auto] md:h-[60vh] lg:h-[70vh] rounded-lg overflow-hidden bg-gray-800/50 flex items-center justify-center md:max-h-[500px]">
      <button
        onClick={onEdit}
        className="absolute top-2 left-2 w-9 h-9 rounded-full bg-gray-900/40 backdrop-blur-sm text-white hover:bg-gray-800/50 hover:text-white flex items-center justify-center z-10 transition-colors"
        title="Profil et caractéristiques"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ✅ Passer onOpenDiceSettings à Avatar */}
      <Avatar
        url={player.avatar_url || ''}
        playerId={player.id}
        size="lg"
        editable={false}
        onAvatarUpdate={() => {}}
        secondaryClass={player.secondary_class}
        secondaryLevel={player.secondary_level}
        onOpenDiceSettings={onOpenDiceSettings}
      />

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pointer-events-none">
        <div className="text-white">
          <h3 className="text-lg font-bold text-white drop-shadow-lg">
            {player.adventurer_name || player.name}
          </h3>
          {player.class && (
            <div className="space-y-1">
              <p className="text-sm text-gray-200 drop-shadow-md">
                {player.class} niveau {player.level}
              </p>
              {player.secondary_class && player.secondary_level && (
                <p className="text-xs text-purple-300 drop-shadow-md">
                  {player.secondary_class} niveau {player.secondary_level}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}