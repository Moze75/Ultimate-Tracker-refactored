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
  // Rooms accessibles en tant que joueur (via campagnes abonnées)
  // -------------------
  // Contient les rooms liées aux campagnes dont le joueur est membre,
  // même s'il n'est pas le GM. Apparaissent automatiquement dans le lobby.
  const [subscribedRooms, setSubscribedRooms] = useState<Room[]>([]);

  const fetchRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listVTTRooms(userId, authToken);
      setRooms(list);
    } catch (err) {
      setError('Erreur lors du chargement des tables : ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
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
      const { data } = await supabase
        .from('vtt_rooms')
        .select('state_json')
        .eq('id', roomId)
        .maybeSingle();

      // -------------------
      // Extraction du campaignId et des tokens existants
      // -------------------
      // On extrait _campaignId même si state_json ne contient pas de tokens.
      // Un state_json = { _campaignId: "xxx" } est valide et signifie
      // qu'il y a une campagne liée mais aucun token encore posé.
      const stateJson = (data?.state_json as Record<string, unknown>) ?? {};
      const allTokens = ((stateJson as { tokens?: VTTToken[] }).tokens) || [];
      const roomCampaignId = stateJson._campaignId as string | undefined;

      // -------------------
      // Stratégie 1 : tokens déjà assignés via controlledByUserIds
      // -------------------
      // Si des tokens sur le canvas sont explicitement assignés au joueur,
      // on les propose directement (cas où le MJ a déjà assigné).
      const assignedTokens = allTokens.filter(t =>
        t.controlledByUserIds && t.controlledByUserIds.includes(userId)
      );

      if (assignedTokens.length > 0) {
        const tokenInfos: RoomTokenInfo[] = assignedTokens.map(t => ({
          id: t.id,
          label: t.label,
          imageUrl: t.imageUrl,
          color: t.color,
          controlledByUserIds: t.controlledByUserIds,
        }));
        setSelectedPlayerTokenIds(assignedTokens.map(t => t.id));
        setPlayerSelectStep({ roomId, tokens: tokenInfos });
        return;
      }

      // -------------------
      // Stratégie 2 : aucun token assigné → chercher les personnages
      // du joueur dans la campagne liée via campaign_members
      // -------------------
      // On récupère les personnages du joueur dans cette campagne
      // pour qu'il puisse choisir lequel incarner.
      // On utilise une requête directe à Supabase plutôt que
      // campaignService.getCampaignMembers() car celle-ci peut
      // être bloquée par les RLS pour un joueur non-GM.
      if (roomCampaignId) {
        try {
          console.log('[VTTLobby] Stratégie 2 : recherche personnages pour userId=', userId, 'dans campagne=', roomCampaignId);

          // -------------------
          // Requête directe : récupère les memberships du joueur
          // avec jointure sur la table players pour avoir le nom
          // -------------------
          const { data: myMemberships, error: memberError } = await supabase
            .from('campaign_members')
            .select(`
              id,
              campaign_id,
              user_id,
              player_id,
              player_email,
              player:players(id, name, adventurer_name)
            `)
            .eq('campaign_id', roomCampaignId)
            .eq('user_id', userId)
            .eq('is_active', true);

          console.log('[VTTLobby] Résultat memberships:', { myMemberships, memberError });

          if (!memberError && myMemberships && myMemberships.length > 0) {
            // -------------------
            // Construction de la liste de personnages sélectionnables
            // -------------------
            // Utilise player.adventurer_name en priorité, puis player.name,
            // puis player_email comme fallback.
            // L'id utilisé est le player_id (id du personnage dans la table players).
            const tokenInfos: RoomTokenInfo[] = myMemberships
              .filter(m => m.player_id) // on ignore les memberships sans player_id
              .map(m => {
                const player = m.player as { id: string; name: string; adventurer_name?: string } | null;
                const label = player?.adventurer_name || player?.name || m.player_email || 'Personnage';
                return {
                  id: m.player_id!,
                  label,
                  imageUrl: null,
                  color: '#3b82f6',
                  controlledByUserIds: [userId],
                };
              });

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
      // Aucun token ni personnage trouvé → rejoindre directement
      // -------------------
      console.log('[VTTLobby] Aucun personnage trouvé, connexion directe');
      onJoinRoom(roomId, 'player');
    } catch {
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

  const getCampaignName = (campaignId: string | null) => {
    if (!campaignId) return null;
    return campaigns.find(c => c.id === campaignId)?.name ?? null;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
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

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm text-red-300 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-300">✕</button>
          </div>
        )}

        <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Créer une nouvelle table</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                placeholder="Nom de la table..."
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
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
            <button
              type="submit"
              disabled={creating || !newRoomName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Créer
            </button>
          </form>
        </div>

        <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Rejoindre par ID</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinRoomId}
              onChange={e => setJoinRoomId(e.target.value)}
              placeholder="ID de la room..."
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
            <button
              onClick={() => joinRoomId.trim() && setPendingJoinRoomId(joinRoomId.trim())}
              disabled={!joinRoomId.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <LogIn size={16} />
              Rejoindre
            </button>
          </div>
        </div>

        <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
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
          ) : rooms.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Aucune table. Créez-en une pour commencer.
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map(room => {
                const campaignName = getCampaignName(room.campaignId);
                return (
                  <div
                    key={room.id}
                    className="flex items-center gap-3 p-3 bg-gray-800/60 rounded-lg border border-gray-700/50 hover:border-amber-700/50 transition-colors"
                  >
                    <Map size={18} className="text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{room.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{room.id}</p>
                      {campaignName && (
                        <p className="text-xs text-amber-400/80 mt-0.5 flex items-center gap-1">
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
                      <button
                        onClick={() => setPendingJoinRoomId(room.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <LogIn size={12} />
                        Ouvrir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div> 

 
        
        {/* -------------------
            Tables des campagnes abonnées (côté joueur)
            -------------------
            Affiche automatiquement les rooms VTT liées aux campagnes
            dont le joueur est membre, sans qu'il ait à saisir un code.
        */}
        {subscribedRooms.length > 0 && (
          <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <BookOpen size={14} className="text-blue-400" />
              Tables de mes campagnes
            </h2>
            <div className="space-y-2">
              {subscribedRooms.map(room => {
                const campaignName = campaigns.find(c => c.id === room.campaignId)?.name
                  || room.campaignId || '';
                return (
                  <div
                    key={room.id}
                    className="flex items-center gap-3 p-3 bg-gray-800/60 rounded-lg border border-gray-700/50 hover:border-blue-700/50 transition-colors"
                  >
                    <Map size={18} className="text-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{room.name}</p>
                      {campaignName && (
                        <p className="text-xs text-blue-400/80 mt-0.5 flex items-center gap-1">
                          <BookOpen size={10} />
                          {campaignName}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setPendingJoinRoomId(room.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      <LogIn size={12} />
                      Rejoindre
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                    <div
                      className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center overflow-hidden border-2"
                      style={{ borderColor: isSelected ? '#3b82f6' : '#4b5563' }}
                    >
                      {token.imageUrl ? (
                        <img
                          src={token.imageUrl}
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
