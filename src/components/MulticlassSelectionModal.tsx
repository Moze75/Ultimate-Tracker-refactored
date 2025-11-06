import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, AlertTriangle, Layers } from 'lucide-react';
import { Player, DndClass } from '../types/dnd';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { validateMulticlassPrerequisites, getHitDieForClass } from '../utils/multiclassUtils';
import { getSpellSlotsByLevel } from '../utils/spellSlots2024';

interface MulticlassSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player;
  onUpdate: (player: Player) => void;
}

const DND_CLASSES: DndClass[] = [
  'Barbare', 'Barde', 'Clerc', 'Druide', 'Ensorceleur', 'Guerrier',
  'Magicien', 'Moine', 'Paladin', 'Rôdeur', 'Roublard', 'Occultiste',
];

const CLASS_IMAGES: Record<string, string> = {
  'Barbare': '/Barbare.png',
  'Barde': '/Barde.png',
  'Clerc': '/Clerc.png',
  'Druide': '/Druide.png',
  'Ensorceleur': '/Ensorceleur.png',
  'Guerrier': '/Guerrier.png',
  'Magicien': '/Magicien.png',
  'Moine': '/Moine.png',
  'Paladin': '/Paladin.png',
  'Rôdeur': '/Rodeur.png',
  'Roublard': '/Voleur.png',
  'Occultiste': '/Occultiste.png',
};

const getModifier = (score: number): number => Math.floor((score - 10) / 2);

const getConstitutionModifier = (player: Player): number => {
  const abilities: any = (player as any)?.abilities;
  const found = Array.isArray(abilities)
    ? abilities.find((a: any) => a?.name?.toLowerCase() === 'constitution')
    : null;

  if (found) {
    if (typeof found.modifier === 'number') return found.modifier;
    if (typeof found.score === 'number') return getModifier(found.score);
  }
  return 0;
};

