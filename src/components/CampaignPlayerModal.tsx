import React, { useEffect, useState } from 'react';
import { X, Gift, Users, Check, Package, Coins, AlertCircle } from 'lucide-react';
import { Player } from '../types/dnd';
import { supabase } from '../lib/supabase';
import { campaignService } from '../services/campaignService';
import {
  CampaignInvitation,
  CampaignGift,
  CampaignMember,
  Campaign
} from '../types/campaign';
import toast from 'react-hot-toast';

// Cache claims simple (TTL 30s) — au niveau module
const CLAIMS_TTL = 30_000;
const claimsCache = new Map<string, { ts: number; list: any[] }>();

async function getClaimsCached(
  giftId: string,
  fetcher: (id: string) => Promise<any[]>
) {
  const cached = claimsCache.get(giftId);
  const now = Date.now();
  if (cached && now - cached.ts < CLAIMS_TTL) {
    return cached.list;
  }
  const list = await fetcher(giftId);
  claimsCache.set(giftId, { ts: now, list });
  return list;
}

// =============================================
// Modal de distribution équitable d'argent
// =============================================
interface DistributionModalProps {
  gift: CampaignGift;
  campaignMembers: CampaignMember[];
  currentUserId: string;
  playerId: string;
  currentPlayer: Player;
  onClose: () => void;
  onDistribute: (distribution: { userId: string; playerId: string; gold: number; silver: number; copper: number }[]) => Promise<void>;
}

