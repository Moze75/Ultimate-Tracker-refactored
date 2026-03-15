import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Loader2, User, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { VTTToken, VTTRole } from '../../types/vtt';
import type { Player } from '../../types/dnd';
import { DiceRollContext } from '../ResponsiveGameLayout';
import { DesktopView } from '../DesktopView';
import { loadAbilitySections } from '../../services/classesContent';

const PANEL_WIDTH = 1300;
const COLLAPSED_WIDTH = 44;

interface VTTCharacterSheetPanelProps {
  token: VTTToken;
  role: VTTRole;
  userId: string;
  onClose: () => void;
}

export function VTTCharacterSheetPanel({ token, role, userId, onClose }: VTTCharacterSheetPanelProps) {
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

  const handlePlayerUpdate = useCallback((updated: Player) => {
    setPlayer(updated);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const { id, created_at, ...rest } = updated as any;
      await supabase.from('players').update(rest).eq('id', id);
    }, 800);
  }, []);

  const handleInventoryUpdate = useCallback((updated: any[]) => {
    setInventory(updated);
  }, []);

  const noop = useCallback((_data: { type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage'; attackName: string; diceFormula: string; modifier: number }) => {}, []);

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !dragStart.current) return;
      const dx = ev.clientX - dragStart.current.mx;
      const dy = ev.clientY - dragStart.current.my;
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

  const canOpen = token.characterId && (role === 'gm' || token.ownerUserId === userId || (token.controlledByUserIds ?? []).includes(userId));
  if (!canOpen) return null;

  const avatarUrl = token.imageUrl || player?.avatar_url;
  const width = collapsed ? COLLAPSED_WIDTH : PANEL_WIDTH;
  const maxHeight = 'calc(100vh - 60px)';

  return (
    <div
      ref={panelRef}
      className="fixed z-50"
      style={{
        left: pos.x,
        top: pos.y,
        width,
        maxHeight,
        transition: 'width 0.2s ease',
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
          className="flex items-center gap-2 px-3 py-2 shrink-0 cursor-grab active:cursor-grabbing select-none"
          style={{
            background: 'rgba(20,14,8,0.9)',
            borderBottom: '1px solid rgba(212,170,100,0.25)',
          }}
        >
          <GripVertical size={14} className="text-amber-600/60 shrink-0" />

          {!collapsed && avatarUrl ? (
            <img
              src={avatarUrl}
              alt={token.label}
              className="w-6 h-6 rounded-full object-cover shrink-0"
              style={{ border: '1px solid rgba(212,170,100,0.5)' }}
            />
          ) : !collapsed ? (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(212,170,100,0.15)', border: '1px solid rgba(212,170,100,0.35)' }}
            >
              <User size={12} style={{ color: '#c9a84c' }} />
            </div>
          ) : null}

          {!collapsed && (
            <span
              className="flex-1 text-xs font-semibold truncate"
              style={{ fontFamily: "'Cinzel', serif", color: '#EFE6D8', letterSpacing: '0.04em' }}
            >
              {token.label || player?.name || 'Personnage'}
            </span>
          )}

          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded transition-colors shrink-0"
            style={{ color: '#c9a84c' }}
            title={collapsed ? 'Déplier' : 'Replier'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {!collapsed && (
            <button
              onClick={onClose}
              className="p-1 rounded transition-colors shrink-0"
              style={{ color: '#9a7a4a' }}
              title="Fermer"
            >
              <X size={14} />
            </button>
          )}
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
              <DiceRollContext.Provider value={{ rollDice: noop }}>
                <DesktopView
                  player={player}
                  inventory={inventory}
                  onPlayerUpdate={handlePlayerUpdate}
                  onInventoryUpdate={handleInventoryUpdate}
                  classSections={classSections}
                  session={null}
                  embedded={true}
                />
              </DiceRollContext.Provider>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
