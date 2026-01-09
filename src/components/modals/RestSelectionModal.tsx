import React, { useState, useMemo } from 'react';
import { X, Sun, Plus, Minus, Check, Dice6, Heart } from 'lucide-react';
import type { Player } from '../../types/dnd';
import { getRestorableResources, getHitDieSize, getModifierFromPlayer, type RestableResource } from '../../services/restService';
import { getIconComponent } from '../CustomClassSettingsModal';

interface RestSelectionModalProps {
  open: boolean;
  onClose: () => void;
  player: Player;
  onConfirm: (hitDiceCount: number, selectedResourceIds: string[]) => void;
}

export function RestSelectionModal({ open, onClose, player, onConfirm }: RestSelectionModalProps) {
  const [hitDiceCount, setHitDiceCount] = useState(0);
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());

  const restorableResources = useMemo(() => {
    return getRestorableResources(player, 'short');
  }, [player]);

  const availableHitDice = player.hit_dice
    ? player.hit_dice.total - player.hit_dice.used
    : 0;

  const hitDieSize = getHitDieSize(player.class);
  const constitutionMod = getModifierFromPlayer(player, 'Constitution');

  const estimatedHealing = useMemo(() => {
    if (hitDiceCount === 0) return 0;
    const avgRoll = (hitDieSize + 1) / 2;
    return Math.floor(hitDiceCount * Math.max(1, avgRoll + constitutionMod));
  }, [hitDiceCount, hitDieSize, constitutionMod]);

  const toggleResource = (id: string) => {
    setSelectedResources(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedResources(new Set(restorableResources.map(r => r.id)));
  };

  const handleConfirm = () => {
    onConfirm(hitDiceCount, Array.from(selectedResources));
    setHitDiceCount(0);
    setSelectedResources(new Set());
    onClose();
  };

  const hasAnythingToRestore = hitDiceCount > 0 || selectedResources.size > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Sun className="w-5 h-5 text-yellow-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-100">Repos court</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Dice6 className="w-5 h-5 text-blue-400" />
                <span className="font-medium text-gray-200">Des de vie</span>
              </div>
              <span className="text-sm text-gray-400">
                {availableHitDice} disponible{availableHitDice > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center justify-center gap-4 mb-3">
              <button
                onClick={() => setHitDiceCount(Math.max(0, hitDiceCount - 1))}
                disabled={hitDiceCount <= 0}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  hitDiceCount > 0
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                <Minus className="w-5 h-5" />
              </button>
              <div className="text-center">
                <span className="text-3xl font-bold text-gray-100">{hitDiceCount}</span>
                <span className="text-gray-400 ml-1">/ {availableHitDice}</span>
              </div>
              <button
                onClick={() => setHitDiceCount(Math.min(availableHitDice, hitDiceCount + 1))}
                disabled={hitDiceCount >= availableHitDice}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  hitDiceCount < availableHitDice
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {hitDiceCount > 0 && (
              <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
                <Heart className="w-4 h-4" />
                <span>~{estimatedHealing} PV (d{hitDieSize} + {constitutionMod >= 0 ? '+' : ''}{constitutionMod})</span>
              </div>
            )}

            {availableHitDice === 0 && (
              <p className="text-center text-gray-500 text-sm">
                Aucun de de vie disponible
              </p>
            )}
          </div>

          {restorableResources.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-yellow-400" />
                  <span className="font-medium text-gray-200">Ressources a restaurer</span>
                </div>
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Tout selectionner
                </button>
              </div>

              <div className="space-y-2">
                {restorableResources.map(resource => (
                  <ResourceCheckbox
                    key={resource.id}
                    resource={resource}
                    checked={selectedResources.has(resource.id)}
                    onToggle={() => toggleResource(resource.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {restorableResources.length === 0 && availableHitDice === 0 && (
            <div className="text-center py-6 text-gray-400">
              <Sun className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucune ressource a restaurer</p>
              <p className="text-sm mt-1">Vous pouvez tout de meme effectuer un repos court</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 space-y-3">
          {hasAnythingToRestore && (
            <div className="text-sm text-gray-400 text-center">
              {hitDiceCount > 0 && (
                <span>{hitDiceCount} de{hitDiceCount > 1 ? 's' : ''} de vie</span>
              )}
              {hitDiceCount > 0 && selectedResources.size > 0 && <span> + </span>}
              {selectedResources.size > 0 && (
                <span>{selectedResources.size} ressource{selectedResources.size > 1 ? 's' : ''}</span>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
            >
              <Sun className="w-4 h-4" />
              Repos court
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourceCheckbox({
  resource,
  checked,
  onToggle
}: {
  resource: RestableResource;
  checked: boolean;
  onToggle: () => void;
}) {
  const colorClasses: Record<string, string> = {
    red: 'text-red-400 bg-red-500/10 border-red-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  };

  const IconComponent = resource.icon ? getIconComponent(resource.icon) : Sun;
  const colorClass = resource.color ? colorClasses[resource.color] : colorClasses.yellow;

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
        checked
          ? 'bg-yellow-500/10 border-yellow-500/50'
          : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-md border ${colorClass}`}>
          <IconComponent className="w-4 h-4" />
        </div>
        <div className="text-left">
          <span className="text-sm font-medium text-gray-200">{resource.name}</span>
          <div className="text-xs text-gray-400">
            {resource.current}/{resource.max} → {resource.max}/{resource.max}
          </div>
        </div>
      </div>
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
        checked
          ? 'bg-yellow-500 border-yellow-500'
          : 'border-gray-600'
      }`}>
        {checked && <Check className="w-3 h-3 text-gray-900" />}
      </div>
    </button>
  );
}
