export const DAMAGE_TYPES = ['Tranchant', 'Perforant', 'Contondant'] as const;

export const WEAPON_CATEGORIES = [
  'Armes courantes',
  'Armes de guerre',
  'Armes de guerre dotées de la propriété Légère',
  'Armes de guerre présentant la propriété Finesse ou Légère',
] as const;

export const RANGES = [
  'Corps à corps',
  'Contact',
  '1,5 m',
  '3 m', '6 m', '9 m', '12 m', '18 m',
  '24 m', '30 m', '36 m', '45 m', '60 m', '90 m', '120 m'
] as const;

export const PROPERTY_TAGS = [
  'Finesse', 'Légère', 'Lancer', 'Polyvalente',
  'Deux mains', 'Lourde', 'Allonge', 'Munitions', 'Chargement'
] as const;
