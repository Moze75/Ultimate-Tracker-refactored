import type { DndClass } from '../types/character';

export const DEFAULT_CUSTOM_CLASS_IMAGE = '/sans_classe.png';

export function getImageBaseForClass(className: DndClass | string): string | null {
  switch (className) {
    case 'Guerrier': return 'Guerrier';
    case 'Magicien': return 'Magicien';
    case 'Roublard': return 'Voleur';
    case 'Clerc': return 'Clerc';
    case 'Rôdeur': return 'Rodeur';
    case 'Barbare': return 'Barbare';
    case 'Barde': return 'Barde';
    case 'Druide': return 'Druide';
    case 'Moine': return 'Moine';
    case 'Paladin': return 'Paladin';
    case 'Ensorceleur': return 'Ensorceleur';
    case 'Occultiste': return 'Occultiste';
    default: return null;
  }
}

export function getClassImageUrl(className: DndClass | string): string {
  const base = getImageBaseForClass(className);
  return base ? `/${base}.png` : DEFAULT_CUSTOM_CLASS_IMAGE;
}