function CurrencyDistributionModal({
  gift,
  campaignMembers,
  currentUserId,
  playerId,
  currentPlayer,
  onClose,
  onDistribute
}: DistributionModalProps) {
  const [distributing, setDistributing] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    campaignMembers.map(m => m.user_id)
  );

  const calculateDistribution = () => {
    if (selectedMembers.length === 0) return [];

    const totalGold = gift.gold || 0;
    const totalSilver = gift.silver || 0;
    const totalCopper = gift.copper || 0;

    const numMembers = selectedMembers.length;

    const goldPerPerson = Math.floor(totalGold / numMembers);
    const silverPerPerson = Math.floor(totalSilver / numMembers);
    const copperPerPerson = Math.floor(totalCopper / numMembers);

    const remainingGold = totalGold % numMembers;
    const remainingSilver = totalSilver % numMembers;
    const remainingCopper = totalCopper % numMembers;

    const distribution = selectedMembers.map((userId, index) => {
      const member = campaignMembers.find(m => m.user_id === userId);
      return {
        userId,
        playerId: member?.player_id || '',
        gold: goldPerPerson + (index === 0 ? remainingGold : 0),
        silver: silverPerPerson + (index === 0 ? remainingSilver : 0),
        copper: copperPerPerson + (index === 0 ? remainingCopper : 0),
      };
    });

    return distribution;
  };

  const distribution = calculateDistribution();
  const myShare = distribution.find(d => d.userId === currentUserId);

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleDistribute = async () => {
    if (distribution.length === 0) {
      toast.error('Sélectionnez au moins un membre');
      return;
    }

    try {
      setDistributing(true);
      await onDistribute(distribution);
      toast.success('Argent distribué avec succès !');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la distribution');
    } finally {
      setDistributing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[12000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(36rem,95vw)] max-h-[85vh] overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
        <div className="sticky top-0 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <Coins className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Distribution équitable</h3>
                <p className="text-sm text-gray-400">Répartir l'argent entre les joueurs</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Montant total */}
          <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-200 mb-3">💰 Montant total à distribuer</h4>
            <div className="flex items-center justify-center gap-6 text-lg">
              {gift.gold > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-yellow-400">{gift.gold}</span>
                  <span className="text-yellow-300 text-sm">po</span>
                </div>
              )}
              {gift.silver > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-300">{gift.silver}</span>
                  <span className="text-gray-400 text-sm">pa</span>
                </div>
              )}
              {gift.copper > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-orange-400">{gift.copper}</span>
                  <span className="text-orange-300 text-sm">pc</span>
                </div>
              )}
            </div>
          </div>

          {/* Sélection des membres */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-300">Joueurs participants ({selectedMembers.length})</h4>
              <button
                onClick={() => {
                  if (selectedMembers.length === campaignMembers.length) {
                    setSelectedMembers([]);
                  } else {
                    setSelectedMembers(campaignMembers.map(m => m.user_id));
                  }
                }}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                {selectedMembers.length === campaignMembers.length ? 'Désélectionner tout' : 'Sélectionner tout'}
              </button>
            </div>

            <div className="space-y-2">
              {campaignMembers.map((member) => {
                const isSelected = selectedMembers.includes(member.user_id);
                const memberShare = distribution.find(d => d.userId === member.user_id);

                return (
                  <label
                    key={member.user_id}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-900/30 border-purple-500/50 hover:bg-purple-900/40'
                        : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMember(member.user_id)}
                        className="w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-900"
                      />
                      <div>
                        <p className="font-medium text-white">
                          {member.player_name || member.email}
                          {member.user_id === currentUserId && (
                            <span className="ml-2 text-xs text-purple-400">(Vous)</span>
                          )}
                        </p>
                        {isSelected && memberShare && (
                          <div className="flex gap-3 mt-1 text-xs">
                            {memberShare.gold > 0 && (
                              <span className="text-yellow-400">{memberShare.gold} po</span>
                            )}
                            {memberShare.silver > 0 && (
                              <span className="text-gray-400">{memberShare.silver} pa</span>
                            )}
                            {memberShare.copper > 0 && (
                              <span className="text-orange-400">{memberShare.copper} pc</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected && memberShare && distribution[0]?.userId === member.user_id && (
                      <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded border border-green-500/30">
                        + surplus
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Résumé de ma part */}
          {myShare && selectedMembers.includes(currentUserId) && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-blue-200 mb-1">Votre part</h4>
                  <div className="flex gap-4 text-sm">
                    {myShare.gold > 0 && (
                      <span className="text-yellow-300 font-medium">{myShare.gold} po</span>
                    )}
                    {myShare.silver > 0 && (
                      <span className="text-gray-300 font-medium">{myShare.silver} pa</span>
                    )}
                    {myShare.copper > 0 && (
                      <span className="text-orange-300 font-medium">{myShare.copper} pc</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info surplus */}
          {selectedMembers.length > 0 && (
            <div className="bg-gray-800/40 rounded-lg p-3 text-xs text-gray-400">
              <p>
                💡 <strong className="text-gray-300">Astuce :</strong> S'il y a un reste non divisible, 
                {' '}<strong className="text-purple-400">{campaignMembers.find(m => m.user_id === distribution[0]?.userId)?.player_name || 'le premier joueur'}</strong>
                {' '}recevra le surplus.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 px-6 py-4">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={distributing}
              className="btn-secondary px-6 py-3 rounded-lg"
            >
              Annuler
            </button>
            <button
              onClick={handleDistribute}
              disabled={distributing || selectedMembers.length === 0}
              className="btn-primary px-6 py-3 rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {distributing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Distribution...
                </>
              ) : (
                <>
                  <Coins size={18} />
                  Partager l'argent
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// Composant principal CampaignPlayerModal
// =============================================
const META_PREFIX = '#meta:';

interface CampaignPlayerModalProps {
  open: boolean;
  onClose: () => void;
  player: Player;
  onUpdate: (player: Player) => void;
}

export function CampaignPlayerModal({
  open,
  onClose,
  player,
  onUpdate
}: CampaignPlayerModalProps) {
  
  // =============================================
  // ÉTATS DU COMPOSANT
  // =============================================

  // États principaux
  const [invitations, setInvitations] = useState<CampaignInvitation[]>([]);
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<Campaign[]>([]);
  const [pendingGifts, setPendingGifts] = useState<CampaignGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'invitations' | 'gifts' | 'notes'>('gifts');

  // États pour les invitations simplifiées
  const [processingInvitation, setProcessingInvitation] = useState<string | null>(null);

  // États pour la distribution d'argent
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [selectedGiftForDistribution, setSelectedGiftForDistribution] = useState<CampaignGift | null>(null);
  const [campaignMembersForDistribution, setCampaignMembersForDistribution] = useState<CampaignMember[]>([]);
  const [membersByCampaign, setMembersByCampaign] = useState<Record<string, CampaignMember[]>>({});

  // État pour empêcher les double-clics lors du claim
  const [claiming, setClaiming] = useState(false);
  const [selectedGiftIds, setSelectedGiftIds] = useState<string[]>([]);
  // Notes (onglet)
const [notesJournal, setNotesJournal] = useState('');
const [notesNPCs, setNotesNPCs] = useState('');
const [notesQuests, setNotesQuests] = useState('');
const [savingNotes, setSavingNotes] = useState(false);
  // Cache in-memory des notes pour affichage instantané
const notesCacheRef = React.useRef<{ journal: string; npcs: string; quests: string } | null>(null);

// Pré-hydrate depuis localStorage dès que le player change (sync, pas d'attente)
useEffect(() => {
  try {
    const raw = localStorage.getItem(LS_NOTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const journal = parsed.journal || '';
      const npcs = parsed.npcs || '';
      const quests = parsed.quests || '';
      setNotesJournal(journal);
      setNotesNPCs(npcs);
      setNotesQuests(quests);
      notesCacheRef.current = { journal, npcs, quests };
    }
  } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [player.id]);

// Prefetch silencieux dès l'ouverture du modal (même si onglet non "notes")
useEffect(() => {
  if (open) {
    // ne bloque pas l'UI; si déjà hydraté, ça ne flashera pas
    loadNotes();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open]);
 const [currentUserId, setCurrentUserId] = useState('');

  const getVisibleDescription = (description: string | null | undefined): string => {
    if (!description) return '';
    return description
      .split('\n')
      .filter(line => !line.trim().startsWith(META_PREFIX))
      .join('\n')
      .trim();
  };
  
  const parseMeta = (description: string | null | undefined) => {
    if (!description) return null;
    const lines = description.split('\n').map(l => l.trim());
    const metaLine = [...lines].reverse().find(l => l.startsWith(META_PREFIX));
    if (!metaLine) return null;
    try {
      return JSON.parse(metaLine.slice(META_PREFIX.length));
    } catch {
      return null;
    }
  };
// ✅ AJOUTE CES FONCTIONS ICI
const toggleGiftSelection = (giftId: string) => {
  setSelectedGiftIds(prev => 
    prev.includes(giftId) 
      ? prev.filter(id => id !== giftId)
      : [...prev, giftId]
  );
};

const handleClaimMultiple = async () => {
  if (claiming || selectedGiftIds.length === 0) return;

  try {
    setClaiming(true);
    
    const giftsToProcess = pendingGifts.filter(g => selectedGiftIds.includes(g.id));
    
    for (const gift of giftsToProcess) {
      await handleClaimGift(gift);
    }
    
    setSelectedGiftIds([]);
    toast.success(`${giftsToProcess.length} loot${giftsToProcess.length > 1 ? 's' : ''} récupéré${giftsToProcess.length > 1 ? 's' : ''} !`);
    
    setTimeout(() => {
      onClose();
    }, 1000);
  } catch (error) {
    console.error('Erreur claim multiple:', error);
    toast.error('Erreur lors de la récupération');
  } finally {
    setClaiming(false);
  }
};
  


  const loadCampaignMembers = async (campaignId: string) => {
    try {
      const members = await campaignService.getCampaignMembers(campaignId);
      return members;
    } catch (error) {
      console.error('Erreur chargement membres:', error);
      return [];
    }
  };

const loadData = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // 0) Afficher instantanément le cache si présent (SWR)
    const cacheKey = `campaign_modal_${user.id}`;
    const cached = readCache(cacheKey);
    if (cached) {
      setInvitations(cached.invitations);
      setMyCampaigns(cached.myCampaigns);
      setActiveCampaigns(cached.activeCampaigns);
      setMembersByCampaign(cached.membersByCampaign);
      setPendingGifts(cached.pendingGifts);
      // Pas de spinner si cache dispo
      setLoading(false);
    } else {
      // Spinner seulement si pas de cache
      setLoading(true);
    }

    // 1) Logs debug identiques (préservent ton workflow)
    console.log('🎯 DEBUG LOAD DATA:');
    console.log('- user.id:', user.id);
    console.log('- player.id:', player.id);

    // 2) Invitations (en parallèle du reste)
    const invitesPromise = campaignService.getMyPendingInvitations();

    // 3) Memberships actifs
    const { data: members, error: membershipError } = await supabase
      .from('campaign_members')
      .select('campaign_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    console.log('🏕️ QUERY campaign_members:');
    console.log('  - Error:', membershipError);
    console.log('  - Data brut:', members);
    console.log('  - Nombre de memberships:', members?.length || 0);

    let myCamps: Campaign[] = [];
    let membersMap: Record<string, CampaignMember[]> = {};
    let giftsFiltered: CampaignGift[] = [];

    if (members && members.length > 0) {
      // 4) Déduplique les ids
      const campaignIds = Array.from(new Set(members.map(m => m.campaign_id)));
      console.log('  - Campaign IDs:', campaignIds);

      // 5) Campagnes (garde select('*') pour le badge/colonnes UI)
      const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .in('id', campaignIds);

      console.log('📋 CAMPAIGNS CHARGÉES:', campaigns);
      console.log('❌ CAMPAIGNS ERROR:', campaignError);

      myCamps = campaigns || [];
      setMyCampaigns(myCamps);
      setActiveCampaigns(myCamps); // Necessaire au badge “Active”

      // 6) Membres par campagne (garde ton service pour cohérence UI)
      const map: Record<string, CampaignMember[]> = {};
      await Promise.all(
        campaignIds.map(async (campaignId) => {
          const cm = await loadCampaignMembers(campaignId);
          map[campaignId] = cm;
        })
      );
      membersMap = map;
      setMembersByCampaign(membersMap);

      // 7) Gifts en attente (identique à ton code)
      const { data: gifts } = await supabase
        .from('campaign_gifts')
        .select('*')
        .in('campaign_id', campaignIds)
        .eq('status', 'pending')
        .order('sent_at', { ascending: false });

      console.log('📦 GIFTS BRUTS (avant filtrage):', gifts);

      const filteredGifts = (gifts || []).filter((gift) => {
        console.log(`  → Gift "${gift.item_name || 'Argent'}":`, {
          distribution_mode: gift.distribution_mode,
          recipient_ids: gift.recipient_ids,
          match_shared: gift.distribution_mode === 'shared',
          match_individual: gift.distribution_mode === 'individual' && gift.recipient_ids?.includes(user.id)
        });

        if (gift.distribution_mode === 'shared') return true;
        if (gift.distribution_mode === 'individual' && gift.recipient_ids) {
          return gift.recipient_ids.includes(user.id);
        }
        return false;
      });

      console.log('📦 GIFTS FILTRÉS:', filteredGifts);

      // 8) Claims — conserve la version service (fiable, zéro régression)
      const giftsWithClaims = await Promise.all(
        filteredGifts.map(async (gift) => {
          const claims = await campaignService.getGiftClaims(gift.id);
          const alreadyClaimed = claims.some(c => c.user_id === user.id);
          return { gift, alreadyClaimed };
        })
      );

      giftsFiltered = giftsWithClaims
        .filter(g => !g.alreadyClaimed)
        .map(g => g.gift);

      setPendingGifts(giftsFiltered); 
    } else {
      // Pas de memberships: si pas de cache, nettoie l’état
      if (!cached) {
        setMyCampaigns([]);
        setActiveCampaigns([]);
        setMembersByCampaign({});
        setPendingGifts([]);
      }
    }

    // 9) Invitations (récupération puis set)
    const invites = await invitesPromise;
    setInvitations(invites);

    // 10) Écrit le cache (toujours à la fin)
    writeCache(cacheKey, {
      invitations: invites,
      myCampaigns: myCamps,
      activeCampaigns: myCamps,
      membersByCampaign: membersMap,
      pendingGifts: giftsFiltered,
    });
  } catch (error) {
    console.error('Erreur chargement campagnes:', error);
    toast.error('Erreur lors du chargement');
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
  (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || '');
  })();
}, []);
  
  useEffect(() => {
  if (open) {
    loadData();
  }
}, [open]);
   

// ===== Client cache (stale-while-revalidate) — non invasif =====
// ===== Client cache (stale-while-revalidate) — non invasif =====
const CACHE_TTL = 30_000; // 30s (ajuste si besoin)

type CampaignModalCache = {
  invitations: CampaignInvitation[];
  myCampaigns: Campaign[];
  activeCampaigns: Campaign[];
  membersByCampaign: Record<string, CampaignMember[]>;
  pendingGifts: CampaignGift[];
  ts: number;
};

function readCache(key: string): CampaignModalCache | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CampaignModalCache;
    if (!parsed.ts || Date.now() - parsed.ts > CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: Omit<CampaignModalCache, 'ts'>) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...data, ts: Date.now() }));
  } catch {}
}

// Helpers Notes
const LS_NOTES_KEY = `campaign_notes_${player.id}`;

const loadNotes = async () => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('id, notes_json')
      .eq('id', player.id)
      .single();

    if (error) {
      console.error('[Notes] SELECT error:', error);
      throw error;
    }

    const notes = data?.notes_json || {};
    const journal = typeof notes.journal === 'string' ? notes.journal : '';
    const npcs = typeof notes.npcs === 'string' ? notes.npcs : '';
    const quests = typeof notes.quests === 'string' ? notes.quests : '';

// ... après setNotesJournal/NPcs/Quests (succès BDD)
setNotesJournal(journal);
setNotesNPCs(npcs);
setNotesQuests(quests);

// aligne le cache mémoire et local
notesCacheRef.current = { journal, npcs, quests };
try {
  localStorage.setItem(LS_NOTES_KEY, JSON.stringify({ journal, npcs, quests }));
} catch {}
  } catch (err) {
    console.warn('[Notes] BDD indisponible, fallback localStorage.', err);
    try {
      const raw = localStorage.getItem(LS_NOTES_KEY);
      if (raw) {
       const parsed = JSON.parse(raw);
const journal = parsed.journal || '';
const npcs = parsed.npcs || '';
const quests = parsed.quests || '';

setNotesJournal(journal);
setNotesNPCs(npcs);
setNotesQuests(quests);
notesCacheRef.current = { journal, npcs, quests };
      } else {
        // Ne pas écraser l'état avec des vides si rien en cache
      }
    } catch (e) {
      console.error('[Notes] Fallback localStorage erreur:', e);
      // Ne rien écraser
    }
  }
};

const saveNotes = async () => {
  if (savingNotes) return;
  setSavingNotes(true);

  const payload = {
    journal: notesJournal,
    npcs: notesNPCs,
    quests: notesQuests,
    updated_at: new Date().toISOString(),
  };

  try {
    console.log('[Notes] Save start', { playerId: player.id, payload });
    const { data, error } = await supabase
      .from('players')
      .update({ notes_json: payload })
      .eq('id', player.id)
      .select('id, notes_json')
      .single();

    if (error) {
      console.error('[Notes] Supabase update error:', error);
      throw error;
    }

    // Mets à jour le cache local pour un affichage immédiat en fallback
    try {
      localStorage.setItem(`campaign_notes_${player.id}`, JSON.stringify({
        journal: payload.journal,
        npcs: payload.npcs,
        quests: payload.quests,
      }));
    } catch {}

    console.log('[Notes] Save OK, returned:', data);
    toast.success('Notes sauvegardées');
  } catch (e: any) {
    console.error('[Notes] Save failed, fallback localStorage. Reason:', e?.message || e);
    try {
      localStorage.setItem(`campaign_notes_${player.id}`, JSON.stringify({
        journal: payload.journal,
        npcs: payload.npcs,
        quests: payload.quests,
      }));
      toast.success('Notes sauvegardées (localement)');
    } catch {
      toast.error('Impossible de sauvegarder les notes');
    }
  } finally {
    setSavingNotes(false);
  }
};
 
 

  
  const handleDistributeCurrency = async (distribution: { userId: string; playerId: string; gold: number; silver: number; copper: number }[]) => {


 
    
    if (!selectedGiftForDistribution) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const myShare = distribution.find(d => d.userId === user.id);
      if (!myShare) {
        throw new Error('Votre part n\'a pas été trouvée');
      }

      const { error: updateError } = await supabase
        .from('players')
        .update({
          gold: (player.gold || 0) + myShare.gold,
          silver: (player.silver || 0) + myShare.silver,
          copper: (player.copper || 0) + myShare.copper,
        })
        .eq('id', player.id);

      if (updateError) throw updateError;

      await campaignService.claimGift(selectedGiftForDistribution.id, player.id, {
        gold: myShare.gold,
        silver: myShare.silver,
        copper: myShare.copper,
      });

      onUpdate({
        ...player,
        gold: (player.gold || 0) + myShare.gold,
        silver: (player.silver || 0) + myShare.silver,
        copper: (player.copper || 0) + myShare.copper,
      });

      setShowDistributionModal(false);
      setSelectedGiftForDistribution(null);
      
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (error) {
      console.error('Erreur distribution:', error);
      throw error;
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    if (!confirm('Refuser cette invitation ?')) return;
    
    try {
      await campaignService.declineInvitation(invitationId);
      toast.success('Invitation refusée');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erreur');
    }
  };

  const handleClaimGift = async (gift: CampaignGift) => {
    if (claiming) {
      console.log('⏳ Claim déjà en cours, ignoré');
      return;
    }

    try {
      setClaiming(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🎁 Claiming gift:', gift);

      if (gift.gift_type === 'item') {
        let originalMeta = null;
        
        if (gift.item_description) {
          const lines = gift.item_description.split('\n');
          const metaLine = lines.find(l => l.trim().startsWith(META_PREFIX));
          if (metaLine) {
            try {
              originalMeta = JSON.parse(metaLine.trim().slice(META_PREFIX.length));
              console.log('📦 Métadonnées originales trouvées:', originalMeta);
            } catch (err) {
              console.error('❌ Erreur parsing métadonnées:', err);
            }
          }
        }

        const itemMeta = originalMeta || {
          type: 'equipment' as const,
          quantity: gift.item_quantity || 1,
          equipped: false,
        };

        itemMeta.quantity = gift.item_quantity || 1;
        itemMeta.equipped = false;

        console.log('📦 Métadonnées finales:', itemMeta);

        const metaLine = `${META_PREFIX}${JSON.stringify(itemMeta)}`;
        
        const cleanDescription = gift.item_description
          ? gift.item_description
              .split('\n')
              .filter(line => !line.trim().startsWith(META_PREFIX))
              .join('\n')
              .trim()
          : '';

        const finalDescription = cleanDescription
          ? `${cleanDescription}\n${metaLine}`
          : metaLine;

        console.log('📦 Description finale:', finalDescription);

        // Claim AVANT création
        try {
          await campaignService.claimGift(gift.id, player.id, {
            quantity: gift.item_quantity || 1,
          });
          console.log('✅ Gift claimed successfully');
        } catch (claimError: any) {
          console.error('❌ Claim error:', claimError);
          if (claimError.message?.includes('déjà récupéré')) {
            toast.error('Cet objet a déjà été récupéré');
            return;
          }
          throw claimError;
        }

        // Vérifier si l'item existe déjà
        const { data: existingItems } = await supabase
          .from('inventory_items')
          .select('id')
          .eq('player_id', player.id)
          .eq('name', gift.item_name || 'Objet')
          .gte('created_at', new Date(Date.now() - 5000).toISOString());

        if (existingItems && existingItems.length > 0) {
          console.log('⚠️ Item déjà créé (probablement via trigger), on skip la création');
          
          window.dispatchEvent(new CustomEvent('inventory:refresh', { 
            detail: { playerId: player.id } 
          }));

          const typeLabel = 
            itemMeta.type === 'armor' ? 'Armure' :
            itemMeta.type === 'shield' ? 'Bouclier' :
            itemMeta.type === 'weapon' ? 'Arme' :
            'Objet';
          
          toast.success(`${typeLabel} "${gift.item_name}" ajouté${itemMeta.type === 'armor' ? 'e' : ''} à votre inventaire !`);

          setTimeout(() => {
            onClose();
          }, 800);

          return;
        }

        // Créer l'item
        const { data: insertedItem, error } = await supabase
          .from('inventory_items')
          .insert({
            player_id: player.id,
            name: gift.item_name || 'Objet',
            description: finalDescription,
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Insert error:', error);
          throw error;
        }

        console.log('✅ Item créé:', insertedItem);

        window.dispatchEvent(new CustomEvent('inventory:refresh', { 
          detail: { playerId: player.id } 
        }));

        const typeLabel = 
          itemMeta.type === 'armor' ? 'Armure' :
          itemMeta.type === 'shield' ? 'Bouclier' :
          itemMeta.type === 'weapon' ? 'Arme' :
          'Objet';
        
        toast.success(`${typeLabel} "${gift.item_name}" ajouté${itemMeta.type === 'armor' ? 'e' : ''} à votre inventaire !`);

        setTimeout(() => {
          onClose();
        }, 800);

      } else {
        // ARGENT
        try {
          await campaignService.claimGift(gift.id, player.id, {
            gold: gift.gold,
            silver: gift.silver,
            copper: gift.copper,
          });
        } catch (claimError: any) {
          if (claimError.message?.includes('déjà récupéré')) {
            toast.error('Cet argent a déjà été récupéré');
            return;
          }
          throw claimError;
        }

        const { error } = await supabase.from('players').update({
          gold: (player.gold || 0) + (gift.gold || 0),
          silver: (player.silver || 0) + (gift.silver || 0),
          copper: (player.copper || 0) + (gift.copper || 0),
        }).eq('id', player.id);

        if (error) throw error;

        const amounts = [];
        if (gift.gold > 0) amounts.push(`${gift.gold} po`);
        if (gift.silver > 0) amounts.push(`${gift.silver} pa`);
        if (gift.copper > 0) amounts.push(`${gift.copper} pc`);

        toast.success(`${amounts.join(', ')} ajouté à votre argent !`);

        onUpdate({
          ...player,
          gold: (player.gold || 0) + (gift.gold || 0),
          silver: (player.silver || 0) + (gift.silver || 0),
          copper: (player.copper || 0) + (gift.copper || 0),
        });

        setTimeout(() => {
          onClose();
        }, 800);
      }

      loadData();

    } catch (error) {
      console.error('💥 Claim error:', error);
      toast.error('Erreur lors de la récupération');
    } finally {
      setClaiming(false);
    }
  };

  // Mémo pour éviter de re-parser les métadonnées à chaque render
const metaByGift = React.useMemo(() => {
  const map = new Map<string, any>();
  for (const g of pendingGifts) {
    try {
      map.set(g.id, parseMeta(g.item_description));
    } catch {
      map.set(g.id, null);
    }
  }
  return map;
}, [pendingGifts]);
  
 if (!open) return null;

return (
  <>
    <div className="fixed inset-0 z-[11000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div 
        className="fixed inset-0 sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[min(42rem,95vw)] sm:max-h-[90vh] sm:rounded-xl overflow-hidden border-0 sm:border sm:border-gray-700 shadow-2xl"
        style={{
          backgroundImage: 'url(/background/ddbground.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Overlay blanc avec opacité */}
        <div className="absolute inset-0 bg-white/20 pointer-events-none" />
        
        {/* Overlay gris foncé pour contraste */}
        <div className="absolute inset-0 bg-gray-900/80 pointer-events-none" />

        {/* Contenu par-dessus les overlays */}
        <div className="relative z-10 h-full flex flex-col">
          {/* Header */}
          <div className="bg-gray-800/60 border-b border-gray-700 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-6 h-6 text-purple-400" />
                  Mes Campagnes
                </h2>
                
                {activeCampaigns.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activeCampaigns.map((camp) => (
                      <span
                        key={camp.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-900/30 border border-purple-500/40 rounded-full text-sm text-purple-200"
                      >
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        {camp.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:bg-gray-700/50 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

         <div className="flex gap-4 mt-3">
  <button
    onClick={() => setActiveTab('invitations')}
    className={`pb-2 px-1 border-b-2 transition-colors ${
      activeTab === 'invitations'
        ? 'border-purple-500 text-purple-400'
        : 'border-transparent text-gray-400 hover:text-gray-300'
    }`}
  >
    Invitations ({invitations.length})
  </button>

  <button
    onClick={() => setActiveTab('gifts')}
    className={`pb-2 px-1 border-b-2 transition-colors relative ${
      activeTab === 'gifts'
        ? 'border-purple-500 text-purple-400'
        : 'border-transparent text-gray-400 hover:text-gray-300'
    }`}
  >
    <span className="flex items-center gap-2">
      Loots ({pendingGifts.length})
      {pendingGifts.length > 0 && (
        <span className="flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      )}
    </span>
  </button>

<button
  onClick={() => {
    setActiveTab('notes');
    // Hydrate instantanément depuis le cache mémoire (aucun flash)
    if (notesCacheRef.current) {
      const { journal, npcs, quests } = notesCacheRef.current;
      setNotesJournal(journal);
      setNotesNPCs(npcs);
      setNotesQuests(quests);
    }
    // Puis rafraîchis en arrière-plan (localStorage/BDD)
    loadNotes();
  }}
  className={`pb-2 px-1 border-b-2 transition-colors ${
    activeTab === 'notes'
      ? 'border-purple-500 text-purple-400'
      : 'border-transparent text-gray-400 hover:text-gray-300'
  }`}
>
  Prise de notes
</button>
</div>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto flex-1">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
                <p className="text-gray-400">Chargement...</p>
              </div>
           ): activeTab === 'notes' ? (
  <div className="space-y-4">
    <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
      <label className="block text-sm font-medium text-gray-300 mb-2">Journal de campagne</label>
      <textarea
        value={notesJournal}
        onChange={(e) => setNotesJournal(e.target.value)}
        className="input-dark w-full px-3 py-2 rounded-md"
        rows={6}
        placeholder="Écrivez ici le résumé des sessions, éléments marquants, récaps..."
      />
    </div>

    <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
      <label className="block text-sm font-medium text-gray-300 mb-2">PNJ rencontrés</label>
      <textarea
        value={notesNPCs}
        onChange={(e) => setNotesNPCs(e.target.value)}
        className="input-dark w-full px-3 py-2 rounded-md"
        rows={5}
        placeholder="Listez les PNJ, rôles, lieux, liens, indices..."
      />
    </div>

    <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
      <label className="block text-sm font-medium text-gray-300 mb-2">Quêtes et objectifs</label>
      <textarea
        value={notesQuests}
        onChange={(e) => setNotesQuests(e.target.value)}
        className="input-dark w-full px-3 py-2 rounded-md"
        rows={5}
        placeholder="Quêtes en cours, objectifs du groupe, pistes à suivre..."
      />
    </div>

    <div className="flex justify-end">
      <button
        onClick={saveNotes}
        disabled={savingNotes}
        className="btn-primary px-5 py-2 rounded-lg disabled:opacity-50"
      >
        {savingNotes ? 'Sauvegarde...' : 'Sauvegarder les notes'}
      </button>
    </div>
  </div>
) : activeTab === 'invitations' ? (
              <div className="space-y-4">
                {invitations.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-300">Invitations en attente</h3>
                    {invitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-6"
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <Users className="w-5 h-5 text-purple-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-white text-lg mb-1">
                              {invitation.campaigns?.name || 'Campagne'}
                            </h3>
                            {invitation.campaigns?.description && (
                              <p className="text-sm text-gray-400 mt-1">
                                {invitation.campaigns.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              Reçue le {new Date(invitation.invited_at).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>

                        <div className="mb-4 bg-gray-800/40 rounded-lg p-3 border border-gray-700">
                          <p className="text-xs text-gray-400 mb-1">Rejoindre avec :</p>
                          <p className="text-sm font-semibold text-white">
                            {player.adventurer_name || player.name}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeclineInvitation(invitation.id)}
                            disabled={processingInvitation === invitation.id}
                            className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 px-4 py-2 rounded-lg border border-red-500/30 disabled:opacity-50"
                          >
                            Refuser
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                setProcessingInvitation(invitation.id);
                                await campaignService.acceptInvitationWithPlayer(invitation.id, player.id);
                                toast.success('Vous avez rejoint la campagne !');
                                loadData();
                              } catch (error: any) {
                                console.error(error);
                                toast.error(error.message || 'Erreur');
                              } finally {
                                setProcessingInvitation(null);
                              }
                            }}
                            disabled={processingInvitation === invitation.id}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {processingInvitation === invitation.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                Inscription...
                              </>
                            ) : (
                              <>
                                <Check size={18} />
                                Rejoindre
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Aucune invitation en attente</p>
                    <p className="text-sm mt-2">
                      Les invitations des Maîtres du Jeu apparaîtront ici
                    </p>
                  </div>
                )}

                {myCampaigns.length > 0 && (
                  <div className="space-y-3 mt-6">
                    <h3 className="text-sm font-semibold text-gray-300">Mes campagnes actives</h3>
                    {myCampaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className="bg-gray-800/40 border border-green-500/30 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-white">{campaign.name}</h3>
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded-full border border-green-500/30">
                                Active
                              </span>
                            </div>
                            {campaign.description && (
                              <p className="text-sm text-gray-400 mt-1">{campaign.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {activeCampaigns.length > 0 && pendingGifts.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <Gift className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white mb-1">
                          {pendingGifts.length} loot{pendingGifts.length > 1 ? 's' : ''} en attente !
                        </h3>
                        <p className="text-sm text-gray-300">
                          Votre Maître du Jeu a envoyé {pendingGifts.length > 1 ? 'des objets' : 'un objet'} pour votre aventure. 
                          Récupérez-{pendingGifts.length > 1 ? 'les' : 'le'} ci-dessous.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {pendingGifts.length > 0 ? (
                  <>
                    {pendingGifts.map((gift) => {
                      const meta = metaByGift.get(gift.id); 
                      const isCurrencyShared = gift.gift_type === 'currency' && gift.distribution_mode === 'shared';
                      const campaignMembers = membersByCampaign[gift.campaign_id] || [];
                      const memberCount = campaignMembers.length;
                      const isSelected = selectedGiftIds.includes(gift.id);

                      const previewDistribution = memberCount > 0 ? {
                        gold: Math.floor((gift.gold || 0) / memberCount),
                        silver: Math.floor((gift.silver || 0) / memberCount),
                        copper: Math.floor((gift.copper || 0) / memberCount),
                      } : null;

                      return (
                        <div
                          key={gift.id}
                          className={`bg-gray-800/40 border rounded-lg p-4 transition-all ${
                            isSelected 
                              ? 'border-purple-500 bg-purple-900/20' 
                              : 'border-purple-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                                {gift.gift_type === 'item' ? (
                                  <Package className="w-5 h-5 text-purple-400" />
                                ) : (
                                  <Coins className="w-5 h-5 text-yellow-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-white">
                                    {gift.gift_type === 'item' 
                                      ? `${gift.item_name}${gift.item_quantity && gift.item_quantity > 1 ? ` x${gift.item_quantity}` : ''}`
                                      : 'Argent'
                                    }
                                  </h3>

                                  {meta?.type === 'armor' && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 border border-purple-500/30">
                                      Armure
                                    </span>
                                  )}
                                  {meta?.type === 'shield' && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-500/30">
                                      Bouclier
                                    </span>
                                  )}
                                  {meta?.type === 'weapon' && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-500/30">
                                      Arme
                                    </span>
                                  )}
                                </div>

                                {meta && (
                                  <div className="mb-2 mt-2 text-xs text-gray-300">
                                    {meta.type === 'armor' && meta.armor && (
                                      <div className="text-purple-300 flex items-center gap-2">
                                        <span className="text-sm">🛡️ CA: {meta.armor.label}</span>
                                      </div>
                                    )}
                                    {meta.type === 'shield' && meta.shield && (
                                      <div className="text-blue-300">🛡️ Bonus: +{meta.shield.bonus}</div>
                                    )}
                                    {meta.type === 'weapon' && meta.weapon && (
                                      <div className="text-red-300">
                                        ⚔️ {meta.weapon.damageDice} {meta.weapon.damageType}
                                        {meta.weapon.properties && ` • ${meta.weapon.properties}`}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {getVisibleDescription(gift.item_description) && (
                                  <p className="text-sm text-gray-400 mt-2">
                                    {getVisibleDescription(gift.item_description)}
                                  </p>
                                )}

                                {gift.gift_type === 'currency' && (
                                  <div className="flex gap-3 mt-2 text-sm">
                                    {gift.gold > 0 && (
                                      <span className="text-yellow-400 font-medium">{gift.gold} po</span>
                                    )}
                                    {gift.silver > 0 && (
                                      <span className="text-gray-300 font-medium">{gift.silver} pa</span>
                                    )}
                                    {gift.copper > 0 && (
                                      <span className="text-orange-400 font-medium">{gift.copper} pc</span>
                                    )}
                                  </div>
                                )}

                                {gift.message && (
                                  <div className="mt-2 text-sm text-gray-300 italic border-l-2 border-purple-500/40 pl-3">
                                    "{gift.message}"
                                  </div>
                                )}
                                <p className="text-xs text-gray-500 mt-2">
                                  Envoyé le {new Date(gift.sent_at).toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                            </div>

                            {!isCurrencyShared && (
                              <label className="flex items-center gap-2 cursor-pointer ml-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleGiftSelection(gift.id)}
                                  className="w-5 h-5 rounded border-gray-600 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-900"
                                />
                              </label>
                            )}
                          </div>

                          {isCurrencyShared ? (
                            <div className="space-y-2">
                              {memberCount > 0 && previewDistribution && (
                                <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                      <Users size={14} />
                                      <span>{memberCount} joueur{memberCount > 1 ? 's' : ''} dans la campagne</span>
                                    </div>
                                  </div>
                                  
                                  <div className="text-sm">
                                    <div className="text-gray-400 mb-1">Distribution équitable :</div>
                                    <div className="flex gap-3 text-xs flex-wrap">
                                      {previewDistribution.gold > 0 && (
                                        <span className="text-yellow-400">
                                          ~{previewDistribution.gold} po / joueur
                                        </span>
                                      )}
                                      {previewDistribution.silver > 0 && (
                                        <span className="text-gray-300">
                                          ~{previewDistribution.silver} pa / joueur
                                        </span>
                                      )}
                                      {previewDistribution.copper > 0 && (
                                        <span className="text-orange-400">
                                          ~{previewDistribution.copper} pc / joueur
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleClaimGift(gift)}
                                  disabled={claiming}
                                  className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm ${
                                    claiming 
                                      ? 'bg-gray-600 cursor-not-allowed' 
                                      : 'bg-purple-600 hover:bg-purple-700'
                                  } text-white`}
                                >
                                  <Gift size={16} />
                                  {claiming ? 'En cours...' : 'Tout prendre'}
                                </button>
                                
                                <button
                                  onClick={() => {
                                    setCampaignMembersForDistribution(campaignMembers);
                                    setSelectedGiftForDistribution(gift);
                                    setShowDistributionModal(true);
                                  }}
                                  disabled={claiming}
                                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                                >
                                  <Users size={16} />
                                  Partager
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleClaimGift(gift)}
                              disabled={claiming}
                              className={`w-full px-4 py-2 rounded-lg flex items-center justify-center gap-2 ${
                                claiming 
                                  ? 'bg-gray-600 cursor-not-allowed' 
                                  : 'bg-purple-600 hover:bg-purple-700'
                              } text-white`}
                            >
                              <Gift size={18} />
                              {claiming ? 'En cours...' : 'Récupérer'}
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {selectedGiftIds.length > 0 && (
                      <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-sm border-t border-purple-500/30 p-4 -mx-4 -mb-4 mt-4">
                        <button
                          onClick={handleClaimMultiple}
                          disabled={claiming}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 font-semibold"
                        >
                          {claiming ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                              Récupération...
                            </>
                          ) : (
                            <>
                              <Gift size={20} />
                              Récupérer la sélection ({selectedGiftIds.length})
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Gift className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Aucun loot en attente</p>
                    {activeCampaigns.length > 0 ? (
                      <p className="text-sm mt-2">
                        Les objets et argent envoyés par votre MJ dans{' '}
                        <span className="text-purple-400 font-semibold">
                          {activeCampaigns.map(c => c.name).join(', ')}
                        </span>
                        {' '}apparaîtront ici
                      </p>
                    ) : (
                      <p className="text-sm mt-2">
                        Rejoignez une campagne pour recevoir des loots !
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

   
    
    {showDistributionModal && selectedGiftForDistribution && (
      <CurrencyDistributionModal
        gift={selectedGiftForDistribution}
        campaignMembers={campaignMembersForDistribution}
   currentUserId={currentUserId}
        playerId={player.id}
        currentPlayer={player}
        onClose={() => {
          setShowDistributionModal(false);
          setSelectedGiftForDistribution(null);
        }}
        onDistribute={handleDistributeCurrency}
      />
    )}
  </>
);
}  // ✅ FERME LA FONCTION

export default CampaignPlayerModal;