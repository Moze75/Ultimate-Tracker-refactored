import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Loader2, User, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { VTTToken, VTTRole } from '../../types/vtt';
import type { Player } from '../../types/dnd';
import { PlayerContext } from '../../contexts/PlayerContext';
import { DiceRollContext } from '../ResponsiveGameLayout';
import CombatTab from '../CombatTab';
import { AbilitiesTab } from '../AbilitiesTab';
import { StatsTab } from '../StatsTab';
import { EquipmentTab } from '../EquipmentTab';
import { ClassesTabWrapper } from '../ClassesTabWrapper';
import PlayerProfileProfileTab from '../PlayerProfileProfileTab';

type TabKey = 'combat' | 'abilities' | 'stats' | 'equipment' | 'class' | 'profile';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'combat', label: 'Combat' },
  { key: 'class', label: 'Classe' },
  { key: 'abilities', label: 'Aptitudes' },
  { key: 'stats', label: 'Stats' },
  { key: 'equipment', label: 'Équip.' },
  { key: 'profile', label: 'Profil' },
];

const PANEL_WIDTH = 440;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('combat');

  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: window.innerWidth - PANEL_WIDTH - 16,
    y: 64,
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

  return (
    <div
      ref={panelRef}
      className="fixed z-50"
      style={{
        left: pos.x,
        top: pos.y,
        width,
        maxHeight: 'calc(100vh - 80px)',
        transition: collapsed !== undefined ? 'width 0.2s ease' : undefined,
        userSelect: dragging.current ? 'none' : undefined,
      }}
    >
      <div
        className="frame-card--light frame-card--tex2 frame-card--no-frame flex flex-col h-full overflow-hidden"
        style={{
          borderRadius: 6,
          boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,170,100,0.25)',
          maxHeight: 'calc(100vh - 80px)',
          border: '1px solid rgba(212,170,100,0.3)',
        }}
      >
        {/* Header / Drag handle */}
        <div
          onMouseDown={onDragMouseDown}
          className="flex items-center gap-2 px-2 py-2 shrink-0 cursor-grab active:cursor-grabbing select-none"
          style={{
            background: 'rgba(20,14,8,0.75)',
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
          <>
            {/* Tabs */}
            <div
              className="flex shrink-0 overflow-x-auto"
              style={{ background: 'rgba(20,14,8,0.55)', borderBottom: '1px solid rgba(212,170,100,0.18)' }}
            >
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex-1 py-1.5 text-xs font-medium whitespace-nowrap transition-colors relative"
                  style={{
                    fontFamily: "'Cinzel', serif",
                    color: activeTab === tab.key ? '#e8c76a' : '#9a7a4a',
                    background: activeTab === tab.key ? 'rgba(212,170,100,0.12)' : 'transparent',
                    borderBottom: activeTab === tab.key ? '2px solid #e8c76a' : '2px solid transparent',
                    letterSpacing: '0.02em',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
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
                <PlayerContext.Provider value={player}>
                  <DiceRollContext.Provider value={{ rollDice: noop }}>
                    <div className="p-3">
                      {activeTab === 'combat' && (
                        <CombatTab
                          player={player}
                          inventory={inventory}
                          onUpdate={handlePlayerUpdate}
                        />
                      )}
                      {activeTab === 'abilities' && (
                        <AbilitiesTab
                          player={player}
                          onUpdate={handlePlayerUpdate}
                          inventory={inventory}
                        />
                      )}
                      {activeTab === 'stats' && (
                        <StatsTab
                          player={player}
                          inventory={inventory}
                          onUpdate={handlePlayerUpdate}
                        />
                      )}
                      {activeTab === 'equipment' && (
                        <EquipmentTab
                          player={player}
                          inventory={inventory}
                          onPlayerUpdate={handlePlayerUpdate}
                          onInventoryUpdate={handleInventoryUpdate}
                        />
                      )}
                      {activeTab === 'class' && (
                        <ClassesTabWrapper
                          player={player}
                          onUpdate={handlePlayerUpdate}
                        />
                      )}
                      {activeTab === 'profile' && (
                        <PlayerProfileProfileTab
                          player={player}
                          onUpdate={handlePlayerUpdate}
                        />
                      )}
                    </div>
                  </DiceRollContext.Provider>
                </PlayerContext.Provider>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
