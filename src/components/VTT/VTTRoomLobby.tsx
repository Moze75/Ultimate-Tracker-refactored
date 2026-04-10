import React, { useState, useEffect } from 'react';
import { Plus, Trash2, LogIn, Map, RefreshCw, Shield, User, Users, BookOpen, Link, Unlink, ChevronDown } from 'lucide-react';
import { createVTTRoom, listVTTRooms, deleteVTTRoom, updateVTTRoomCampaign } from '../../services/vttService';
import { campaignService } from '../../services/campaignService';
import { supabase } from '../../lib/supabase';
import type { VTTToken } from '../../types/vtt';
import type { Campaign, CampaignMember } from '../../types/campaign';

interface Room {
  id: string;
  name: string;
  gmUserId: string;
  createdAt: string;
  campaignId: string | null;
}

interface RoomTokenInfo {
  label: string;
  imageUrl: string | null;
  avatarUrl: string | null;
  color: string;
  id: string;
  controlledByUserIds?: string[];
}

interface VTTRoomLobbyProps {
  userId: string;
  authToken: string;
  onJoinRoom: (roomId: string, role: 'gm' | 'player', selectedTokenIds?: string[]) => void;
  onBack: () => void;
}

export function VTTRoomLobby({ userId, authToken, onJoinRoom, onBack }: VTTRoomLobbyProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCampaignId, setNewRoomCampaignId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);
  const [playerSelectStep, setPlayerSelectStep] = useState<{ roomId: string; tokens: RoomTokenInfo[] } | null>(null);
  const [selectedPlayerTokenIds, setSelectedPlayerTokenIds] = useState<string[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [linkingRoomId, setLinkingRoomId] = useState<string | null>(null);
  const [linkCampaignId, setLinkCampaignId] = useState<string>('');
  const [savingLink, setSavingLink] = useState(false);

  // -------------------
  // -------------------
  // Rooms accessibles en tant que joueur (via campagnes abonnées)
  // -------------------
  // Contient les rooms liées aux campagnes dont le joueur est membre,
  // même s'il n'est pas le GM. Fusionnées dans "Mes tables".
  const [subscribedRooms, setSubscribedRooms] = useState<Room[]>([]);

  // -------------------
  // Cache des noms de campagnes abonnées (résolution campaignId → nom)
  // -------------------
  // Utilisé pour afficher le nom de la campagne au lieu de l'UUID
  // dans la liste "Mes tables" pour les rooms abonnées.
  const [subscribedCampaignNames, setSubscribedCampaignNames] = useState<Record<string, string>>({});

const fetchRooms = async () => {
  // -------------------
  // Chargement des tables du MJ
  // -------------------
  setLoading(true);
  setError(null);
  try {
    const list = await listVTTRooms(userId, authToken);
    setRooms(list);
    return list;
  } catch (err) {
    setError('Erreur lors du chargement des tables : ' + (err instanceof Error ? err.message : String(err)));
    return [];
  } finally {
    setLoading(false);
  }
};

// -------------------
// Gestion du fond du lobby
// -------------------
// Précharge l'image de fond pour éviter l'affichage progressif
// du décor avant que le lobby soit visuellement prêt.
const LOBBY_BACKGROUND_URL = 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/MysticForest2.jpg';

const preloadLobbyBackground = () => {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.src = LOBBY_BACKGROUND_URL;
    img.onload = () => {
      setIsBackgroundReady(true);
      resolve();
    };
    img.onerror = () => {
      // On débloque quand même l'écran pour éviter un loader infini
      setIsBackgroundReady(true);
      resolve();
    };
  });
};

// -------------------
// Chargement des campagnes du MJ
// -------------------
// Alimente les listes de sélection pour la création et la liaison
// d'une table VTT à une campagne.
const fetchCampaigns = async () => {
  try {
    const myCampaigns = await campaignService.getMyCampaigns();
    setCampaigns(myCampaigns);
    return myCampaigns;
  } catch {
    setCampaigns([]);
    return [];
  }
};

