// Inférence de caractéristique STR/DEX pour une attaque basée sur ses propriétés, sa portée et son type
// Règles D&D 5e:
// - Arme de lancer (Lance, Javeline) => meilleur de STR/DEX (peut être lancée OU utilisée en mêlée)
// - Arme à distance (Arc, Arbalète) => DEX obligatoire
// - Arme de mêlée avec Finesse => meilleur de STR/DEX
// - Arme de mêlée standard => STR
// override_ability est gérée dans l'appelant (CombatTab)

export interface AbilityLike {
  name: string;        // 'Force' | 'Dextérité' | ...
  modifier: number;    // mod associé
  score?: number;      // score brut pour comparaison
}

// Signature souple pour ne pas coupler aux types locaux
export function inferWeaponAbilityMod(attack: any, playerAbilities: AbilityLike[]): number {
  const normalize = (s?: string | null) => (s || '').toLowerCase();

  const hasProp = (props: string | null | undefined, keyword: string) => {
    const p = normalize(props);
    return p.includes(keyword.toLowerCase());
  };

  const isMeleeRangeLabel = (range?: string | null) => {
    const r = normalize(range);
    // Mêlée: "corps à corps", "contact" et reach 1,5 m / 3 m
    return r.includes('corps à corps') || r.includes('contact') || r.includes('1,5') || r.includes('3 m');
  };

  // Récupérer les modificateurs et scores
  const strAbility = playerAbilities?.find((a) => a.name === 'Force');
  const strMod = strAbility?.modifier ?? 0;
  const strScore = strAbility?.score ?? 10;
  
  const dexAbility = playerAbilities?.find((a) => a.name === 'Dextérité');
  const dexMod = dexAbility?.modifier ?? 0;
  const dexScore = dexAbility?.score ?? 10;

  // 1) Drapeaux depuis propriétés/catégorie/nom
  const props = attack?.properties as string | undefined | null;
  const category = normalize((attack as any)?.category || '');
  const nameLower = normalize((attack as any)?.name || '');

  const thrown = hasProp(props, 'lancer') || hasProp(props, 'jet') || category.includes('lancer');
  const finesse = hasProp(props, 'finesse') || category.includes('finesse');
  const light = hasProp(props, 'légère') || category.includes('légère');
  const versatile = hasProp(props, 'polyvalente') || category.includes('polyvalente');
  const hasMunitions = hasProp(props, 'munitions') || category.includes('munitions');
  const hasChargement = hasProp(props, 'chargement') || category.includes('chargement');

  // 2) Détection arme à distance PURE (Arc, Arbalète)
  const ammoType = (attack as any)?.ammo_type as string | undefined;
  const isPureRangedWeapon = 
    !!ammoType || 
    hasMunitions || 
    hasChargement || 
    nameLower.includes('arc') || 
    nameLower.includes('arbalète');

  // ✅ CORRECTION : Si c'est une arme PUREMENT à distance (pas de lancer), utiliser DEX
  if (isPureRangedWeapon && !thrown) {
    return dexMod;
  }

  // 3) ✅ ARMES DE LANCER (Lance, Javeline, Hache de lancer, etc.)
  // Règle D&D : Utilise le meilleur entre Force et Dex
  if (thrown) {
    return Math.max(strMod, dexMod);
  }

  // 4) ✅ ARMES DE MÊLÉE avec propriétés spéciales
  // Finesse, Légère, Polyvalente => meilleur de STR/DEX
  if (finesse || light || versatile) {
    return Math.max(strMod, dexMod);
  }

  // 5) ✅ ARMES DE MÊLÉE STANDARD => Force obligatoire
  return strMod;
}