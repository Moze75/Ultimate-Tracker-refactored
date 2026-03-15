import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { X, GripVertical, Loader2, Skull } from 'lucide-react';
import type { VTTToken } from '../../types/vtt';
import type { Monster } from '../../types/campaign';
import { monsterService } from '../../services/monsterService';
import { MonsterStatBlock, DiceRollData } from '../Combat/MonsterStatBlock';
import { DiceRollContext } from '../ResponsiveGameLayout';

const PANEL_WIDTH = 480;

interface VTTMonsterStatBlockPanelProps {
  token: VTTToken;
  onClose: () => void;
}

export function VTTMonsterStatBlockPanel({ token, onClose }: VTTMonsterStatBlockPanelProps) {
  const { rollDice } = useContext(DiceRollContext);
  const [monster, setMonster] = useState<Monster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(0, window.innerWidth - PANEL_WIDTH - 20),
    y: 60,
  }));

  const dragging = useRef(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMonster(null);

    const load = async () => {
      try {
        let slug = token.monsterSlug;

        if (!slug) {
          const list = await monsterService.fetchMonsterList();
          const labelLower = token.label.toLowerCase().trim();
          const match = list.find(m => m.name.toLowerCase().trim() === labelLower);
          if (!match) {
            throw new Error(`Monstre "${token.label}" introuvable dans le bestiaire.`);
          }
          slug = match.slug;
        }

        const data = await monsterService.fetchMonsterDetail(slug);
        if (!cancelled) setMonster(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Impossible de charger le statblock du monstre.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [token.monsterSlug, token.label]);

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !dragStart.current) return;
      const dx = ev.clientX - dragStart.current.mx;
      const dy = ev.clientY - dragStart.current.my;
      const newX = Math.max(0, Math.min(window.innerWidth - PANEL_WIDTH, dragStart.current.px + dx));
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
  }, [pos]);

  return (
    <div
      className="fixed z-50"
      style={{
        left: pos.x,
        top: pos.y,
        width: PANEL_WIDTH,
        maxHeight: 'calc(100vh - 80px)',
        userSelect: dragging.current ? 'none' : undefined,
      }}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          borderRadius: 8,
          boxShadow: '0 16px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(180,60,40,0.35)',
          maxHeight: 'calc(100vh - 80px)',
          border: '1px solid rgba(180,60,40,0.35)',
          background: 'rgba(10,5,4,0.97)',
        }}
      >
        {/* Drag handle */}
        <div
          onMouseDown={onDragMouseDown}
          className="flex items-center gap-2 px-3 py-2 shrink-0 cursor-grab active:cursor-grabbing select-none"
          style={{
            background: 'rgba(30,10,8,0.95)',
            borderBottom: '1px solid rgba(180,60,40,0.25)',
          }}
        >
          <GripVertical size={14} className="shrink-0" style={{ color: 'rgba(180,60,40,0.6)' }} />

          {token.imageUrl ? (
            <img
              src={token.imageUrl}
              alt={token.label}
              className="w-6 h-6 rounded-full object-cover shrink-0"
              style={{ border: '1px solid rgba(180,60,40,0.5)' }}
            />
          ) : (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(180,60,40,0.15)', border: '1px solid rgba(180,60,40,0.35)' }}
            >
              <Skull size={12} style={{ color: '#b43c28' }} />
            </div>
          )}

          <span
            className="flex-1 text-xs font-semibold truncate"
            style={{ color: '#EFE6D8', letterSpacing: '0.04em' }}
          >
            {token.label}
          </span>

          <button
            onClick={onClose}
            className="p-1 rounded transition-colors shrink-0 hover:text-red-400"
            style={{ color: '#9a4a3a' }}
            title="Fermer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ minHeight: 0 }}>
          {loading && (
            <div className="flex items-center justify-center h-40 gap-3" style={{ color: '#b43c28' }}>
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Chargement...</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center justify-center h-40 px-6 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && monster && (
            <MonsterStatBlock
              monster={monster}
              compact={false}
              onRollDice={(data: DiceRollData) => rollDice(data)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