// -------------------
// Chargement des tables abonnées
// -------------------
// Récupère les rooms liées aux campagnes auxquelles le joueur est
// membre actif, puis résout les noms de campagnes correspondants.
const fetchSubscribedRooms = async () => {
  try {
    const { data: memberships } = await supabase
      .from('campaign_members')
      .select('campaign_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!memberships || memberships.length === 0) {
      setSubscribedRooms([]);
      setSubscribedCampaignNames({});
      return [];
    }

    const campaignIds = [...new Set(memberships.map(m => m.campaign_id))];

    const { data: allRooms } = await supabase
      .from('vtt_rooms')
      .select('id, name, gm_user_id, created_at, state_json');

    if (!allRooms) {
      setSubscribedRooms([]);
      setSubscribedCampaignNames({});
      return [];
    }

    const matchingRooms: Room[] = allRooms
      .filter(r => {
        const stateJson = (r.state_json as Record<string, unknown>) ?? {};
        const roomCampaignId = stateJson._campaignId as string | null;
        return roomCampaignId && campaignIds.includes(roomCampaignId) && r.gm_user_id !== userId;
      })
      .map(r => ({
        id: r.id,
        name: r.name,
        gmUserId: r.gm_user_id,
        createdAt: r.created_at,
        campaignId: ((r.state_json as Record<string, unknown>)?._campaignId as string) ?? null,
      }));

    setSubscribedRooms(matchingRooms);

    const uniqueCampaignIds = [...new Set(matchingRooms.map(r => r.campaignId).filter(Boolean))] as string[];

    if (uniqueCampaignIds.length > 0) {
      const { data: campaignRows } = await supabase
        .from('campaigns')
        .select('id, name')
        .in('id', uniqueCampaignIds);

      if (campaignRows) {
        const namesMap: Record<string, string> = {};
        campaignRows.forEach(c => {
          namesMap[c.id] = c.name;
        });
        setSubscribedCampaignNames(namesMap);
      } else {
        setSubscribedCampaignNames({});
      }
    } else {
      setSubscribedCampaignNames({});
    }

    return matchingRooms;
  } catch (err) {
    console.error('Erreur chargement rooms abonnées:', err);
    setSubscribedRooms([]);
    setSubscribedCampaignNames({});
    return [];
  }
};
  
  useEffect(() => {
    fetchRooms();

    // -------------------
    // Chargement des campagnes créées par le MJ (pour le select de liaison)
    // -------------------
    campaignService.getMyCampaigns()
      .then(setCampaigns)
      .catch(() => setCampaigns([]));

    // -------------------
    // Chargement des rooms liées aux campagnes auxquelles le joueur est abonné
    // -------------------
    // 1. Récupère les campaign_ids où le joueur est membre actif
    // 2. Récupère les rooms VTT liées à ces campagnes via state_json->_campaignId
    // 3. Exclut les rooms dont le joueur est déjà le GM (déjà dans "Mes tables")
    (async () => {
      try {
        const { data: memberships } = await supabase
          .from('campaign_members')
          .select('campaign_id')
          .eq('user_id', userId)
          .eq('is_active', true);

        if (!memberships || memberships.length === 0) return;

        const campaignIds = [...new Set(memberships.map(m => m.campaign_id))];

        // Récupère toutes les rooms VTT et filtre celles liées à ces campagnes
        const { data: allRooms } = await supabase
          .from('vtt_rooms')
          .select('id, name, gm_user_id, created_at, state_json');

        if (!allRooms) return;

         const matchingRooms: Room[] = allRooms
          .filter(r => {
            const stateJson = (r.state_json as Record<string, unknown>) ?? {};
            const roomCampaignId = stateJson._campaignId as string | null;
            return roomCampaignId && campaignIds.includes(roomCampaignId) && r.gm_user_id !== userId;
          })
          .map(r => ({
            id: r.id,
            name: r.name,
            gmUserId: r.gm_user_id,
            createdAt: r.created_at,
            campaignId: ((r.state_json as Record<string, unknown>)?._campaignId as string) ?? null,
          }));

        setSubscribedRooms(matchingRooms);

        // -------------------
        // Résolution des noms de campagnes abonnées
        // -------------------
        // Récupère le nom réel de chaque campagne liée aux rooms
        // pour l'afficher dans "Mes tables" à la place de l'UUID.
        const uniqueCampaignIds = [...new Set(matchingRooms.map(r => r.campaignId).filter(Boolean))] as string[];
        if (uniqueCampaignIds.length > 0) {
          const { data: campaignRows } = await supabase
            .from('campaigns')
            .select('id, name')
            .in('id', uniqueCampaignIds);

          if (campaignRows) {
            const namesMap: Record<string, string> = {};
            campaignRows.forEach(c => { namesMap[c.id] = c.name; });
            setSubscribedCampaignNames(namesMap);
          }
        }
      } catch (err) {
        console.error('Erreur chargement rooms abonnées:', err);
      }
    })();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setCreating(true);
    try {
      const { roomId } = await createVTTRoom(
        newRoomName.trim(),
        userId,
        authToken,
        newRoomCampaignId || undefined
      );
      setNewRoomName('');
      setNewRoomCampaignId('');
      await fetchRooms();
      onJoinRoom(roomId, 'gm');
    } catch {
      setError('Erreur lors de la création de la room.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (roomId: string) => {
    if (!window.confirm('Supprimer cette room ?')) return;
    try {
      await deleteVTTRoom(roomId, authToken);
      setRooms(r => r.filter(x => x.id !== roomId));
    } catch {
      setError('Erreur lors de la suppression.');
    }
  };

   const handleRoleSelect = async (roomId: string, role: 'gm' | 'player') => {
    setPendingJoinRoomId(null);
    if (role === 'gm') {
      onJoinRoom(roomId, 'gm');
      return;
    }

    setLoadingTokens(true);
    try {
      // -------------------
      // Récupération de la room et de sa campagne liée
      // -------------------
      // On récupère state_json en best-effort. Si la RLS bloque
      // la lecture pour un joueur non-GM, data sera null → on passe
      // directement à la recherche via campaign_members.
      const { data } = await supabase
        .from('vtt_rooms')
        .select('state_json')
        .eq('id', roomId)
        .maybeSingle();

      const stateJson = (data?.state_json as Record<string, unknown>) ?? {};
      const allTokens = ((stateJson as { tokens?: VTTToken[] }).tokens) || [];
      // -------------------
      // Extraction du campaignId avec fallback sur subscribedRooms
      // -------------------
      // Si state_json est inaccessible (RLS), on retrouve le campaignId
      // via les rooms déjà chargées dans le lobby du joueur.
      const roomCampaignId = (stateJson._campaignId as string | undefined)
        || subscribedRooms.find(r => r.id === roomId)?.campaignId
        || undefined;

      console.log('[VTTLobby] handleRoleSelect:', {
        roomId,
        allTokensCount: allTokens.length,
        roomCampaignId,
        userId,
      });

      // -------------------
      // Stratégie PRIORITAIRE : personnages de campagne du joueur
      // -------------------
      // Si la room est liée à une campagne, on cherche d'abord les
      // personnages du joueur dans cette campagne. C'est la source
      // de vérité pour "quels persos appartiennent à ce joueur".
      // Les tokens assignés sur le canvas (controlledByUserIds) sont
      // un mécanisme de contrôle en jeu, pas de sélection au lobby.
      if (roomCampaignId) {
        try {
          console.log('[VTTLobby] Recherche personnages campagne pour userId=', userId, 'campagne=', roomCampaignId);

          // -------------------
          // Récupération des memberships avec avatar_url du joueur
          // -------------------
          const { data: myMemberships, error: memberError } = await supabase
            .from('campaign_members')
            .select(`
              id,
              campaign_id,
              user_id,
              player_id,
              player_email,
              player:players(id, name, adventurer_name, avatar_url)
            `)
            .eq('campaign_id', roomCampaignId)
            .eq('user_id', userId)
            .eq('is_active', true);

          console.log('[VTTLobby] Résultat memberships:', { myMemberships, memberError });

          if (!memberError && myMemberships && myMemberships.length > 0) {
            // -------------------
            // Construction de la liste de personnages avec avatar
            // -------------------
            const tokenInfos: RoomTokenInfo[] = myMemberships
              .filter(m => m.player_id)
              .map(m => {
                const playerData = m.player as { id: string; name: string; adventurer_name?: string; avatar_url?: string } | null;
                const label = playerData?.adventurer_name || playerData?.name || m.player_email || 'Personnage';
                return {
                  id: m.player_id!,
                  label,
                  imageUrl: null,
                  avatarUrl: playerData?.avatar_url || null,
                  color: '#3b82f6',
                  controlledByUserIds: [userId],
                };
              });

            console.log('[VTTLobby] Personnages trouvés:', tokenInfos.map(t => ({ id: t.id, label: t.label })));

            if (tokenInfos.length > 0) {
              setSelectedPlayerTokenIds(tokenInfos.map(t => t.id));
              setPlayerSelectStep({ roomId, tokens: tokenInfos });
              return;
            }
          }
        } catch (err) {
          console.error('[VTTLobby] Erreur chargement personnages campagne:', err);
        }
      }

      // -------------------
      // Stratégie FALLBACK : tokens assignés sur le canvas
      // -------------------
      // Si aucune campagne n'est liée ou si le joueur n'a pas de
      // personnage dans la campagne, on propose les tokens du canvas
      // qui lui sont explicitement assignés via controlledByUserIds.
      const assignedTokens = allTokens.filter(t =>
        t.controlledByUserIds && t.controlledByUserIds.includes(userId)
      );

      if (assignedTokens.length > 0) {
        console.log('[VTTLobby] Fallback : tokens canvas assignés:', assignedTokens.length);
        // -------------------
        // Fallback : tokens canvas assignés (pas d'avatar campagne)
        // -------------------
        const tokenInfos: RoomTokenInfo[] = assignedTokens.map(t => ({
          id: t.id,
          label: t.label,
          imageUrl: t.imageUrl,
          avatarUrl: null,
          color: t.color,
          controlledByUserIds: t.controlledByUserIds,
        }));
        setSelectedPlayerTokenIds(assignedTokens.map(t => t.id));
        setPlayerSelectStep({ roomId, tokens: tokenInfos });
        return;
      }

      // -------------------
      // Aucun token ni personnage trouvé → rejoindre directement
      // -------------------
      console.log('[VTTLobby] Aucun personnage trouvé, connexion directe');
      onJoinRoom(roomId, 'player');
    } catch (err) {
      console.error('[VTTLobby] Erreur handleRoleSelect:', err);
      onJoinRoom(roomId, 'player');
    } finally {
      setLoadingTokens(false);
    }
  };

  const handlePlayerConfirm = () => {
    if (!playerSelectStep) return;

    const playerSessionId = crypto.randomUUID();
    sessionStorage.setItem(`vtt:playerSessionId:${playerSelectStep.roomId}`, playerSessionId);

    onJoinRoom(playerSelectStep.roomId, 'player', selectedPlayerTokenIds);
    setPlayerSelectStep(null);
    setSelectedPlayerTokenIds([]);
  };

  const toggleTokenSelection = (tokenId: string) => {
    setSelectedPlayerTokenIds(prev =>
      prev.includes(tokenId)
        ? prev.filter(id => id !== tokenId)
        : [...prev, tokenId]
    );
  };

  const openLinkModal = (room: Room) => {
    setLinkingRoomId(room.id);
    setLinkCampaignId(room.campaignId ?? '');
  };

  const handleSaveLink = async () => {
    if (!linkingRoomId) return;
    setSavingLink(true);
    try {
      await updateVTTRoomCampaign(linkingRoomId, linkCampaignId || null);
      setRooms(prev => prev.map(r =>
        r.id === linkingRoomId ? { ...r, campaignId: linkCampaignId || null } : r
      ));
      setLinkingRoomId(null);
    } catch {
      setError('Erreur lors de la mise à jour du lien de campagne.');
    } finally {
      setSavingLink(false);
    }
  };

  // -------------------
  // Résolution du nom de campagne (MJ + abonnées)
  // -------------------
  // Cherche d'abord dans les campagnes du MJ, puis dans le cache
  // des noms de campagnes abonnées (subscribedCampaignNames).
  const getCampaignName = (campaignId: string | null) => {
    if (!campaignId) return null;
    return campaigns.find(c => c.id === campaignId)?.name
      ?? subscribedCampaignNames[campaignId]
      ?? null;
  };

  return (
<div
  className="min-h-screen text-white flex flex-col relative"
  style={{
    backgroundImage: `url('https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/MysticForest2.jpg')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  }}
>
  {/* Overlay retiré — laisse l'image de fond MysticForest2 visible sans assombrissement */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
        >
          ← Retour
        </button>
        <Map className="text-amber-500" size={20} />
        <h1 className="text-lg font-bold">VTT Beta</h1>
        <span className="px-2 py-0.5 text-xs bg-amber-900/50 text-amber-400 rounded-full border border-amber-700/50">
          Beta fermée
        </span>
      </div>

      <div className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-16 py-8 space-y-16">
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm text-red-300 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-300">✕</button>
          </div>
        )}
 
        <div className="vtt-create-card p-4">
          <div className="vtt-create-card-frame" aria-hidden="true" />

          <h2 className="text-sm font-semibold text-gray-300 mb-3">Créer une nouvelle table</h2>
               <form onSubmit={handleCreate} className="space-y-3"> 
            {/* -------------------
                Input nom de la table
                ------------------- */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                placeholder="Nom de la table..."
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            {/* -------------------
                Select campagne liée (optionnel, affiché si le MJ a des campagnes)
                ------------------- */}
            {campaigns.length > 0 && (
              <div className="relative">
                <BookOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <select
                  value={newRoomCampaignId}
                  onChange={e => setNewRoomCampaignId(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none appearance-none"
                >
                  <option value="">Aucune campagne liée</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            )}
            {/* -------------------
                Bouton Créer — aligné à droite, style btn-primary (bouton rouge thème)
                ------------------- */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating || !newRoomName.trim()}
                className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm"
              >
                <Plus size={16} />
                Créer
              </button>
            </div>
          </form>
        </div>

        {/* -------------------
            Carte "Rejoindre par ID" — frame AmbreFrame.png via ::after CSS
            Variante compacte (vtt-lobby-card--compact) car moins de contenu vertical
            ------------------- */}
        <div className="vtt-lobby-card vtt-lobby-card--compact">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Rejoindre par ID</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinRoomId}
              onChange={e => setJoinRoomId(e.target.value)}
              placeholder="ID de la room..."
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
            {/* -------------------
                Bouton Rejoindre — style btn-secondary (bouton bleu thème)
                ------------------- */}
            <button
              onClick={() => joinRoomId.trim() && setPendingJoinRoomId(joinRoomId.trim())}
              disabled={!joinRoomId.trim()}
              className="btn-secondary flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm"
            >
              <LogIn size={16} />
              Rejoindre
            </button>
          </div>
        </div>

        {/* -------------------
            Carte "Mes tables" — frame AmbreFrame.png via ::after CSS
            ------------------- */}
        <div className="vtt-lobby-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">Mes tables</h2>
            <button
              onClick={fetchRooms}
              className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors text-gray-400"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Chargement...</div>
          ) : (rooms.length === 0 && subscribedRooms.length === 0) ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Aucune table. Créez-en une pour commencer.
            </div>
          ) : (
            <div className="space-y-2">
              {/* -------------------
                  Boucle sur les rooms du MJ + rooms des campagnes abonnées
                  Les subscribedRooms sont ajoutées à la fin de la liste
              ------------------- */}
              {[...rooms, ...subscribedRooms].map(room => {
                const campaignName = getCampaignName(room.campaignId);
                // -------------------
                // Détection room abonnée (joueur) vs room du MJ
                // -------------------
                const isSubscribedRoom = room.gmUserId !== userId;
                return (
                  <div
                    key={room.id}
                    className={`flex items-center gap-3 p-3 bg-gray-800/60 rounded-lg border border-gray-700/50 transition-colors ${
                      isSubscribedRoom ? 'hover:border-blue-700/50' : 'hover:border-amber-700/50'
                    }`}
                  >
                              <Map size={18} className={isSubscribedRoom ? 'text-blue-400 shrink-0' : 'text-amber-500 shrink-0'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{room.name}</p>
                      {/* -------------------
                          ID de la room (masqué pour les rooms abonnées)
                      ------------------- */}
                      {!isSubscribedRoom && (
                        <p className="text-xs text-gray-500 font-mono">{room.id}</p>
                      )}
                      {/* -------------------
                          Nom de la campagne liée (au lieu de l'UUID)
                      ------------------- */}
                      {campaignName && (
                        <p className={`text-xs mt-0.5 flex items-center gap-1 ${isSubscribedRoom ? 'text-blue-400/80' : 'text-amber-400/80'}`}>
                          <BookOpen size={10} />
                          {campaignName}
                        </p>
                      )}
                      {!campaignName && room.gmUserId === userId && campaigns.length > 0 && (
                        <p className="text-xs text-gray-600 mt-0.5">Aucune campagne liée</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {room.gmUserId === userId && campaigns.length > 0 && (
                        <button
                          onClick={() => openLinkModal(room)}
                          title={room.campaignId ? 'Modifier la campagne liée' : 'Lier une campagne'}
                          className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors text-gray-500 hover:text-amber-400"
                        >
                          {room.campaignId ? <Link size={14} /> : <Unlink size={14} />}
                        </button>
                      )}
                      {room.gmUserId === userId && (
                        <button
                          onClick={() => handleDelete(room.id)}
                          className="p-1.5 hover:bg-red-900/40 rounded-lg transition-colors text-gray-500 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {/* -------------------
                          Bouton Ouvrir (MJ) / Rejoindre (joueur)
                          btn-primary = bouton rouge thème (MJ)
                          btn-secondary = bouton bleu thème (joueur abonné)
                          ------------------- */}
                      <button
                        onClick={() => setPendingJoinRoomId(room.id)}
                        className={`${
                          isSubscribedRoom ? 'btn-secondary' : 'btn-primary'
                        } flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs`}
                      >
                        <LogIn size={12} />
                        {isSubscribedRoom ? 'Rejoindre' : 'Ouvrir'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div> 

 
        
   

        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
          <p className="text-xs text-blue-300">
            <strong>VTT Beta :</strong> Créez une table en tant que MJ et partagez l'ID avec vos joueurs.
            Les tokens, la carte et le brouillard de guerre sont synchronisés en temps réel.
          </p>
        </div>
      </div>

      {pendingJoinRoomId && !playerSelectStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-white mb-1">Rejoindre la table</h3>
            <p className="text-xs text-gray-400 mb-5">Choisissez votre role pour cette session.</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => handleRoleSelect(pendingJoinRoomId, 'gm')}
                disabled={loadingTokens}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-amber-900/30 border border-gray-700 hover:border-amber-600/50 rounded-xl transition-all group disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-amber-600/20 border border-amber-600/40 flex items-center justify-center group-hover:bg-amber-600/30 transition-colors">
                  <Shield size={20} className="text-amber-400" />
                </div>
                <span className="text-sm font-medium text-gray-200 group-hover:text-amber-300 transition-colors">Maitre du Jeu</span>
                <span className="text-[10px] text-gray-500 text-center leading-tight">Controle total de la table</span>
              </button>
              <button
                onClick={() => handleRoleSelect(pendingJoinRoomId, 'player')}
                disabled={loadingTokens}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-blue-900/30 border border-gray-700 hover:border-blue-600/50 rounded-xl transition-all group disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-600/40 flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                  <User size={20} className="text-blue-400" />
                </div>
                <span className="text-sm font-medium text-gray-200 group-hover:text-blue-300 transition-colors">Joueur</span>
                <span className="text-[10px] text-gray-500 text-center leading-tight">Vision limitee par le MJ</span>
              </button>
            </div>
            {loadingTokens && (
              <div className="text-center text-xs text-gray-400 mb-2">Chargement des tokens...</div>
            )}
            <button
              onClick={() => setPendingJoinRoomId(null)}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {playerSelectStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <Users size={18} className="text-blue-400" />
              <h3 className="text-base font-semibold text-white">Choisir vos tokens</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Selectionnez les tokens que vous allez controler durant la session. Vous ne pourrez deplacer que ces tokens.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {playerSelectStep.tokens.map(token => {
                const isSelected = selectedPlayerTokenIds.includes(token.id);
                const boundToOther = token.controlledByUserIds &&
                  token.controlledByUserIds.length > 0 &&
                  !token.controlledByUserIds.includes(userId);
                return (
                  <button
                    key={token.id}
                    onClick={() => toggleTokenSelection(token.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/15'
                        : boundToOther
                          ? 'border-gray-700 bg-gray-800/40 opacity-60'
                          : 'border-gray-700 bg-gray-800/60 hover:border-gray-500'
                    }`}
                  >
                    {/* -------------------
                        Avatar du personnage / joueur
                        Priorité : avatarUrl (campagne) > imageUrl (token canvas) > initiales
                    ------------------- */}
                    <div
                      className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center overflow-hidden border-2"
                      style={{ borderColor: isSelected ? '#3b82f6' : '#4b5563' }}
                    >
                      {(token.avatarUrl || token.imageUrl) ? (
                        <img
                          src={(token.avatarUrl || token.imageUrl)!}
                          alt={token.label}
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: token.color }}
                        >
                          {token.label.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{token.label}</p>
                      {boundToOther && (
                        <p className="text-[10px] text-gray-500">Deja assigne a un autre joueur</p>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setPlayerSelectStep(null); setSelectedPlayerTokenIds([]); }}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handlePlayerConfirm}
                disabled={selectedPlayerTokenIds.length === 0}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Confirmer ({selectedPlayerTokenIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {linkingRoomId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={18} className="text-amber-400" />
              <h3 className="text-base font-semibold text-white">Lier une campagne</h3>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              La campagne liée active le combat et la liste des membres dans le VTT.
            </p>
            <div className="relative mb-4">
              <BookOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <select
                value={linkCampaignId}
                onChange={e => setLinkCampaignId(e.target.value)}
                className="w-full pl-8 pr-8 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none appearance-none"
              >
                <option value="">Aucune campagne</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLinkingRoomId(null)}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveLink}
                disabled={savingLink}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {savingLink ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 