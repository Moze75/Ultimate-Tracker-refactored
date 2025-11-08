import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Book, Swords, Shield, Target, Eye, Users, Heart, Search, Wand2, Clock, Move, Lightbulb, MessageCircle } from 'lucide-react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout'; // ← Ajouter cet import

interface StandardAction {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  rules: string[];
  actionType: 'Action' | 'Action bonus' | 'Réaction' | 'Mouvement';
}

const STANDARD_ACTIONS: StandardAction[] = [
  {
    id: 'attack',
    name: 'Attaque',
    icon: <Swords className="w-5 h-5 text-red-500" />,
    description: 'Lorsque vous entreprenez l\'action Attaque, vous effectuez un jet d\'Attaque avec une arme ou une attaque à mains nues.\n\nS\'équiper et se déséquiper : Vous pouvez vous équiper ou vous déséquiper d\'une arme lorsque vous effectuez une attaque dans le cadre de cette action. Vous pouvez le faire avant ou après l\'attaque. Si vous vous équipez d\'une arme avant une attaque, vous n\'êtes pas tenu de l\'utiliser lors de cette attaque. S\'équiper d\'une arme comprend le fait de la sortir du fourreau ou de la ramasser. Se déséquiper d\'une arme consiste à la rengainer, la ranger ou la laisser choir.\n\nSe déplacer entre les attaques : Si vous vous déplacez pendant votre tour et disposez d\'une aptitude, telle qu\'Attaque supplémentaire, qui vous octroie plusieurs attaques dans le cadre de l\'action Attaque, vous pouvez consacrer tout ou partie de ce déplacement à vous mouvoir entre ces attaques.',
    rules: [],
    actionType: 'Action'
  },
  {
    id: 'dash',
    name: 'Pointe',
    icon: <Move className="w-5 h-5 text-blue-500" />,
    description: 'Lorsque vous entreprenez l\'action Pointe, vous recevez du déplacement supplémentaire pour ce tour. Cette augmentation est égale à votre Vitesse, après application d\'éventuels modificateurs. Si vous disposez par exemple d\'une Vitesse de 9 m, vous pouvez vous déplacer de 18 m à votre tour en entreprenenant l\'action Pointe. Si vous disposez d\'une Vitesse de 9 m réduite à 4,50 m, vous pouvez vous déplacer de 9 m à votre tour avec l\'action Pointe.',
    rules: [],
    actionType: 'Action'
  },
  {
    id: 'disengage',
    name: 'Désengagement',
    icon: <Shield className="w-5 h-5 text-green-500" />,
    description: 'Si vous entreprenez l\'action Désengagement, votre déplacement ne provoque pas d\'attaque d\'Opportunité jusqu\'à la fin du tour.',
    rules: [],
    actionType: 'Action'
  },
  {
    id: 'dodge',
    name: 'Esquive',
    icon: <Target className="w-5 h-5 text-purple-500" />,
    description: 'Si vous entreprenez l\'action Esquive, vous recevez les bénéfices suivants : jusqu\'au début de votre tour suivant, tout jet d\'attaque effectué contre vous par un assaillant que vous voyez subit le Désavantage, et vos jets de sauvegarde de Dextérité ont l\'Avantage. Vous perdez ces bénéfices si vous subissez l\'état Neutralisé ou si votre Vitesse tombe à 0.',
    rules: [],
    actionType: 'Action'
  },
  {
    id: 'help',
    name: 'Soutien',
    icon: <Heart className="w-5 h-5 text-pink-500" />,
    description: 'Lorsque vous entreprenez l\'action Soutien, vous faites l\'une ou l\'autre des deux choses ci-après.\n\nAssister un test de caractéristique : Choisissez l\'une de vos maîtrises de compétence ou d\'outil, ainsi qu\'un allié suffisamment proche pour que vous puissiez l\'assister verbalement ou physiquement lorsqu\'il entreprend un test de caractéristique. Cet allié a l\'Avantage au prochain test de caractéristique qu\'il entreprend avec la compétence ou l\'outil choisi. Ce bénéfice expire si l\'allié n\'y recourt pas avant le début de votre tour suivant. C\'est le MD qui décide si votre assistance est possible ou non.\n\nAssister un jet d\'attaque : Vous distrayez momentanément un ennemi dans un rayon de 1,50 m, ce qui octroie l\'Avantage au jet d\'attaque suivant de l\'un de vos alliés contre cet ennemi. Ce bénéfice expire au début de votre tour suivant.',
    rules: [],
    actionType: 'Action'
  },
  {
    id: 'hide',
    name: 'Furtivité',
    icon: <Eye className="w-5 h-5 text-gray-500" />,
    description: 'L\'action Furtivité vous permet d\'essayer de vous cacher. Pour ce faire, vous effectuez un test de Dextérité (Discrétion) DD 15 à condition d\'être dans une zone où la Visibilité est nulle, derrière un Abri supérieur ou un Abri total, et de ne pas être dans le champ de vision d\'un ennemi ; si vous voyez une créature, vous savez si celle-ci vous voit ou non.\n\nEn cas de réussite, vous bénéficiez de l\'état Invisible tant que vous êtes caché. Prenez note du résultat de ce test, qui est le DD à atteindre pour qu\'une créature vous localise au moyen d\'un test de Sagesse (Perception).\n\nVous cessez d\'être caché aussitôt après l\'un des événements suivants : vous émettez un son plus fort qu\'un murmure, un ennemi vous détecte, vous effectuez un jet d\'attaque ou lancez un sort à composante verbale.',
    rules: [],
    actionType: 'Action'
  },
  {
    id: 'influence',
    name: 'Influence',
    icon: <MessageCircle className="w-5 h-5 text-indigo-500" />,
    description: 'Par l\'action Influence, vous incitez un monstre à faire quelque chose. Décrivez ou incarnez la façon dont vous communiquez avec le monstre. Essayez-vous de tromper, d\'intimider, d\'amuser, de persuader en douceur ? Le MD détermine alors si le monstre se sent disposé, réticent ou hésitant suite à votre interaction ; ce jugement détermine si un test de caractéristique est nécessaire, comme expliqué ci-dessous.\n\nDisposé : Si votre requête est en accord avec les désirs du monstre, aucun test de caractéristique n\'est nécessaire ; il accède à votre demande par la méthode qu\'il préfère.\n\nRéticent : Si votre requête répugne au monstre ou est contraire à son alignement, aucun test de caractéristique n\'est nécessaire ; il vous oppose un refus.\n\nHésitant : Si vous incitez le monstre à faire quelque chose et qu\'il se montre hésitant, vous devez en passer par un test de caractéristique, lequel est affecté par l\'attitude du monstre : Indifférent, Amical ou Hostile, chacun de ces termes étant défini dans le présent glossaire. La table Tests d\'Influence suggère quel test de caractéristique entreprendre en fonction de la façon dont vous interagissez avec le monstre. Le MD choisit le test, dont le DD par défaut est égal à 15 ou à la valeur d\'Intelligence du monstre, selon ce qui est le plus élevé. En cas de réussite, le monstre accomplit ce qui lui est demandé. En cas d\'échec, vous devez attendre 24 heures (ou une autre durée définie par le MD) avant de l\'exhorter à nouveau de la même manière.',
    rules: [],
    actionType: 'Action'
  },
  {
    id: 'ready',
    name: 'Intention',
    icon: <Clock className="w-5 h-5 text-cyan-500" />,
    description: 'L\'action Intention consiste à attendre une circonstance particulière avant d\'agir. Pour ce faire, vous entreprenez cette action à votre tour, ce qui vous permet de jouer votre Réaction avant le début de votre tour suivant.\n\nCommencez par décider quelles circonstances perceptibles déclencheront votre Réaction. Puis choisissez l\'action que vous entreprendrez en réponse à ce déclencheur (ou optez pour un déplacement n\'excédant pas votre Vitesse). Ce pourrait être par exemple : « Si le fanatique pose le pied sur la trappe, j\'active le levier qui l\'ouvre », ou « Si le zombi s\'approche de moi, je m\'en éloigne. »\n\nLorsque le déclencheur intervient, vous avez le choix entre jouer votre Réaction juste après la fin du déclencheur et ne pas tenir compte de celui-ci.\n\nLorsque votre Intention concerne l\'incantation d\'un sort, vous le lancez normalement (ce qui requiert de dépenser les éventuelles ressources nécessaires) mais retenez les énergies magiques, que vous ne libérerez qu\'à l\'intervention du déclencheur en jouant votre Réaction. Pour pouvoir anticiper ainsi, le sort doit avoir un temps d\'incantation d\'une action, sachant que retenir ses énergies vous demande de maintenir votre Concentration, ce que vous ne pouvez faire que jusqu\'au début de votre tour suivant. Si votre Concentration est rompue, le sort se dissipe sans prendre effet.',
    rules: [],
    actionType: 'Action'
  },
  {
    id: 'search',
    name: 'Observation',
    icon: <Search className="w-5 h-5 text-teal-500" />,
    description: 'Lorsque vous entreprenez l\'action Observation, vous effectuez un test de Sagesse visant à discerner ce qui n\'est pas évident. La table « Observation » suggère quelle compétence entre en jeu lorsque vous effectuez cette action, en fonction de ce que vous essayez de détecter.',
    rules: [],
    actionType: 'Action'
  },
  {
    id: 'study',
    name: 'Étude',
    icon: <Book className="w-5 h-5 text-amber-500" />,
    description: 'Lorsque vous entreprenez l\'action Étude, vous effectuez un test d\'Intelligence en consultant votre mémoire, un livre, un indice ou une autre source de savoir, à la recherche d\'une information importante sur un sujet donné.',
    rules: [],
    actionType: 'Action'
  },
  {
    id: 'cast_spell',
    name: 'Magie',
    icon: <Wand2 className="w-5 h-5 text-purple-400" />,
    description: 'Lorsque vous entreprenez l\'action Magie, vous lancez un sort dont le temps d\'incantation est de une action ou recourez à une aptitude ou à un objet magique dont l\'activation se fait au prix de l\'action Magie.\n\nSi vous lancez un sort dont le temps d\'incantation est de 1 minute ou plus, vous devez entreprendre l\'action Magie à chaque tour de l\'incantation, et devez maintenir votre Concentration tout du long. Si cette Concentration est rompue, le sort échoue, mais vous ne dépensez aucun emplacement de sort.',
    rules: [],
    actionType: 'Action'
  },
  {
    id: 'use_object',
    name: 'Utilisation',
    icon: <Lightbulb className="w-5 h-5 text-yellow-500" />,
    description: 'Vous interagissez souvent avec un objet tout en faisant autre chose, comme lorsque vous dégainez votre épée dans le cadre de l\'action Attaque. Lorsqu\'un objet requiert spécifiquement votre action, vous entreprenez l\'action Utilisation.',
    rules: [],
    actionType: 'Action'
  }
];

