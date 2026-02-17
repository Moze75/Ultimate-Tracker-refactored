import React, { useEffect, useState, useMemo } from 'react';
import {
  X, User, Heart, Shield, Swords, Zap, BookOpen,
  Scroll, Package, Star, Loader2, Filter, ChevronDown,
  Calendar, Globe, Compass, Sparkles, Wrench, Footprints,
  ScrollText, Minus, Plus, ShieldCheck
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Player, Ability, SpellSlots, InventoryItem } from '../../types/dnd';
import toast from 'react-hot-toast';
import { checkWeaponProficiency, getPlayerWeaponProficiencies } from '../../utils/weaponProficiencyChecker';
import { checkArmorProficiency, getPlayerArmorProficiencies } from '../../utils/armorProficiencyChecker';

interface CollapsibleSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ icon, title, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-gray-800/40 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-gray-300">{title}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

type MetaType = 'armor' | 'shield' | 'weapon' | 'potion' | 'equipment' | 'jewelry' | 'tool' | 'other';

interface ItemMeta {
  type: MetaType;
  quantity?: number;
  equipped?: boolean;
  weapon?: {
    damageDice: string;
    damageType: string;
    properties?: string;
    range?: string;
  };
  armor?: {
    base: number;
    addDex: boolean;
    dexCap?: number | null;
    label: string;
  };
  shield?: {
    bonus: number;
  };
}

const META_PREFIX = '#meta:';

function parseMeta(description: string | null | undefined): ItemMeta | null {
  if (!description) return null;
  const lines = (description || '').split('\n').map(l => l.trim());
  const metaLine = [...lines].reverse().find(l => l.startsWith(META_PREFIX));
  if (!metaLine) return null;
  try {
    return JSON.parse(metaLine.slice(META_PREFIX.length));
  } catch {
    return null;
  }
}

function visibleDescription(desc: string | null | undefined): string {
  if (!desc) return '';
  return desc.split('\n').filter((l) => !l.trim().startsWith(META_PREFIX)).join('\n').trim();
}

const TYPE_LABELS: Record<MetaType, string> = {
  weapon: 'Arme',
  armor: 'Armure',
  shield: 'Bouclier',
  jewelry: 'Bijou',
  potion: 'Potion',
  tool: 'Outil',
  equipment: 'Equipement',
  other: 'Autre',
};

const TYPE_COLORS: Record<MetaType, string> = {
  weapon: 'bg-red-500/20 text-red-300 border-red-500/40',
  armor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  shield: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  jewelry: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  potion: 'bg-green-500/20 text-green-300 border-green-500/40',
  tool: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
  equipment: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  other: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40',
};

interface PlayerDetailsModalProps {
  playerId: string;
  playerName: string;
  onClose: () => void;
  onPlayerUpdated?: () => void;
}

