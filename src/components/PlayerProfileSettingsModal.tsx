import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, TrendingUp, Triangle, Plus, ChevronDown, Sword, Shield, CheckSquare, Square, Download, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Avatar } from './Avatar';
import { invalidateAvatarCache, cacheAvatar } from '../services/avatarCacheService';
import { LevelUpModal } from './LevelUpModal';
import { MulticlassSelectionModal } from './MulticlassSelectionModal';
import type { DndClass, Player, PlayerBackground, PlayerStats } from '../types/dnd';
import MarkdownLite from './MarkdownLite';
import { generateCharacterSheet } from '../services/pdfExportService'; // ✅ IMPORT

/* ============================ Helpers ============================ */

const getModifier = (score: number): number => Math.floor((score - 10) / 2);

const getProficiencyBonusForLevel = (level: number): number => {
  if (level >= 17) return 6;
  if (level >= 13) return 5; 
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}; 

const getDexModFromPlayer = (player: Player): number => {
  const abilities: any = (player as any).abilities;

  const dexFromArray =
    Array.isArray(abilities)
      ? abilities.find?.((a: any) => a?.name === 'Dextérité')
      : undefined;

  let dexFromMap: any = undefined;
  if (!dexFromArray && abilities && typeof abilities === 'object') {
    const direct =
      abilities['Dextérité'] ??
      abilities['dextérité'] ??
      abilities['dexterite'] ??
      abilities['dexterity'];
    if (typeof direct === 'number') {
      dexFromMap = { score: direct };
    } else if (direct && typeof direct === 'object') {
      dexFromMap = direct;
    }
  }

  const dex = dexFromArray ?? dexFromMap;
  if (!dex) return 0;

  if (typeof dex.modifier === 'number') return dex.modifier;
  if (typeof dex.score === 'number') return getModifier(dex.score);
  return 0;
};

const getConModFromPlayer = (player: Player): number => {
  const abilities: any = (player as any).abilities;

  const conFromArray =
    Array.isArray(abilities)
      ? abilities. find?. ((a: any) => a?. name === 'Constitution')
      : undefined;

  let conFromMap: any = undefined;
  if (! conFromArray && abilities && typeof abilities === 'object') {
    const direct =
      abilities['Constitution'] ??
      abilities['constitution'];
    if (typeof direct === 'number') {
      conFromMap = { score: direct };
    } else if (direct && typeof direct === 'object') {
      conFromMap = direct;
    }
  }

  const con = conFromArray ??  conFromMap;
  if (! con) return 0;

  if (typeof con. modifier === 'number') return con.modifier;
  if (typeof con.score === 'number') return getModifier(con.score);
  return 0;
};

const getWisModFromPlayer = (player: Player): number => {
  const abilities: any = (player as any).abilities;

  const wisFromArray =
    Array.isArray(abilities)
      ?  abilities.find?.((a: any) => a?.name === 'Sagesse')
      : undefined;

  let wisFromMap: any = undefined;
  if (!wisFromArray && abilities && typeof abilities === 'object') {
    const direct =
      abilities['Sagesse'] ??
      abilities['sagesse'] ??
      abilities['wisdom'];
    if (typeof direct === 'number') {
      wisFromMap = { score: direct };
    } else if (direct && typeof direct === 'object') {
      wisFromMap = direct;
    }
  }

  const wis = wisFromArray ?? wisFromMap;
  if (!wis) return 0;

  if (typeof wis.modifier === 'number') return wis.modifier;
  if (typeof wis.score === 'number') return getModifier(wis.score);
  return 0;
};

/**
 * Calcule la CA "défense sans armure" selon la classe du joueur. 
 * - Moine : 10 + DEX + SAG
 * - Barbare : 10 + DEX + CON
 * - Autres : 10 + DEX
 */
// Remplacer la fonction calculateUnarmoredAC existante par :

/**
 * Calcule la CA "défense sans armure" selon la classe du joueur
 * en tenant compte des bonus d'équipement (optionnels)
 */
const calculateUnarmoredAC = (
  player: Player,
  equipmentBonuses?: { Dextérité?: number; Sagesse?: number; Constitution?: number }
): number => {
  const baseDexMod = getDexModFromPlayer(player);
  const dexMod = baseDexMod + (equipmentBonuses?. Dextérité || 0);
  
  if (player.class === 'Moine') {
    const baseWisMod = getWisModFromPlayer(player);
    const wisMod = baseWisMod + (equipmentBonuses?.Sagesse || 0);
    return 10 + dexMod + wisMod;
  }
  
  if (player.class === 'Barbare') {
    const baseConMod = getConModFromPlayer(player);
    const conMod = baseConMod + (equipmentBonuses?.Constitution || 0);
    return 10 + dexMod + conMod;
  }
  
  // Autres classes : 10 + DEX
  return 10 + dexMod;
};


function mapClassForRpc(pClass: DndClass | null | undefined): string | null | undefined {
  if (pClass === 'Occultiste') return 'Occultiste';
  return pClass;
}

// --- Helpers ajoutés pour debug / parsing / déduplication ---
// Placez ce bloc juste après mapClassForRpc (avant la section "Données de sélection").

function normalizeKeyForDedupe(s?: string) {
  if (!s) return '';
  const replaced = s.replace(/[\u2018\u2019\u201A\u201B]/g, "'"); // apostrophes typographiques -> droite
  const normalized = replaced.normalize ? replaced.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : replaced;
  return normalized.replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
}

function toStringArrayMaybe(data: any): string[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.map((d) => (d == null ? '' : String(d)));
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed.map((d) => (d == null ? '' : String(d)));
    } catch (e) {
      // pas JSON : retourner la chaîne comme un seul élément
      return [data];
    }
  }
  if (typeof data === 'object') {
    try {
      // si supabase renvoie un object-like
      return Object.values(data).map((v) => (v == null ? '' : String(v)));
    } catch (e) {
      return [];
    }
  }
  return [String(data)];
}

/* ============================ Données de sélection ============================ */

const DND_RACES: string[] = [
  '',
  'Drakeide',
  'Elfe sylvestre',
  'Haut-elfe',
  'Drow',
  'Demi-elfe',
  'Humain',
  'Gnome',
  'Goliath',
  'Halfelin',
  'Nain',
  'Orc',
  'Demi-orc',
  'Tieffelin',
];

const DND_BACKGROUNDS: PlayerBackground[] = [
  '',
  'Acolyte',
  'Artisan',
  'Artiste',
  'Charlatan',
  'Criminel',
  'Ermite',
  'Fermier',
  'Garde',
  'Guide',
  'Marchand',
  'Marin',
  'Noble',
  'Sage',
  'Scribe',
  'Soldat',
  'Voyageur',
];

