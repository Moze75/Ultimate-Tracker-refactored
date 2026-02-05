const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const ARMURES_LEGERES: string[] = [
  'Matelassée', 'Cuir', 'Cuir clouté',
];

const ARMURES_INTERMEDIAIRES: string[] = [
  'Peaux', 'Chemise de mailles', 'Écailles', 'Cuirasse', 'Demi-plate',
];

const ARMURES_LOURDES: string[] = [
  'Broigne', 'Cotte de mailles', 'Clibanion', 'Harnois',
];

const BOUCLIERS: string[] = [
  'Bouclier',
];

function armorIn(list: string[], name: string): boolean {
  const n = normalize(name);
  return list.some(a => normalize(a) === n);
}

function detectArmorCategory(itemName: string, meta?: { type?: string }): string {
  if (meta?.type === 'shield') return 'Boucliers';
  if (armorIn(ARMURES_LEGERES, itemName)) return 'Armures légères';
  if (armorIn(ARMURES_INTERMEDIAIRES, itemName)) return 'Armures intermédiaires';
  if (armorIn(ARMURES_LOURDES, itemName)) return 'Armures lourdes';

  const n = normalize(itemName);
  if (n.includes('bouclier')) return 'Boucliers';
  if (n.includes('cuir')) return 'Armures légères';
  if (n.includes('matelass')) return 'Armures légères';
  if (n.includes('ecaille') || n.includes('cuirasse') || n.includes('demi-plate') || n.includes('chemise de maille') || n.includes('peaux')) return 'Armures intermédiaires';
  if (n.includes('harnois') || n.includes('clibanion') || n.includes('broigne') || n.includes('cotte de maille')) return 'Armures lourdes';

  return 'Inconnue';
}

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  'Armures légères': ['armures legeres', 'armure legere', 'light armor', 'light armors'],
  'Armures intermédiaires': ['armures intermediaires', 'armure intermediaire', 'medium armor', 'medium armors'],
  'Armures lourdes': ['armures lourdes', 'armure lourde', 'heavy armor', 'heavy armors'],
  'Boucliers': ['boucliers', 'bouclier', 'shields', 'shield'],
};

export interface ArmorProficiencyCheck {
  isProficient: boolean;
  category: string;
}

export function checkArmorProficiency(
  itemName: string,
  playerProficiencies: string[],
  meta?: { type?: string }
): ArmorProficiencyCheck {
  if (!itemName?.trim()) {
    return { isProficient: false, category: 'Inconnue' };
  }

  const category = detectArmorCategory(itemName, meta);

  if (category === 'Inconnue') {
    return { isProficient: false, category };
  }

  const normProfs = playerProficiencies.map(normalize);
  const synonyms = CATEGORY_SYNONYMS[category];

  if (synonyms) {
    const hasProficiency = normProfs.some(p =>
      synonyms.some(s => normalize(s) === p)
    );
    if (hasProficiency) {
      return { isProficient: true, category };
    }
  }

  return { isProficient: false, category };
}

export function getPlayerArmorProficiencies(player: any): string[] {
  const out: string[] = [];
  const pushArr = (arr: any) => {
    if (Array.isArray(arr)) {
      for (const v of arr) {
        if (typeof v === 'string' && v.trim()) out.push(v.trim());
      }
    }
  };

  const paths = [
    ['stats', 'creator_meta', 'armor_proficiencies'],
    ['stats', 'creator_meta', 'armorProficiencies'],
    ['stats', 'armor_proficiencies'],
    ['stats', 'armorProficiencies'],
    ['armor_proficiencies'],
    ['armorProficiencies'],
    ['proficiencies', 'armors'],
    ['proficiencies', 'armor'],
  ];

  for (const p of paths) {
    let val: any = player;
    for (const key of p) {
      val = val?.[key];
    }
    pushArr(val);
  }

  if (player?.proficiencies && !Array.isArray(player.proficiencies) && typeof player.proficiencies === 'object') {
    for (const k of Object.keys(player.proficiencies)) {
      const lower = k.toLowerCase();
      if (lower.includes('armor') || lower.includes('armure')) {
        pushArr(player.proficiencies[k]);
      }
    }
  }

  return [...new Set(out)].filter(Boolean);
}
