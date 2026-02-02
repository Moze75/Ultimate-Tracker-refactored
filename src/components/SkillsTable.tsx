import React from 'react';
import { Star, Settings, Save, X } from 'lucide-react';

// ✅ AJOUT : Fonction de mapping pour l'affichage
const getDisplaySkillName = (skillName: string): string => {
  if (skillName === 'Perspicacité') return 'Intuition';
  return skillName;
};

interface SkillItem {
  abilityIndex: number;
  skillIndex: number;
  abilityShort: string;
  skillName: string;
  bonus: number;
  isProficient: boolean;
  hasExpertise: boolean;
}

interface SkillsTableProps {
  allSkills: SkillItem[];
  editing: boolean;
  expertiseLimit: number;
  handleProficiencyChange: (abilityIndex: number, skillIndex: number) => void;
  handleExpertiseChange: (abilityIndex: number, skillIndex: number) => void;
  rollSkillCheck: (skillName: string, bonus: number) => void;
  statsJackOfAllTrades: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
}

export function SkillsTable({
  allSkills,
  editing,
  expertiseLimit,
  handleProficiencyChange,
  handleExpertiseChange,
  rollSkillCheck,
  statsJackOfAllTrades,
  onEdit,
  onSave,
  onCancel
}: SkillsTableProps) {
  return (
    <div className="flex justify-center mt-6">
      <div className="w-full max-w-2xl bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-semibold text-gray-300 text-left">Compétences</h4>
          {onEdit && onSave && onCancel && (
            <div className="flex items-center gap-2">
              {editing && (
                <button
                  onClick={onCancel}
                  className="p-2 text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors"
                  title="Annuler"
                >
                  <X size={20} />
                </button>
              )}
              <button
                onClick={() => editing ? onSave() : onEdit()}
                className="p-2 text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors flex items-center justify-center"
                title={editing ? 'Sauvegarder' : 'Modifier'}
              >
                {editing ? <Save size={20} /> : <Settings size={20} />}
              </button>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          {allSkills.map((skill) => (
            <div
              key={`${skill.abilityIndex}-${skill.skillIndex}`}
              className={`flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded ${
                !editing ? 'cursor-pointer hover:bg-gray-700/50 transition-colors' : ''
              }`}
              onClick={() => !editing && rollSkillCheck(skill.skillName, skill.bonus)}
              title={!editing ? `Test de ${getDisplaySkillName(skill.skillName)} 1d20+${skill.bonus}` : ''}
            >
              <div className="flex items-center gap-3 flex-1">
                {editing ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProficiencyChange(skill.abilityIndex, skill.skillIndex);
                    }}
                    className={`w-4 h-4 rounded border flex-shrink-0 ${
                      skill.isProficient
                        ? 'bg-red-500 border-red-600'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  />
                ) : (
                  <div
                    className={`w-4 h-4 rounded border flex-shrink-0 ${
                      skill.isProficient
                        ? 'bg-red-500 border-red-600'
                        : 'border-gray-600'
                    }`}
                  />
                )}

                {editing && skill.isProficient && expertiseLimit > 0 ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExpertiseChange(skill.abilityIndex, skill.skillIndex);
                    }}
                    className={`w-4 h-4 flex items-center justify-center rounded flex-shrink-0 ${
                      skill.hasExpertise
                        ? 'text-yellow-500 hover:text-yellow-400'
                        : 'text-gray-600 hover:text-yellow-500'
                    }`}
                    title={skill.hasExpertise ? 'Retirer l\'expertise' : 'Ajouter l\'expertise'}
                  >
                    <Star size={12} fill={skill.hasExpertise ? 'currentColor' : 'none'} />
                  </button>
                ) : skill.hasExpertise ? (
                  <Star size={12} className="text-yellow-500 flex-shrink-0" fill="currentColor" />
                ) : (
                  <div className="w-4 flex-shrink-0" />
                )}

                <span className="text-sm text-gray-500 min-w-[40px]">{skill.abilityShort}</span>
                <span className="text-sm text-gray-300 flex-1">
                  {getDisplaySkillName(skill.skillName)}
                  {!skill.isProficient && statsJackOfAllTrades && (
                    <span className="text-xs text-blue-400 ml-1" title="Touche-à-tout">
                      (T)
                    </span>
                  )}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-300 ml-3">
                {skill.bonus >= 0 ? '+' : ''}{skill.bonus}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}