const DND_CLASSES: DndClass[] = [
  '',
  'Barbare',
  'Barde',
  'Clerc',
  'Druide',
  'Ensorceleur',
  'Guerrier',
  'Magicien',
  'Moine',
  'Paladin',
  'Rôdeur',
  'Roublard',
  'Occultiste',
];

const ORIGIN_FEATS: string[] = [
  'Bagarreur de tavernes',
  'Chanceux',
  'Doué',
  'Façonneur',
  'Façonnage rapide',
  'Guérisseur',
  'Initié à la magie',
  'Musicien',
  'Robuste',
  'Sauvagerie martiale',
  'Vigilant',
];

const GENERAL_FEATS: string[] = [
  'Adepte élémentaire',
  'Affinité féerique',
  'Affinité ombreuse',
  'Amélioration de caractéristique',
  'Athlète',
  'Broyeur',
  'Chef cuisinier',
  'Cogneur lourd',
  'Combattant à deux armes',
  'Combattant monté',
  'Comédien',
  'Discret',
  'Duelliste défensif',
  'Empoisonneur',
  'Esprit affûté',
  'Expert',
  'Expert de la charge',
  'Figure de proue',
  'Formation aux armes de guerre',
  'Gaillard',
  "Incantateur d'élite",
  'Mage de guerre',
  'Magie rituelle',
  "Maître d'armes",
  'Maître du hast',
  'Maître-arbalétrier',
  'Maître des armures intermédiaires',
  'Maître des armures lourdes',
  'Maître des boucliers',
  'Mobile',
  'Observateur',
  'Perforateur',
  'Protection intermédiaire',
  'Protection légère',
  'Protection lourde',
  'Résilient',
  'Sentinelle',
  'Télékinésiste',
  'Télépathe',
  "Tireur d'élite",
  'Trancheur',
  'Tueur de mages',
];

const FIGHTING_STYLES: string[] = [
  'Archerie',
  'Armes à deux mains',
  'Armes de lancer',
  'Combat à deux armes',
  'Combat à mains nues',
  'Combat en aveugle',
  'Défense',
  'Duel',
  'Interception',
  'Protection',
];

const DND_LANGUAGES: string[] = [
  'Commun',
  'Elfique',
  'Nain',
  'Géant',
  'Gnome',
  'Gobelin',
  'Halfelin',
  'Orc',
  'Abyssal',
  'Céleste',
  'Commun des profondeurs',
  'Draconique',
  'Infernal',
  'Primordial',
  'Sylvestre',
  'Autre',
];

const WEAPON_PROFICIENCIES = [
  'Armes courantes',
  'Armes de guerre',
  'Armes de guerre dotées de la propriété Légère',
  'Armes de guerre présentant la propriété Finesse ou Légère'
];

const ARMOR_PROFICIENCIES = [
  'Armures légères',
  'Armures intermédiaires',
  'Armures lourdes',
  'Boucliers'
];

export interface PlayerProfileSettingsModalProps {
  open: boolean;
  onClose: () => void;
  player: Player;
  onUpdate: (player: Player) => void;
  slideFrom?: 'left' | 'right';
}

/* ============================ Carte repliable ============================ */
function CollapsibleCard({
  title,
  defaultCollapsed = false,
  children,
}: {
  title: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div className="stat-card">
      <div className="stat-header">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
          <ChevronDown
            className={`w-5 h-5 text-gray-300 transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`}
          />
        </button>
      </div>
      {!collapsed && <div className="p-4">{children}</div>}
    </div>
  );
}

