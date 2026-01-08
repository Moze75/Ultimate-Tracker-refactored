import {
  norm,
  uniq,
  stripDiacritics,
  stripParentheses,
  sentenceCase,
  CLASS_ALIASES,
  SUBCLASS_ALIASES,
  AbilitySection
} from './ClassUtilsModal';
import { loadAbilitySections } from '../../../services/classesContent';
import type { Player, CustomClassData } from '../../../types/dnd';

const DEBUG = typeof window !== 'undefined' && (window as any).UT_DEBUG === true;

function convertCustomAbilitiesToSections(customClass: CustomClassData, level: number): AbilitySection[] {
  if (!customClass?.abilities?.length) return [];

  return customClass.abilities
    .filter(ability => ability.level <= level)
    .map(ability => ({
      title: ability.name,
      level: ability.level,
      content: ability.description || '',
      origin: 'class' as const,
      features: [{
        name: ability.name,
        description: ability.description || '',
      }],
    }));
}

/* ===========================================================
   Chargement "smart" avec alias
   =========================================================== */

export async function loadSectionsSmart(params: {
  className: string;
  subclassName: string | null;
  level: number;
  player?: Player | null;
}): Promise<AbilitySection[]> {
  const { className, subclassName, level, player } = params;

  if (player?.custom_class_data?.isCustom) {
    return convertCustomAbilitiesToSections(player.custom_class_data, level);
  }
  const clsNorm = norm(className);
  const subNorm = subclassName ? norm(subclassName) : '';

  const classCandidatesBase = uniq([
    className,
    stripDiacritics(className),
    stripParentheses(className),
    sentenceCase(className),
  ]).filter(Boolean) as string[];

  const subclassCandidatesBase = uniq([
    subclassName ?? '',
    stripParentheses(subclassName ?? ''),
    stripDiacritics(subclassName ?? ''),
    sentenceCase(subclassName ?? ''),
  ]).filter(Boolean) as string[];

  const classAlias = CLASS_ALIASES[clsNorm] ?? [];
  const subclassAlias = subNorm ? (SUBCLASS_ALIASES[subNorm] ?? []) : [];

  const classCandidates = uniq([...classCandidatesBase, ...classAlias]).filter(Boolean) as string[];
  const subclassCandidates = uniq([...subclassCandidatesBase, ...subclassAlias]).filter(Boolean) as string[];

  if (DEBUG) {
    console.debug('[ClassesTab] Tentatives de chargement', {
      input: { className, subclassName, level },
      normalized: { clsNorm, subNorm },
      classCandidates,
      subclassCandidates,
    });
  }

  // Essayer class + subclass
  for (const c of classCandidates) {
    for (const sc of subclassCandidates) {
      try {
        if (DEBUG) console.debug('[ClassesTab] loadAbilitySections try', { className: c, subclassName: sc, level });
        const res = await loadAbilitySections({ className: c, subclassName: sc, characterLevel: level });
        const secs = (res?.sections ?? []) as AbilitySection[];
        if (Array.isArray(secs) && secs.length > 0) {
          if (DEBUG) console.debug('[ClassesTab] -> OK', { className: c, subclassName: sc, count: secs.length });
          return secs;
        }
      } catch (e) {
        if (DEBUG) console.debug('[ClassesTab] -> KO', { className: c, subclassName: sc, error: e });
      }
    }
  }

  // Essayer class seule
  for (const c of classCandidates) {
    try {
      if (DEBUG) console.debug('[ClassesTab] loadAbilitySections try (class only)', { className: c, level });
      const res = await loadAbilitySections({ className: c, subclassName: null, characterLevel: level });
      const secs = (res?.sections ?? []) as AbilitySection[];
      if (Array.isArray(secs) && secs.length > 0) {
        if (DEBUG) console.debug('[ClassesTab] -> OK (class only)', { className: c, count: secs.length });
        return secs;
      }
    } catch (e) {
      if (DEBUG) console.debug('[ClassesTab] -> KO (class only)', { className: c, error: e });
    }
  }

  return [];
}