import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Loader2, User, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { vttService } from '../../services/vttService';
import type { VTTToken, VTTRole } from '../../types/vtt';
import type { Player } from '../../types/dnd';
import { DesktopView } from '../DesktopView';
import { loadAbilitySections } from '../../services/classesContent';

const PANEL_WIDTH = 1100;
const COLLAPSED_WIDTH = 320;

interface VTTCharacterSheetPanelProps {
  token: VTTToken;
  role: VTTRole;
  userId: string;
  onClose: () => void;
  onSyncTokenHp: (tokenId: string, hp: number | null, maxHp: number | null) => void;
  /** Appelé depuis VTTPage quand les HP du token changent en externe (auto-apply, dégâts MJ) */
  forcedHp?: number | null;
}

export function VTTCharacterSheetPanel({ token, role, userId, onClose, onSyncTokenHp, forcedHp }: VTTCharacterSheetPanelProps) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [classSections, setClassSections] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(0, (window.innerWidth - PANEL_WIDTH) / 2),
    y: 40,
  }));

  const dragging = useRef(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // -------------------
  // Sync Supabase realtime sur la table players
  // -------------------
  // Quand le MJ applique des dégâts via useCombatController.syncTokenHpToParticipant,
  // celui-ci fait un supabase.from('players').update({ current_hp }) qui déclenche
  // ce hook côté joueur B via postgres_changes — c'est le seul canal fiable
  // pour mettre à jour la feuille ouverte chez le joueur cible.
  usePlayerRealtimeSync({
    playerId: token.characterId ?? '',
    currentPlayer: player ?? ({ current_hp: 0, temporary_hp: 0 } as any),
    onPlayerUpdated: (updates) => {
      setPlayer(prev => {
        if (!prev) return prev;
        return { ...prev, ...updates };
      });
    },
    soundsEnabled: false,
  });

  

   useEffect(() => {
    if (!token.characterId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const [playerRes, invRes] = await Promise.all([
          supabase.from('players').select('*').eq('id', token.characterId!).maybeSingle(),
          supabase.from('inventory_items').select('*').eq('player_id', token.characterId!),
        ]);
        if (cancelled) return;
        if (playerRes.error || !playerRes.data) {
          setError(playerRes.error ? 'Impossible de charger la fiche.' : 'Personnage introuvable.');
          setLoading(false);
          return;
        }
        setPlayer(playerRes.data as Player);
        setInventory(invRes.data || []);
      } catch {
        if (!cancelled) setError('Erreur de chargement.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [token.characterId]);

  // -------------------
  // Synchronisation HP en temps réel
  // -------------------
  // Double écoute :
  // 1. window event 'vtt:token-hp-changed' — pour le MJ qui applique
  //    des dégâts sur sa propre machine (auto-apply local)
  // 2. vttService.onMessage TOKEN_UPDATED — pour le joueur qui reçoit
  //    le broadcast réseau quand un autre client (MJ) modifie son token
  useEffect(() => {
    // Écoute locale (MJ côté MJ)
    const windowHandler = (e: Event) => {
      const { tokenId, newHp } = (e as CustomEvent).detail;
      if (tokenId !== token.id) return;
      setPlayer(prev => {
        if (!prev) return prev;
        if (prev.current_hp === newHp) return prev;
        return { ...prev, current_hp: newHp };
      });
    };
    window.addEventListener('vtt:token-hp-changed', windowHandler);

    // Écoute réseau (joueur B reçoit broadcast du MJ)
    const unsub = vttService.onMessage((event) => {
      if (event.type !== 'TOKEN_UPDATED') return;
      if (event.tokenId !== token.id) return;
      const changes = event.changes as Partial<{ hp: number; maxHp: number }>;
      setPlayer(prev => {
        if (!prev) return prev;
        const updates: Partial<Player> = {};
        if (typeof changes.hp === 'number' && changes.hp !== prev.current_hp) {
          updates.current_hp = changes.hp;
        }
        if (typeof changes.maxHp === 'number' && changes.maxHp !== prev.max_hp) {
          updates.max_hp = changes.maxHp;
        }
        if (Object.keys(updates).length === 0) return prev;
        return { ...prev, ...updates };
      });
    });

    return () => {
      window.removeEventListener('vtt:token-hp-changed', windowHandler);
      unsub();
    };
  }, [token.id]);

  // -------------------
  // Synchronisation maxHp token → feuille (fallback)
  // -------------------
  const prevTokenMaxHpRef = useRef<number | undefined>(token.maxHp);

  useEffect(() => {
    if (token.maxHp === prevTokenMaxHpRef.current) return;
    prevTokenMaxHpRef.current = token.maxHp;
    if (typeof token.maxHp !== 'number') return;
    setPlayer(prev => {
      if (!prev) return prev;
      if (prev.max_hp === token.maxHp) return prev;
      return { ...prev, max_hp: token.maxHp as number };
    });
  }, [token.maxHp]);

  useEffect(() => {
    if (!player) return;
    let cancelled = false;
    setClassSections(null);
    async function preload() {
      const cls = player?.class;
      if (!cls) { setClassSections([]); return; }
      try {
        const res = await loadAbilitySections({
          className: cls,
          subclassName: (player as any)?.subclass ?? null,
          characterLevel: player?.level ?? 1,
        });
        if (!cancelled) setClassSections(res?.sections ?? []);
      } catch {
        if (!cancelled) setClassSections([]);
      }
    }
    preload();
    return () => { cancelled = true; };
  }, [player?.id, player?.class, (player as any)?.subclass, player?.level]);

  // -------------------
  // Gestion des mises à jour de la feuille de personnage
  // -------------------
  // handlePlayerUpdate : persiste les changements du personnage puis
  // synchronise immédiatement les PV vers le token VTT lié.
  // Cela garantit que la barre de vie du canvas, l’onglet
  // "tokens sur la carte" et les autres vues basées sur token.hp/maxHp
  // restent alignées avec la feuille de personnage.
  const handlePlayerUpdate = useCallback((updated: Player) => {
    setPlayer(updated);

    // -------------------
    // Synchronisation des PV personnage -> token
    // -------------------
    onSyncTokenHp(
      token.id,
      typeof updated.current_hp === 'number' ? updated.current_hp : null,
      typeof updated.max_hp === 'number' ? updated.max_hp : null,
    );

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const { id, created_at, ...rest } = updated as any;
      await supabase.from('players').update(rest).eq('id', id);
    }, 800);
  }, [onSyncTokenHp, token.id]);

  const handleInventoryUpdate = useCallback((updated: any[]) => {
    setInventory(updated);
  }, []);

  const hasDragged = useRef(false);

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragging.current = true;
    hasDragged.current = false;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !dragStart.current) return;
      const dx = ev.clientX - dragStart.current.mx;
      const dy = ev.clientY - dragStart.current.my;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true;
      const width = collapsed ? COLLAPSED_WIDTH : PANEL_WIDTH;
      const newX = Math.max(0, Math.min(window.innerWidth - width, dragStart.current.px + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 60, dragStart.current.py + dy));
      setPos({ x: newX, y: newY });
    };

    const onUp = () => {
      dragging.current = false;
      dragStart.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos, collapsed]);

  const onHeaderDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setCollapsed(c => !c);
  }, []);

  const canOpen = token.characterId && (role === 'gm' || token.ownerUserId === userId || (token.controlledByUserIds ?? []).includes(userId));
  if (!canOpen) return null;

  const avatarUrl = token.imageUrl || player?.avatar_url;
  const maxHeight = 'calc(100vh - 60px)';

  return (
    <div
      ref={panelRef}
      className="fixed z-50"
      style={{
        left: pos.x,
        top: pos.y,
        width: PANEL_WIDTH,
        maxHeight,
        userSelect: dragging.current ? 'none' : undefined,
      }}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          borderRadius: 8,
          boxShadow: '0 16px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(212,170,100,0.3)',
          maxHeight,
          border: '1px solid rgba(212,170,100,0.3)',
          background: 'rgba(10,7,4,0.97)',
        }}
      >
        {/* Drag handle / header */}
        <div
          onMouseDown={onDragMouseDown}
          onDoubleClick={onHeaderDoubleClick}
          className="flex items-center gap-2 px-3 py-2 shrink-0 cursor-grab active:cursor-grabbing select-none"
          style={{
            background: 'rgba(20,14,8,0.9)',
            borderBottom: collapsed ? 'none' : '1px solid rgba(212,170,100,0.25)',
          }}
          title="Double-clic pour replier / déplier"
        >
          <GripVertical size={14} className="text-amber-600/60 shrink-0" />

          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={token.label}
              className="w-6 h-6 rounded-full object-cover shrink-0"
              style={{ border: '1px solid rgba(212,170,100,0.5)' }}
            />
          ) : (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(212,170,100,0.15)', border: '1px solid rgba(212,170,100,0.35)' }}
            >
              <User size={12} style={{ color: '#c9a84c' }} />
            </div>
          )}

          <span
            className="flex-1 text-xs font-semibold truncate"
            style={{ fontFamily: "'Cinzel', serif", color: '#EFE6D8', letterSpacing: '0.04em' }}
          >
            {token.label || player?.name || 'Personnage'}
          </span>

          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded transition-colors shrink-0"
            style={{ color: '#c9a84c' }}
            title={collapsed ? 'Déplier' : 'Replier'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded transition-colors shrink-0"
            style={{ color: '#9a7a4a' }}
            title="Fermer"
          >
            <X size={14} />
          </button>
        </div>

        {!collapsed && (
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{ minHeight: 0, position: 'relative' }}
          >
            {loading && (
              <div className="flex items-center justify-center h-40 gap-3" style={{ color: '#c9a84c' }}>
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm" style={{ fontFamily: "'Cinzel', serif" }}>Chargement...</span>
              </div>
            )}

            {!loading && error && (
              <div className="flex items-center justify-center h-40 px-6 text-center">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {!loading && !error && player && (
              <DesktopView
                player={player}
                inventory={inventory}
                onPlayerUpdate={handlePlayerUpdate}
                onInventoryUpdate={handleInventoryUpdate}
                classSections={classSections}
                session={null}
                embedded={true}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
