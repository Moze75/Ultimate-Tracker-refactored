import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Loader2, User } from 'lucide-react';
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
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

        if (playerRes.error) {
          setError('Impossible de charger la fiche de personnage.');
          setLoading(false);
          return;
        }

        if (!playerRes.data) {
          setError('Personnage introuvable.');
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

  const canOpen = token.characterId && (role === 'gm' || token.ownerUserId === userId || (token.controlledByUserIds ?? []).includes(userId));

  if (!canOpen) return null;

  const avatarUrl = token.imageUrl || player?.avatar_url;

  return (
    <div
      className="fixed right-0 top-0 bottom-0 z-40 flex flex-col"
      style={{ width: collapsed ? 48 : 420, transition: 'width 0.25s ease' }}
    >
      <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700/60 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 border-b border-gray-700/60 shrink-0">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors"
            title={collapsed ? 'Déplier' : 'Replier'}
          >
            {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          {!collapsed && (
            <>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={token.label}
                  className="w-7 h-7 rounded-full object-cover border border-gray-600 shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center shrink-0">
                  <User size={14} className="text-gray-400" />
                </div>
              )}
              <span className="flex-1 text-sm font-semibold text-white truncate">{token.label || player?.name || 'Personnage'}</span>
              <button
                onClick={onClose}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>

        {!collapsed && (
          <>
            {/* Tabs */}
            <div className="flex bg-gray-800/70 border-b border-gray-700/60 shrink-0 overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.key
                      ? 'text-amber-400 border-amber-400 bg-gray-800'
                      : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-700/40'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center h-40 gap-3 text-gray-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Chargement...</span>
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
