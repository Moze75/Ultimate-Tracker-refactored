import React from 'react';
import { Plus, Settings, Trash2, Sword } from 'lucide-react';
import BowIcon from '../icons/BowIcon';
import { Player } from '../../types/dnd';

type Attack = any;

interface AttackSectionProps {
  player: Player;
  attacks: Attack[];
  onAdd: () => void;
  onEdit: (attack: Attack) => void;
  onDelete: (attackId: string) => void;
  onRollAttack: (attack: Attack) => void;
  onRollDamage: (attack: Attack) => void;
  getAttackBonus: (attack: Attack) => number;
  getDamageBonus: (attack: Attack) => number;
  changeAmmoCount: (attack: Attack, delta: number) => void;
  setAmmoCount: (attack: Attack, next: number) => void;
  isEmptyLabel?: {
    title?: string;
    subtitle?: string;
    hint?: string;
  };
}

export function AttackSection({
  player,
  attacks,
  onAdd,
  onEdit,
  onDelete,
  onRollAttack,
  onRollDamage,
  getAttackBonus,
  getDamageBonus,
  changeAmmoCount,
  setAmmoCount,
  isEmptyLabel
}: AttackSectionProps) {

  // --- LOGIQUE ATTAQUE SANS ARME ---
  const getMartialArtsDie = (level: number) => {
    if (level >= 17) return '1d10';
    if (level >= 11) return '1d8';
    if (level >= 5) return '1d6';
    return '1d4';
  };

  const getUnarmedStrike = (): Attack => {
    const isMonk = player.class === 'Moine';
    let damageDice = '1'; // Par défaut, 1 point de dégât (+ mod)
    let ability = 'Force';
    let name = 'Attaque sans arme';
    let properties = '';

    // Logique Moine : Arts Martiaux (DEX ou FORCE, Dé évolutif)
    if (isMonk) {
      name = 'Arts Martiaux (Mains nues)';
      damageDice = getMartialArtsDie(player.level);
      properties = 'Action Bonus possible';
      
      // Détermine la meilleure stat entre Force et Dex pour le Moine
      const strScore = (player.abilities as any[])?.find((a: any) => a.name === 'Force')?.score || 10;
      const dexScore = (player.abilities as any[])?.find((a: any) => a.name === 'Dextérité')?.score || 10;
      
      if (dexScore > strScore) {
        ability = 'Dextérité';
      }
    }

    return {
      id: 'unarmed-strike-virtual',
      name: name,
      damage_dice: damageDice,
      damage_type: 'Contondant',
      range: 'Contact',
      player_id: player.id,
      expertise: true, // Tout le monde maîtrise ses attaques sans armes
      override_ability: ability, 
      attack_type: 'physical',
      properties: properties,
      ammo_type: null,
      ammo_count: 0,
      weapon_bonus: 0
    };
  };

  // Fusionne l'attaque virtuelle avec les attaques physiques existantes
  const unarmedStrike = getUnarmedStrike();
  const physicalAttacks = [
    unarmedStrike,
    ...attacks.filter((a: Attack) => (a.attack_type || 'physical') === 'physical')
  ];

  const renderAttackCard = (attack: Attack) => {
    const isVirtual = attack.id === 'unarmed-strike-virtual';
    const isMonk = player.class === 'Moine';
    
    const dmgBonus = getDamageBonus(attack);
    const dmgLabel = `${attack.damage_dice}${dmgBonus !== 0 ? (dmgBonus > 0 ? `+${dmgBonus}` : `${dmgBonus}`) : ''}`;
    const ammoType = (attack as any).ammo_type || '';
    const ammoCount = (attack as any).ammo_count ?? 0;

    // On n'affiche overrideLabel que si ce n'est PAS l'attaque virtuelle
    const overrideLabel = (!isVirtual && attack.override_ability) ? ` (${attack.override_ability})` : '';

    // Pour l'attaque sans arme non-moine, on affiche juste le total fixe (1 + Force)
    // Le calcul : 1 (base) + dmgBonus (mod force)
    const fixedDamageValue = 1 + dmgBonus; 

    return (
      <div key={attack.id} className={`bg-gray-800/50 rounded-lg p-3 border ${isVirtual ? 'border-gray-600/30 bg-gray-800/30' : 'border-gray-700/50'}`}>
        <div className="flex items-start justify-between mb-1">
          <div>
            <h4 className="font-medium text-gray-100 text-base flex items-center gap-2">
                {attack.name}
            </h4>
            <p className="text-sm text-gray-400">
              {attack.damage_type} • {attack.range}
              {overrideLabel && <span className="text-purple-400">{overrideLabel}</span>}
              {attack.properties && <span className="text-gray-500 italic ml-2"> - {attack.properties}</span>}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {!isVirtual && (
                <>
                    <button
                    onClick={() => onEdit(attack)}
                    className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded transition-colors"
                    title="Modifier l'attaque"
                    >
                    <Settings size={16} />
                    </button>
                    <button
                    onClick={() => onDelete(attack.id)}
                    className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-900/30 rounded transition-colors"
                    title="Supprimer l'attaque"
                    >
                    <Trash2 size={16} />
                    </button>
                </>
            )}
          </div>
        </div>

        <div className="flex gap-2 text-sm items-stretch">
          <div className="flex-1 flex flex-col">
            <button
              onClick={() => {
                console.log('🎯 [AttackSection] Clic Attaque:', attack.name);
                onRollAttack(attack);
              }}
              className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-md transition-colors flex items-center justify-center"
            >
              Attaque : 1d20+{getAttackBonus(attack)}
            </button>

            {ammoType ? (
              <div
                className="mt-2 px-3 py-2 rounded-md flex items-center justify-center gap-2 bg-transparent"
                aria-hidden
              >
                <BowIcon className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-medium text-gray-100">{ammoType}</span>
              </div>
            ) : (
              <div className="mt-2" />
            )}
          </div>

          <div className="flex-1 flex flex-col">
            {/* Si c'est une attaque virtuelle ET que ce n'est pas un Moine, on affiche un div statique au lieu d'un bouton */}
            {isVirtual && !isMonk ? (
               <div className="bg-orange-900/30 border border-orange-700/30 text-orange-200/70 px-3 py-2 rounded-md flex items-center justify-center cursor-default">
                 Dégâts fixes : {fixedDamageValue}
               </div>
            ) : (
              <button
                onClick={() => {
                  console.log('🎯 [AttackSection] Clic Dégâts:', attack.name);
                  onRollDamage(attack);
                }}
                className="bg-orange-600/60 hover:bg-orange-500/60 text-white px-3 py-2 rounded-md transition-colors flex items-center justify-center"
              >
                Dégâts : {dmgLabel}
              </button>
            )}

            {ammoType ? (
              <div className="mt-2 flex items-center justify-center gap-2">
                <button
                  onClick={() => changeAmmoCount(attack, -1)}
                  disabled={(ammoCount ?? 0) <= 0}
                  className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200"
                  title="Retirer une munition"
                >
                  −
                </button>
                <input
                  type="number"
                  value={ammoCount}
                  min={0}
                  onChange={(e) => setAmmoCount(attack, Number(e.target.value))}
                  className="w-16 text-center input-dark px-2 py-1 rounded-md border border-gray-600 focus:border-red-500"
                />
                <button
                  onClick={() => changeAmmoCount(attack, +1)}
                  className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
                  title="Ajouter une munition"
                >
                  +
                </button>
              </div>
            ) : (
              <div className="mt-2" />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="stat-card">
      <div className="stat-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sword className="w-5 h-5 text-red-500" />
          <h3 className="text-lg font-semibold text-gray-100">Attaques</h3>
        </div>
        <button
          onClick={onAdd}
          className="p-2 text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors"
          title="Ajouter une attaque"
        >
          <Plus size={20} />
        </button>
      </div>
      <div className="p-4 space-y-2">
        {physicalAttacks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Sword className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{isEmptyLabel?.title ?? 'Aucune attaque configurée'}</p>
            <p className="text-sm">{isEmptyLabel?.subtitle ?? "Equippez une arme dans l'onglet Sac"}</p>
            <p className="text-sm">{isEmptyLabel?.hint ?? "ou bien cliquez sur + pour ajouter une attaque"}</p>
          </div>
        ) : (
          <div className="space-y-2">{physicalAttacks.map(renderAttackCard)}</div>
        )}
      </div>
    </div>
  );
}