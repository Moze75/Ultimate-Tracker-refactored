import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, BookOpen, Sparkles } from 'lucide-react';
import Button from '../ui/Button';
import { DndClass } from '../../types/character';
import { getSpellKnowledgeInfo } from '../../../../utils/spellSlots2024';
import { supabase } from '../../../../lib/supabase';
import { MarkdownLite } from '../../../../lib/markdownLite';

interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  casting_time: string;
  range: string;
  components: {
    V: boolean;
    S: boolean;
    M: string | null;
  };
  duration: string;
  description: string;
  higher_levels?: string;
  classes: string[];
}

interface SpellSelectionProps {
  selectedClass: DndClass | '';
  selectedCantrips: Spell[];
  selectedLevel1Spells: Spell[];
  onCantripsChange: (spells: Spell[]) => void;
  onLevel1SpellsChange: (spells: Spell[]) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const getComponentsText = (components: Spell['components']) => {
  const parts = [];
  if (components.V) parts.push('V');
  if (components.S) parts.push('S');
  if (components.M) parts.push(`M (${components.M})`);
  return parts.join(', ');
};

const MAGIC_SCHOOLS = [
  'Abjuration',
  'Invocation',
  'Divination',
  'Enchantement',
  'Évocation',
  'Illusion',
  'Nécromancie',
  'Transmutation'
];

// ✅ NOUVELLE VERSION
const generateSpellId = (name: string): string => {
  // Normalise le nom
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  
  // Créer un hash simple mais déterministe
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  
  // Générer un UUID v4 valide mais déterministe basé sur le hash
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  
  // Créer des segments additionnels basés sur le nom
  const segment2 = normalized.substring(0, 4).split('').map(c => c.charCodeAt(0).toString(16)).join('').padEnd(4, '0').slice(0, 4);
  const segment3 = '4' + normalized.substring(4, 7).split('').map(c => c.charCodeAt(0).toString(16)).join('').padEnd(3, '0').slice(0, 3);
  const segment4 = '8' + normalized.substring(7, 10).split('').map(c => c.charCodeAt(0).toString(16)).join('').padEnd(3, '0').slice(0, 3);
  const segment5 = (normalized + normalized).substring(0, 12).split('').map(c => c.charCodeAt(0).toString(16)).join('').padEnd(12, '0').slice(0, 12);
  
  return `${hex}-${segment2}-${segment3}-${segment4}-${segment5}`;
};

const SpellSelection: React.FC<SpellSelectionProps> = ({
  selectedClass,
  selectedCantrips,
  selectedLevel1Spells,
  onCantripsChange,
  onLevel1SpellsChange,
  onNext,
  onPrevious,
}) => {
  const [allSpells, setAllSpells] = useState<Spell[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('');

  const spellInfo = useMemo(() => {
    if (!selectedClass) return { kind: 'none' as const };
    return getSpellKnowledgeInfo(selectedClass, 1);
  }, [selectedClass]);

  const cantripsNeeded = spellInfo.kind === 'prepared' ? (spellInfo.cantrips || 0) : 0;
  const level1SpellsNeeded = spellInfo.kind === 'prepared' ? spellInfo.prepared : 0;

  useEffect(() => {
    const loadSpells = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('sorts')
          .download('Sorts 2024.md');

        if (error) throw error;

        const text = await data.text();
        const parsedSpells = parseSpellsFromMarkdown(text);
        setAllSpells(parsedSpells);
      } catch (error) {
        console.error('Erreur lors du chargement des sorts:', error);
        setAllSpells([]);
      } finally {
        setLoading(false);
      }
    };

    loadSpells();
  }, []);