interface StandardActionsSectionProps {
  player?: any;
  onUpdate?: (player: any) => void;
}

export function StandardActionsSection({ player, onUpdate }: StandardActionsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedAction, setSelectedAction] = useState<StandardAction | null>(null);

  const handleActionClick = (action: StandardAction) => {
    setSelectedAction(selectedAction?.id === action.id ? null : action);
  };

  return (
    <div className="stat-card">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <Book className="text-orange-500" size={20} />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-100">Actions standard </h2>
        </div>
        {isExpanded ? (
          <ChevronDown className="text-gray-400" size={20} />
        ) : (
          <ChevronRight className="text-gray-400" size={20} />
        )}
      </button>
      
      {isExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {STANDARD_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedAction?.id === action.id
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    : 'bg-gray-800/50 text-gray-300 border border-gray-700/50 hover:bg-gray-700/50'
                }`}
              >
                {action.name}
              </button>
            ))}
          </div>

          {selectedAction && (
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <div className="flex items-center gap-3 mb-3">
                {selectedAction.icon}
                <div>
                  <h3 className="text-lg font-medium text-blue-300">
                    {selectedAction.name}
                  </h3>
                  <span className="text-sm text-gray-400">{selectedAction.actionType}</span>
                </div>
              </div>
              
              <div className="text-gray-300 mb-4 whitespace-pre-wrap">
                {selectedAction.description.split('\n\n').map((paragraph, idx) => (
                  <div key={idx} className="mb-3">
                    {paragraph.includes(':') && !paragraph.startsWith('•') ? (
                      <div>
                        {paragraph.split('\n').map((line, lineIdx) => (
                          <div key={lineIdx} className="flex items-start gap-2 mb-1">
                            <div className="w-2 h-2 mt-2 rounded-full bg-blue-500/50 flex-shrink-0" />
                            <p className="text-gray-300 flex-1">{line}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>{paragraph}</p>
                    )}
                  </div>
                ))}
              </div>
              
              {selectedAction.rules.length > 0 && (
                <div className="space-y-2">
                  {selectedAction.rules.map((rule, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500/50 flex-shrink-0" />
                      <p className="text-gray-400 flex-1">{rule}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}