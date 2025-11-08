import React, { useState } from 'react';
import { User, ChevronDown, ChevronRight } from 'lucide-react';
import { Condition, Player } from '../types/dnd';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout'; // ← Ajouter cet import

export const CONDITIONS: Condition[] = [
  {
    id: 'prone',
    name: 'À terre',
    description: 'Tant que vous avez l\'état À terre, vous subissez les effets suivants.',
    effects: [
      'Déplacement limité. Vos seules possibilités de déplacement sont ramper ou vous relever en dépensant la moitié de votre Vitesse (arrondie à l\'inférieur), ce qui met un terme à l\'état. Si votre Vitesse est de 0, vous ne pouvez pas vous relever.',
      'Effet sur les attaques. Vous subissez le Désavantage aux jets d\'attaque. Un jet d\'attaque contre vous reçoit l\'Avantage si l\'assaillant se trouve dans un rayon de 1,50 m de vous. Sans cela, ce jet d\'attaque subit le Désavantage.'
    ]
  },
  {
    id: 'grappled',
    name: 'Agrippé',
    description: 'Tant que vous avez l\'état Agrippé, vous subissez les effets suivants.',
    effects: [
      'Vitesse 0. Votre Vitesse est de 0 et ne peut pas augmenter.',
      'Effet sur les attaques. Vous subissez le Désavantage aux jets d\'attaque contre toute cible hormis l\'agrippeur.',
      'Déplaçable. L\'agrippeur peut vous tirer ou vous porter lorsqu\'il se déplace, mais ses coûts de déplacement sont doublés, sauf si vous êtes de taille TP ou que votre catégorie est inférieure d\'au moins deux crans à la sienne.'
    ]
  },
  {
    id: 'deafened',
    name: 'Assourdi',
    description: 'Tant que vous avez l\'état Assourdi, vous subissez les effets suivants.',
    effects: [
      'Incapable d\'entendre. Vous n\'entendez rien, et ratez automatiquement tous les tests de caractéristique qui reposent sur l\'ouïe.'
    ]
  },
  {
    id: 'blinded',
    name: 'Aveuglé',
    description: 'Tant que vous avez l\'état Aveuglé, vous subissez les effets suivants.',
    effects: [
      'Incapable de voir. Vous ne voyez rien et ratez automatiquement tout test de caractéristique reposant sur la vue.',
      'Effet sur les attaques. Les jets d\'attaque contre vous ont l\'Avantage, et vos jets d\'attaque subissent le Désavantage.'
    ]
  },
  {
    id: 'charmed',
    name: 'Charmé',
    description: 'Tant que vous avez l\'état Charmé, vous subissez les effets suivants.',
    effects: [
      'Ne pas nuire au charmeur. Vous ne pouvez pas attaquer votre « charmeur » ni le cibler avec des aptitudes ou effets magiques qui infligent des dégâts.',
      'Interaction avec Avantage. Le charmeur a l\'Avantage aux tests de caractéristique d\'interaction sociale avec vous.'
    ]
  },
  {
    id: 'frightened',
    name: 'Effrayé',
    description: 'Tant que vous avez l\'état Effrayé, vous subissez les effets suivants.',
    effects: [
      'Effet sur les attaques et les tests de caractéristique. Vous subissez le Désavantage aux tests de caractéristique et aux jets d\'attaque tant que la source de votre effroi est dans votre champ de vision.',
      'Impossible d\'approcher. Vous ne pouvez pas vous rapprocher volontairement de la source de votre effroi.'
    ]
  },
  {
    id: 'poisoned',
    name: 'Empoisonné',
    description: 'Tant que vous avez l\'état Empoisonné, vous subissez l\'effet suivant.',
    effects: [
      'Effet sur les attaques et les tests de caractéristique. Vous subissez le Désavantage aux jets d\'attaque et aux tests de caractéristique.'
    ]
  },
  {
    id: 'restrained',
    name: 'Entravé',
    description: 'Tant que vous avez l\'état Entravé, vous subissez les effets suivants.',
    effects: [
      'Vitesse 0. Votre Vitesse est de 0 et ne peut pas augmenter.',
      'Effet sur les attaques. Les jets d\'attaque contre vous ont l\'Avantage, et vos jets d\'attaque subissent le Désavantage.',
      'Effet sur les jets de sauvegarde. Vous subissez le Désavantage aux jets de sauvegarde de Dextérité.'
    ]
  },
  {
    id: 'exhaustion',
    name: 'Épuisement',
    description: 'Tant que vous avez l\'état Épuisement, vous subissez les effets suivants.',
    effects: [
      'Niveaux d\'Épuisement. Cet état est cumulatif. Chaque fois que vous le recevez, vous subissez 1 niveau d\'Épuisement. Vous mourez quand votre niveau d\'Épuisement atteint 6.',
      'Tests d20 affectés. Lorsque vous effectuez un Test d20, le résultat est réduit de 2 fois votre niveau actuel d\'Épuisement.',
      'Vitesse réduite. Votre Vitesse est réduite de 1,50 m x votre niveau actuel d\'Épuisement.',
      'Suppression des niveaux d\'Épuisement. Terminer un Repos long dissipe 1 niveau d\'Épuisement. Lorsque votre niveau d\'Épuisement atteint 0, l\'état prend fin pour vous.'
    ]
  },
  {
    id: 'stunned',
    name: 'Étourdi',
    description: 'Tant que vous avez l\'état Étourdi, vous subissez les effets suivants.',
    effects: [
      'Neutralisé. Vous subissez l\'état Neutralisé.',
      'Effet sur les jets de sauvegarde. Vous ratez automatiquement vos jets de sauvegarde de Force et de Dextérité.',
      'Effet sur les attaques. Les jets d\'attaque contre vous ont l\'Avantage.'
    ]
  },
  {
    id: 'unconscious',
    name: 'Inconscient',
    description: 'Tant que vous avez l\'état Inconscient, vous subissez les effets suivants.',
    effects: [
      'Inerte. Vous subissez les états À terre et Neutralisé, et laissez choir tout ce que vous teniez. Lorsque cet état prend fin, vous êtes toujours À terre.',
      'Vitesse 0. Votre Vitesse est de 0 et ne peut pas augmenter.',
      'Effet sur les attaques. Les jets d\'attaque contre vous ont l\'Avantage.',
      'Effet sur les jets de sauvegarde. Vous ratez automatiquement vos jets de sauvegarde de Force et de Dextérité.',
      'Coups critiques automatiques. Tout jet d\'attaque qui vous touche est un Coup critique si l\'assaillant qui la porte se trouve dans un rayon de 1,50 m.',
      'Dénué de conscience. Vous n\'avez pas conscience de ce qui vous entoure.'
    ]
  },
  {
    id: 'invisible',
    name: 'Invisible',
    description: 'Tant que vous avez l\'état Invisible, vous subissez les effets suivants.',
    effects: [
      'Surprise. Si vous êtes Invisible au moment de jouer l\'Initiative, vous avez l\'Avantage à ce jet.',
      'Dissimulé. Vous n\'êtes pas affecté par les effets qui exigent que la cible soit vue, sauf si le créateur de l\'effet vous « voit » par un biais ou un autre. Tout l\'équipement que vous portez est lui aussi dissimulé.',
      'Effet sur les attaques. Les jets d\'attaque contre vous subissent le Désavantage, et vos jets d\'attaque ont l\'Avantage. Si une créature vous voit par un biais ou un autre, vous ne recevez pas ce bénéfice contre elle.'
    ]
  },
  {
    id: 'incapacitated',
    name: 'Neutralisé',
    description: 'Tant que vous avez l\'état Neutralisé, vous subissez les effets suivants.',
    effects: [
      'Inactif. Vous ne pouvez entreprendre ni action, ni action Bonus ni Réaction.',
      'Concentration brisée. Votre Concentration est brisée.',
      'Sans voix. Vous ne pouvez pas parler.',
      'Surpris. Si vous êtes Neutralisé au moment de jouer l\'Initiative, vous subissez le Désavantage à ce jet.'
    ]
  },
  {
    id: 'paralyzed',
    name: 'Paralysé',
    description: 'Tant que vous avez l\'état Paralysé, vous subissez les effets suivants.',
    effects: [
      'Neutralisé. Vous subissez l\'état Neutralisé.',
      'Vitesse 0. Votre Vitesse est de 0 et ne peut pas augmenter.',
      'Effet sur les jets de sauvegarde. Vous ratez automatiquement vos jets de sauvegarde de Force et de Dextérité.',
      'Effet sur les attaques. Les jets d\'attaque contre vous ont l\'Avantage.',
      'Coups critiques automatiques. Tout jet d\'attaque qui vous touche est un Coup critique si l\'assaillant qui la porte se trouve dans un rayon de 1,50 m.'
    ]
  },
  {
    id: 'petrified',
    name: 'Pétrifié',
    description: 'Tant que vous avez l\'état Pétrifié, vous subissez les effets suivants.',
    effects: [
      'Transformé en substance inanimée. Vous êtes transformé, ainsi que les objets non magiques que vous portez, en une substance inanimée et dense (généralement de la pierre). Votre poids est décuplé et vous n\'êtes plus soumis au vieillissement.',
      'Neutralisé. Vous subissez l\'état Neutralisé.',
      'Vitesse 0. Votre Vitesse est de 0 et ne peut pas augmenter.',
      'Effet sur les attaques. Les jets d\'attaque contre vous ont l\'Avantage.',
      'Effet sur les jets de sauvegarde. Vous ratez automatiquement vos jets de sauvegarde de Force et de Dextérité.',
      'Résistance aux dégâts. Vous avez la Résistance à tous les dégâts.',
      'Immunité contre le poison. Vous avez l\'Immunité contre l\'état Empoisonné.'
    ]
  }
];

interface ConditionsSectionProps {
  player: Player;
  onUpdate: (player: Player) => void;
}

export function ConditionsSection({ player, onUpdate }: ConditionsSectionProps) {
  const deviceType = useResponsiveLayout(); // ← Ajouter cette ligne
  const [selectedCondition, setSelectedCondition] = useState<Condition | null>(null);
  const [conditionsExpanded, setConditionsExpanded] = useState(false);

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