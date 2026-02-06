import { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { Dices } from 'lucide-react';
import { CampaignMember, CampaignInventoryItem } from '../../../types/campaign';
import { campaignService } from '../../../services/campaignService';
import { LOOT_TABLES, CURRENCY_AMOUNTS, GEM_AMOUNTS, LevelRange, Difficulty, EnemyCount } from '../../../data/lootTables';
import { META_PREFIX } from '../utils/metaParser';
import { useRecipientSelection } from '../hooks/useRecipientSelection';
import toast from 'react-hot-toast';

interface RandomLootModalProps {
  campaignId: string;
  members: CampaignMember[];
  inventory: CampaignInventoryItem[];
  onClose: () => void;
  onSent: () => void;
}

interface LootPreview {
  copper: number;
  silver: number;
  gold: number;
  equipment: Array<{ name: string; meta: any; description?: string }>;
  gems: Array<{ name: string; meta: any; description?: string }>;
}

export function RandomLootModal({ campaignId, members, inventory, onClose, onSent }: RandomLootModalProps) {
  const [levelRange, setLevelRange] = useState<LevelRange>('1-4');
  const [difficulty, setDifficulty] = useState<Difficulty>('facile');
  const [enemyCount, setEnemyCount] = useState<EnemyCount>('1');
  const [distributionMode, setDistributionMode] = useState<'individual' | 'shared'>('shared');
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [previewLoot, setPreviewLoot] = useState<LootPreview | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);

  const [customMode, setCustomMode] = useState(false);
  const [customProbs, setCustomProbs] = useState({ copper: 0, silver: 0, gold: 0, equipment: 0, gems: 0 });

  const {
    selectedRecipients,
    setSelectedRecipients,
    selectAllRecipients,
    setSelectAllRecipients,
    toggleRecipient,
  } = useRecipientSelection(members);

  const defaultProbs = LOOT_TABLES[levelRange][difficulty][enemyCount];
  const probs = customMode ? customProbs : defaultProbs;

  useEffect(() => {
    const loadCatalog = async () => {
      setLoadingCatalog(true);
      try {
        const { loadEquipmentCatalog } = await import('../../../services/equipmentCatalogService');
        const items = await loadEquipmentCatalog();
        setCatalog(items);
      } catch (error) {
        console.error('Erreur chargement catalogue:', error);
        toast.error('Erreur de chargement du catalogue d\'équipements');
      } finally {
        setLoadingCatalog(false);
      }
    };
    loadCatalog();
  }, []);

  useEffect(() => {
    if (!customMode) {
      const newDefaultProbs = LOOT_TABLES[levelRange][difficulty][enemyCount];
      setCustomProbs(newDefaultProbs);
    }
  }, [levelRange, difficulty, enemyCount, customMode]);

  const updateProbability = (key: keyof typeof customProbs, value: number) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    setCustomProbs(prev => ({ ...prev, [key]: clampedValue }));
  };

  const totalProb = customProbs.copper + customProbs.silver + customProbs.gold + customProbs.equipment + customProbs.gems;
  const probsValid = totalProb === 100;

  const getRandomEquipmentFromCatalog = () => {
    if (catalog.length === 0) return null;
    let types: any[] = [];
    if (levelRange === '1-4') types = ['weapons', 'adventuring_gear', 'tools'];
    else if (levelRange === '5-10') types = ['weapons', 'armors', 'shields', 'adventuring_gear'];
    else if (levelRange === '11-16') types = ['weapons', 'armors', 'shields', 'adventuring_gear', 'tools'];
    else types = ['weapons', 'armors', 'shields'];

    const filtered = catalog.filter(item => types.includes(item.kind));
    if (filtered.length === 0) return null;
    return filtered[Math.floor(Math.random() * filtered.length)];
  };

  const generateLoot = (): LootPreview => {
    const actualProbs = probs;
    const currencyRanges = CURRENCY_AMOUNTS[levelRange];
    const gemRange = GEM_AMOUNTS[levelRange];

    let copper = 0, silver = 0, gold = 0;
    const equipment: LootPreview['equipment'] = [];
    const gems: LootPreview['gems'] = [];

    const roll = Math.random() * 100;

    if (roll < actualProbs.copper) {
      copper = Math.floor(Math.random() * (currencyRanges.copper.max - currencyRanges.copper.min + 1) + currencyRanges.copper.min);
    } else if (roll < actualProbs.copper + actualProbs.silver) {
      silver = Math.floor(Math.random() * (currencyRanges.silver.max - currencyRanges.silver.min + 1) + currencyRanges.silver.min);
    } else if (roll < actualProbs.copper + actualProbs.silver + actualProbs.gold) {
      gold = Math.floor(Math.random() * (currencyRanges.gold.max - currencyRanges.gold.min + 1) + currencyRanges.gold.min);
    } else if (roll < actualProbs.copper + actualProbs.silver + actualProbs.gold + actualProbs.equipment) {
      const numItems =
        levelRange === '1-4' ? 1 :
        levelRange === '5-10' ? (Math.random() < 0.5 ? 1 : 2) :
        levelRange === '11-16' ? (Math.random() < 0.3 ? 1 : Math.random() < 0.7 ? 2 : 3) :
        (Math.random() < 0.2 ? 1 : Math.random() < 0.6 ? 2 : 3);

      for (let i = 0; i < numItems; i++) {
        const item = getRandomEquipmentFromCatalog();
        if (item) {
          let meta: any = { type: 'equipment', quantity: 1, equipped: false };
          if (item.kind === 'armors' && item.armor) meta = { type: 'armor', quantity: 1, equipped: false, armor: item.armor };
          else if (item.kind === 'shields' && item.shield) meta = { type: 'shield', quantity: 1, equipped: false, shield: item.shield };
          else if (item.kind === 'weapons' && item.weapon) meta = { type: 'weapon', quantity: 1, equipped: false, weapon: item.weapon };
          else if (item.kind === 'tools') meta = { type: 'tool', quantity: 1, equipped: false };
          equipment.push({ name: item.name, meta, description: item.description || '' });
        }
      }
    } else {
      const numGems = Math.floor(Math.random() * (gemRange.max - gemRange.min + 1) + gemRange.min);
      const gemItems = catalog.filter(item => item.kind === 'gems');
      if (gemItems.length > 0) {
        for (let i = 0; i < numGems; i++) {
          const randomGem = gemItems[Math.floor(Math.random() * gemItems.length)];
          gems.push({ name: randomGem.name, meta: { type: 'jewelry', quantity: 1, equipped: false }, description: randomGem.description || '' });
        }
      }
    }

    return { copper, silver, gold, equipment, gems };
  };

  const handlePreview = () => {
    if (loadingCatalog) { toast.error('Chargement du catalogue en cours...'); return; }
    setPreviewLoot(generateLoot());
  };

  const handleSend = async () => {
    if (distributionMode === 'individual' && selectedRecipients.length === 0) {
      toast.error('Sélectionnez au moins un destinataire');
      return;
    }
    if (!previewLoot) { toast.error('Générez d\'abord le loot'); return; }

    try {
      setGenerating(true);
      const recipientIds = distributionMode === 'individual' ? selectedRecipients : null;

      if (previewLoot.copper > 0 || previewLoot.silver > 0 || previewLoot.gold > 0) {
        await campaignService.sendGift(campaignId, 'currency', {
          gold: previewLoot.gold, silver: previewLoot.silver, copper: previewLoot.copper,
          distributionMode,
          message: message.trim() || `Loot aléatoire (Niveau ${levelRange}, ${difficulty}, ${enemyCount} ennemi${enemyCount === '1' ? '' : 's'})`,
          recipientIds: recipientIds || undefined,
        });
      }

      for (const equip of previewLoot.equipment) {
        const metaLine = `${META_PREFIX}${JSON.stringify(equip.meta)}`;
        const visibleDesc = (equip.description || '').trim();
        const fullDescription = visibleDesc ? `${visibleDesc}\n${metaLine}` : metaLine;
        await campaignService.sendGift(campaignId, 'item', {
          itemName: equip.name, itemDescription: fullDescription, itemQuantity: 1,
          gold: 0, silver: 0, copper: 0, distributionMode,
          message: message.trim() || `Loot aléatoire (Niveau ${levelRange}, ${difficulty})`,
          recipientIds: recipientIds || undefined,
        });
      }

      if (previewLoot.gems && previewLoot.gems.length > 0) {
        for (const gem of previewLoot.gems) {
          const metaLine = `${META_PREFIX}${JSON.stringify(gem.meta)}`;
          const visibleDesc = (gem.description || '').trim();
          const fullDescription = visibleDesc ? `${visibleDesc}\n${metaLine}` : metaLine;
          await campaignService.sendGift(campaignId, 'item', {
            itemName: gem.name, itemDescription: fullDescription, itemQuantity: 1,
            gold: 0, silver: 0, copper: 0, distributionMode,
            message: message.trim() || `Loot aléatoire - Pierre précieuse (Niveau ${levelRange}, ${difficulty})`,
            recipientIds: recipientIds || undefined,
          });
        }
      }

      toast.success('Loot aléatoire envoyé !');
      onSent();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(40rem,95vw)] max-h-[90vh] overflow-y-auto bg-gray-900/95 border border-gray-700 rounded-xl p-6">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
              <Dices className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Loot Aléatoire</h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {loadingCatalog && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400" />
              <p className="text-sm text-blue-200">Chargement du catalogue d'équipements...</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="bg-gray-800/30 rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Paramètres de la rencontre</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Niveau de la rencontre</label>
                <select value={levelRange} onChange={(e) => setLevelRange(e.target.value as LevelRange)} className="input-dark w-full px-3 py-2 rounded-lg text-sm" disabled={customMode}>
                  <option value="1-4">Niveau 1-4</option>
                  <option value="5-10">Niveau 5-10</option>
                  <option value="11-16">Niveau 11-16</option>
                  <option value="17-20">Niveau 17-20</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Difficulté</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="input-dark w-full px-3 py-2 rounded-lg text-sm" disabled={customMode}>
                  <option value="facile">Facile</option>
                  <option value="modérée">Modérée</option>
                  <option value="difficile">Difficile</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Nombre d'ennemis</label>
                <select value={enemyCount} onChange={(e) => setEnemyCount(e.target.value as EnemyCount)} className="input-dark w-full px-3 py-2 rounded-lg text-sm" disabled={customMode}>
                  <option value="1">1 ennemi</option>
                  <option value="2-4">2-4 ennemis</option>
                  <option value="5-10">5-10 ennemis</option>
                  <option value="11+">11+ ennemis</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between bg-gray-900/40 rounded p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300">Mode personnalisé</span>
                <span className="text-xs text-gray-500">(Modifier les probabilités manuellement)</span>
              </div>
              <button
                onClick={() => setCustomMode(!customMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${customMode ? 'bg-purple-600' : 'bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${customMode ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {customMode && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-medium text-purple-300">Personnaliser les probabilités</h5>
                  <div className={`text-xs font-medium px-2 py-1 rounded ${probsValid ? 'bg-green-900/30 text-green-300 border border-green-500/30' : 'bg-red-900/30 text-red-300 border border-red-500/30'}`}>
                    Total: {totalProb}%
                  </div>
                </div>

                {!probsValid && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded p-2 text-xs text-red-300">
                    Le total doit être exactement 100%
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {([['copper', 'Cuivre'], ['silver', 'Argent'], ['gold', 'Or'], ['equipment', 'Équipement'], ['gems', 'Gemmes']] as const).map(([key, label]) => (
                    <div key={key} className={key === 'gems' ? 'md:col-span-2' : ''}>
                      <label className="block text-xs text-gray-400 mb-1">{label} (%)</label>
                      <input
                        type="number" min="0" max="100"
                        value={customProbs[key]}
                        onChange={(e) => updateProbability(key, parseInt(e.target.value) || 0)}
                        className="input-dark w-full px-3 py-2 rounded-md text-sm"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setCustomProbs(defaultProbs)}
                  className="w-full text-xs text-gray-400 hover:text-white transition-colors py-2 border border-gray-700 rounded hover:bg-gray-700/30"
                >
                  Réinitialiser aux valeurs par défaut
                </button>
              </div>
            )}

            <div className="bg-gray-900/40 rounded p-3 text-xs text-gray-400">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-gray-300">
                  {customMode ? 'Probabilités personnalisées :' : 'Probabilités par défaut :'}
                </div>
                {customMode && probsValid && (
                  <div className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded border border-purple-500/30">Personnalisées</div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div className={customMode && probs.copper !== defaultProbs.copper ? 'text-purple-300 font-semibold' : ''}>Cuivre: {probs.copper}%</div>
                <div className={customMode && probs.silver !== defaultProbs.silver ? 'text-purple-300 font-semibold' : ''}>Argent: {probs.silver}%</div>
                <div className={customMode && probs.gold !== defaultProbs.gold ? 'text-purple-300 font-semibold' : ''}>Or: {probs.gold}%</div>
                <div className={customMode && probs.equipment !== defaultProbs.equipment ? 'text-purple-300 font-semibold' : ''}>Équipement: {probs.equipment}%</div>
                <div className={customMode && probs.gems !== defaultProbs.gems ? 'text-purple-300 font-semibold' : ''}>Gemmes: {probs.gems}%</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePreview}
                disabled={loadingCatalog || (customMode && !probsValid)}
                className="flex-1 btn-primary px-4 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Dices size={18} />
                {loadingCatalog ? 'Chargement...' : 'Générer le loot'}
              </button>

              {customMode && (
                <button
                  onClick={() => toast.success(`Probabilités ${probsValid ? 'valides' : 'invalides'} (${totalProb}%)`)}
                  className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm"
                  title="Tester les probabilités"
                >
                  Test
                </button>
              )}
            </div>
          </div>

          {previewLoot && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-300 mb-3">Loot généré :</h4>
              <div className="space-y-2">
                {(previewLoot.gold > 0 || previewLoot.silver > 0 || previewLoot.copper > 0) && (
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    {previewLoot.gold > 0 && <span className="text-yellow-400 font-semibold">{previewLoot.gold} or</span>}
                    {previewLoot.silver > 0 && <span className="text-gray-300 font-semibold">{previewLoot.silver} argent</span>}
                    {previewLoot.copper > 0 && <span className="text-orange-400 font-semibold">{previewLoot.copper} cuivre</span>}
                  </div>
                )}
                {previewLoot.equipment.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Équipements :</div>
                    {previewLoot.equipment.map((eq, idx) => (
                      <div key={idx} className="text-sm text-purple-300 flex items-center gap-2">
                        <span className="font-medium">{eq.name}</span>
                        {eq.meta.type === 'weapon' && eq.meta.weapon && (
                          <span className="text-xs text-gray-400">({eq.meta.weapon.damageDice} {eq.meta.weapon.damageType})</span>
                        )}
                        {eq.meta.type === 'armor' && eq.meta.armor && (
                          <span className="text-xs text-gray-400">(CA {eq.meta.armor.label})</span>
                        )}
                        {eq.meta.type === 'shield' && eq.meta.shield && (
                          <span className="text-xs text-gray-400">(+{eq.meta.shield.bonus} CA)</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {previewLoot.gems && previewLoot.gems.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Pierres précieuses :</div>
                    {previewLoot.gems.map((gem, idx) => (
                      <div key={idx} className="text-sm text-pink-300 flex items-center gap-2">
                        <span className="font-medium">{gem.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {previewLoot.copper === 0 && previewLoot.silver === 0 && previewLoot.gold === 0 &&
                 previewLoot.equipment.length === 0 && (!previewLoot.gems || previewLoot.gems.length === 0) && (
                  <div className="text-sm text-gray-500">Aucun loot généré cette fois-ci</div>
                )}
              </div>
            </div>
          )}

          {previewLoot && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mode de distribution</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setDistributionMode('individual'); setSelectAllRecipients(false); setSelectedRecipients([]); }}
                    className={`p-4 rounded-lg border-2 transition-colors ${distributionMode === 'individual' ? 'border-purple-500 bg-purple-900/20 text-white' : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:bg-gray-700/40'}`}
                  >
                    <div className="font-semibold mb-1">Individuel</div>
                    <div className="text-xs opacity-80">Envoyer à des destinataires spécifiques</div>
                  </button>
                  <button
                    onClick={() => { setDistributionMode('shared'); setSelectAllRecipients(false); setSelectedRecipients([]); }}
                    className={`p-4 rounded-lg border-2 transition-colors ${distributionMode === 'shared' ? 'border-purple-500 bg-purple-900/20 text-white' : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:bg-gray-700/40'}`}
                  >
                    <div className="font-semibold mb-1">Partagé</div>
                    <div className="text-xs opacity-80">Visible à tous</div>
                  </button>
                </div>
              </div>

              {distributionMode === 'individual' && (
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-300">Destinataires</div>
                    <label className="text-xs text-gray-400 inline-flex items-center gap-2">
                      <input type="checkbox" checked={selectAllRecipients} onChange={(e) => setSelectAllRecipients(e.target.checked)} />
                      <span>Tous</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {members.map((m) => {
                      const uid = m.user_id;
                      if (!uid) return null;
                      return (
                        <label key={uid} className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={selectedRecipients.includes(uid)} onChange={() => toggleRecipient(uid)} />
                          <span className="ml-1">{m.player_name || m.email}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Message (optionnel)</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="input-dark w-full px-4 py-2 rounded-lg" rows={2} placeholder="Ajoutez un message pour les joueurs..." />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} disabled={generating} className="btn-secondary px-6 py-3 rounded-lg">Annuler</button>
          {previewLoot && (
            <button
              onClick={handleSend}
              disabled={generating || (distributionMode === 'individual' && selectedRecipients.length === 0)}
              className="btn-primary px-6 py-3 rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Envoyer le loot
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
