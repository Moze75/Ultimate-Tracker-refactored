import React from 'react';
import { createPortal } from 'react-dom';
import { Brain } from 'lucide-react';
import { Player } from '../../types/dnd';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface ConcentrationCheckModalProps {
  player: Player;
  concentrationDC: number;
  onUpdate: (player: Player) => void;
  onClose: () => void;
}

export function ConcentrationCheckModal({ player, concentrationDC, onUpdate, onClose }: ConcentrationCheckModalProps) {
  const handleFailed = async () => {
    try {
      const { error } = await supabase
        .from('players')
        .update({
          is_concentrating: false,
          concentration_spell: null
        })
        .eq('id', player.id);

      if (error) throw error;

      onUpdate({
        ...player,
        is_concentrating: false,
        concentration_spell: null
      });

      onClose();
      toast.error('Concentration perdue');
    } catch (error) {
      console.error('Erreur lors de l\'interruption de la concentration:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleSuccess = () => {
    onClose();
    toast.success('Concentration maintenue !');
  };

  const abilities = Array.isArray(player.abilities) ? player.abilities : [];
  const conAbility = abilities.find(a => a.name === 'Constitution');
  const conMod = conAbility?.modifier || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-purple-500/40 shadow-xl shadow-purple-500/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Brain className="w-6 h-6 text-purple-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Test de Concentration</h3>
            <p className="text-sm text-purple-400">Vous avez subi des dégâts !</p>
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4 mb-4 border border-gray-700">
          <p className="text-gray-300 mb-3">
            Vous devez réussir un jet de sauvegarde de Constitution pour maintenir votre concentration sur{' '}
            <span className="text-purple-400 font-semibold">{player.concentration_spell || 'votre sort'}</span>.
          </p>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">DD du test :</span>
              <span className="text-2xl font-bold text-red-400">
                {concentrationDC}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Votre modificateur de CON :</span>
              <span className="text-xl font-semibold text-green-400">
                {conMod >= 0 ? `+${conMod}` : conMod}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 mb-4">
          <p className="text-sm text-gray-300">
            <span className="font-semibold text-purple-400">Rappel :</span> Lancez 1d20 et ajoutez votre modificateur de Constitution.
            Si le résultat est égal ou supérieur à {concentrationDC}, vous maintenez votre concentration.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleFailed}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
          >
            J'ai raté le test
          </button>

          <button
            onClick={handleSuccess}
            className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
          >
            J'ai réussi le test
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm"
        >
          Fermer (je gère plus tard)
        </button>
      </div>
    </div>
  );
}
