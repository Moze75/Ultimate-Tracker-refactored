import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Users, Map, Settings, Eye, EyeOff, Trash2, LogOut, Package, DoorOpen, ChevronRight, ChevronLeft, ChevronDown, Skull, Swords, MessageSquare, RefreshCw } from 'lucide-react';
import type { VTTToken, VTTRoomConfig, VTTProp, VTTChatMessage } from '../../types/vtt';
import { VTTChatPanel } from './VTTChatPanel'; 
import { VTTPropsPanel } from './VTTPropsPanel';
import { VTTMapLibrary } from './VTTMapLibrary';
import { VTTTokenLibraryPanel } from './VTTTokenLibraryPanel';
import { VTTMonsterBestiary } from './VTTMonsterBestiary';
import type { MonsterListItem, Monster, CampaignMember } from '../../types/campaign';
import { campaignService } from '../../services/campaignService';
import { VTTCombatTab } from './combat/VTTCombatTab';
import { VTTSettingsPanel } from './settings/VTTSettingsPanel';

type SidebarTab = 'tokens' | 'map' | 'props' | 'combat' | 'settings' | 'chat';


interface VTTSidebarProps {
  authToken?: string;
  role: 'gm' | 'player';
  tokens: VTTToken[];
  config: VTTRoomConfig;
  selectedTokenId: string | null;
  userId: string;
  roomId: string;
  campaignId?: string;
  connected: boolean;
  connectedCount: number;
  connectedUsers: { userId: string; name: string; role: 'gm' | 'player' }[];
  activeTab?: SidebarTab;
  onChangeTab?: (tab: SidebarTab) => void;
  combatInitTokens?: VTTToken[];
  onSelectToken: (id: string | null) => void;
  onEditToken: (token: VTTToken) => void;
  onRemoveToken: (tokenId: string) => void;
  onToggleVisibility: (tokenId: string) => void;
  onUpdateMap: (changes: Partial<VTTRoomConfig>) => void;
  onBack: () => void;
  onHome: () => void;
  props: VTTProp[];
  selectedPropId: string | null;
  onSelectProp: (id: string | null) => void;
  onAddProp: (prop: Omit<VTTProp, 'id'>) => void;
  onRemoveProp: (propId: string) => void;
  onUpdateProp: (propId: string, changes: Partial<VTTProp>) => void;
  onSaveScene?: () => Promise<void>;
  onAddMonsterAsToken?: (token: Omit<VTTToken, 'id'>) => void;
  // Callback pour synchroniser les PV du token VTT depuis le combat ou la fiche perso
  onUpdateToken?: (tokenId: string, changes: Partial<VTTToken>) => void;
  // -------------------
  // Props du chat live
  // -------------------
  userName?: string;
  pendingChatRoll?: VTTChatMessage | null;
  onChatRollConsumed?: () => void;
  autoFocusCombatTurn?: boolean;
  onToggleAutoFocusCombatTurn?: () => void;
  followCameraOnTokenMove?: boolean;
  onToggleFollowCameraOnTokenMove?: () => void;
  lockPlayerMovementOutsideTurn?: boolean;
  onToggleLockPlayerMovementOutsideTurn?: () => void;
  onFocusCombatTokenByLabel?: (displayName: string) => void;
  onCurrentTurnLabelChange?: (displayName: string | null) => void;
}

