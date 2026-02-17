import React from 'react';
import { Settings, Dices } from 'lucide-react';

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
  onOpenDiceSettings?: () => void;
  onOpenFamiliar?: () => void; // ✅ Nouvelle prop
}

const DEFAULT_CUSTOM_CLASS_IMAGE = '/sans_classe.png';

export function CompactAvatar({ player, onEdit, onOpenDiceSettings, onOpenFamiliar }: CompactAvatarProps) {
  const getClassImage = (className: string | undefined) => {
    if (!className) return DEFAULT_CUSTOM_CLASS_IMAGE;
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
    return classMap[className] || DEFAULT_CUSTOM_CLASS_IMAGE;
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
            e.currentTarget.src = DEFAULT_CUSTOM_CLASS_IMAGE;
          }}
        />
      </div>

      {/* ✅ Boutons Éditer et Paramètres côte à côte */}
      <div className="absolute top-0 left-[8.5rem] flex gap-1 z-50">
        <button
          onClick={onEdit}
          className="px-2 py-1 rounded bg-transparent text-white hover:bg-gray-800/50 flex items-center gap-1 transition-colors text-xs"
          title="Éditer le profil"
        >
          <Settings className="w-3 h-3" />
          <span>Éditer</span>
        </button>

        {onOpenDiceSettings && (
          <button
            onClick={onOpenDiceSettings}
            className="px-2 py-1 rounded bg-transparent text-purple-300 hover:bg-purple-800/30 flex items-center gap-1 transition-colors text-xs"
            title="Paramètres des dés"
          >
            <Dices className="w-3 h-3" />
            <span>Paramètres</span>
          </button>
        )}
      </div>

      {/* Infos personnage */}
      <div className="flex-1 min-w-0">
         <h2 className="text-2xl font-bold text-gray-100 truncate mt-4">
          {player.adventurer_name || player.name}
        </h2>
        {player.class && (
          <div className="space-y-0.5">
            <p className="text-sm text-gray-300">
              {player.class} niveau {player.level}
            </p>
            {player.secondary_class && player.secondary_level && (
              <p className="text-sm text-purple-300">
                {player.secondary_class} niveau {player.secondary_level}
              </p>
            )}
          </div>
        )}
        {/* ✅ Bouton Familier en dessous de classe/niveau (desktop) */}
        {onOpenFamiliar && (
          <button
            onClick={onOpenFamiliar}
            className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-transparent hover:bg-emerald-900/30 transition-colors group"
            title="Gérer le familier"
          >
            <img
              src="https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/icons/familier.png"
              alt="Familier"
              className="w-10 h-10"
            />
            <span className="text-xs text-gray-400 group-hover:text-emerald-300 transition-colors">Familier</span>
          </button>
        )}
      </div>
    </div>
  );
}