import type { VTTToken } from '../types/vtt';

/**
 * Applies damage to all tokens targeted by a given userId.
 * Only applies when the roll type is 'damage' (weapon or spell damage),
 * never for attack rolls, ability checks, saving throws, or skills.
 */
export function getTargetedTokensForUser(
  tokens: VTTToken[],
  userId: string,
): VTTToken[] {
  return tokens.filter(
    (t) => t.targetedByUserIds && t.targetedByUserIds.includes(userId),
  );
}

export function computeNewHp(token: VTTToken, damage: number): number {
  const currentHp = token.hp ?? 0;
  const tempHp = (token as VTTToken & { temporaryHp?: number }).temporaryHp ?? 0;

  let remaining = damage;
  let newTempHp = tempHp;

  if (remaining > 0 && tempHp > 0) {
    const absorbed = Math.min(tempHp, remaining);
    newTempHp = tempHp - absorbed;
    remaining -= absorbed;
  }

  const newHp = Math.max(0, currentHp - remaining);
  return newHp;
}