export function PlayerProfileSettingsModal({
  open,
  onClose,
  player,
  onUpdate,
  slideFrom = 'left',
}: PlayerProfileSettingsModalProps) {
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showSecondaryLevelUp, setShowSecondaryLevelUp] = useState(false);
  const [showMulticlassModal, setShowMulticlassModal] = useState(false);
  const [isDirty, setDirty] = useState(false);

  const [adventurerName, setAdventurerName] = useState(player.adventurer_name || '');
  const [avatarUrl, setAvatarUrl] = useState(player.avatar_url || '');
  const [selectedClass, setSelectedClass] = useState<DndClass | undefined>(player.class || undefined);
  const [selectedSubclass, setSelectedSubclass] = useState(player.subclass || '');
  const [selectedRace, setSelectedRace] = useState<string>(player.race || '');
  const [availableSubclasses, setAvailableSubclasses] = useState<string[]>([]);

  // États pour la classe secondaire
  const [selectedSecondaryClass, setSelectedSecondaryClass] = useState<DndClass | undefined>(player.secondary_class || undefined);
  const [selectedSecondarySubclass, setSelectedSecondarySubclass] = useState(player.secondary_subclass || '');
  const [availableSecondarySubclasses, setAvailableSecondarySubclasses] = useState<string[]>([]);
  const [selectedBackground, setSelectedBackground] = useState<PlayerBackground | undefined>(
    (player.background as PlayerBackground) || undefined
  );
  const [selectedAlignment, setSelectedAlignment] = useState(player.alignment || '');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(player.languages || []);
  const [age, setAge] = useState(player.age || '');
  const [gender, setGender] = useState(player.gender || '');
  const [characterHistory, setCharacterHistory] = useState(player.character_history || '');
  const [level, setLevel] = useState(player.level);
  const [hitDice, setHitDice] = useState(player.hit_dice || { total: player.level, used: 0 });
  const [maxHp, setMaxHp] = useState(player.max_hp);
  const [currentHp, setCurrentHp] = useState(player.current_hp);
  const [tempHp, setTempHp] = useState(player.temporary_hp);

  const [acField, setAcField] = useState<string>('');
  const [initField, setInitField] = useState<string>('');
  const [speedField, setSpeedField] = useState<string>('');
  const [profField, setProfField] = useState<string>('');

  const [originFeats, setOriginFeats] = useState<string[]>([]);
  const [generalFeats, setGeneralFeats] = useState<string[]>([]);
  const [fightingStyles, setFightingStyles] = useState<string[]>([]);

  // Nouveaux états pour les maîtrises
  const [weaponProficiencies, setWeaponProficiencies] = useState<string[]>([]);
  const [armorProficiencies, setArmorProficiencies] = useState<string[]>([]);
  const [acBonus, setAcBonus] = useState<number>(0);

  const ALLOWED_RACES = useMemo(() => new Set(DND_RACES.filter(Boolean)), []);
  const ALLOWED_BACKGROUNDS = useMemo(() => new Set(DND_BACKGROUNDS.filter(Boolean)), []);
  const ALLOWED_ORIGIN_FEATS = useMemo(() => new Set(ORIGIN_FEATS), []);
  const ALLOWED_GENERAL_FEATS = useMemo(() => new Set(GENERAL_FEATS), []);
  const ALLOWED_FIGHTING_STYLES = useMemo(() => new Set(FIGHTING_STYLES), []);

  const remainingOriginOptions = useMemo(
    () => ORIGIN_FEATS.filter((f) => !originFeats.filter(Boolean).includes(f)),
    [originFeats]
  );
  const remainingGeneralOptions = useMemo(
    () => GENERAL_FEATS.filter((f) => !generalFeats.filter(Boolean).includes(f)),
    [generalFeats]
  );
  const remainingStyleOptions = useMemo(
    () => FIGHTING_STYLES.filter((s) => !fightingStyles.filter(Boolean).includes(s)),
    [fightingStyles]
  );

  const parseDecimal = (s: string): number => {
    const n = parseFloat((s || '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };

  useEffect(() => {
    if (!open) return;

    setDirty(false);
    setLevel(player.level);
    setMaxHp(player.max_hp);
    setCurrentHp(player.current_hp);
    setTempHp(player.temporary_hp);
    setHitDice(player.hit_dice || { total: player.level, used: 0 });

    setAdventurerName(player.adventurer_name || '');
    setSelectedClass(player.class || undefined);
    setSelectedSubclass(player.subclass || '');
    setSelectedSecondaryClass(player.secondary_class || undefined);
    setSelectedSecondarySubclass(player.secondary_subclass || '');

   setSelectedRace(player.race || '');

    const nextBackground =
      player.background && ALLOWED_BACKGROUNDS.has(player.background as PlayerBackground)
        ? (player.background as PlayerBackground)
        : ('' as PlayerBackground);
    setSelectedBackground(nextBackground);

    setSelectedAlignment(player.alignment || '');
    setSelectedLanguages(player.languages || []);
    setAge(player.age || '');
    setGender(player.gender || '');
    setCharacterHistory(player.character_history || '');
    setAvatarUrl(player.avatar_url || '');

    const dexMod = getDexModFromPlayer(player);
    const profAuto = getProficiencyBonusForLevel(player.level);

    const acInitial = (player.stats?.armor_class ?? 0) || 0;
    const initInitial = player.stats?.initiative;
    const speedInitial = (player.stats?.speed ?? 0) || 0;
    const profInitial = (player.stats?.proficiency_bonus ?? 0) || 0;

   // Vérifier si une armure est équipée
const hasArmorEquipped = ! !(player.equipment?.armor?. armor_formula);

// Calculer la CA auto selon la classe (si pas d'armure équipée)
const autoAC = hasArmorEquipped 
  ? (10 + dexMod)  // Avec armure, la formule d'armure prendra le dessus à l'affichage
  : calculateUnarmoredAC(player);



setAcField(acInitial > 0 ? String(acInitial) : String(autoAC));
    setInitField(initInitial !== undefined && initInitial !== null ? String(initInitial) : String(dexMod));
    setSpeedField(speedInitial > 0 ? String(speedInitial).replace('.', ',') : String(9));
    setProfField(profInitial > 0 ? String(profInitial) : String(profAuto));
    setAcBonus((player.stats as any)?.ac_bonus ?? 0);

    const feats: any = (player.stats as any)?.feats || {};

    let origins: string[] = [];
    if (Array.isArray(feats.origins)) {
      origins = feats.origins.filter((f: string) => ALLOWED_ORIGIN_FEATS.has(f));
    } else if (typeof feats.origin === 'string' && ALLOWED_ORIGIN_FEATS.has(feats.origin)) {
      origins = [feats.origin];
    }
    setOriginFeats(origins.length > 0 ? origins : ['']);

    const gens = Array.isArray(feats.generals) ? feats.generals.filter((f: string) => ALLOWED_GENERAL_FEATS.has(f)) : [];
    setGeneralFeats(gens.length > 0 ? gens : ['']);

    const styles = Array.isArray(feats.styles) ? feats.styles.filter((s: string) => ALLOWED_FIGHTING_STYLES.has(s)) : [];
    setFightingStyles(styles.length > 0 ? styles : ['']);

    if (player.stats && typeof player.stats === 'object') {
      const stats = player.stats as any;
      const creatorMeta = stats.creator_meta || {};

      let weaponProfs = creatorMeta.weapon_proficiencies || stats.weapon_proficiencies || [];
      weaponProfs = Array.isArray(weaponProfs) ? weaponProfs : [];

      let armorProfs = creatorMeta.armor_proficiencies || stats.armor_proficiencies || [];
      armorProfs = Array.isArray(armorProfs) ? armorProfs : [];

      setWeaponProficiencies(weaponProfs);
      setArmorProficiencies(armorProfs);
    
  // ✅ VÉRIFIER si la race personnalisée est détectée
  const customRace = stats.creator_meta?.custom_race;
  console.log('[PlayerProfileSettingsModal] Race du player:', player.race);
  console.log('[PlayerProfileSettingsModal] Custom race data:', customRace);
  console.log('[PlayerProfileSettingsModal] Match:', customRace && customRace.name === player.race);
  
  if (customRace && customRace.name === player.race) {
    setCustomRaceName(player.race);
    console.log('[PlayerProfileSettingsModal] ✅ Custom race name défini:', player.race);
  } else {
    setCustomRaceName(null);
    console.log('[PlayerProfileSettingsModal] ❌ Pas de custom race');
  }
} else {
  setWeaponProficiencies([]);
  setArmorProficiencies([]);
  setCustomRaceName(null);
}
  }, [
    open,
    player,
    ALLOWED_RACES,
    ALLOWED_BACKGROUNDS,
    ALLOWED_ORIGIN_FEATS,
    ALLOWED_GENERAL_FEATS,
    ALLOWED_FIGHTING_STYLES,
  ]);

useEffect(() => {
  if (!open) return;
  const loadSubclasses = async () => {
    if (!selectedClass) {
      setAvailableSubclasses([]);
      return;
    }
    // reset UI quickly to avoid showing stale values
    setAvailableSubclasses([]);
    try {
      const rpcClass = mapClassForRpc(selectedClass);
      console.log('[DEBUG] loadSubclasses - selectedClass:', selectedClass, 'rpcClass:', rpcClass);
      const { data, error } = await supabase.rpc('get_subclasses_by_class', { p_class: rpcClass });
      console.log('[DEBUG] rpc response raw data:', data, 'error:', error);
      if (error) throw error;

      const raw = toStringArrayMaybe(data);
      console.log('[DEBUG] rpc parsed array:', raw);

      const map = new Map<string, string>();
      for (const item of raw) {
        const key = normalizeKeyForDedupe(item);
        if (!map.has(key) && item && item.toString().trim() !== '') {
          map.set(key, item);
        }
      }
      const unique = Array.from(map.values());
      console.log('[DEBUG] availableSubclasses final:', unique);
      setAvailableSubclasses(unique);
    } catch (err) {
      console.error('Erreur lors du chargement des sous-classes:', err);
      setAvailableSubclasses([]);
    }
  };
  loadSubclasses();
}, [open, selectedClass]);

  // Chargement des sous-classes secondaires
useEffect(() => {
  if (!open) return;
  const loadSecondarySubclasses = async () => {
    if (!selectedSecondaryClass) {
      setAvailableSecondarySubclasses([]);
      return;
    }
    setAvailableSecondarySubclasses([]);
    try {
      const rpcClass = mapClassForRpc(selectedSecondaryClass);
      console.log('[DEBUG] loadSecondarySubclasses - selectedSecondaryClass:', selectedSecondaryClass, 'rpcClass:', rpcClass);
      const { data, error } = await supabase.rpc('get_subclasses_by_class', { p_class: rpcClass });
      console.log('[DEBUG] rpc response raw data (secondary):', data, 'error:', error);
      if (error) throw error;

      const raw = toStringArrayMaybe(data);
      const map = new Map<string, string>();
      for (const item of raw) {
        const key = normalizeKeyForDedupe(item);
        if (!map.has(key) && item && item.toString().trim() !== '') {
          map.set(key, item);
        }
      }
      const unique = Array.from(map.values());
      console.log('[DEBUG] availableSecondarySubclasses final:', unique);
      setAvailableSecondarySubclasses(unique);
    } catch (err) {
      console.error('Erreur lors du chargement des sous-classes secondaires:', err);
      setAvailableSecondarySubclasses([]);
    }
  };
  loadSecondarySubclasses();
}, [open, selectedSecondaryClass]);

  useEffect(() => {
    setHitDice((prev) => {
      const used = Math.max(0, Math.min(prev?.used ?? 0, level));
      return { total: level, used };
    });
  }, [level]);

    useEffect(() => {
    setHitDice((prev) => {
      const used = Math.max(0, Math.min(prev?.used ?? 0, level));
      return { total: level, used };
    });
  }, [level]);

  // Recalculer automatiquement le bonus de maîtrise quand le niveau change
  useEffect(() => {
    const newProfBonus = getProficiencyBonusForLevel(level);
    setProfField(String(newProfBonus));
  }, [level]);

  const buildOptions = (all: string[], selected: string[], idx: number) => {
    const current = selected[idx] || '';
    const used = new Set(selected.filter(Boolean));
    return all.filter((opt) => !used.has(opt) || opt === current);
  };

  const addOriginSelect = () => {
    if (remainingOriginOptions.length === 0) return;
    setOriginFeats((prev) => [...prev, '']);
    setDirty(true);
  };
  const changeOriginAt = (i: number, val: string) => {
    setOriginFeats((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
    setDirty(true);
  };

  const addGeneralSelect = () => {
    if (remainingGeneralOptions.length === 0) return;
    setGeneralFeats((prev) => [...prev, '']);
    setDirty(true);
  };
  const changeGeneralAt = (i: number, val: string) => {
    setGeneralFeats((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
    setDirty(true);
  };

  const addStyleSelect = () => {
    if (remainingStyleOptions.length === 0) return;
    setFightingStyles((prev) => [...prev, '']);
    setDirty(true);
  };
  const changeStyleAt = (i: number, val: string) => {
    setFightingStyles((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
    setDirty(true);
  };

  const toggleWeaponProficiency = (proficiency: string) => {
    setWeaponProficiencies(prev => {
      if (prev.includes(proficiency)) {
        return prev.filter(p => p !== proficiency);
      } else {
        return [...prev, proficiency];
      }
    });
    setDirty(true);
  };

  const toggleArmorProficiency = (proficiency: string) => {
    setArmorProficiencies(prev => {
      if (prev.includes(proficiency)) {
        return prev.filter(p => p !== proficiency);
      } else {
        return [...prev, proficiency];
      }
    });
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      const dexMod = getDexModFromPlayer(player);
      const profAuto = getProficiencyBonusForLevel(level);

      const acVal = parseInt(acField, 10);
      const initVal = parseInt(initField, 10);
      const speedVal = parseDecimal(speedField);
      const profVal = parseInt(profField, 10);

      const normOrigins = originFeats
        .filter((v) => v && ALLOWED_ORIGIN_FEATS.has(v))
        .filter((v, i, arr) => arr.indexOf(v) === i);

      const normGenerals = generalFeats
        .filter((v) => v && ALLOWED_GENERAL_FEATS.has(v))
        .filter((v, i, arr) => arr.indexOf(v) === i);

      const normStyles = fightingStyles
        .filter((v) => v && ALLOWED_FIGHTING_STYLES.has(v))
        .filter((v, i, arr) => arr.indexOf(v) === i);

      const featsData: any = {
        origin: normOrigins.length > 0 ? normOrigins[0] : null,
        origins: normOrigins,
        generals: normGenerals,
        styles: normStyles,
      };

      const currentStats = (player.stats as any) || {};
      const autoAC = calculateUnarmoredAC(player);
      const isManualAC = Number.isFinite(acVal) && acField.trim() !== '' && acVal > 0;

      const finalizedStats: any = {
        ...currentStats,
        armor_class: isManualAC ? acVal : autoAC,
        auto_armor_class: autoAC,
        is_ac_manual: isManualAC,
        initiative: Number.isFinite(initVal) ? initVal : dexMod,
        speed: Number.isFinite(speedVal) && speedVal > 0 ? speedVal : 9,
        proficiency_bonus: profAuto,
        ac_bonus: acBonus,
        feats: featsData,
        creator_meta: {
          ...currentStats.creator_meta,
          weapon_proficiencies: weaponProficiencies,
          armor_proficiencies: armorProficiencies,
        },
        weapon_proficiencies: weaponProficiencies,
        armor_proficiencies: armorProficiencies,
      };

      const updateData: any = {
        adventurer_name: adventurerName.trim() || null,
        race: selectedRace || null,
        class: selectedClass || null,
        subclass: selectedSubclass || null,
        background: (selectedBackground as string) || null,
        alignment: selectedAlignment || null,
        languages: selectedLanguages,
        max_hp: Math.max(1, maxHp),
        current_hp: Math.max(0, Math.min(maxHp, currentHp)),
        temporary_hp: Math.max(0, tempHp),
        age: age.trim() || null,
        gender: gender.trim() || null,
        character_history: characterHistory.trim() || null,
        level: level,
        hit_dice: {
          total: level,
          used: Math.min(hitDice.used, level),
        },
        stats: finalizedStats as PlayerStats,
      };

      // Ajouter les champs de classe secondaire seulement si une classe secondaire existe
      if (player.secondary_class) {
        updateData.secondary_class = selectedSecondaryClass || null;
        updateData.secondary_subclass = selectedSecondarySubclass || null;
      }

      const { error } = await supabase.from('players').update(updateData).eq('id', player.id);
      if (error) throw error;

      onUpdate({
        ...player,
        ...updateData,
      });

      toast.success('Profil mis à jour');
      setDirty(false);
      smoothClose();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const [enter, setEnter] = useState(false);
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setEnter(true), 20);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(id);
      setEnter(false);
      document.body.style.overflow = prev || '';
    };
  }, [open]);

   const [customRaceName, setCustomRaceName] = useState<string | null>(null);
  const initialTranslate = slideFrom === 'right' ? 'translate-x-full' : '-translate-x-full';

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const gestureRef = useRef<'undetermined' | 'horizontal' | 'vertical'>('undetermined');

  const smoothClose = useCallback(() => {
    setEnter(false);
    window.setTimeout(() => onClose(), 300);
  }, [onClose]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    gestureRef.current = 'undetermined';
  };

  // --- GESTION EXPORT PDF ---
  const [isExporting, setIsExporting] = useState(false);

  const handlePdfExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading('Génération de la fiche PDF...');
    
    try {
      await generateCharacterSheet(player);
      toast.success('Fiche téléchargée !', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la création du PDF', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startXRef.current == null || startYRef.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (gestureRef.current === 'undetermined') {
      if (adx >= 14 || ady >= 14) {
        gestureRef.current = adx > ady * 1.15 ? 'horizontal' : 'vertical';
      } else {
        return;
      }
    }
    if (gestureRef.current !== 'horizontal') return;

    const threshold = 50;
    if (slideFrom === 'right' && dx > threshold) {
      e.preventDefault();
      smoothClose();
    } else if (slideFrom === 'left' && dx < -threshold) {
      e.preventDefault();
      smoothClose();
    }
  };

  const handleTouchEnd = () => {
    startXRef.current = null;
    startYRef.current = null;
    gestureRef.current = 'undetermined';
  };

  if (!open) return null;

  const modalContent = (
    <div
      className={`
        fixed inset-0 z-50 overflow-y-auto
        transform transition-transform duration-300 ease-out
        ${enter ? 'translate-x-0' : initialTranslate}
      `}
      style={{ 
        touchAction: 'pan-y',
        background: 'linear-gradient(to bottom, rgba(17, 24, 39, 0.98), rgba(17, 24, 39, 0.95))'
      }}

      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
        <div className="max-w-4xl mx-auto p-4 py-8 space-y-6 frame-card frame-card--light frame-card--no-frame">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-100">Paramètres du personnage</h2>
            <button
              onClick={smoothClose}
              className="p-2 text-gray-400 hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="hidden">
            <MarkdownLite content="" />
          </div>

          {/* Identité */}
          <div className="stat-card">
            <div className="stat-header">
              <h3 className="text-lg font-semibold text-gray-100">Identité</h3>
            </div>
            <div className="p-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Avatar</label>
                  <div className="w-40 h-56 rounded-lg overflow-hidden bg-gray-800/50 mx-auto">
<Avatar
  url={avatarUrl}
  playerId={player.id}
  onAvatarUpdate={async (url) => {
    setAvatarUrl(url);
    setDirty(true);
    
    // ✅ Invalider le cache de l'ancien avatar
    invalidateAvatarCache(player.id);
    
    // ✅ Mettre en cache le nouvel avatar
    await cacheAvatar(player.id, url);
    
    // ✅ Sauvegarder immédiatement dans la base de données
    try {
      const { error } = await supabase
        .from('players')
        .update({ avatar_url: url })
        .eq('id', player.id);
      
      if (error) throw error;
      
      // ✅ Notifier le composant parent
      onUpdate({
        ...player,
        avatar_url: url
      });
      
      toast.success('Avatar mis à jour');
    } catch (error) {
      console.error('Erreur mise à jour avatar:', error);
      toast.error('Erreur lors de la mise à jour de l\'avatar');
    }
  }}
  size="lg"
  editable
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Bonus de maîtrise
                    <span className="text-xs text-gray-500 ml-2">(calculé automatiquement selon le niveau)</span>
                  </label>
                  <input
                    type="number"
                    value={profField}
                    readOnly
                    className="input-dark w-full px-3 py-2 rounded-md bg-gray-800/50 cursor-not-allowed"
                    placeholder="Auto si vide: selon niveau"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Niveau */}
          <div className="stat-card">
            <div className="stat-header">
              <h3 className="text-lg font-semibold text-gray-100">Niveau</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Niveau</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={level}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value)) {
                      setLevel(Math.max(1, Math.min(20, value)));
                      setDirty(true);
                    }
                  }}
                  className="input-dark w-full px-3 py-2 rounded-md"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>

              <button
                onClick={() => setShowLevelUp(true)}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
              >
                <TrendingUp size={20} />
                Passer au niveau {level + 1}
              </button>
              
              {!player.secondary_class && level >= 2 && (
                <button
                  onClick={() => setShowMulticlassModal(true)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Ajouter une classe (multiclassage)
                </button>
              )}
            </div>
          </div>

                    {/* Niveau de la classe secondaire */}
          {player.secondary_class && (
            <div className="stat-card">
              <div className="stat-header">
                <h3 className="text-lg font-semibold text-gray-100">
                  Niveau de {player.secondary_class}
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Niveau
                    <span className="text-xs text-gray-500 ml-2">(vider pour supprimer la classe)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={player.secondary_level || 1}
                    onChange={async (e) => {
                      const value = e.target.value;
                      if (!value || parseInt(value) === 0) {
                        if (!window.confirm(`Voulez-vous vraiment supprimer votre classe secondaire ${player.secondary_class} ?`)) return;
                        try {
                          const hitDieSize = player.secondary_class === 'Barbare' ? 12 : player.secondary_class === 'Guerrier' || player.secondary_class === 'Paladin' || player.secondary_class === 'Rôdeur' ? 10 : player.secondary_class === 'Magicien' || player.secondary_class === 'Ensorceleur' ? 6 : 8;
                          const dieType = `d${hitDieSize}`;
                          const currentHitDiceByType = player.hit_dice_by_type || {};
                          const newHitDiceByType = { ...currentHitDiceByType };
                          if (newHitDiceByType[dieType]) {
                            const secondaryTotal = player.secondary_level || 0;
                            newHitDiceByType[dieType] = {
                              total: Math.max(0, newHitDiceByType[dieType].total - secondaryTotal),
                              used: Math.max(0, Math.min(newHitDiceByType[dieType].used, newHitDiceByType[dieType].total - secondaryTotal)),
                            };
                            if (newHitDiceByType[dieType].total === 0) delete newHitDiceByType[dieType];
                          }
                          const { error } = await supabase.from('players').update({ secondary_class: null, secondary_level: null, secondary_class_resources: null, secondary_spell_slots: null, hit_dice_by_type: newHitDiceByType }).eq('id', player.id);
                          if (error) throw error;
                          onUpdate({ ...player, secondary_class: null, secondary_level: null, secondary_class_resources: null, secondary_spell_slots: null, hit_dice_by_type: newHitDiceByType });
                          toast.success('Classe secondaire supprimée');
                          setTimeout(smoothClose, 500);
                        } catch (error) {
                          console.error('Erreur suppression classe secondaire:', error);
                          toast.error('Erreur lors de la suppression');
                        }
                      }
                    }}
                    className="input-dark w-full px-3 py-2 rounded-md"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Vider pour supprimer"
                  />
                </div>

                <button
                  onClick={() => setShowSecondaryLevelUp(true)}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
                >
                  <TrendingUp size={20} />
                  Passer au niveau {(player.secondary_level || 1) + 1} de {player.secondary_class}
                </button>

              </div>
            </div>
          )}

          
          {/* PV max et Dés de vie */}
          <CollapsibleCard title="PV max et Dés de vie" defaultCollapsed>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="block text-sm font-medium text-gray-300 min-w-[70px]">PV max</label>
                <input
                  type="number"
                  min={1}
                  value={maxHp}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) {
                      setMaxHp(Math.max(1, v));
                      setDirty(true);
                    }
                  }}
                  className="input-dark w-28 px-3 py-2 rounded-md"
                  placeholder="PV max"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="block text-sm font-medium text-gray-300 min-w-[70px]">Dés de vie</label>
                <button
                  type="button"
                  className="px-3 py-2 rounded-md bg-gray-800/60 hover:bg-gray-700/60 text-gray-200 border border-white/10"
                  onClick={() => {
                    setHitDice((prev) => {
                      const used = Math.max(0, Math.min((prev?.used ?? 0) + 1, level));
                      return { total: level, used };
                    });
                    setDirty(true);
                  }}
                  aria-label="Consommer un dé de vie"
                  title="Consommer un dé de vie"
                >
                  −
                </button>

                <span className="text-gray-200 font-medium tabular-nums">
                  {Math.max(0, level - (hitDice?.used ?? 0))} / {level}
                </span>

                <button
                  type="button"
                  className="px-3 py-2 rounded-md bg-gray-800/60 hover:bg-gray-700/60 text-gray-200 border border-white/10"
                  onClick={() => {
                    setHitDice((prev) => {
                      const used = Math.max(0, Math.min((prev?.used ?? 0) - 1, level));
                      return { total: level, used };
                    });
                    setDirty(true);
                  }}
                  aria-label="Ajouter un dé de vie"
                  title="Ajouter un dé de vie"
                >
                  +
                </button>
              </div>
            </div>
          </CollapsibleCard>

          

          {/* Statistiques */}
          <CollapsibleCard title="CA / Vit. / Init. / Maît." defaultCollapsed>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Classe d'armure (CA)</label>
                  <input
                    type="number"
                    value={acField}
                    onChange={(e) => {
                      setAcField(e.target.value);
                      setDirty(true);
                    }}
              
                    className="input-dark w-full px-3 py-2 rounded-md"
                    placeholder={
  player.class === 'Moine' 
    ? "Auto si vide: 10 + DEX + SAG" 
    : player.class === 'Barbare'
      ? "Auto si vide: 10 + DEX + CON"
      : "Auto si vide: 10 + DEX"
}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Initiative</label>
                  <input
                    type="number"
                    value={initField}
                    onChange={(e) => {
                      setInitField(e.target.value);
                      setDirty(true);
                    }}
                    onBlur={() => {
                      if (initField === '') {
                        const dm = getDexModFromPlayer(player);
                        const next = String(dm);
                        if (next !== initField) {
                          setInitField(next);
                          setDirty(true);
                        }
                      }
                    }}
                    className="input-dark w-full px-3 py-2 rounded-md"
                    placeholder="Auto si vide: mod DEX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Vitesse (m)</label>
                  <input
                    type="text"
                    value={speedField}
                    onChange={(e) => {
                      setSpeedField(e.target.value);
                      setDirty(true);
                    }}
                    onBlur={() => {
                      if (speedField.trim() === '') {
                        if (speedField !== '9') {
                          setSpeedField('9');
                          setDirty(true);
                        }
                        return;
                      }
                      const n = parseDecimal(speedField);
                      if (!Number.isFinite(n) || n <= 0) {
                        if (speedField !== '9') {
                          setSpeedField('9');
                          setDirty(true);
                        }
                      } else {
                        const display = String(n).replace('.', ',');
                        if (display !== speedField) {
                          setSpeedField(display);
                          setDirty(true);
                        }
                      }
                    }}
                    className="input-dark w-full px-3 py-2 rounded-md"
                    placeholder="Ex: 9, 10,5, 12"
                    inputMode="decimal"
                    pattern="^[0-9]+([\.,][0-9]+)?$"
                    aria-describedby="speed-help"
                  />
                  <p id="speed-help" className="text-xs text-gray-500 mt-1">Décimales autorisées: utilisez une virgule (ex: 10,5)</p>
                </div>

                <div>
