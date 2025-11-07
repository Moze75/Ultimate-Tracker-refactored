import React from 'react';
import { Settings } from 'lucide-react';

interface CompactAvatarProps {
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
}

export function CompactAvatar({ player, onEdit }: CompactAvatarProps) {
  const getClassImage = (className: string | undefined) => {
    if (!className) return '/icons/wmremove-transformed.png';
    const classMap: Record<string, string> = {
      'Barbare': '/Barbare.png',
      'Barde': '/Barde.png',
      'Clerc': '/Clerc.png',
      'Druide': '/Druide.png',
      'Ensorceleur': '/Ensorceleur.png',
      'Guerrier': '/Guerrier.png',
      'Magicien': '/Magicien.png',
      'Moine': '/Moine.png',
      'Occultiste': '/Occultiste.png',
      'Paladin': '/Paladin.png',
      'Rôdeur': '/Rodeur.png',
      'Roublard': '/Voleur.png',
    };
    return classMap[className] || '/icons/wmremove-transformed.png';
  };

  const imageUrl = player.avatar_url || getClassImage(player.class);

  return (
    <div className="relative flex items-center gap-4">
      {/* Avatar compact */}
      <div className="w-32 h-44 rounded-lg overflow-hidden bg-gray-800/50 border border-gray-700 flex-shrink-0">
        <img
          src={imageUrl}
          alt={player.adventurer_name || player.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = '/icons/wmremove-transformed.png';
          }}
        />
      </div>
      <button
        onClick={onEdit}
        className="absolute top-0 left-[8.5rem] px-2 py-1 rounded bg-gray-900/70 backdrop-blur-sm text-white hover:bg-gray-800/90 flex items-center gap-1 transition-colors text-xs z-10"
        title="Éditer le profil"
      >
        <Settings className="w-3 h-3" />
        <span>Éditer</span>
      </button>

      {/* Infos personnage */}
      <div className="flex-1 min-w-0">
        <h2 className="text-2xl font-bold text-gray-100 truncate">
          {player.adventurer_name || player.name}
        </h2>
        {player.class && (
          <div className="space-y-0.5">
            <p className="text-base text-gray-300">
              {player.class} niveau {player.level}
            </p>
            {player.secondary_class && player.secondary_level && (
              <p className="text-sm text-purple-300">
                {player.secondary_class} niveau {player.secondary_level}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