function compressImageToDataUrl(file: File, maxPx = 1920, quality = 0.82): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), width: w, height: h });
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function VTTSidebar({
  role,
  tokens,
  config,
  selectedTokenId,
  userId,
  roomId,
  connected,
  connectedCount,
  connectedUsers,
  activeTab: activeTabProp,
  onChangeTab,
  combatInitTokens,
  onSelectToken,
  onEditToken,
  onRemoveToken,
  onToggleVisibility,
  onUpdateMap,
  onBack,
  props,
  selectedPropId,
  onSelectProp,
  onAddProp,
  onRemoveProp,
  onUpdateProp,
  onHome,
  authToken,
  onSaveScene,
  onAddMonsterAsToken,
  onUpdateToken,
  campaignId,
  userName = 'Joueur',
  pendingChatRoll,
  onChatRollConsumed,
  autoFocusCombatTurn = true,
  onToggleAutoFocusCombatTurn,
  followCameraOnTokenMove = false,
  onToggleFollowCameraOnTokenMove,
  lockPlayerMovementOutsideTurn = true,
  onToggleLockPlayerMovementOutsideTurn,
  onFocusCombatTokenByLabel,
  onCurrentTurnLabelChange,
}: VTTSidebarProps) {
  const [saving, setSaving] = React.useState(false);
  const [saveOk, setSaveOk] = React.useState(false);
  // -------------------
  // Onglet par défaut selon le rôle
  // -------------------
  // Le MJ arrive sur "tokens", le joueur directement sur "chat"
  // pour voir immédiatement le fil de chat/dés dès la connexion.
  // Note : activeTabProp (transmis depuis VTTPage) prend la priorité
  // sur internalTab — voir const activeTab = activeTabProp ?? internalTab.
  const [internalTab, setInternalTab] = useState<SidebarTab>(role === 'gm' ? 'tokens' : 'chat');
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = (tab: SidebarTab) => {
    setInternalTab(tab);
    onChangeTab?.(tab);
  };
  // -------------------
  // Badge de messages non lus sur l'onglet Chat
  // -------------------
  // Incrémenté par VTTChatPanel quand un message arrive hors onglet actif,
  // remis à zéro dès que l'utilisateur ouvre l'onglet chat.
  const [unreadChat, setUnreadChat] = useState(0);
  const [mapUrl, setMapUrl] = useState(config.mapImageUrl);
  const [compressing, setCompressing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(290);
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // -------------------
  // Gestion des sections du panel tokens
  // -------------------
  // Permet de replier la liste des tokens presents sur la carte
  // ainsi que la bibliotheque de tokens.
  const [showCanvasTokens, setShowCanvasTokens] = useState(true);
  const [showTokenLibrary, setShowTokenLibrary] = useState(true);
  const [showBestiary, setShowBestiary] = useState(false);
  // -------------------
  // État de la section joueurs connectés (repliée par défaut)
  // -------------------
  const [showConnectedUsers, setShowConnectedUsers] = useState(false);
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tokenListRef = useRef<HTMLDivElement>(null);

  const reloadMembers = useCallback(() => {
    if (campaignId) {
      campaignService.getCampaignMembers(campaignId).then(setMembers).catch(console.error);
    }
  }, [campaignId]);

  useEffect(() => {
    if (activeTab === 'combat' && campaignId) {
      reloadMembers();
    }
  }, [activeTab, campaignId, reloadMembers]);

  useEffect(() => {
    if (!selectedTokenId || !tokenListRef.current) return;
    const el = tokenListRef.current.querySelector(`[data-token-id="${selectedTokenId}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (activeTab !== 'tokens') setActiveTab('tokens');
    }
  }, [selectedTokenId]);

  useEffect(() => {
    if (!config.mapImageUrl.startsWith('data:')) {
      setMapUrl(config.mapImageUrl);
    }
  }, [config.mapImageUrl]);

  const hasExistingMap = !!config.mapImageUrl;

  const confirmReplace = (action: () => void) => {
    if (hasExistingMap) {
      if (!window.confirm('Une carte est déjà chargée. Voulez-vous la remplacer ?')) return;
    }
    action();
  };

  const handleApplyUrl = () => {
    const trimmed = mapUrl.trim();
    if (!trimmed) return;
    confirmReplace(() => onUpdateMap({ mapImageUrl: trimmed }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    confirmReplace(async () => {
      setCompressing(true);
      try {
        const workerUrl = import.meta.env.VITE_CF_UPLOAD_WORKER_URL;
        if (workerUrl) {
          // ✅ Upload vers Cloudflare R2
          const { uploadVttAsset } = await import('../../services/vttStorageService');
const cdnUrl = await uploadVttAsset(file, 'maps', userId, roomId);
          const dims = await new Promise<{ w: number; h: number }>((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => resolve({ w: 3000, h: 2000 });
            img.src = cdnUrl;
          });
          onUpdateMap({ mapImageUrl: cdnUrl, mapWidth: dims.w, mapHeight: dims.h });
          setMapUrl(cdnUrl);
        } else {
          // ⚠️ Fallback dataURL
          const { dataUrl, width, height } = await compressImageToDataUrl(file);
          onUpdateMap({ mapImageUrl: dataUrl, mapWidth: width, mapHeight: height });
          setMapUrl('(fichier local)');
        }
      } catch (err) {
        console.error('Erreur upload carte:', err);
        alert('Erreur lors du chargement. Vérifiez votre connexion.');
      } finally {
        setCompressing(false);
      }
    });
  };

  if (collapsed) {
    return (
        // -------------------
      // Gestion de la transparence de la sidebar repliee
      // -------------------
      // Le panneau replie reste lui aussi en surimpression.
      <div className="flex flex-col items-center w-8 h-full bg-gray-900/70 backdrop-blur-md border-l border-white/10 shadow-2xl">
        <button
          onClick={() => setCollapsed(false)}
          className="mt-2 p-1 text-gray-500 hover:text-amber-400 hover:bg-gray-800 rounded transition-colors"
          title="Ouvrir le panneau"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
    );
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = resizeStartX.current - ev.clientX;
           const newWidth = Math.max(340, Math.min(480, resizeStartWidth.current + delta));
      setSidebarWidth(newWidth);
    };
    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

const isGM = role === 'gm';

const visibleTokens = isGM
  ? tokens
  : tokens.filter(token => token.controlledByUserIds?.includes(userId) ?? false);

  return (
    // -------------------
    // Wrapper externe — position:relative sans overflow-hidden
    // -------------------
    // La poignée doit être ici, HORS du overflow-hidden,
    // sinon le navigateur coupe le positionnement absolu
    // et top:50% ne se calcule que sur la zone visible, pas toute la hauteur.
 <div className="relative h-full flex-shrink-0 z-20" style={{ width: sidebarWidth, minWidth: 240, maxWidth: 480 }}>

      
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-40 group"
        title="Redimensionner"
      >
        <div className="absolute inset-y-0 left-0 w-px bg-white/10 group-hover:bg-amber-400/50 transition-colors" />
        <div
          onMouseDown={handleResizeMouseDown}
          className="fixed flex flex-col items-center justify-center gap-[3px] px-[3px] py-2 rounded-full bg-gray-700/80 hover:bg-amber-500/90 transition-colors shadow-md cursor-col-resize z-50"
          style={{ top: '50vh', left: 'auto', transform: 'translateY(-50%)' }}
        >
          <span className="block w-[3px] h-[3px] rounded-full bg-gray-400" />
          <span className="block w-[3px] h-[3px] rounded-full bg-gray-400" />
          <span className="block w-[3px] h-[3px] rounded-full bg-gray-400" />
        </div>
      </div>

 
      
      <div className="flex flex-col h-full bg-gray-900/70 backdrop-blur-md border-l border-white/10 overflow-hidden shadow-2xl">


      {/* -------------------
          Barre d'onglets de la sidebar
          -------------------
          Ordre pour les joueurs : Chat en premier (premier onglet visible),
          puis Combat. Le MJ a accès à tous les onglets avec Chat après Combat.
      */}
      <div className="flex border-b border-gray-700/60 shrink-0">

        {/* Onglet Chat — premier pour les joueurs, visible par tous */}
        <TabBtn
          icon={
            <div className="relative">
              <MessageSquare size={14} />
              {/* Badge non-lus */}
              {unreadChat > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-[3px] bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadChat > 9 ? '9+' : unreadChat}
                </span>
              )}
            </div>
          }
          title="Chat"
          active={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
        />

{isGM && (
  <>
    <TabBtn icon={<Users size={14} />} title="Tokens" active={activeTab === 'tokens'} onClick={() => setActiveTab('tokens')} />
    <TabBtn icon={<Swords size={14} />} title="Combat" active={activeTab === 'combat'} onClick={() => setActiveTab('combat')} />
    <TabBtn icon={<Map size={14} />} title="Carte" active={activeTab === 'map'} onClick={() => setActiveTab('map')} />
    <TabBtn icon={<Package size={14} />} title="Props" active={activeTab === 'props'} onClick={() => setActiveTab('props')} />
  </>
)}
{!isGM && (
  <TabBtn icon={<Swords size={14} />} title="Combat" active={activeTab === 'combat'} onClick={() => setActiveTab('combat')} />
)}
<TabBtn icon={<Settings size={14} />} title="Config" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />

        <button
          onClick={() => setCollapsed(true)}
          className="px-1.5 flex items-center justify-center text-gray-500 hover:text-amber-400 hover:bg-gray-800/50 transition-colors border-b-2 border-transparent"
          title="Replier le panneau"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
                  {activeTab === 'tokens' && isGM && (
          <div className="flex flex-col">
            {/* -------------------
                Gestion des tokens presents sur la carte
                -------------------
                Cette section affiche les tokens actuellement poses sur le canvas.
            */}
            <div className="shrink-0 border-b border-gray-700/60">
              <button
                type="button"
                onClick={() => setShowCanvasTokens(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-800/40 transition-colors"
              >
                <span className="text-[10px] text-gray-200 font-medium uppercase tracking-wide">
                  Tokens sur la carte
                </span>
                {showCanvasTokens ? (
                  <ChevronDown size={12} className="text-gray-500" />
                ) : (
                  <ChevronRight size={12} className="text-gray-500" />
                )}
              </button>

              {showCanvasTokens && (
                <div ref={tokenListRef} className="p-2 space-y-1 overflow-y-auto" style={{ maxHeight: '220px' }}>
                  {visibleTokens.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Aucun token sur la carte</p>
                  )}

                  {visibleTokens.map(token => {
                    const canEdit = role === 'gm' || token.ownerUserId === userId;
                    const isSelected = token.id === selectedTokenId;

                    return (
                      <div
                        key={token.id}
                        data-token-id={token.id}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData('application/vtt-token-id', token.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing group transition-colors ${
                          isSelected
                            ? 'bg-amber-500/15 border border-amber-500/40'
                            : 'hover:bg-gray-800 border border-transparent'
                        }`}
                        onClick={() => onSelectToken(isSelected ? null : token.id)}
                      >
                        <div
                          className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-white overflow-hidden"
                          style={{ backgroundColor: token.imageUrl ? 'transparent' : token.color }}
                        >
                          {token.imageUrl ? (
                            <img src={token.imageUrl} alt="" draggable={false} className="w-full h-full object-cover rounded-full pointer-events-none" />
                          ) : (
                            token.label.slice(0, 2)
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`text-xs truncate ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                            {token.label}
                          </p>

                          {token.maxHp != null && token.hp != null && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.max(0, Math.min(100, (token.hp / token.maxHp) * 100))}%`,
                                    backgroundColor: token.hp / token.maxHp > 0.5 ? '#22c55e' : token.hp / token.maxHp > 0.25 ? '#f59e0b' : '#ef4444',
                                  }}
                                />
                              </div>
                              <span className="text-[9px] text-gray-500">{token.hp}/{token.maxHp}</span>
                            </div>
                          )}
                        </div>

                        {!token.visible && <EyeOff size={11} className="text-gray-500 shrink-0" />}

                        {canEdit && (
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            {role === 'gm' && (
                              <button
                                onClick={e => { e.stopPropagation(); onToggleVisibility(token.id); }}
                                className="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
                                title={token.visible ? 'Masquer' : 'Afficher'}
                              >
                                {token.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                              </button>
                            )}

                            <button
                              onClick={e => { e.stopPropagation(); onEditToken(token); }}
                              className="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
                              title="Éditer"
                            >
                              <Settings size={11} />
                            </button>

                            {role === 'gm' && (
                              <button
                                onClick={e => { e.stopPropagation(); onRemoveToken(token.id); }}
                                className="p-1 rounded hover:bg-red-700/40 text-gray-400 hover:text-red-400 transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* -------------------
                Gestion de la bibliotheque de tokens
                -------------------
                Cette section contient les tokens importes et ranges
                dans des dossiers, avec drag and drop vers le canvas.
            */}
            <div className="flex flex-col border-t border-gray-700/60">
              <button
                type="button"
                onClick={() => setShowTokenLibrary(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-800/40 transition-colors border-b border-gray-700/60"
              >
                <span className="text-[10px] text-gray-200 font-medium uppercase tracking-wide">
                  Bibliothèque de tokens
                </span>
                {showTokenLibrary ? (
                  <ChevronDown size={12} className="text-gray-500" />
                ) : (
                  <ChevronRight size={12} className="text-gray-500" />
                )}
              </button>

              {showTokenLibrary && (
                <div style={{ height: '200px' }}>
              <VTTTokenLibraryPanel roomId={roomId} campaignId={campaignId} userId={userId} />
                </div>
              )}
            </div>

            {/* Bestiaire */}
            <div className="flex flex-col border-t border-gray-700/60">
              <button
                type="button"
                onClick={() => setShowBestiary(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-800/40 transition-colors"
              >
                <span className="flex items-center gap-1.5 text-[10px] text-gray-200 font-medium uppercase tracking-wide">
                  <Skull size={10} className="text-red-400" />
                  Bestiaire
                </span>
                {showBestiary ? (
                  <ChevronDown size={12} className="text-gray-500" />
                ) : (
                  <ChevronRight size={12} className="text-gray-500" />
                )}
              </button>

              {showBestiary && (
                <div style={{ height: '400px' }}>
                  <VTTMonsterBestiary
                    onAddAsToken={onAddMonsterAsToken ? (m: MonsterListItem, detail: Monster | null) => {
                      const hp = typeof m.hp === 'number' ? m.hp : parseInt(String(m.hp ?? '0')) || 10;
                      onAddMonsterAsToken({
                        characterId: null,
                        monsterSlug: m.slug || undefined,
                        ownerUserId: '',
                        label: m.name,
                        imageUrl: detail?.image_url || null,
                        position: { x: 200, y: 200 },
                        size: 1,
                        rotation: 0,
                        visible: true,
                        color: '#ef4444',
                        hp,
                        maxHp: hp,
                        showLabel: true,
                        visionMode: 'none',
                        lightSource: 'none',
                      });
                    } : undefined}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------
            Onglet Chat — toujours monté, jamais démonté
            -------------------
            Même pattern que CombatTab : display:none pour conserver
            l'abonnement vttService.onChat() actif en permanence,
            les messages s'accumulent même si l'onglet n'est pas visible.
            Le badge non-lus est mis à jour via onUnreadChange.
        */}
        <div
          className="flex flex-col h-full overflow-hidden"
          style={{ display: activeTab === 'chat' ? 'flex' : 'none' }}
        >
          <VTTChatPanel
            roomId={roomId}
            userId={userId}
            userName={userName}
            role={role}
            tokens={tokens}
            externalMessage={pendingChatRoll}
            onConsumed={onChatRollConsumed}
            onUnreadChange={setUnreadChat}
            isActive={activeTab === 'chat'}
          />
        </div>

        {/* -------------------
            Onglet Combat — toujours monté, jamais démonté
            -------------------
            On utilise display:none au lieu du rendu conditionnel &&
            pour que le CombatTab reste monté en permanence.
            Cela maintient l'abonnement Supabase Realtime actif
            même quand le joueur est sur un autre onglet,
            ce qui garantit la synchro des tours en temps réel.
        */}
        <div
          className="flex flex-col h-full overflow-hidden"
          style={{ display: activeTab === 'combat' ? 'flex' : 'none' }}
        >
                   {campaignId ? (
            <VTTCombatTab
              campaignId={campaignId}
              members={members}
              onReload={reloadMembers}
              initialTokens={combatInitTokens ?? tokens}
              liveTokens={tokens}
              role={role}
              onUpdateToken={onUpdateToken}
              autoFocusCombatTurn={autoFocusCombatTurn}
              onToggleAutoFocusCombatTurn={onToggleAutoFocusCombatTurn}
              followCameraOnTokenMove={followCameraOnTokenMove}
              onToggleFollowCameraOnTokenMove={onToggleFollowCameraOnTokenMove}
              lockPlayerMovementOutsideTurn={lockPlayerMovementOutsideTurn}
              onToggleLockPlayerMovementOutsideTurn={onToggleLockPlayerMovementOutsideTurn}
              onFocusCombatTokenByLabel={onFocusCombatTokenByLabel}
              onCurrentTurnLabelChange={onCurrentTurnLabelChange}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center gap-3">
              <Swords size={32} className="text-gray-600" />
              <p className="text-xs text-gray-400">Aucune campagne liée à cette salle. Ouvrez le VTT depuis une campagne pour accéder au combat.</p>
            </div>
          )}
        </div>

        {activeTab === 'map' && (
          <div className="flex flex-col h-full">
            {/* Carte active */}
            {config.mapImageUrl && (
              <div className="relative overflow-hidden border-b border-gray-700/60 bg-gray-800 shrink-0">
                <img
                  src={config.mapImageUrl}
                  alt="Carte actuelle"
                  className="w-full h-20 object-cover"
                  onError={e => ((e.target as HTMLImageElement).style.display = 'none')}
                />
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent">
                  <p className="text-[10px] text-white truncate">
                    {config.mapImageUrl.startsWith('data:') ? 'Fichier local' : config.mapImageUrl}
                  </p>
                </div>
                <button
                  onClick={() => { if (window.confirm('Supprimer la carte ?')) onUpdateMap({ mapImageUrl: '' }); }}
                  className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-900/70 rounded text-gray-300 hover:text-red-300 transition-colors"
                  title="Retirer la carte"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            )}

            {/* Bibliothèque de cartes */}
            <div className="flex-1 overflow-hidden border-b border-gray-700/60">
<VTTMapLibrary
  roomId={roomId}
  userId={userId}
  currentMapUrl={config.mapImageUrl}
                onLoadMap={(url, width, height) => {
                  onUpdateMap({
                    mapImageUrl: url,
                    ...(width ? { mapWidth: width } : {}),
                    ...(height ? { mapHeight: height } : {}),
                  });
                  setMapUrl(url);
                }}
              />
            </div>

            {/* URL manuelle (repli) */}
            <div className="p-3 space-y-2 shrink-0">
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  <span className="flex items-center gap-1"><RefreshCw size={10} /> URL directe</span>
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={mapUrl}
                    onChange={e => setMapUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleApplyUrl(); }}
                    placeholder="https://..."
                    className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    onClick={handleApplyUrl}
                    className="px-2 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'props' && (
          <VTTPropsPanel
            props={props}
            selectedPropId={selectedPropId}
            role={role}
            roomId={roomId}
            userId={userId}
            onSelectProp={onSelectProp}
            onAddProp={onAddProp}
            onRemoveProp={onRemoveProp}
            onUpdateProp={onUpdateProp}
          />
        )}

        {activeTab === 'settings' && (
          <VTTSettingsPanel
            autoFocusCombatTurn={autoFocusCombatTurn}
            onToggleAutoFocusCombatTurn={onToggleAutoFocusCombatTurn}
            followCameraOnTokenMove={followCameraOnTokenMove}
            onToggleFollowCameraOnTokenMove={onToggleFollowCameraOnTokenMove}
            lockPlayerMovementOutsideTurn={lockPlayerMovementOutsideTurn}
            onToggleLockPlayerMovementOutsideTurn={onToggleLockPlayerMovementOutsideTurn}
            onSaveScene={onSaveScene}
            roomId={roomId}
            saving={saving}
            saveOk={saveOk}
            setSaving={setSaving}
            setSaveOk={setSaveOk}
            isGM={isGM}
          />
        )}

      </div>

      <div className="border-t border-gray-700/60 shrink-0">
        {/* -------------------
            Gestion des joueurs connectes (repliable)
            -------------------
            L'indicateur de connexion est toujours visible.
            La liste détaillée des joueurs est masquée par défaut
            et se déplie au clic sur l'indicateur.
        */}
               <div className="px-3 py-2 border-b border-gray-700/50">
          <button
            type="button"
            onClick={() => setShowConnectedUsers(prev => !prev)}
            className="w-full flex items-center justify-between"
          >
            <div className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-emerald-300' : 'text-red-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {connected ? `${connectedCount} connecté${connectedCount > 1 ? 's' : ''}` : 'Déconnecté'}
            </div>
            {connectedUsers.length > 0 && (
              showConnectedUsers
                ? <ChevronDown size={12} className="text-gray-500" />
                : <ChevronRight size={12} className="text-gray-500" />
            )}
          </button>

                {connectedUsers.length > 0 && showConnectedUsers && (
            <div className="mt-2 space-y-1.5">
              {connectedUsers.map(user => {
                // -------------------
                // Résolution du nom d'affichage d'un joueur connecté
                // -------------------
                // Priorité :
                // 1. Si MJ → "MJ"
                // 2. Si un token est assigné à ce joueur (controlledByUserIds)
                //    → on affiche le label du token (= nom du personnage)
                // 3. Sinon, si le name ressemble à un email → partie avant @
                // 4. Sinon → name brut
                let displayName: string;
                if (user.role === 'gm') {
                  displayName = 'MJ';
                } else {
                  const playerToken = tokens.find(t =>
                    t.controlledByUserIds?.includes(user.userId)
                  );
                  if (playerToken) {
                    displayName = playerToken.label;
                  } else if (user.name?.includes('@')) {
                    displayName = user.name.split('@')[0];
                  } else {
                    displayName = user.name || 'Inconnu';
                  }
                }
                return (
                  <div key={user.userId} className="flex items-center gap-2 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[9px] font-bold text-white">
                        {displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-gray-900" />
                    </div>

                    <span className="text-xs text-white truncate flex-1">
                      {displayName}
                    </span>

                    {user.role === 'gm' && (
                      <span className="text-[9px] text-amber-400 uppercase tracking-wide shrink-0">
                        MJ
                      </span>
                    )}
                  </div>
                   
                );
              })}
            </div>
          )}
        </div>

             <div className="flex">
          <button
            onClick={onHome}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-[11px]"
            title="Retour a l'accueil"
          >
            <LogOut size={12} />
            Accueil
          </button>
          <div className="w-px bg-gray-700/60" />
          <button
            onClick={onBack}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-gray-300 hover:text-red-400 hover:bg-red-950/30 transition-colors text-[11px]"
            title="Quitter la salle"
          >
            <DoorOpen size={12} />
            Quitter
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}

function TabBtn({ icon, title, active, onClick }: { icon: React.ReactNode; title: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`relative group flex-1 flex items-center justify-center py-2.5 transition-colors border-b-2 ${
        active
          ? 'text-amber-400 border-amber-500 bg-amber-500/10'
          : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-800/60'
      }`}
    >
      {icon}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {title}
      </span>
    </button>
  );
}