  const parseSpellsFromMarkdown = (text: string): Spell[] => {
    const spells: Spell[] = [];
    const sections = text.split(/(?=^# [^#])/m).filter(section => section.trim().length > 0);

    sections.forEach((section) => {
      const lines = section.split('\n');
      const spell: Partial<Spell> = {
        id: '', // ✅ Sera défini après avoir trouvé le nom
        classes: [],
        components: { V: false, S: false, M: null },
        level: 0,
        school: 'Évocation',
        casting_time: '1 action',
        range: '9 mètres',
        duration: 'Instantané',
        description: ''
      };

      let descriptionLines: string[] = [];
      let higherLevelsLines: string[] = [];
      let inHigherLevelsSection = false;

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.startsWith('# ')) {
          spell.name = trimmedLine.substring(2).trim();
          // ✅ Génère l'ID déterministe basé sur le nom
          spell.id = generateSpellId(spell.name);
          continue;
        }

        if (trimmedLine.match(/^[A-Za-zÀ-ÿ\s]+\s+de\s+niveau\s+\d+/i) ||
            trimmedLine.match(/^Tour\s+de\s+magie/i)) {

          if (trimmedLine.toLowerCase().includes('tour de magie')) {
            spell.level = 0;
          } else {
            const levelMatch = trimmedLine.match(/niveau\s+(\d+)/i);
            if (levelMatch) {
              spell.level = parseInt(levelMatch[1]);
            }
          }

          const schoolMatch = trimmedLine.match(/^([A-Za-zÀ-ÿ\s]+)\s+de\s+niveau/i);
          if (schoolMatch) {
            spell.school = schoolMatch[1].trim();
          } else if (trimmedLine.toLowerCase().includes('tour de magie')) {
            const schoolMatch2 = trimmedLine.match(/Tour\s+de\s+magie\s+d[''']([A-Za-zÀ-ÿ\s]+)/i);
            if (schoolMatch2) {
              spell.school = schoolMatch2[1].trim();
            }
          }

          const classMatch = trimmedLine.match(/\(([^)]+)\)/);
          if (classMatch) {
            const classesText = classMatch[1];
            const classMapping: { [key: string]: string } = {
              'barbare': 'Barbare',
              'barde': 'Barde',
              'clerc': 'Clerc',
              'druide': 'Druide',
              'ensorceleur': 'Ensorceleur',
              'guerrier': 'Guerrier',
              'magicien': 'Magicien',
              'moine': 'Moine',
              'paladin': 'Paladin',
              'rôdeur': 'Rôdeur',
              'rodeur': 'Rôdeur',
              'roublard': 'Roublard',
              'occultiste': 'Occultiste'
            };

            const detectedClasses: string[] = [];
            const classesLower = classesText.toLowerCase();

            Object.entries(classMapping).forEach(([key, value]) => {
              if (classesLower.includes(key)) {
                if (!detectedClasses.includes(value)) {
                  detectedClasses.push(value);
                }
              }
            });

            spell.classes = detectedClasses;
          }

          continue;
        }

        if (trimmedLine.match(/^\*\*[^*]+\*\*\s*:/)) {
          const match = trimmedLine.match(/^\*\*([^*]+)\*\*\s*:\s*(.+)$/);
          if (match) {
            const fieldName = match[1].trim().toLowerCase();
            const valuePart = match[2].trim();

            switch (fieldName) {
              case 'temps d\'incantation':
              case 'temps d incantation':
              case 'incantation':
                spell.casting_time = valuePart;
                break;

              case 'portée':
              case 'portee':
                spell.range = valuePart;
                break;

              case 'composantes':
              case 'composants':
                const components = { V: false, S: false, M: null as string | null };
                if (valuePart.includes('V')) components.V = true;
                if (valuePart.includes('S')) components.S = true;
                const mMatch = valuePart.match(/M[:\s]*\(?([^)]+)\)?/i);
                if (mMatch) components.M = mMatch[1];
                spell.components = components;
                break;

              case 'durée':
              case 'duree':
                spell.duration = valuePart;
                break;
            }
          }
          continue;
        }

        if (
          trimmedLine.toLowerCase().includes('aux niveaux supérieurs') ||
          trimmedLine.toLowerCase().includes('niveaux supérieurs') ||
          trimmedLine.toLowerCase().includes('emplacement de niveau supérieur') ||
          trimmedLine.toLowerCase().includes('emplacements de niveaux supérieurs') ||
          trimmedLine.toLowerCase().includes('améliorations de sorts mineurs')
        ) {
          inHigherLevelsSection = true;
          higherLevelsLines.push(trimmedLine);
          continue;
        }

        if (inHigherLevelsSection) {
          if (trimmedLine.startsWith('**') || trimmedLine.startsWith('#')) {
            inHigherLevelsSection = false;
          } else {
            higherLevelsLines.push(trimmedLine);
            continue;
          }
        }

        if (!trimmedLine.startsWith('**') && !trimmedLine.startsWith('#') && spell.name && !inHigherLevelsSection) {
          descriptionLines.push(trimmedLine);
        }
      }

      if (spell.name) {
        let cleanDescription = descriptionLines.join('\n').trim();
        const descriptionParts = cleanDescription.split('\n').filter(line => {
          const trimmed = line.trim().toLowerCase();
          return !trimmed.match(/^[a-zà-ÿ\s]+\s+de\s+niveau\s+\d+/i) &&
                 !trimmed.match(/^tour\s+de\s+magie/i) &&
                 !trimmed.includes('(') ||
                 trimmed.length > 50;
        });

        spell.description = descriptionParts.join('\n').trim();
        spell.higher_levels = higherLevelsLines.join('\n').trim() || undefined;
        spell.classes = spell.classes || [];

        spells.push(spell as Spell);
      }
    });

    return spells;
  };

  const filteredCantrips = useMemo(() => {
    if (!selectedClass) return [];

    let filtered = allSpells.filter(spell =>
      spell.level === 0 &&
      spell.classes.some(spellClass => spellClass.toLowerCase() === selectedClass.toLowerCase())
    );

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }

    if (selectedSchool) {
      filtered = filtered.filter(s => s.school === selectedSchool);
    }

    return filtered;
  }, [allSpells, selectedClass, searchTerm, selectedSchool]);

  const filteredLevel1Spells = useMemo(() => {
    if (!selectedClass) return [];

    let filtered = allSpells.filter(spell =>
      spell.level === 1 &&
      spell.classes.some(spellClass => spellClass.toLowerCase() === selectedClass.toLowerCase())
    );

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }

    if (selectedSchool) {
      filtered = filtered.filter(s => s.school === selectedSchool);
    }

    return filtered;
  }, [allSpells, selectedClass, searchTerm, selectedSchool]);

  const toggleSpellSelection = (spell: Spell, isCantrip: boolean) => {
    if (isCantrip) {
      const isSelected = selectedCantrips.find(s => s.id === spell.id);
      if (isSelected) {
        onCantripsChange(selectedCantrips.filter(s => s.id !== spell.id));
      } else if (selectedCantrips.length < cantripsNeeded) {
        onCantripsChange([...selectedCantrips, spell]);
      }
    } else {
      const isSelected = selectedLevel1Spells.find(s => s.id === spell.id);
      if (isSelected) {
        onLevel1SpellsChange(selectedLevel1Spells.filter(s => s.id !== spell.id));
      } else if (selectedLevel1Spells.length < level1SpellsNeeded) {
        onLevel1SpellsChange([...selectedLevel1Spells, spell]);
      }
    }
  };

  const canProceed =
    selectedCantrips.length === cantripsNeeded &&
    selectedLevel1Spells.length === level1SpellsNeeded;

  return (
    <div className="wizard-step space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Choisissez vos sorts</h2>
        <p className="text-gray-400">
          Sélectionnez vos sorts de départ pour votre {selectedClass}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <img 
              src="/icons/wmremove-transformed.png" 
              alt="Chargement..." 
              className="animate-spin h-8 w-8 mx-auto object-contain"
              style={{ backgroundColor: 'transparent' }}
            />
            <p className="text-gray-400">Chargement des sorts...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-dark w-full pl-10 pr-3 py-2 rounded-lg"
                />
              </div>

              <select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="input-dark px-3 py-2 rounded-lg"
              >
                <option value="">Toutes les écoles</option>
                {MAGIC_SCHOOLS.map(school => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {cantripsNeeded > 0 && (
            <div className="space-y-3">
              <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    <div>
                      <h3 className="font-semibold text-gray-100">Sorts mineurs (Tours de magie)</h3>
                      <p className="text-sm text-gray-400">
                        {selectedCantrips.length}/{cantripsNeeded} sélectionnés
                      </p>
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${
                    selectedCantrips.length === cantripsNeeded ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {selectedCantrips.length === cantripsNeeded ? '✓ Complet' : 'En cours'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {filteredCantrips.map(spell => {
                  const isSelected = selectedCantrips.find(s => s.id === spell.id);
                  const isExpanded = expandedSpell === spell.id;

                  return (
                    <div
                      key={spell.id}
                      className={`border rounded-lg overflow-hidden transition-all ${
                        isSelected
                          ? 'border-blue-500/60 bg-blue-900/20'
                          : 'border-gray-700/50 bg-gray-800/50 hover:bg-gray-700/50'
                      }`}
                    >
                      <button
                        onClick={() => setExpandedSpell(isExpanded ? null : spell.id)}
                        className="w-full text-left p-3 transition-all duration-200"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3 flex-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSpellSelection(spell, true);
                              }}
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-blue-500 border-blue-500 text-white'
                                  : 'border-gray-600 hover:border-blue-500'
                              }`}
                            >
                              {isSelected && <Check size={14} />}
                            </button>
                            <h4 className="font-medium text-gray-100">{spell.name}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                              Tour
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`} />
                          </div>
                        </div>
                        <div className="text-sm text-gray-400">
                          {spell.school} • {spell.casting_time}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-700/50 bg-gray-900/50 p-4 space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-gray-800/50 p-2 rounded-lg">
                              <div className="text-xs font-medium text-gray-400 mb-1">Temps</div>
                              <div className="text-sm text-gray-200 font-medium">{spell.casting_time}</div>
                            </div>
                            <div className="bg-gray-800/50 p-2 rounded-lg">
                              <div className="text-xs font-medium text-gray-400 mb-1">Portée</div>
                              <div className="text-sm text-gray-200 font-medium">{spell.range}</div>
                            </div>
                            <div className="bg-gray-800/50 p-2 rounded-lg">
                              <div className="text-xs font-medium text-gray-400 mb-1">Composantes</div>
                              <div className="text-sm text-gray-200 font-medium">{getComponentsText(spell.components)}</div>
                            </div>
                            <div className="bg-gray-800/50 p-2 rounded-lg">
                              <div className="text-xs font-medium text-gray-400 mb-1">Durée</div>
                              <div className="text-sm text-gray-200 font-medium">{spell.duration}</div>
                            </div>
                          </div>

                          <div className="bg-gray-800/30 p-3 rounded-lg">
                            <h5 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
                              <BookOpen size={16} className="text-blue-400" />
                              Description
                            </h5>
                            <div className="text-gray-300 leading-relaxed whitespace-pre-line">
                              {spell.description}
                              {spell.higher_levels && `\n\n${spell.higher_levels}`}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {level1SpellsNeeded > 0 && (
            <div className="space-y-3">
              <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-purple-400" />
                    <div>
                      <h3 className="font-semibold text-gray-100">Sorts de niveau 1</h3>
                      <p className="text-sm text-gray-400">
                        {selectedLevel1Spells.length}/{level1SpellsNeeded} sélectionnés
                      </p>
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${
                    selectedLevel1Spells.length === level1SpellsNeeded ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {selectedLevel1Spells.length === level1SpellsNeeded ? '✓ Complet' : 'En cours'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {filteredLevel1Spells.map(spell => {
                  const isSelected = selectedLevel1Spells.find(s => s.id === spell.id);
                  const isExpanded = expandedSpell === spell.id;

                  return (
                    <div
                      key={spell.id}
                      className={`border rounded-lg overflow-hidden transition-all ${
                        isSelected
                          ? 'border-purple-500/60 bg-purple-900/20'
                          : 'border-gray-700/50 bg-gray-800/50 hover:bg-gray-700/50'
                      }`}
                    >
                      <button
                        onClick={() => setExpandedSpell(isExpanded ? null : spell.id)}
                        className="w-full text-left p-3 transition-all duration-200"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3 flex-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSpellSelection(spell, false);
                              }}
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-purple-500 border-purple-500 text-white'
                                  : 'border-gray-600 hover:border-purple-500'
                              }`}
                            >
                              {isSelected && <Check size={14} />}
                            </button>
                            <h4 className="font-medium text-gray-100">{spell.name}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                              Niv. 1
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`} />
                          </div>
                        </div>
                        <div className="text-sm text-gray-400">
                          {spell.school} • {spell.casting_time}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-700/50 bg-gray-900/50 p-4 space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-gray-800/50 p-2 rounded-lg">
                              <div className="text-xs font-medium text-gray-400 mb-1">Temps</div>
                              <div className="text-sm text-gray-200 font-medium">{spell.casting_time}</div>
                            </div>
                            <div className="bg-gray-800/50 p-2 rounded-lg">
                              <div className="text-xs font-medium text-gray-400 mb-1">Portée</div>
                              <div className="text-sm text-gray-200 font-medium">{spell.range}</div>
                            </div>
                            <div className="bg-gray-800/50 p-2 rounded-lg">
                              <div className="text-xs font-medium text-gray-400 mb-1">Composantes</div>
                              <div className="text-sm text-gray-200 font-medium">{getComponentsText(spell.components)}</div>
                            </div>
                            <div className="bg-gray-800/50 p-2 rounded-lg">
                              <div className="text-xs font-medium text-gray-400 mb-1">Durée</div>
                              <div className="text-sm text-gray-200 font-medium">{spell.duration}</div>
                            </div>
                          </div>

                          <div className="bg-gray-800/30 p-3 rounded-lg">
                            <h5 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
                              <BookOpen size={16} className="text-blue-400" />
                              Description
                            </h5>
                            <div className="text-gray-300 space-y-2">
                              <MarkdownLite 
                                text={
                                  (spell.description || '') + 
                                  (spell.higher_levels ? `\n\n${spell.higher_levels}` : '')
                                } 
                                ctx={{}}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex justify-between pt-6">
        <Button onClick={onPrevious} variant="secondary" size="lg">
          Précédent
        </Button>
        <Button
          onClick={onNext}
          disabled={!canProceed || loading}
          size="lg"
          className="min-w-[200px]"
        >
          Continuer
        </Button>
      </div>
    </div>
  );
};

export default SpellSelection;