<label className="block text-sm font-medium text-gray-300 mb-1">
  Bonus de maîtrise
  <span className="text-xs text-gray-500 ml-2">(mis à jour automatiquement)</span>
</label>
                  <input
                    type="number"
                    value={profField}
                    onChange={(e) => {
                      setProfField(e.target.value);
                      setDirty(true);
                    }}
                    onBlur={() => {
                      if (profField === '' || parseInt(profField, 10) <= 0) {
                        const next = String(getProficiencyBonusForLevel(level));
                        if (next !== profField) {
                          setProfField(next);
                          setDirty(true);
                        }
                      }
                    }}
                    className="input-dark w-full px-3 py-2 rounded-md"
                    placeholder="Auto si vide: selon niveau"
                  />
                </div>
              </div>

              <div className="border-t border-gray-700/50 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bonus de CA
                    <span className="text-xs text-gray-500 ml-2">(dons, objets magiques, etc.)</span>
                  </label>
                  <input
                    type="number"
                    value={acBonus}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setAcBonus(isNaN(val) ? 0 : val);
                      setDirty(true);
                    }}
                    className="input-dark w-full px-3 py-2 rounded-md"
                    placeholder="Bonus additionnel de CA (ex: +1 pour le style Défense)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ce bonus s'ajoute à votre CA calculée (armure + bouclier + DEX)
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleCard>
          
          {/* Classe et Espèce */}
          <CollapsibleCard title="Classe et Espèce" defaultCollapsed>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Espèce</label>
                <select
                  value={selectedRace}
                  onChange={(e) => {
                    setSelectedRace(e.target.value);
                    setDirty(true);
                  }}
                  className="input-dark w-full px-3 py-2 rounded-md"
                >
                    {/* ✅ AJOUTER: Afficher la race custom en premier si elle existe */}
    {customRaceName && !DND_RACES.includes(customRaceName) && (
      <option key={customRaceName} value={customRaceName}>
        {customRaceName} (personnalisée)
      </option>
    )}
                  {DND_RACES.map((race) => (
                    <option key={race} value={race}>
                      {race || 'Sélectionnez une espèce'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Classe principale</label>
                <select
                  value={selectedClass || ''}
                  onChange={(e) => {
                    setSelectedClass(e.target.value as DndClass);
                    setDirty(true);
                  }}
                  className="input-dark w-full px-3 py-2 rounded-md"
                >
                  {DND_CLASSES.map((dndClass) => (
                    <option key={dndClass} value={dndClass}>
                      {dndClass || 'Sélectionnez une classe'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Sous-classe principale</label>
                <select
                  value={selectedSubclass}
                  onChange={(e) => {
                    setSelectedSubclass(e.target.value);
                    setDirty(true);
                  }}
                  className="input-dark w-full px-3 py-2 rounded-md"
                  disabled={!selectedClass || availableSubclasses.length === 0}
                >
                  <option value="">Sélectionnez une sous-classe</option>
                  {availableSubclasses.map((subclass) => (
                    <option key={subclass} value={subclass}>
                      {subclass}
                    </option>
                  ))}
                </select>
              </div>

              {/* Classe secondaire - affichée seulement si elle existe */}
              {player.secondary_class && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Classe secondaire</label>
                    <select
                      value={selectedSecondaryClass || ''}
                      onChange={(e) => {
                        setSelectedSecondaryClass(e.target.value as DndClass);
                        setSelectedSecondarySubclass(''); // Réinitialiser la sous-classe si la classe change
                        setDirty(true);
                      }}
                      className="input-dark w-full px-3 py-2 rounded-md"
                    >
                      {DND_CLASSES.map((dndClass) => (
                        <option key={dndClass} value={dndClass}>
                          {dndClass || 'Sélectionnez une classe'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sous-classe secondaire - affichée seulement si elle existe */}
                  {player.secondary_subclass && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Sous-classe secondaire</label>
                      <select
                        value={selectedSecondarySubclass}
                        onChange={(e) => {
                          setSelectedSecondarySubclass(e.target.value);
                          setDirty(true);
                        }}
                        className="input-dark w-full px-3 py-2 rounded-md"
                        disabled={!selectedSecondaryClass || availableSecondarySubclasses.length === 0}
                      >
                        <option value="">Sélectionnez une sous-classe</option>
                        {availableSecondarySubclasses.map((subclass) => (
                          <option key={subclass} value={subclass}>
                            {subclass}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
          </CollapsibleCard>

          {/* Dons */}
          <CollapsibleCard title="Dons" defaultCollapsed>
            <div className="space-y-8">
              <div>
                <label className="block text-sm font-medium text-gray-300">Dons d'origine</label>
                <div className="mt-2 space-y-2">
                  {originFeats.length === 0 ? (
                    <select
                      value=""
                      onChange={(e) => changeOriginAt(0, e.target.value)}
                      className="input-dark w-full px-3 py-2 rounded-md"
                    >
                      <option value="">Sélectionnez un don d'origine</option>
                      {ORIGIN_FEATS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  ) : (
                    originFeats.map((val, idx) => {
                      const options = buildOptions(ORIGIN_FEATS, originFeats, idx);
                      return (
                        <select
                          key={`origin-${idx}`}
                          value={val || ''}
                          onChange={(e) => changeOriginAt(idx, e.target.value)}
                          className="input-dark w-full px-3 py-2 rounded-md"
                        >
                          <option value="">{idx === 0 ? 'Sélectionnez un don d\'origine' : 'Choisir un don'}</option>
                          {options.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      );
                    })
                  )}
                </div>
                <button
                  type="button"
                  onClick={addOriginSelect}
                  className="mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800/60 hover:bg-gray-700/60 text-gray-200 border border-white/10"
                  disabled={remainingOriginOptions.length === 0}
                  title={remainingOriginOptions.length === 0 ? 'Aucun autre don disponible' : 'Ajouter un don d\'origine'}
                >
                  <Plus size={16} />
                  Ajouter
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">Dons généraux</label>
                <div className="mt-2 space-y-2">
                  {generalFeats.length === 0 ? (
                    <select
                      value=""
                      onChange={(e) => changeGeneralAt(0, e.target.value)}
                      className="input-dark w-full px-3 py-2 rounded-md"
                    >
                      <option value="">Sélectionnez un don général</option>
                      {GENERAL_FEATS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  ) : (
                    generalFeats.map((val, idx) => {
                      const options = buildOptions(GENERAL_FEATS, generalFeats, idx);
                      return (
                        <select
                          key={`general-${idx}`}
                          value={val || ''}
                          onChange={(e) => changeGeneralAt(idx, e.target.value)}
                          className="input-dark w-full px-3 py-2 rounded-md"
                        >
                          <option value="">{idx === 0 ? 'Sélectionnez un don général' : 'Choisir un don'}</option>
                          {options.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      );
                    })
                  )}
                </div>
                <button
                  type="button"
                  onClick={addGeneralSelect}
                  className="mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800/60 hover:bg-gray-700/60 text-gray-200 border border-white/10"
                  disabled={remainingGeneralOptions.length === 0}
                  title={remainingGeneralOptions.length === 0 ? 'Aucun autre don disponible' : 'Ajouter un don général'}
                >
                  <Plus size={16} />
                  Ajouter
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">Styles de combat</label>
                <div className="mt-2 space-y-2">
                  {fightingStyles.length === 0 ? (
                    <select
                      value=""
                      onChange={(e) => changeStyleAt(0, e.target.value)}
                      className="input-dark w-full px-3 py-2 rounded-md"
                    >
                      <option value="">Sélectionnez un style</option>
                      {FIGHTING_STYLES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    fightingStyles.map((val, idx) => {
                      const options = buildOptions(FIGHTING_STYLES, fightingStyles, idx);
                      return (
                        <select
                          key={`style-${idx}`}
                          value={val || ''}
                          onChange={(e) => changeStyleAt(idx, e.target.value)}
                          className="input-dark w-full px-3 py-2 rounded-md"
                        >
                          <option value="">{idx === 0 ? 'Sélectionnez un style' : 'Choisir un style'}</option>
                          {options.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      );
                    })
                  )}
                </div>
                <button
                  type="button"
                  onClick={addStyleSelect}
                  className="mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800/60 hover:bg-gray-700/60 text-gray-200 border border-white/10"
                  disabled={remainingStyleOptions.length === 0}
                  title={remainingStyleOptions.length === 0 ? 'Aucun autre style disponible' : 'Ajouter un style de combat'}
                >
                  <Plus size={16} />
                  Ajouter
                </button>
              </div>
            </div>
          </CollapsibleCard>

          {/* Maîtrises d'armes */}
          <CollapsibleCard title="Maîtrises d'armes" defaultCollapsed>
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Sword className="w-5 h-5 text-red-400" />
                <p className="text-sm text-gray-400">
                  Sélectionnez les catégories d'armes que votre personnage maîtrise (en plus de celles de sa classe).
                </p>
              </div>
              
              <div className="space-y-3">
                {WEAPON_PROFICIENCIES.map((proficiency) => {
                  const isChecked = weaponProficiencies.includes(proficiency);
                  
                  return (
                    <button
                      key={proficiency}
                      type="button"
                      onClick={() => toggleWeaponProficiency(proficiency)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all w-full ${
                        isChecked
                          ? 'border-red-500/60 bg-red-900/20 text-gray-100'
                          : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-red-400 shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400 shrink-0" />
                      )}
                      <span className="text-sm font-medium">{proficiency}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CollapsibleCard>

          {/* Formation aux armures et boucliers */}
          <CollapsibleCard title="Formation aux armures" defaultCollapsed>
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-blue-400" />
                <p className="text-sm text-gray-400">
                  Sélectionnez les catégories d'armures que votre personnage maîtrise (en plus de celles de sa classe).
                </p>
              </div>
              
              <div className="space-y-3">
                {ARMOR_PROFICIENCIES.map((proficiency) => {
                  const isChecked = armorProficiencies.includes(proficiency);
                  
                  return (
                    <button
                      key={proficiency}
                      type="button"
                      onClick={() => toggleArmorProficiency(proficiency)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all w-full ${
                        isChecked
                          ? 'border-blue-500/60 bg-blue-900/20 text-gray-100'
                          : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-blue-400 shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400 shrink-0" />
                      )}
                      <span className="text-sm font-medium">{proficiency}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CollapsibleCard>


          {/* Historique */}
          <CollapsibleCard title="Historique" defaultCollapsed>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Historique</label>
                  <select
                    value={selectedBackground || ''}
                    onChange={(e) => {
                      setSelectedBackground(e.target.value as PlayerBackground);
                      setDirty(true);
                    }}
                    className="input-dark w-full px-3 py-2 rounded-md"
                  >
                    {DND_BACKGROUNDS.map((b) => (
                      <option key={b} value={b}>
                        {b || 'Sélectionnez un historique'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Alignement</label>
                  <input
                    type="text"
                    value={selectedAlignment}
                    onChange={(e) => {
                      setSelectedAlignment(e.target.value);
                      setDirty(true);
                    }}
                    className="input-dark w-full px-3 py-2 rounded-md"
                    placeholder="Alignement (optionnel)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Âge</label>
                  <input
                    type="text"
                    value={age}
                    onChange={(e) => {
                      setAge(e.target.value);
                      setDirty(true);
                    }}
                    className="input-dark w-full px-3 py-2 rounded-md"
                    placeholder="Âge du personnage"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Genre</label>
                  <input
                    type="text"
                    value={gender}
                    onChange={(e) => {
                      setGender(e.target.value);
                      setDirty(true);
                    }}
                    className="input-dark w-full px-3 py-2 rounded-md"
                    placeholder="Genre du personnage"
                  />
                </div>
              </div>
            </div>
          </CollapsibleCard>

          {/* Langues */}
          <CollapsibleCard title="Langues" defaultCollapsed>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {DND_LANGUAGES.map((language) => {
                const selected = selectedLanguages.includes(language);
                return (
                  <label
                    key={language}
                    className="flex items-center cursor-pointer hover:bg-gray-800/30 p-2 rounded transition-colors select-none"
                  >
                    <div
                      className={`mr-2 h-4 w-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                        selected ? 'bg-red-500 border-red-500' : 'border-gray-600 hover:border-gray-500'
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedLanguages((prev) => {
                          const next = selected ? prev.filter((lang) => lang !== language) : [...prev, language];
                          return next;
                        });
                        setDirty(true);
                      }}
                    >
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-gray-300">{language}</span>
                  </label>
                );
              })}
            </div>
          </CollapsibleCard>


          {/* EXPORT PDF */}
          <div className="stat-card border-blue-500/30 bg-blue-900/10">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-100">Fiche de personnage</h3>
                  <p className="text-sm text-blue-300/70">Format officiel D&D 2024 (PDF)</p>
                </div>
              </div>
              
              <button
                onClick={handlePdfExport}
                disabled={isExporting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 shadow-lg shadow-blue-900/20 flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    <span>Génération...</span>
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    <span>Télécharger</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Bandeau d'actions */}
          <div className="mt-4">
            <div className="flex gap-3 justify-end border-t border-gray-700/50 pt-4">
              {isDirty && (
                <button
                  onClick={handleSave}
                  className="btn-primary px-4 py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg"
                >
                  <Save size={20} />
                  Sauvegarder
                </button>
              )}
              <button
                onClick={smoothClose}
                className="btn-secondary px-4 py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg"
              >
                <Triangle size={18} className="transform -rotate-90" />
                Retour
              </button>
            </div>
          </div>

             {/* Modal passage de niveau - Classe principale */}
          <LevelUpModal
            isOpen={showLevelUp}
            onClose={() => setShowLevelUp(false)}
            player={player}
            onUpdate={onUpdate}
                        classType="primary"
          />

          {/* Modal passage de niveau - Classe secondaire */}
          {player.secondary_class && (
            <LevelUpModal
              isOpen={showSecondaryLevelUp}
              onClose={() => setShowSecondaryLevelUp(false)}
              player={player}
              onUpdate={onUpdate}
              classType="secondary"
            />
          )}

          {/* Modal sélection de multiclassage */}
          <MulticlassSelectionModal
            isOpen={showMulticlassModal}
            onClose={() => setShowMulticlassModal(false)}
            player={player}
            onUpdate={onUpdate}
          />
        </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}