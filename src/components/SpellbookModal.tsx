import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Book, Search, Filter, Sparkles, Clock, Target, Zap, Wand2, Skull, Check } from 'lucide-react';
import { DndClass } from '../types/dnd';
import { supabase } from '../lib/supabase';
import { MarkdownLite } from '../lib/markdownLite';

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

interface SpellbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerClass?: DndClass | null | undefined;
  playerClasses?: (DndClass | null | undefined)[];
  selectionMode?: boolean;
  onSpellSelect?: (spell: any) => void;
  selectedSpells?: any[];
  onConfirm?: (spells: any[]) => void;
  playerSubclass?: string | null; // ✅ Ajout de la prop
}

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

const SPELL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];



export function SpellbookModal({
  isOpen,
  onClose,
  playerClass,
  playerClasses,
  selectionMode = false,
  onSpellSelect,
  selectedSpells = [],
  onConfirm,
  playerSubclass // ✅ Récupéré ici
}: SpellbookModalProps) {
  // Utiliser playerClasses si fourni, sinon fallback sur playerClass
  const baseClasses = playerClasses || (playerClass ? [playerClass] : []);
  
  // ✅ Ajouter 'Magicien' si c'est un Chevalier Occulte ou Escroc Arcanique
  const effectivePlayerClasses = React.useMemo(() => {
    const classes = [...baseClasses];
    if (playerSubclass) {
      const s = playerSubclass.toLowerCase();
      // Si Guerrier + Chevalier Occulte OU Roublard + Escroc Arcanique
      const isEldritch = classes.includes('Guerrier') && (s.includes('chevalier occulte') || s.includes('eldritch'));
      const isTrickster = classes.includes('Roublard') && (s.includes('escroc') || s.includes('trickster'));
      
      if (isEldritch || isTrickster) {
        if (!classes.includes('Magicien')) classes.push('Magicien');
      }
    }
    return classes;
  }, [baseClasses, playerSubclass]);
  const [spells, setSpells] = useState<Spell[]>([]);
  const [filteredSpells, setFilteredSpells] = useState<Spell[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set());
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [totalSpellsCount, setTotalSpellsCount] = useState(0);
 
    // ✅ OPTIMISÉ : Cache des sorts en mémoire + localStorage
  useEffect(() => {
    const SPELLS_CACHE_KEY = 'ut:spells:2024';
    const SPELLS_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 heures
    
    const loadSpells = async () => {
      if (! isOpen) return;
      
      // 1. Vérifier le cache localStorage d'abord
      try {
        const cachedData = localStorage.getItem(SPELLS_CACHE_KEY);
        const cachedTimestamp = localStorage.getItem(`${SPELLS_CACHE_KEY}:ts`);
        
        if (cachedData && cachedTimestamp) {
          const age = Date.now() - parseInt(cachedTimestamp, 10);
          
          if (age < SPELLS_CACHE_TTL) {
            const parsed = JSON.parse(cachedData);
            setSpells(parsed);
            setTotalSpellsCount(parsed. length);
            setLoading(false);
            console.log('[SpellbookModal] ✅ Sorts chargés depuis le cache:', parsed.length);
            return; // ✅ Pas de requête réseau ! 
          }
        }
      } catch (e) {
        console.warn('[SpellbookModal] Erreur lecture cache:', e);
      }
      
      // 2.  Cache expiré ou absent : fetch depuis GitHub
      setLoading(true);
      try {
        console.log('[SpellbookModal] 🔄 Chargement des sorts depuis GitHub...');
        const res = await fetch(
          'https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Sorts/Sorts%202024.md'
        );

        if (! res.ok) {
          throw new Error(`Échec du chargement: ${res.status}`);
        }

        const text = await res.text();
        const parsedSpells = parseSpellsFromMarkdown(text);
        
        // Sauvegarder dans le cache
        try {
          localStorage. setItem(SPELLS_CACHE_KEY, JSON.stringify(parsedSpells));
          localStorage.setItem(`${SPELLS_CACHE_KEY}:ts`, Date.now().toString());
          console.log('[SpellbookModal] 💾 Sorts mis en cache:', parsedSpells.length);
        } catch (e) {
          console.warn('[SpellbookModal] Erreur sauvegarde cache:', e);
        }
        
        setTotalSpellsCount(parsedSpells.length);
        setSpells(parsedSpells);
      } catch (error) {
        console.error('[SpellbookModal] Erreur, fallback SAMPLE_SPELLS:', error);
        
        // Fallback : essayer le cache même expiré
        try {
          const cachedData = localStorage. getItem(SPELLS_CACHE_KEY);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            setSpells(parsed);
            setTotalSpellsCount(parsed.length);
            console.log('[SpellbookModal] 📴 Utilisation du cache expiré');
            setLoading(false);
            return;
          }
        } catch {}
        
        setTotalSpellsCount(SAMPLE_SPELLS.length);
        setSpells(SAMPLE_SPELLS);
      } finally {
        setLoading(false);
      }
    };
    
    loadSpells();
  }, [isOpen]);

  // Empêcher le défilement de l'arrière-plan
  useEffect(() => {
    if (isOpen) {
      // Ne pas bloquer le défilement de l'arrière-plan
      // Le modal gère son propre défilement
    }
  }, [isOpen]);

  // Fonction pour parser les sorts depuis le fichier Markdown
  const parseSpellsFromMarkdown = (text: string): Spell[] => {
    const spells: Spell[] = [];
    
    console.log('=== DÉBUT DU PARSING ===');
    console.log('Taille du fichier:', text.length, 'caractères');
    
    // Diviser le texte en sections de sorts (chaque sort commence par # suivi d'un nom)
    const sections = text.split(/(?=^# [^#])/m).filter(section => section.trim().length > 0);
    
    console.log(`Sections trouvées: ${sections.length}`);
    
    sections.forEach((section, index) => {
      const lines = section.split('\n');
      const spell: Partial<Spell> = {
        id: crypto.randomUUID(),
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
      let foundFirstDescription = false;
      let inHigherLevelsSection = false; // Nouvelle variable pour tracker l'état
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // Nom du sort
        if (trimmedLine.startsWith('# ')) {
          spell.name = trimmedLine.substring(2).trim();
          console.log(`📖 Sort trouvé: ${spell.name} (ID: ${spell.id})`);
          continue;
        }
        
        // Détecter les lignes d'information (niveau, école, classes)
        if (trimmedLine.match(/^[A-Za-zÀ-ÿ\s]+\s+de\s+niveau\s+\d+/i) || 
            trimmedLine.match(/^Tour\s+de\s+magie/i)) {
          
          console.log(`📋 Ligne d'info détectée: ${trimmedLine}`);
          
          // Extraire le niveau
          if (trimmedLine.toLowerCase().includes('tour de magie')) {
            spell.level = 0;
            console.log(`🎯 Niveau: 0 (tour de magie)`);
          } else {
            const levelMatch = trimmedLine.match(/niveau\s+(\d+)/i);
            if (levelMatch) {
              spell.level = parseInt(levelMatch[1]);
              console.log(`🎯 Niveau: ${spell.level}`);
            }
          }
          
          // Extraire l'école de magie
          const schoolMatch = trimmedLine.match(/^([A-Za-zÀ-ÿ\s]+)\s+de\s+niveau/i);
          if (schoolMatch) {
            spell.school = schoolMatch[1].trim();
            console.log(`🏫 École: ${spell.school}`);
          } else if (trimmedLine.toLowerCase().includes('tour de magie')) {
            const schoolMatch2 = trimmedLine.match(/Tour\s+de\s+magie\s+d[''']([A-Za-zÀ-ÿ\s]+)/i);
            if (schoolMatch2) {
              spell.school = schoolMatch2[1].trim();
              console.log(`🏫 École (tour): ${spell.school}`);
            }
          }
          
          // Extraire les classes (entre parenthèses)
          const classMatch = trimmedLine.match(/\(([^)]+)\)/);
          if (classMatch) {
            const classesText = classMatch[1];
            console.log(`🎭 Classes brutes: ${classesText}`);
            
            // Parser les classes avec mapping
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
            console.log(`🎭 Classes parsées: ${spell.classes.join(', ')}`);
          }
          
          continue;
        }
        
// Champs avec format "**Champ:** valeur" (SEULEMENT les champs structurés)
if (trimmedLine.match(/^\*\*[^*]+\*\*\s*:/)) {
  const match = trimmedLine.match(/^\*\*([^*]+)\*\*\s*:\s*(.+)$/);
  if (match) {
    const fieldName = match[1].trim().toLowerCase(); 
    const valuePart = match[2].trim();
    
    // ✅ Liste des champs structurés à extraire
    const structuredFields = [
      'temps d\'incantation',
      'temps d incantation',
      'incantation',
      'portée',
      'portee',
      'composantes',
      'composants',
      'durée',
      'duree', 
    ];
    
    const isStructuredField = structuredFields.includes(fieldName);
    
    if (isStructuredField) {
      // Extraire dans les propriétés structurées
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
      continue; // Skip seulement pour les champs structurés
    } else {
      // ✅ NOUVEAU : Les autres labels restent dans la description
      descriptionLines.push(trimmedLine);
      foundFirstDescription = true;
    }
  }
  continue;
}
        
        // Détecter "Aux niveaux supérieurs"
if (
  trimmedLine.toLowerCase().includes('aux niveaux supérieurs') ||
  trimmedLine.toLowerCase().includes('à des niveaux supérieurs') ||
  trimmedLine.toLowerCase().includes('niveaux supérieurs') ||
  trimmedLine.toLowerCase().includes('niveau supérieur') || // ✅ AJOUT (sans "x")
  trimmedLine.toLowerCase().includes('emplacement de niveau supérieur') ||
  trimmedLine.toLowerCase().includes('emplacements de niveau supérieur') || // ✅ AJOUT (sans "x" à "niveaux")
  trimmedLine.toLowerCase().includes('emplacements de niveaux supérieurs') ||
  trimmedLine.toLowerCase().includes('amélioration de sort mineur') ||
  trimmedLine.toLowerCase().includes('améliorations de sorts mineurs') ||
  trimmedLine.toLowerCase().includes('incantation supérieure') // ✅ BONUS
) {
            inHigherLevelsSection = true;
            higherLevelsLines.push(trimmedLine);
            continue;
          }
        
        // Si on est dans la section "niveaux supérieurs"
        if (inHigherLevelsSection) {
          // Vérifier si on sort de la section (nouveau champ ou nouveau sort)
          if (trimmedLine.startsWith('**') || trimmedLine.startsWith('#')) {
            inHigherLevelsSection = false;
            // Traiter cette ligne normalement (ne pas faire continue)
          } else {
            higherLevelsLines.push(trimmedLine);
            continue;
          }
        } 
               
        // Si ce n'est pas un titre de sort ni une ligne "niveaux supérieurs", c'est de la description
        // (les champs structurés ont déjà été filtrés plus haut)
        if (!trimmedLine.startsWith('#') && spell.name && !inHigherLevelsSection) {
          descriptionLines.push(trimmedLine);
          foundFirstDescription = true;
        }
      } // Fermeture de la boucle for
      
      // Finaliser le sort
      if (spell.name) {
        // Nettoyer la description en enlevant les infos de niveau/école/classes du début
        let cleanDescription = descriptionLines.join('\n').trim();
        
        // Enlever les lignes qui contiennent des infos de niveau/école/classes
        const descriptionParts = cleanDescription.split('\n').filter(line => {
          const trimmed = line.trim().toLowerCase();
          return !trimmed.match(/^[a-zà-ÿ\s]+\s+de\s+niveau\s+\d+/i) &&
                 !trimmed.match(/^tour\s+de\s+magie/i) &&
                 !trimmed.includes('(') || // Enlever les lignes avec parenthèses (classes)
                 trimmed.length > 50; // Garder les longues lignes même avec parenthèses
        });
        
        spell.description = descriptionParts.join('\n').trim();
        spell.higher_levels = higherLevelsLines.join('\n').trim() || undefined;
        
        // Convertir les classes en tableau de chaînes pour la base de données
        spell.classes = spell.classes || [];
        
        console.log(`✅ Sort finalisé: ${spell.name} (ID: ${spell.id})`);
        console.log(`   - Niveau: ${spell.level}`);
        console.log(`   - École: ${spell.school}`);
        console.log(`   - Classes: ${spell.classes?.join(', ') || 'aucune'}`);
        console.log(`   - Description: ${spell.description.substring(0, 100)}...`);
        if (spell.higher_levels) {
          console.log(`   - Niveaux supérieurs: ${spell.higher_levels.substring(0, 50)}...`);
        }
        
        spells.push(spell as Spell);
      }
    });
    
    console.log(`=== RÉSULTAT PARSING ===`);
    console.log(`Total de sorts parsés: ${spells.length}`);
    console.log('Premiers IDs générés:', spells.slice(0, 3).map(s => ({ name: s.name, id: s.id })));
    
    return spells;
  };

  // Filtrer les sorts selon les critères
  useEffect(() => {
    let filtered = spells;
    
    console.log('=== FILTRAGE DES SORTS ===');
    console.log(`Total sorts: ${spells.length}`);
    console.log(`Classes joueur: ${effectivePlayerClasses.filter(Boolean).join(', ')}`);
    console.log(`Afficher toutes classes: ${showAllClasses}`);
    console.log(`Niveaux sélectionnés: ${Array.from(selectedLevels).join(', ')}`);
    console.log(`École sélectionnée: ${selectedSchool}`);
    console.log(`Terme de recherche: ${searchTerm}`);

    // Filtrer par classe du joueur (sauf si showAllClasses est activé)
    if (!showAllClasses && effectivePlayerClasses.length > 0 && effectivePlayerClasses.some(Boolean)) {
      console.log(`🔍 Filtrage par classes: ${effectivePlayerClasses.filter(Boolean).join(', ')}`);
      filtered = filtered.filter(spell => {
        // Un sort est valide s'il appartient à au moins une des classes du joueur
        const hasClass = spell.classes.some(spellClass =>
          effectivePlayerClasses.some(playerCls =>
            playerCls && spellClass.toLowerCase() === playerCls.toLowerCase()
          )
        );
        if (hasClass) {
          console.log(`✅ Sort ${spell.name} correspond à l'une des classes`);
        }
        return hasClass;
      });
      console.log(`Après filtrage par classe: ${filtered.length} sorts`);

      // Debug: afficher quelques sorts qui correspondent
      if (filtered.length > 0) {
        console.log('Premiers sorts filtrés:', filtered.slice(0, 3).map(s =>
          `${s.name} (classes: ${s.classes.join(', ')})`
        ));
      }
    }

    // Filtrer par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(spell =>
        spell.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        spell.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrer par niveau
    if (selectedLevels.size > 0) {
      filtered = filtered.filter(spell => selectedLevels.has(spell.level));
    }

    // Filtrer par école
    if (selectedSchool) {
      filtered = filtered.filter(spell => spell.school === selectedSchool);
    }

    console.log(`=== RÉSULTAT FILTRAGE ===`);
    console.log(`Sorts affichés: ${filtered.length}`);
    if (filtered.length > 0) {
      console.log('Premiers sorts:', filtered.slice(0, 3).map(s => `${s.name} (niv.${s.level})`));
    }
    
    setFilteredSpells(filtered);
  }, [spells, searchTerm, selectedLevels, selectedSchool, effectivePlayerClasses, showAllClasses]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedLevels(new Set());
    setSelectedSchool('');
    setShowAllClasses(false);
  };

  const getComponentsText = (components: Spell['components']) => {
    const parts = [];
    if (components.V) parts.push('V');
    if (components.S) parts.push('S');
    if (components.M) parts.push(`M (${components.M})`);
    return parts.join(', ');
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] border border-gray-700/50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700/50 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Book className="w-6 h-6 text-blue-400" />
              <div>
                <h3 className="text-xl font-semibold text-gray-100">
                  Grimoire de sorts
                </h3>
                <p className="text-gray-400">
                  {!showAllClasses && effectivePlayerClasses.filter(Boolean).length > 0
                    ? `Sorts de ${effectivePlayerClasses.filter(Boolean).join(', ')}`
                    : 'Tous les sorts'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content - Single scrollable area */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Bouton de validation en mode sélection */}
            {selectionMode && selectedSpells.length > 0 && (
              <div className="sticky top-0 z-10 bg-gray-800/95 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-gray-100">
                        {selectedSpells.length} sort{selectedSpells.length > 1 ? 's' : ''} sélectionné{selectedSpells.length > 1 ? 's' : ''}
                      </h4>
                      {/* Noms retirés volontairement pour éviter la casse de layout */}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (onConfirm) {
                        onConfirm(selectedSpells);
                        onClose();
                      }
                    }}
                    className="shrink-0 min-w-[200px] sm:min-w-[220px] bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg flex items-center gap-2 justify-center"
                  >
                    <Check size={16} />
                    Valider la sélection
                  </button>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {/* Search */}
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

                {/* Level Filter */}
                <div className="relative">
                  <div className="input-dark px-3 py-2 rounded-lg cursor-pointer" onClick={() => {
                    const dropdown = document.getElementById('level-dropdown');
                    if (dropdown) {
                      dropdown.classList.toggle('hidden');
                    }
                  }}>
                    {selectedLevels.size === 0 ? 'Tous les niveaux' : 
                     selectedLevels.size === 1 ? 
                       (Array.from(selectedLevels)[0] === 0 ? 'Tours de magie' : `Niveau ${Array.from(selectedLevels)[0]}`) :
                       `${selectedLevels.size} niveaux sélectionnés`
                    }
                  </div>
                  <div id="level-dropdown" className="hidden absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {SPELL_LEVELS.map(level => (
                      <label key={level} className="flex items-center px-3 py-2 hover:bg-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedLevels.has(level)}
                          onChange={(e) => {
                            const newLevels = new Set(selectedLevels);
                            if (e.target.checked) {
                              newLevels.add(level);
                            } else {
                              newLevels.delete(level);
                            }
                            setSelectedLevels(newLevels);
                          }}
                          className="mr-2 text-purple-500 focus:ring-purple-500"
                        />
                        <span className="text-gray-300">
                          {level === 0 ? 'Tours de magie' : `Niveau ${level}`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* School Filter */}
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

                {/* Class Filter Toggle */}
                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAllClasses}
                      onChange={(e) => setShowAllClasses(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`relative w-12 h-6 rounded-full transition-colors ${
                      showAllClasses ? 'bg-blue-600' : 'bg-gray-600'
                    }`}>
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        showAllClasses ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </div>
                    <span className="ml-3 text-sm text-gray-300">
                      Toutes les classes
                    </span>
                  </label>
                </div>

                {/* Reset Filters */}
                <button
                  onClick={resetFilters}
                  className="btn-secondary px-4 py-2 rounded-lg flex items-center justify-center gap-2"
                >
                  <Filter size={16} />
                  Réinitialiser
                </button>
              </div>
            </div>
            
            {/* Spells list */}
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
              <div className="space-y-4">
                <div className="text-gray-400 mb-4 flex items-center justify-between">
                  <span>
                    {filteredSpells.length} sort{filteredSpells.length > 1 ? 's' : ''} trouvé{filteredSpells.length > 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    {!showAllClasses && effectivePlayerClasses.filter(Boolean).length > 0 && effectivePlayerClasses.filter(Boolean).map(cls => (
                      <span key={cls} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                        {cls}
                      </span>
                    ))}
                    {totalSpellsCount > 0 && (
                      <span className="text-xs text-gray-500">
                        sur {totalSpellsCount} total
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {filteredSpells.map((spell) => (
                    <div key={spell.id} className="relative border border-gray-600/50 bg-gray-800/30 rounded-lg overflow-hidden hover:bg-gray-700/30 transition-colors">
                      {selectionMode && (
                        <div className="absolute top-3 right-3 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSpellSelect?.(spell);
                            }}
                            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                              selectedSpells.find(s => s.id === spell.id)
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'border-gray-600 hover:border-blue-500'
                            }`}
                          >
                            {selectedSpells.find(s => s.id === spell.id) && (
                              <Check size={14} />
                            )}
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => setSelectedSpell(selectedSpell?.id === spell.id ? null : spell)}
                        className="w-full text-left p-3 pr-12 transition-all duration-200"
                      >
                        <div className="flex items-start justify-between mb-2 pr-2">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold text-base text-gray-100">{spell.name}</h4>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-xs bg-gray-700/50 px-2 py-1 rounded-full font-medium text-gray-300">
                              {spell.level === 0 ? 'Tour' : `Niv. ${spell.level}`}
                            </div>
                            <div className={`transform transition-transform duration-200 ${
                              selectedSpell?.id === spell.id ? 'rotate-180' : ''
                            }`}>
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-400 mb-2">
                          {spell.school} • {spell.casting_time} • {spell.range}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {spell.classes.slice(0, 4).map(className => (
                            <span
                              key={className}
                              className={`text-xs px-2 py-1 rounded-full ${
                                effectivePlayerClasses.some(playerCls => playerCls && className === playerCls)
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                  : 'bg-gray-700/50 text-gray-500'
                              }`}
                            >
                              {className}
                            </span>
                          ))}
                          {spell.classes.length > 4 && (
                            <span className="text-xs text-gray-500 px-2 py-1">
                              +{spell.classes.length - 4} autres
                            </span>
                          )}
                        </div>
                      </button>
                      
                      {/* Expanded Details */}
                      {selectedSpell?.id === spell.id && (
                        <div className="border-t border-gray-700/50 bg-gray-900/50 p-4 space-y-4">
                          {/* Casting Info Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-gray-800/50 p-2 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-gray-400">Temps</span>
                              </div>
                              <div className="text-sm text-gray-200 font-medium">{spell.casting_time}</div>
                            </div>
                            <div className="bg-gray-800/50 p-2 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-gray-400">Portée</span>
                              </div>
                              <div className="text-sm text-gray-200 font-medium">{spell.range}</div>
                            </div>
                            <div className="bg-gray-800/50 p-2 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-gray-400">Composantes</span>
                              </div>
                              <div className="text-sm text-gray-200 font-medium">{getComponentsText(spell.components)}</div>
                            </div>
                            <div className="bg-gray-800/50 p-2 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-gray-400">Durée</span>
                              </div>
                              <div className="text-sm text-gray-200 font-medium">{spell.duration}</div>
                            </div>
                          </div>

{/* Description + Higher Levels ensemble */}
<div className="bg-gray-800/30 p-3 rounded-lg">
  <h5 className="font-semibold text-gray-200 mb-2">Description</h5>
  <div className="text-gray-300 space-y-2">
    <MarkdownLite 
      text={spell.description || ''} 
      ctx={{}}
    />
    
    {spell.higher_levels && (
      <div className="mt-4">
        <MarkdownLite 
          text={
            spell.higher_levels.trim().startsWith('**') 
              ? spell.higher_levels 
              : `**Aux niveaux supérieurs :** ${spell.higher_levels}`
          } 
          ctx={{}}
        />
      </div>
    )}
  </div>
</div>

                          {/* All Classes */}
                          <div className="bg-gray-800/30 p-3 rounded-lg">
                            <h5 className="font-semibold text-gray-200 mb-2">Classes disponibles</h5>
                            <div className="flex flex-wrap gap-2">
                              {spell.classes.map((className, idx) => (
                                <span
                                  key={`${className}-${idx}`}
                                  className={`px-2 py-1 rounded-lg text-sm font-medium ${
                                    effectivePlayerClasses.some(playerCls =>
                                      playerCls && className.toLowerCase() === playerCls.toLowerCase()
                                    )
                                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                      : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                                  }`}
                                >
                                  {className}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {filteredSpells.length === 0 && !loading && (
                    <div className="text-center py-8">
                      <Book className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                      <p className="text-gray-400">
                        Aucun sort trouvé
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        Essayez de modifier vos filtres ou activez "Toutes les classes"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}