export function PlayerDetailsModal({ playerId, playerName, onClose, onPlayerUpdated }: PlayerDetailsModalProps) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<MetaType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hpChangeValue, setHpChangeValue] = useState<string>('');
  const [isApplyingHp, setIsApplyingHp] = useState(false);

  useEffect(() => {
    loadPlayerData();
  }, [playerId]);

  const loadPlayerData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [playerResult, inventoryResult] = await Promise.all([
        supabase
          .from('players')
          .select('*')
          .eq('id', playerId)
          .maybeSingle(),
        supabase
          .from('inventory_items')
          .select('*')
          .eq('player_id', playerId)
          .order('created_at', { ascending: false }),
      ]);

      if (playerResult.error) throw playerResult.error;
      if (!playerResult.data) {
        setError('Joueur non trouve');
        return;
      }

      setPlayer(playerResult.data as Player);
      setInventoryItems(inventoryResult.data || []);
    } catch (err: any) {
      console.error('Erreur chargement joueur:', err);
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const filteredInventory = useMemo(() => {
    if (typeFilter === 'all') return inventoryItems;
    return inventoryItems.filter((item) => {
      const meta = parseMeta(item.description);
      return meta?.type === typeFilter;
    });
  }, [inventoryItems, typeFilter]);

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<MetaType, number>> = {};
    inventoryItems.forEach((item) => {
      const meta = parseMeta(item.description);
      const type = meta?.type || 'other';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [inventoryItems]);

  const playerWeaponProfs = useMemo(
    () => (player ? getPlayerWeaponProficiencies(player) : []),
    [player]
  );

  const playerArmorProfs = useMemo(
    () => (player ? getPlayerArmorProficiencies(player) : []),
    [player]
  );

  const getModifierString = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const getHpPercentage = (current: number, max: number) => {
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, (current / max) * 100));
  };

  const getHpColor = (percentage: number) => {
    if (percentage > 50) return 'bg-green-500';
    if (percentage > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const hasSpellSlots = (slots: SpellSlots | null | undefined): boolean => {
    if (!slots) return false;
    for (let i = 1; i <= 9; i++) {
      const key = `level${i}` as keyof SpellSlots;
      if (slots[key] && (slots[key] as number) > 0) return true;
    }
    return false;
  };

  const applyDamage = async () => {
    if (!player) return;
    const amount = parseInt(hpChangeValue);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Entrez un montant valide');
      return;
    }

    setIsApplyingHp(true);
    try {
      let newCurrentHp = player.current_hp;
      let newTempHp = player.temporary_hp || 0;

      if (newTempHp > 0) {
        if (amount <= newTempHp) {
          newTempHp -= amount;
        } else {
          const remaining = amount - newTempHp;
          newTempHp = 0;
          newCurrentHp = Math.max(0, newCurrentHp - remaining);
        }
      } else {
        newCurrentHp = Math.max(0, newCurrentHp - amount);
      }

      const { error } = await supabase
        .from('players')
        .update({
          current_hp: newCurrentHp,
          temporary_hp: newTempHp,
        })
        .eq('id', player.id);

      if (error) throw error;

      setPlayer({ ...player, current_hp: newCurrentHp, temporary_hp: newTempHp });
      setHpChangeValue('');
      toast.success(`${amount} degats appliques`);
      onPlayerUpdated?.();
    } catch (err) {
      console.error('Erreur application degats:', err);
      toast.error('Erreur lors de l\'application des degats');
    } finally {
      setIsApplyingHp(false);
    }
  };

  const applyHealing = async () => {
    if (!player) return;
    const amount = parseInt(hpChangeValue);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Entrez un montant valide');
      return;
    }

    setIsApplyingHp(true);
    try {
      const newCurrentHp = Math.min(player.max_hp, player.current_hp + amount);

      const { error } = await supabase
        .from('players')
        .update({ current_hp: newCurrentHp })
        .eq('id', player.id);

      if (error) throw error;

      setPlayer({ ...player, current_hp: newCurrentHp });
      setHpChangeValue('');
      toast.success(`${amount} PV soignes`);
      onPlayerUpdated?.();
    } catch (err) {
      console.error('Erreur application soins:', err);
      toast.error('Erreur lors de l\'application des soins');
    } finally {
      setIsApplyingHp(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(48rem,95vw)] max-h-[90vh] overflow-hidden frame-card frame-card--light frame-card--no-frame rounded-xl shadow-2xl flex flex-col">
        <div className="sticky top-0 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 px-4 sm:px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{playerName}</h3>
                <p className="text-sm text-gray-400">Fiche de personnage</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-red-400">{error}</p>
            </div>
          ) : player ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
                <div className="flex-shrink-0 mx-auto sm:mx-0">
                  {player.avatar_url ? (
                    <div
                      className="w-32 h-32 rounded-xl border-2 border-gray-600 overflow-hidden shadow-lg"
                      style={{
                        backgroundImage: `url(${player.avatar_url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: player.avatar_position
                          ? `${player.avatar_position.x}% ${player.avatar_position.y}%`
                          : 'center',
                      }}
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-xl border-2 border-gray-600 bg-gray-800 flex items-center justify-center shadow-lg">
                      <User className="w-12 h-12 text-gray-500" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 w-full overflow-hidden">
                  <div className="text-center sm:text-left mb-4">
                    <h2 className="text-2xl font-bold text-white truncate">
                      {player.adventurer_name || player.name}
                    </h2>
                    <p className="text-gray-400">
                      {player.race && <span>{player.race}</span>}
                      {player.race && player.class && <span> - </span>}
                      {player.class && (
                        <span className="text-blue-400 font-medium">
                          {player.class} Niv. {player.level}
                        </span>
                      )}
                      {player.secondary_class && player.secondary_level && (
                        <span className="text-green-400 ml-2">
                          / {player.secondary_class} Niv. {player.secondary_level}
                        </span>
                      )}
                    </p>
                    {player.subclass && (
                      <p className="text-sm text-gray-500">
                        Sous-classe: <span className="text-blue-400">{player.subclass}</span>
                        {player.secondary_subclass && (
                          <span className="text-green-400 ml-2">/ {player.secondary_subclass}</span>
                        )}
                      </p>
                    )}
                    {player.background && (
                      <p className="text-sm text-gray-500">
                        Historique: {player.background}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-center">
                      <Heart className="w-4 h-4 text-red-400 mx-auto mb-1" />
                      <div className="text-[10px] text-gray-500 uppercase">PV</div>
                      <div className="font-bold text-white text-sm">
                        {player.current_hp}/{player.max_hp}
                        {player.temporary_hp > 0 && (
                          <span className="text-blue-400 text-xs ml-0.5">+{player.temporary_hp}</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-center">
                      <Shield className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <div className="text-[10px] text-gray-500 uppercase">CA</div>
                      <div className="font-bold text-white text-sm">{player.stats?.armor_class || 10}</div>
                    </div>

                    <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-center">
                      <Zap className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                      <div className="text-[10px] text-gray-500 uppercase">Init.</div>
                      <div className="font-bold text-white text-sm">
                        {player.stats?.initiative >= 0 ? '+' : ''}{player.stats?.initiative || 0}
                      </div>
                    </div>

                    <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-center">
                      <Star className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                      <div className="text-[10px] text-gray-500 uppercase">Maitrise</div>
                      <div className="font-bold text-white text-sm">+{player.stats?.proficiency_bonus || 2}</div>
                    </div>

                    <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-center col-span-2 sm:col-span-1 mx-auto sm:mx-0 w-1/2 sm:w-auto">
                      <Footprints className="w-4 h-4 text-green-400 mx-auto mb-1" />
                      <div className="text-[10px] text-gray-500 uppercase">Vitesse</div>
                      <div className="font-bold text-white text-sm">{player.stats?.speed || 9} m</div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Points de vie</span>
                      <span>{Math.round(getHpPercentage(player.current_hp, player.max_hp))}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                      <div
                        className={`h-full ${getHpColor(getHpPercentage(player.current_hp, player.max_hp))} transition-all`}
                        style={{ width: `${getHpPercentage(player.current_hp, player.max_hp)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-gray-800/60 border border-gray-700 rounded-lg">
                    <div className="text-xs text-gray-400 mb-2 font-medium">Modifier les PV (MJ)</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={hpChangeValue}
                        onChange={(e) => setHpChangeValue(e.target.value)}
                        placeholder="Montant"
                        className="flex-1 min-w-[100px] px-3 py-2 bg-gray-900/60 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                        disabled={isApplyingHp}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={applyDamage}
                          disabled={isApplyingHp || !hpChangeValue}
                          className="px-3 py-2 bg-red-600/80 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap"
                          title="Appliquer des degats"
                        >
                          <Minus size={16} />
                          Degats
                        </button>
                        <button
                          onClick={applyHealing}
                          disabled={isApplyingHp || !hpChangeValue}
                          className="px-3 py-2 bg-green-600/80 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap"
                          title="Appliquer des soins"
                        >
                          <Plus size={16} />
                          Soins
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {player.abilities && player.abilities.length > 0 && (
                <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Swords className="w-4 h-4 text-red-400" />
                    Caractéristiques
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {player.abilities.map((ability) => (
                      <div
                        key={ability.name}
                        className="bg-gray-900/60 border border-gray-600 rounded-lg p-3 text-center"
                      >
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                          {ability.name.slice(0, 3)}
                        </div>
                        <div className="text-xl font-bold text-white">
                          {getModifierString(ability.score)}
                        </div>
                        <div className="text-xs text-gray-400">{ability.score}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(() => {
                const age = (player as any)?.age || '';
                const gender = (player as any)?.gender || '';
                const alignment = (player as any)?.alignment || '';
                const languages = Array.isArray((player as any)?.languages)
                  ? (player as any).languages.filter((lang: string) => lang && !lang.toLowerCase().includes('au choix'))
                  : [];
                const hasPersonalInfo = age || gender || alignment || languages.length > 0;

                if (!hasPersonalInfo) return null;

                return (
                  <CollapsibleSection
                    icon={<User className="w-4 h-4 text-cyan-400" />}
                    title="Informations personnelles"
                    defaultOpen={true}
                  >
                    <div className="space-y-4">
                      {(age || gender || alignment) && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {age && (
                            <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-700/50">
                              <div className="flex items-center gap-2 mb-1">
                                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Age</span>
                              </div>
                              <div className="text-sm text-gray-200 font-medium">{age}</div>
                            </div>
                          )}
                          {gender && (
                            <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-700/50">
                              <div className="flex items-center gap-2 mb-1">
                                <User className="w-3.5 h-3.5 text-pink-400" />
                                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Genre</span>
                              </div>
                              <div className="text-sm text-gray-200 font-medium">{gender}</div>
                            </div>
                          )}
                          {alignment && (
                            <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-700/50">
                              <div className="flex items-center gap-2 mb-1">
                                <Compass className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Alignement</span>
                              </div>
                              <div className="text-sm text-gray-200 font-medium">{alignment}</div>
                            </div>
                          )}
                        </div>
                      )}
                      {languages.length > 0 && (
                        <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-700/50">
                          <div className="flex items-center gap-2 mb-2">
                            <Globe className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                              Langues ({languages.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {languages.map((lang: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-200 rounded border border-cyan-500/30"
                              >
                                {lang}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                );
              })()}

              {(() => {
                const stats = player.stats as any;
                const feats = stats?.feats || {};
                const originFeats: string[] = Array.isArray(feats.origins)
                  ? feats.origins
                  : typeof feats.origin === 'string' && feats.origin
                  ? [feats.origin]
                  : [];
                const generalFeats: string[] = Array.isArray(feats.generals) ? feats.generals : [];
                const styleFeats: string[] = Array.isArray(feats.styles) ? feats.styles : [];
                const allFeats = [...originFeats, ...generalFeats, ...styleFeats];

                if (allFeats.length === 0) return null;

                return (
                  <CollapsibleSection
                    icon={<Sparkles className="w-4 h-4 text-amber-400" />}
                    title={`Dons (${allFeats.length})`}
                    defaultOpen={true}
                  >
                    <div className="space-y-3">
                      {originFeats.length > 0 && (
                        <div>
                          <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">Dons d'origine</div>
                          <div className="flex flex-wrap gap-1.5">
                            {originFeats.map((feat, i) => (
                              <span key={i} className="px-2 py-1 text-xs bg-amber-500/20 text-amber-200 rounded border border-amber-500/30">
                                {feat}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {generalFeats.length > 0 && (
                        <div>
                          <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">Dons generaux</div>
                          <div className="flex flex-wrap gap-1.5">
                            {generalFeats.map((feat, i) => (
                              <span key={i} className="px-2 py-1 text-xs bg-blue-500/20 text-blue-200 rounded border border-blue-500/30">
                                {feat}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {styleFeats.length > 0 && (
                        <div>
                          <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">Styles de combat</div>
                          <div className="flex flex-wrap gap-1.5">
                            {styleFeats.map((feat, i) => (
                              <span key={i} className="px-2 py-1 text-xs bg-red-500/20 text-red-200 rounded border border-red-500/30">
                                {feat}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                );
              })()}

              {(() => {
                const stats = player.stats as any;
                const creatorMeta = stats?.creator_meta || {};
                const weapons = creatorMeta.weapon_proficiencies || stats?.weapon_proficiencies || [];
                const armors = creatorMeta.armor_proficiencies || stats?.armor_proficiencies || [];
                const tools = creatorMeta.tool_proficiencies || stats?.tool_proficiencies || [];
                const hasProficiencies = weapons.length > 0 || armors.length > 0 || tools.length > 0;

                if (!hasProficiencies) return null;

                return (
                  <CollapsibleSection
                    icon={<Shield className="w-4 h-4 text-blue-400" />}
                    title="Maitrises"
                    defaultOpen={true}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Swords className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Armes</span>
                        </div>
                        {weapons.length > 0 ? (
                          <div className="space-y-1">
                            {weapons.map((w: string, i: number) => (
                              <span key={i} className="block px-2 py-1 text-xs bg-gray-700/40 text-gray-200 rounded">
                                {w}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Selon classe</p>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Armures</span>
                        </div>
                        {armors.length > 0 ? (
                          <div className="space-y-1">
                            {armors.map((a: string, i: number) => (
                              <span key={i} className="block px-2 py-1 text-xs bg-gray-700/40 text-gray-200 rounded">
                                {a}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Selon classe</p>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Wrench className="w-3.5 h-3.5 text-yellow-400" />
                          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Outils</span>
                        </div>
                        {tools.length > 0 ? (
                          <div className="space-y-1">
                            {tools.map((t: string, i: number) => (
                              <span key={i} className="block px-2 py-1 text-xs bg-gray-700/40 text-gray-200 rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Aucune</p>
                        )}
                      </div>
                    </div>
                  </CollapsibleSection>
                );
              })()}

              {hasSpellSlots(player.spell_slots) && (
                <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    Emplacements de sorts
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => {
                      const totalKey = `level${level}` as keyof SpellSlots;
                      const usedKey = `used${level}` as keyof SpellSlots;
                      const total = (player.spell_slots?.[totalKey] as number) || 0;
                      const used = (player.spell_slots?.[usedKey] as number) || 0;

                      if (total === 0) return null;

                      return (
                        <div
                          key={level}
                          className="bg-gray-900/60 border border-gray-600 rounded-lg p-2 text-center"
                        >
                          <div className="text-xs text-gray-500 mb-1">Niv. {level}</div>
                          <div className="flex items-center justify-center gap-1">
                            {Array.from({ length: total }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-2 h-2 rounded-full ${
                                  i < total - used ? 'bg-purple-500' : 'bg-gray-600'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {total - used}/{total}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-400" />
                    Inventaire ({inventoryItems.length})
                  </h4>
                  {inventoryItems.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Filter className="w-3 h-3 text-gray-500" />
                    </div>
                  )}
                </div>

                {inventoryItems.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <button
                        onClick={() => setTypeFilter('all')}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                          typeFilter === 'all'
                            ? 'bg-white/10 text-white border-white/30'
                            : 'text-gray-400 border-gray-600 hover:border-gray-500'
                        }`}
                      >
                        Tous ({inventoryItems.length})
                      </button>
                      {(['weapon', 'armor', 'shield', 'jewelry', 'potion', 'tool', 'equipment', 'other'] as MetaType[]).map((type) => {
                        const count = typeCounts[type] || 0;
                        if (count === 0) return null;
                        return (
                          <button
                            key={type}
                            onClick={() => setTypeFilter(type)}
                            className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                              typeFilter === type
                                ? TYPE_COLORS[type]
                                : 'text-gray-400 border-gray-600 hover:border-gray-500'
                            }`}
                          >
                            {TYPE_LABELS[type]} ({count})
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {filteredInventory.map((item) => {
                        const meta = parseMeta(item.description);
                        const type = meta?.type || 'other';
                        const qty = meta?.quantity || 1;
                        const equipped = meta?.equipped || false;
                        const desc = visibleDescription(item.description);
                        const isWeapon = type === 'weapon';
                        const isArmor = type === 'armor';
                        const isShield = type === 'shield';

                        let weaponProf = null;
                        if (isWeapon && meta?.weapon) {
                          try {
                            weaponProf = checkWeaponProficiency(
                              item.name,
                              playerWeaponProfs,
                              meta.weapon.category,
                              meta.weapon.properties
                            );
                          } catch {}
                        }

                        let armorProf = null;
                        if (isArmor || isShield) {
                          try {
                            armorProf = checkArmorProficiency(
                              item.name,
                              playerArmorProfs,
                              { type: meta?.type }
                            );
                          } catch {}
                        }

                        const isProficient = isWeapon
                          ? weaponProf?.isProficient
                          : (isArmor || isShield)
                            ? armorProf?.isProficient
                            : null;

                        let statInfo = '';
                        if (meta?.weapon) {
                          statInfo = `${meta.weapon.damageDice} ${meta.weapon.damageType}`;
                        } else if (meta?.armor) {
                          statInfo = `CA ${meta.armor.base}${meta.armor.addDex ? ' + Dex' : ''}${meta.armor.dexCap ? ` (max ${meta.armor.dexCap})` : ''}`;
                        } else if (meta?.shield) {
                          statInfo = `+${meta.shield.bonus} CA`;
                        }

                        return (
                          <div
                            key={item.id}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors ${
                              equipped
                                ? 'bg-emerald-900/20 border-emerald-500/30'
                                : 'bg-gray-900/40 border-gray-700 hover:border-gray-600'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-white font-medium truncate">
                                  {item.name}
                                  {qty > 1 && <span className="text-gray-400 ml-1">x{qty}</span>}
                                </span>
                                <span className={`px-1.5 py-0.5 text-[10px] rounded border ${TYPE_COLORS[type]}`}>
                                  {TYPE_LABELS[type]}
                                </span>
                                {equipped && (
                                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    Equipe
                                  </span>
                                )}
                                {isProficient === true && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-emerald-900/25 text-emerald-400 border border-emerald-700/30">
                                    {isWeapon ? <Swords size={10} /> : <ShieldCheck size={10} />}
                                    Maitrise
                                  </span>
                                )}
                                {isProficient === false && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-amber-900/25 text-amber-400 border border-amber-700/30">
                                    Non maitrise
                                  </span>
                                )}
                              </div>
                              {statInfo && (
                                <div className="text-xs text-gray-500 mt-0.5">{statInfo}</div>
                              )}
                              {desc && typeFilter !== 'all' && (
                                <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{desc}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {filteredInventory.length === 0 && (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          Aucun objet de ce type
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Inventaire vide
                  </div>
                )}
              </div>

              {player.is_concentrating && player.concentration_spell && (
                <div className="bg-purple-900/30 border border-purple-500/50 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <Scroll className="w-5 h-5 text-purple-400" />
                    <span className="text-sm text-purple-200">
                      Concentration sur: <strong>{player.concentration_spell}</strong>
                    </span>
                  </div>
                </div>
              )}

              {player.active_conditions && player.active_conditions.length > 0 && (
                <div className="bg-orange-900/30 border border-orange-500/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-orange-200 mb-2">Conditions actives</h4>
                  <div className="flex flex-wrap gap-2">
                    {player.active_conditions.map((condition) => (
                      <span
                        key={condition}
                        className="px-3 py-1 bg-orange-500/20 border border-orange-500/40 rounded-full text-xs text-orange-200"
                      >
                        {condition}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <span className="text-yellow-400">Bourse</span>
                </h4>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-yellow-400 font-medium">{player.gold || 0} po</span>
                  <span className="text-gray-300">{player.silver || 0} pa</span>
                  <span className="text-orange-400">{player.copper || 0} pc</span>
                </div>
              </div>

              {(player as any)?.character_history && (
                <CollapsibleSection
                  icon={<ScrollText className="w-4 h-4 text-blue-400" />}
                  title="Histoire du personnage"
                  defaultOpen={false}
                >
                  <div className="bg-gray-900/40 rounded-lg p-4 border border-gray-700/50 max-h-60 overflow-y-auto">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {(player as any).character_history}
                    </p>
                  </div>
                </CollapsibleSection>
              )}
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 px-4 sm:px-6 py-4">
          <button
            onClick={onClose}
            className="w-full btn-secondary py-2 rounded-lg"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlayerDetailsModal;
