import React, { useState } from 'react';
import { User, ChevronDown, ChevronRight } from 'lucide-react';
import { Condition, Player } from '../types/dnd';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { CONDITIONS } from '../constants/conditions';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

interface ConditionsSectionProps {
  player: Player;
  onUpdate: (player: Player) => void;
}

export function ConditionsSection({ player, onUpdate }: ConditionsSectionProps) {
  const deviceType = useResponsiveLayout();
  const [selectedCondition, setSelectedCondition] = useState<Condition | null>(null);
  const [conditionsExpanded, setConditionsExpanded] = useState(deviceType === 'desktop');

  if (!player) {
    return (
      <div className="stat-card">
        <button
          onClick={() => setConditionsExpanded(!conditionsExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-3">
            <User className="text-orange-500" size={20} />
            <h2 className="text-lg sm:text-xl font-semibold text-gray-100">États</h2>
          </div>
          {conditionsExpanded ? (
            <ChevronDown className="text-gray-400" size={20} />
          ) : (
            <ChevronRight className="text-gray-400" size={20} />
          )}
        </button>
        <div className="p-4">
          <p className="text-gray-400">Chargement des états...</p>
        </div>
      </div>
    );
  }

  const activeConditions = player?.active_conditions || [];

  const updateSelectedCondition = (condition: Condition, isActive: boolean) => {
    if (isActive) {
      setSelectedCondition(condition);
    } else if (selectedCondition?.id === condition.id) {
      setSelectedCondition(null);
    }
  };

  const handleToggleCondition = async (conditionId: string) => {
    if (!player) return;

    const newConditions = activeConditions.includes(conditionId)
      ? activeConditions.filter(id => id !== conditionId)
      : [...activeConditions, conditionId];

    const condition = CONDITIONS.find(c => c.id === conditionId);
    if (!condition) return;

    try {
      const { error } = await supabase
        .from('players')
        .update({ active_conditions: newConditions })
        .eq('id', player.id);

      if (error) throw error;

      await onUpdate({
        ...player,
        active_conditions: newConditions
      });

      toast.success(
        activeConditions.includes(conditionId)
          ? `État retiré : ${condition.name}`
          : `État ajouté : ${condition.name}`
      );

      updateSelectedCondition(condition, newConditions.includes(conditionId));
    } catch (error) {
      console.error('Erreur lors de la mise à jour des états:', error);
      toast.error('Erreur lors de la mise à jour des états');
    }
  };

  const handleConditionClick = (condition: Condition) => {
    handleToggleCondition(condition.id);
    if (selectedCondition?.id === condition.id) {
      setSelectedCondition(null);
    } else {
      setSelectedCondition(condition);
    }
  };

  return (
    <div className="stat-card">
      <button
        onClick={() => setConditionsExpanded(!conditionsExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <User className="text-blue-500" size={20} />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-100">États</h2>
        </div>
        {conditionsExpanded ? (
          <ChevronDown className="text-gray-400" size={20} />
        ) : (
          <ChevronRight className="text-gray-400" size={20} />
        )}
      </button>
      
      {conditionsExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {CONDITIONS.map((condition) => (
              <button
                key={condition.id}
                onClick={() => handleConditionClick(condition)} 
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeConditions.includes(condition.id)
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'
                }`}
              >
                {condition.name}
              </button>
            ))}
          </div>

          {selectedCondition && activeConditions.includes(selectedCondition.id) && (
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <h3 className="text-lg font-medium text-orange-400 mb-2">
                {selectedCondition.name}
              </h3>
              <p className="text-gray-300 mb-4">{selectedCondition.description}</p>
              <div className="space-y-2">
                {selectedCondition.effects.map((effect, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-orange-500/50 flex-shrink-0" />
                    <p className="text-gray-400 flex-1">{effect}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}