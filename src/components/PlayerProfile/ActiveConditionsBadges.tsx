import React from 'react';
import { CONDITIONS } from '../ConditionsSection';

interface ActiveConditionsBadgesProps {
  activeConditions: string[];
}

export function ActiveConditionsBadges({ activeConditions }: ActiveConditionsBadgesProps) {
  if (!activeConditions || activeConditions.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {activeConditions
        .map(conditionId => CONDITIONS.find(c => c.id === conditionId))
        .filter(Boolean)
        .map(condition => (
          <div
            key={condition!.id}
            className="inline-block px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40 text-sm font-medium"
          >
            {condition!.name}
          </div>
        ))}
    </div>
  );
}