export function MulticlassSelectionModal({
  isOpen,
  onClose,
  player,
  onUpdate,
}: MulticlassSelectionModalProps) {
  const [selectedClass, setSelectedClass] = useState<DndClass | null>(null);
  const [hpGain, setHpGain] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string>('');

  if (!isOpen) return null;

  const availableClasses = DND_CLASSES.filter((cls) => cls !== player.class && cls !== '');

  const handleClassSelect = (cls: DndClass) => {
    setSelectedClass(cls);
    const validation = validateMulticlassPrerequisites(player, cls);
    if (!validation.valid) {
      setValidationWarning(validation.message);
    } else {
      setValidationWarning('');
    }
  };

  const handleConfirm = async () => {
    if (!selectedClass) {
      toast.error('Veuillez sélectionner une classe');
      return;
    }

    const hpGainValue = parseInt(hpGain) || 0;
    const hitDieSize = getHitDieForClass(selectedClass);
    const constitutionModifier = getConstitutionModifier(player);

    if (hpGainValue < 1) {
      toast.error('Les PV supplémentaires doivent être d\'au moins 1');
      return;
    }

    if (hpGainValue > (hitDieSize + constitutionModifier)) {
      toast.error(`Les PV supplémentaires ne peuvent pas dépasser ${hitDieSize + constitutionModifier}`);
      return;
    }

    setIsProcessing(true);

    try {
      const newMaxHp = player.max_hp + hpGainValue;
      const newCurrentHp = player.current_hp + hpGainValue;

      const secondaryClassResources: any = {};
      const secondarySpellSlots = getSpellSlotsByLevel(selectedClass, 1);

      const dieType = `d${hitDieSize}`;
      const currentHitDiceByType = player.hit_dice_by_type || {};

      const updatedHitDiceByType = {
        ...currentHitDiceByType,
        [dieType]: {
          total: (currentHitDiceByType[dieType]?.total || 0) + 1,
          used: currentHitDiceByType[dieType]?.used || 0,
        },
      };

      const { error } = await supabase
        .from('players')
        .update({
          secondary_class: selectedClass,
          secondary_level: 1,
          secondary_class_resources: secondaryClassResources,
          secondary_spell_slots: secondarySpellSlots,
          max_hp: newMaxHp,
          current_hp: newCurrentHp,
          hit_dice_by_type: updatedHitDiceByType,
        })
        .eq('id', player.id);

      if (error) throw error;

      onUpdate({
        ...player,
        secondary_class: selectedClass,
        secondary_level: 1,
        secondary_class_resources: secondaryClassResources,
        secondary_spell_slots: secondarySpellSlots,
        max_hp: newMaxHp,
        current_hp: newCurrentHp,
        hit_dice_by_type: updatedHitDiceByType,
      });

      toast.success(`Multiclassage vers ${selectedClass} réussi ! (+${hpGainValue} PV)`);
      onClose();
    } catch (error) {
      console.error('Erreur lors du multiclassage:', error);
      toast.error('Erreur lors du multiclassage');
    } finally {
      setIsProcessing(false);
    }
  };

  const hitDieSize = selectedClass ? getHitDieForClass(selectedClass) : 0;
  const constitutionModifier = getConstitutionModifier(player);
  const averageHpGain = selectedClass ? Math.floor(hitDieSize / 2) + 1 + constitutionModifier : 0;

  const modalContent = (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overscroll-contain">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-2xl max-w-2xl w-full border border-gray-700/50 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700/50 p-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="w-6 h-6 text-blue-400" />
              <div>
                <h3 className="text-lg font-semibold text-gray-100">Ajouter une classe (Multiclassage)</h3>
                <p className="text-sm text-gray-400">{player.class} niveau {player.level} → Ajouter une seconde classe</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {!selectedClass ? (
            <>
              <div>
                <h4 className="text-base font-medium text-gray-200 mb-3">Choisissez votre seconde classe</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {availableClasses.map((cls) => (
                    <button key={cls} onClick={() => handleClassSelect(cls)} className="relative p-3 rounded-lg border-2 border-gray-700 hover:border-blue-500 transition-all bg-gray-800/50 hover:bg-gray-700/50 flex flex-col items-center gap-2">
                      <img src={CLASS_IMAGES[cls]} alt={cls} className="w-16 h-16 object-contain" />
                      <span className="text-sm font-medium text-gray-200">{cls}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                <div className="flex items-center gap-3 mb-3">
                  <img src={CLASS_IMAGES[selectedClass]} alt={selectedClass} className="w-12 h-12 object-contain" />
                  <div>
                    <h4 className="text-lg font-bold text-gray-100">{selectedClass}</h4>
                    <p className="text-sm text-gray-400">Niveau 1</p>
                  </div>
                </div>

                {validationWarning && (
                  <div className="mt-3 p-3 bg-orange-900/30 border border-orange-700/50 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-orange-200">{validationWarning}</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="w-5 h-5 text-red-500" />
                  <h5 className="font-medium text-gray-200">Points de vie supplémentaires</h5>
                </div>

                <div className="space-y-3">
                  <div className="text-sm text-gray-400">
                    Dé de vie : 1d{hitDieSize} (ou {Math.floor(hitDieSize / 2) + 1}) + modificateur de Constitution ({constitutionModifier >= 0 ? '+' : ''}{constitutionModifier})
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-2">
                      PV théoriques : <span className="text-green-400 font-medium">{averageHpGain}</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">PV supplémentaires à appliquer</label>
                    <input type="number" min="1" max={hitDieSize + constitutionModifier} value={hpGain} onChange={(e) => setHpGain(e.target.value)} className="input-dark w-full px-3 py-2 rounded-md text-center text-lg font-bold" placeholder={averageHpGain.toString()} autoFocus />
                    <p className="text-xs text-gray-500 mt-1 text-center">Minimum : 1 • Maximum : {hitDieSize + constitutionModifier}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setSelectedClass(null); setHpGain(''); setValidationWarning(''); }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium transition-colors">
                  Retour
                </button>
              </div>
            </>
          )}
        </div>

        {selectedClass && (
          <div className="p-4 border-t border-gray-700/50 shrink-0">
            <div className="flex gap-3">
              <button onClick={handleConfirm} disabled={isProcessing || !hpGain || parseInt(hpGain) < 1} className={`flex-1 px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${ isProcessing || !hpGain || parseInt(hpGain) < 1 ? 'bg-gray-700 text-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white' }`}>
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Ajout en cours...
                  </>
                ) : (
                  <>
                    <Layers size={18} />
                    Valider le multiclassage
                  </>
                )}
              </button>
              <button onClick={onClose} disabled={isProcessing} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 rounded-lg font-medium transition-colors">
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}