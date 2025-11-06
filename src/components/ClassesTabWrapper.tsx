import React from 'react';
import ClassesTab from './ClassesTab';
import type { Player } from '../types/dnd';

interface ClassesTabWrapperProps {
  player?: Player | null;
  onUpdate?: (player: Player) => void;
}

export function ClassesTabWrapper({ player, onUpdate }: ClassesTabWrapperProps) {
  if (!player) return null;

  const hasPrimaryClass = !!player.class;
  const hasSecondaryClass = !!player.secondary_class;

  return (
    <div className="space-y-6">
      {hasPrimaryClass && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-400 px-1">Classe principale</h4>
          <ClassesTab
            player={player}
            playerClass={player.class}
            className={player.class}
            subclassName={player.subclass}
            characterLevel={player.level}
            onUpdate={onUpdate}
          />
        </div>
      )}

      {hasSecondaryClass && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-400 px-1">Classe secondaire</h4>
          <ClassesTab
            player={{
              ...player,
              class: player.secondary_class,
              level: player.secondary_level || 1,
              class_resources: player.secondary_class_resources,
              spell_slots: player.secondary_spell_slots,
              subclass: player.secondary_subclass,
            } as Player}
            playerClass={player.secondary_class}
            className={player.secondary_class}
            subclassName={player.secondary_subclass || null}
            characterLevel={player.secondary_level || 1}
            onUpdate={(updatedPlayer) => {
              if (!onUpdate) return;

              onUpdate({
                ...player,
                secondary_class: updatedPlayer.class,
                secondary_level: updatedPlayer.level,
                secondary_class_resources: updatedPlayer.class_resources,
                secondary_spell_slots: updatedPlayer.spell_slots,
                secondary_subclass: updatedPlayer.subclass,
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
