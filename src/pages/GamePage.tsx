import React, { useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { LogOut } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { Player } from '../types/dnd';
import { CampaignMember } from '../types/campaign';
import { campaignService } from '../services/campaignService';

import { PlayerProfile } from '../components/PlayerProfile';
import { TabNavigation } from '../components/TabNavigation';
import CombatTab from '../components/CombatTab';
import { EquipmentTab } from '../components/EquipmentTab';
import { AbilitiesTab } from '../components/AbilitiesTab';
import { StatsTab } from '../components/StatsTab';
import { ClassesTabWrapper } from '../components/ClassesTabWrapper';
import { PlayerContext } from '../contexts/PlayerContext';

import { ResponsiveGameLayout, DiceRollContext } from '../components/ResponsiveGameLayout';
import { Grid3x3 } from 'lucide-react';

import PlayerProfileProfileTab from '../components/PlayerProfileProfileTab';
import { loadAbilitySections } from '../services/classesContent';

import { PlayerProfileSettingsModal } from '../components/PlayerProfileSettingsModal';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useDiceSettings } from '../hooks/useDiceSettings';
import { DiceBox3D } from '../components/DiceBox3D';
import { DesktopView } from '../components/DesktopView';

import '../styles/swipe.css';

/* ===========================================================
   Types & Constantes
   =========================================================== */
type TabKey = 'combat' | 'abilities' | 'stats' | 'equipment' | 'class' | 'profile' | 'visuals';
const TAB_ORDER: TabKey[] = ['combat', 'class', 'abilities', 'stats', 'equipment', 'profile', 'visuals'];

const LAST_SELECTED_CHARACTER_SNAPSHOT = 'selectedCharacter';
const lastTabKeyFor = (playerId: string) => `ut:lastActiveTab:${playerId}`;
const isValidTab = (t: string | null): t is TabKey =>
  t === 'combat' || t === 'abilities' || t === 'stats' || t === 'equipment' || t === 'class' || t === 'profile';

type GamePageProps = {
  session: any;
  selectedCharacter: Player;
  onBackToSelection: () => void;
  onUpdateCharacter?: (p: Player) => void;
};

/* ===========================================================
   Helpers Scroll (sécurisés)
   =========================================================== */
function reallyFreezeScroll(): number {
  const y = window.scrollY || window.pageYOffset || 0;
  const body = document.body;
  (body as any).__scrollY = y;
  body.style.position = 'fixed';
  body.style.top = `-${y}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflowY = 'scroll';
  return y;
}
function reallyUnfreezeScroll() {
  const body = document.body;
  const y = (body as any).__scrollY || 0;
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  body.style.overflowY = '';
  window.scrollTo(0, y);
  delete (body as any).__scrollY;
}
function stabilizeScroll(y: number, durationMs = 350) {
  const start = performance.now();
  const tick = (now: number) => {
    window.scrollTo(0, y);
    if (now - start < durationMs) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ===========================================================
   Composant principal
   =========================================================== */
export function GamePage({
  session,
  selectedCharacter,
  onBackToSelection,
  onUpdateCharacter, 
}: GamePageProps) { 
  /* ---------------- State principal ---------------- */
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(selectedCharacter);
  const [isExiting, setIsExiting] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [classSections, setClassSections] = useState<any[] | null>(null);

  const [isGridMode, setIsGridMode] = useState(false);
  const deviceType = useResponsiveLayout();

  // 🆕 État pour gérer le fond d'écran (partagé desktop/mobile/tablet)
  const [backgroundImage, setBackgroundImage] = useState<string>(() => {
    return localStorage.getItem('desktop-background') || '/fondecran/Table.png';
  });

  // 🆕 Compteur de version pour forcer le reload du DiceBox
  const [diceBoxVersion, setDiceBoxVersion] = useState(0);

  // ✨ État pour le contexte de dés centralisé
  const [diceRollData, setDiceRollData] = useState<{
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  } | null>(null);

  const { settings: diceSettings, isLoading: isDiceSettingsLoading } = useDiceSettings();

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignMembers, setCampaignMembers] = useState<CampaignMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const hasFetchedRef = useRef(false);
  const FETCH_THROTTLE_MS = 30000; // 30 secondes
  const prevPlayerId = useRef<string | null>(selectedCharacter?.id ?? null);

  // ✅ Écouter l'événement de sauvegarde des paramètres pour déclencher le reload du DiceBox
  useEffect(() => {
    const handleSettingsChanged = () => {
      console.log('🔄 [GamePage] Paramètres sauvegardés -> Rechargement propre du DiceBox');
      setDiceBoxVersion(v => v + 1);
    };

    window.addEventListener('dice-settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('dice-settings-changed', handleSettingsChanged);
  }, []);

  useEffect(() => {
    if (prevPlayerId.current !== selectedCharacter.id) {
      hasFetchedRef.current = false;
      prevPlayerId.current = selectedCharacter.id;
    }

    // Afficher immédiatement
    setCurrentPlayer(selectedCharacter);
    setLoading(false);

    // Fetch throttled
    if (!hasFetchedRef.current) {
      const fetchTsKey = `ut:player-fetch-ts:${selectedCharacter.id}`;
      const lastFetch = parseInt(localStorage.getItem(fetchTsKey) || '0', 10);
      const elapsed = Date.now() - lastFetch;

      if (elapsed > FETCH_THROTTLE_MS) {
        hasFetchedRef.current = true;

        supabase
          .from('players')
          .select('*')
          .eq('id', selectedCharacter.id)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              localStorage.setItem(fetchTsKey, Date.now().toString());
              
              setCurrentPlayer(prev => {
                if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
                console.log('[GamePage] ✅ Sync depuis Supabase');
                localStorage.setItem(LAST_SELECTED_CHARACTER_SNAPSHOT, JSON.stringify(data));
                return data;
              });
            }
          })
          .catch(e => console.error('[GamePage] Erreur fetch:', e));
      } else {
        console.log('[GamePage] ⏳ Throttled, skip fetch');
        hasFetchedRef.current = true;
      }
    }
  }, [selectedCharacter]);

  useEffect(() => {
    const loadCampaignData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        if (!currentPlayer?.id) return;

        const campaignData = await campaignService.getPlayerCampaign(currentPlayer.id);
        if (campaignData) {
          setCampaignId(campaignData.campaignId);
          setCampaignMembers(campaignData.members);
        } else {
          setCampaignId(null);
          setCampaignMembers([]);
        }
      } catch (error) {
        console.error('[GamePage] Erreur chargement campagne:', error);
      }
    };

    loadCampaignData();
  }, [currentPlayer?.id]);

  // ✨ Fonction pour lancer les dés (partagée via Context)
  const rollDice = useCallback((data: {
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  }) => {
    console.log('🎲 [GamePage] rollDice appelé:', data);
    setDiceRollData(data);
  }, []);

   // --- START: Inventory avec cache local (GamePage) ---
  const INVENTORY_CACHE_KEY = `ut:inventory:${currentPlayer?.id}`;
  const INVENTORY_CACHE_TTL = 1000 * 60 * 60; // 1 heure de validité du cache

  useEffect(() => {
    if (!currentPlayer?.id) return;

    const cacheKey = `ut:inventory:${currentPlayer.id}`;
    const cacheTimestampKey = `ut:inventory:ts:${currentPlayer.id}`;

    const loadInventory = async () => {
      // 1. Essayer de charger depuis le cache local d'abord
      try {
        const cachedData = localStorage.getItem(cacheKey);
        const cachedTimestamp = localStorage.getItem(cacheTimestampKey);
        
        if (cachedData && cachedTimestamp) {
          const age = Date.now() - parseInt(cachedTimestamp, 10);
          if (age < INVENTORY_CACHE_TTL) {
            const parsed = JSON.parse(cachedData);
            setInventory(parsed);
            return; 
          }
        }
      } catch (e) {
        console.warn('⚠️ Erreur lecture cache inventaire:', e);
      }

      // 2. Cache expiré ou absent : fetch depuis Supabase
      if (!navigator.onLine) {
        try {
          const cachedData = localStorage.getItem(cacheKey);
          if (cachedData) {
            setInventory(JSON.parse(cachedData));
          }
        } catch {}
        return;
      }

      try {
        const { data, error } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('player_id', currentPlayer.id)
          .order('created_at', { ascending: false });

        if (data) {
          setInventory(data);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
            localStorage.setItem(cacheTimestampKey, Date.now().toString());
          } catch (e) {
            console.warn('⚠️ Erreur sauvegarde cache:', e);
          }
        }
      } catch (err) {
        console.error('💥 Erreur fetch inventaire:', err);
      }
    };

    loadInventory();
  }, [currentPlayer?.id]);

  useEffect(() => {
    const handleRefreshRequest = async (e: CustomEvent) => {
      if (e.detail?.playerId === currentPlayer?.id) {
        const cacheTimestampKey = `ut:inventory:ts:${currentPlayer.id}`;
        localStorage.removeItem(cacheTimestampKey);
        
        if (navigator.onLine) {
          const { data } = await supabase
            .from('inventory_items')
            .select('*')
            .eq('player_id', currentPlayer.id)
            .order('created_at', { ascending: false });
          
          if (data) {
            setInventory(data);
            const cacheKey = `ut:inventory:${currentPlayer.id}`;
            localStorage.setItem(cacheKey, JSON.stringify(data));
            localStorage.setItem(cacheTimestampKey, Date.now().toString());
          }
        }
      }
    };

    window.addEventListener('inventory:refresh', handleRefreshRequest as EventListener);
    return () => {
      window.removeEventListener('inventory:refresh', handleRefreshRequest as EventListener);
    };
  }, [currentPlayer?.id]);

  useEffect(() => {
    if (deviceType === 'mobile' && isGridMode) {
      setIsGridMode(false);
      toast('Mode grille disponible uniquement sur desktop', { icon: '📱' });
    }
  }, [deviceType, isGridMode]);
  
  const initialTab: TabKey = (() => {
    try {
      const saved = localStorage.getItem(lastTabKeyFor(selectedCharacter.id));
      return isValidTab(saved) ? saved : 'combat';
    } catch {
      return 'combat';
    }
  })();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

const [visitedTabs] = useState<Set<TabKey>>(
    () => new Set<TabKey>(['combat', 'class', 'abilities', 'stats', 'equipment', 'profile', 'visuals'])
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSlideFrom, setSettingsSlideFrom] = useState<'left' | 'right'>('left');

  /* ---------------- Refs layout & swipe ---------------- */
  const stageRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef<number>(0);
  const paneRefs = useRef<Record<TabKey, HTMLDivElement | null>>({} as any);

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const dragStartScrollYRef = useRef<number>(0);
  const gestureDirRef = useRef<'undetermined' | 'horizontal' | 'vertical'>('undetermined');

  const freezeActiveRef = useRef(false);
  const freezeWatchdogRef = useRef<number | null>(null);
  const hasStabilizedRef = useRef(false);

  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [containerH, setContainerH] = useState<number | undefined>(undefined);
  const [heightLocking, setHeightLocking] = useState(false);
  const recentMovesRef = useRef<Array<{ x: number; t: number }>>([]);
  const [latchedNeighbor, setLatchedNeighbor] = useState<'prev' | 'next' | null>(null);

  /* ---------------- Scroll Freeze Safe API ---------------- */
  const safeFreeze = useCallback(() => {
    if (freezeActiveRef.current) return;
    freezeActiveRef.current = true;
    dragStartScrollYRef.current = reallyFreezeScroll();
    freezeWatchdogRef.current = window.setTimeout(() => {
      if (freezeActiveRef.current) {
        safeUnfreeze(true);
      }
    }, 1200);
  }, []);

  const safeUnfreeze = useCallback((forced = false) => {
    if (!freezeActiveRef.current) return;
    freezeActiveRef.current = false;
    if (freezeWatchdogRef.current) {
      clearTimeout(freezeWatchdogRef.current);
      freezeWatchdogRef.current = null;
    }
    reallyUnfreezeScroll();
    if (!forced) {
      stabilizeScroll(dragStartScrollYRef.current, 320);
    }
  }, []);

  const resetGestureState = useCallback(() => {
    startXRef.current = null;
    startYRef.current = null;
    gestureDirRef.current = 'undetermined';
    hasStabilizedRef.current = false;
  }, []);

  const fullAbortInteraction = useCallback(() => {
    setIsInteracting(false);
    setAnimating(false);
    setDragX(0);
    setLatchedNeighbor(null);
    if (freezeActiveRef.current) safeUnfreeze();
    resetGestureState();
  }, [resetGestureState, safeUnfreeze]);

  const openSettings = useCallback(
    (dir: 'left' | 'right' = 'left') => {
      if (freezeActiveRef.current) safeUnfreeze(true); 
      fullAbortInteraction(); 
      setSettingsSlideFrom(dir);
      setSettingsOpen(true);
    },
    [fullAbortInteraction, safeUnfreeze]
  );

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  /* ---------------- Update player ---------------- */
  const applyPlayerUpdate = useCallback( 
    (updated: Player) => {
      if (isExiting) return;
      setCurrentPlayer(updated);
      try { onUpdateCharacter?.(updated); } catch (e) {}
      try { localStorage.setItem(LAST_SELECTED_CHARACTER_SNAPSHOT, JSON.stringify(updated)); } catch (e) {}
    },
    [onUpdateCharacter, isExiting, currentPlayer]
  );

  const handleBackgroundChange = useCallback((url: string) => {
    setBackgroundImage(url);
    localStorage.setItem('desktop-background', url);
  }, []);

  /* ---------------- Initialisation ---------------- */
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        setConnectionError(null);
        setCurrentPlayer((prev) =>
          prev && prev.id === selectedCharacter.id ? prev : selectedCharacter
        );
        setLoading(false);
      } catch (error: any) {
        console.error('Erreur d\'initialisation:', error);
        setConnectionError(error?.message ?? 'Erreur inconnue');
        setLoading(false);
      }
    };

    if (prevPlayerId.current !== selectedCharacter.id) {
      prevPlayerId.current = selectedCharacter.id;
      initialize();
    } else if (loading) {
      initialize();
    }
  }, [selectedCharacter.id, loading]);
 
  /* ---------------- Préchargement Sections Classe ---------------- */
  useEffect(() => {
    let cancelled = false;
    setClassSections(null);
    async function preloadClassContent() {
      const cls = selectedCharacter?.class;
      if (!cls) { setClassSections([]); return; }
      try {
        const res = await loadAbilitySections({
          className: cls,
          subclassName: (selectedCharacter as any)?.subclass ?? null,
          characterLevel: selectedCharacter?.level ?? 1,
        });
        if (!cancelled) setClassSections(res?.sections ?? []);
      } catch {
        if (!cancelled) setClassSections([]);
      }
    }
    preloadClassContent();
    return () => { cancelled = true; };
  }, [selectedCharacter?.id, selectedCharacter?.class, (selectedCharacter as any)?.subclass, selectedCharacter?.level]);

  /* ---------------- Voisins d'onglet ---------------- */
  const activeIndex = TAB_ORDER.indexOf(activeTab);
  const prevKey = activeIndex > 0 ? TAB_ORDER[activeIndex - 1] : null;
  const nextKey = activeIndex < TAB_ORDER.length - 1 ? TAB_ORDER[activeIndex + 1] : null;

  /* ---------------- Mesures ---------------- */
  const measurePaneHeight = useCallback((key: TabKey | null | undefined) => {
    if (!key) return 0;
    const el = paneRefs.current[key];
    return el?.offsetHeight ?? 0;
  }, []);

  const measureActiveHeight = useCallback(() => {
    const h = measurePaneHeight(activeTab);
    if (h) setContainerH(h);
  }, [activeTab, measurePaneHeight]);

  const measureDuringSwipe = useCallback(() => {
    const ch = measurePaneHeight(activeTab);
    const neighbor = dragX > 0 ? prevKey : dragX < 0 ? nextKey : null;
    const nh = measurePaneHeight(neighbor as any);
    const h = Math.max(ch, nh || 0);
    if (h) setContainerH(h);
  }, [activeTab, dragX, nextKey, prevKey, measurePaneHeight]);

  useEffect(() => {
    if (isInteracting || animating) return;
    const id = window.requestAnimationFrame(measureActiveHeight);
    return () => window.cancelAnimationFrame(id);
  }, [activeTab, isInteracting, animating, measureActiveHeight]);

  /* ---------------- Swipe tactile amélioré ---------------- */
  const HORIZONTAL_DECIDE_THRESHOLD = 10;
  const HORIZONTAL_DOMINANCE_RATIO = 1.10;
  const SWIPE_THRESHOLD_RATIO = 0.18;
  const SWIPE_THRESHOLD_MIN_PX = 36;
  const FLICK_VELOCITY_PX_PER_MS = 0.35;

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    gestureDirRef.current = 'undetermined';
    setAnimating(false);
    setLatchedNeighbor(null);
    recentMovesRef.current = [{ x: t.clientX, t: performance.now() }];
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startXRef.current == null || startYRef.current == null) return;

    const t = e.touches[0];
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (gestureDirRef.current === 'undetermined') {
      if (adx >= HORIZONTAL_DECIDE_THRESHOLD || ady >= HORIZONTAL_DECIDE_THRESHOLD) {
        if (adx > ady * HORIZONTAL_DOMINANCE_RATIO) {
          gestureDirRef.current = 'horizontal';
          setIsInteracting(true);
          setContainerH(measurePaneHeight(activeTab));
          safeFreeze();
        } else {
          gestureDirRef.current = 'vertical';
          return;
        }
      } else {
        return;
      }
    }

    if (gestureDirRef.current !== 'horizontal') return;

    e.preventDefault();

    let clamped = dx;
    if (!prevKey && clamped > 0) clamped = 0;
    if (!nextKey && clamped < 0) clamped = 0;

    if (clamped > 0 && prevKey) {
      if (latchedNeighbor !== 'prev') setLatchedNeighbor('prev');
    } else if (clamped < 0 && nextKey) {
      if (latchedNeighbor !== 'next') setLatchedNeighbor('next');
    }

    setDragX(clamped);
    requestAnimationFrame(measureDuringSwipe);
    const now = performance.now();
    recentMovesRef.current.push({ x: t.clientX, t: now });
    const cutoff = now - 120;
    while (recentMovesRef.current.length > 2 && recentMovesRef.current[0].t < cutoff) {
      recentMovesRef.current.shift();
    }
  };

  const animateTo = (toPx: number, cb?: () => void) => {
    setAnimating(true);
    requestAnimationFrame(() => {
      setDragX(toPx);
      window.setTimeout(() => {
        setAnimating(false);
        cb?.();
        setLatchedNeighbor(null);
      }, 310);
    });
  };

  const finishInteract = () => {
    setIsInteracting(false);
    setDragX(0);
    requestAnimationFrame(measureActiveHeight);
  };

  const onTouchEnd = () => {
    if (startXRef.current == null || startYRef.current == null) {
      resetGestureState();
      return;
    }

    if (gestureDirRef.current !== 'horizontal') {
      if (freezeActiveRef.current) safeUnfreeze();
      resetGestureState();
      return;
    }

    const width = widthRef.current || (stageRef.current?.clientWidth ?? 0);
    const threshold = Math.max(SWIPE_THRESHOLD_MIN_PX, width * SWIPE_THRESHOLD_RATIO);

    let vx = 0;
    const moves = recentMovesRef.current;
    if (moves.length >= 2) {
      const first = moves[0];
      const last = moves[moves.length - 1];
      const dt = Math.max(1, last.t - first.t);
      vx = (last.x - first.x) / dt;
    }

    const commit = (dir: -1 | 1) => {
      const toPx = dir === 1 ? -width : width;
      animateTo(toPx, () => {
        const next = dir === 1 ? nextKey : prevKey;
        if (next) {
          setActiveTab(next);
          try { localStorage.setItem(lastTabKeyFor(selectedCharacter.id), next); } catch {}
        }
        if (freezeActiveRef.current) safeUnfreeze();
        finishInteract();
        resetGestureState();
      });
    };

    const cancel = () => {
      animateTo(0, () => {
        if (freezeActiveRef.current) safeUnfreeze();
        finishInteract();
        resetGestureState();
      });
    };

    if (dragX <= -threshold && nextKey) commit(1);
    else if (dragX >= threshold && prevKey) commit(-1);
    else if (vx <= -FLICK_VELOCITY_PX_PER_MS && nextKey) commit(1);
    else if (vx >= FLICK_VELOCITY_PX_PER_MS && prevKey) commit(-1);
    else cancel();
  };

  useEffect(() => {
    const safetyRelease = () => {
      if (freezeActiveRef.current) safeUnfreeze(true);
      fullAbortInteraction();
    };
    window.addEventListener('blur', safetyRelease);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') safetyRelease();
    });
    window.addEventListener('orientationchange', safetyRelease);
    window.addEventListener('resize', safetyRelease);
    window.addEventListener('pagehide', safetyRelease);
    return () => {
      safetyRelease();
      window.removeEventListener('blur', safetyRelease);
      window.removeEventListener('visibilitychange', safetyRelease);
      window.removeEventListener('orientationchange', safetyRelease);
      window.removeEventListener('resize', safetyRelease);
      window.removeEventListener('pagehide', safetyRelease);
    };
  }, [fullAbortInteraction, safeUnfreeze]);

  const handleTabClickChange = useCallback((tab: string) => {
    if (!isValidTab(tab)) return;
    if (freezeActiveRef.current) safeUnfreeze(true);
    resetGestureState();
    setIsInteracting(false);
    setAnimating(false);
    setDragX(0);
    setLatchedNeighbor(null);

    const fromH = measurePaneHeight(activeTab);
    if (fromH > 0) {
      setContainerH(fromH);
      setHeightLocking(true);
    }
    setActiveTab(tab as TabKey);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const toH = measurePaneHeight(tab as TabKey) || fromH;
        if (toH > 0) setContainerH(toH);
        setTimeout(() => {
          setHeightLocking(false);
          requestAnimationFrame(measureActiveHeight);
        }, 280);
      });
    });

    try { localStorage.setItem(lastTabKeyFor(selectedCharacter.id), tab); } catch {}
  }, [activeTab, selectedCharacter.id, measureActiveHeight, measurePaneHeight, resetGestureState, safeUnfreeze]);

  const handleBackToSelection = () => {
    if (isExiting) return;
    if (currentPlayer) {
      localStorage.setItem(LAST_SELECTED_CHARACTER_SNAPSHOT, JSON.stringify(currentPlayer));
    }
    localStorage.removeItem(`ut:players-list:ts:${session?.user?.id}`);
    setIsExiting(true);
    onBackToSelection?.();
  };

  const renderPane = (key: TabKey | 'profile-details') => { 
    if (!currentPlayer) return null;
     
    if (key === 'profile') { 
      if (isGridMode) {
        return (
          <div className="-m-4">
            <PlayerProfile player={currentPlayer} onUpdate={applyPlayerUpdate} />
          </div>
        );
      }
      return <PlayerProfileProfileTab player={currentPlayer} onUpdate={applyPlayerUpdate} />;
    }
    
    switch (key) {
      case 'combat': {
        return (
          <div
            onTouchStart={(e) => {
              const t = e.touches[0];
              (e.currentTarget as any).__sx = t.clientX;
              (e.currentTarget as any).__sy = t.clientY;
            }}
            onTouchMove={(e) => {
              const sx = (e.currentTarget as any).__sx ?? null;
              const sy = (e.currentTarget as any).__sy ?? null; 
              if (sx == null || sy == null) return;
              const t = e.touches[0];
              const dx = t.clientX - sx;
              const dy = t.clientY - sy;
              if (Math.abs(dx) > Math.abs(dy) * 1.15 && dx > 64) {
                e.stopPropagation();
                e.preventDefault();
                openSettings('left');
              }
            }}
            onTouchEnd={(e) => {
              (e.currentTarget as any).__sx = null; 
              (e.currentTarget as any).__sy = null;
            }}
               >
            <CombatTab player={currentPlayer} inventory={inventory} onUpdate={applyPlayerUpdate} />
          </div>
        ); 
      }
      case 'class': return <ClassesTabWrapper player={currentPlayer} onUpdate={applyPlayerUpdate} />;
      case 'abilities': return <AbilitiesTab player={currentPlayer} onUpdate={applyPlayerUpdate} />;
      case 'stats': return <StatsTab player={currentPlayer} inventory={inventory} onUpdate={applyPlayerUpdate} />;
      case 'equipment':
        return (
          <EquipmentTab
            player={currentPlayer}
            inventory={inventory}
            onPlayerUpdate={applyPlayerUpdate}
            onInventoryUpdate={setInventory}
            campaignId={campaignId}
            campaignMembers={campaignMembers}
            currentUserId={currentUserId}
          />
        );
      default: return null; 
    }
  }; 

  return (
    <DiceRollContext.Provider value={{ rollDice }}>
      {(deviceType === 'mobile' || deviceType === 'tablet') && (
        <>
          <div 
            className="fixed inset-0 pointer-events-none"
            style={{
              zIndex: 0,
              overflow: 'hidden',
            }}
          >
            {backgroundImage.startsWith('color:') ? (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: backgroundImage.replace('color:', ''),
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            ) : backgroundImage.startsWith('gradient:') ? (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: backgroundImage.replace('gradient:', ''),
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            ) : (
              <img
                src={backgroundImage}
                alt="background"
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  filter: 'brightness(0.95)',
                }}
              />
            )}
          </div>
          <div 
            className="fixed inset-0 pointer-events-none bg-gray-900/70"
            style={{
              zIndex: 1,
            }}
          />
        </>
      )}

      {(() => {
        if (loading) {
          return (
            <div className="min-h-screen flex items-center justify-center relative z-50">
              <div className="text-center space-y-4">
                <img
                  src="/icons/wmremove-transformed.png"
                  alt="Chargement..."
                  className="animate-spin rounded-full h-12 w-12 mx-auto object-cover"
                />
                <p className="text-gray-400">Chargement en cours...</p>
              </div>
            </div>
          );
        }

        if (connectionError) {
          return (
            <div className="min-h-screen flex items-center justify-center p-4">
              <div className="max-w-md w-full space-y-4 stat-card p-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-red-500 mb-4">Erreur de connexion</h2>
                  <p className="text-gray-300 mb-4">{connectionError}</p>
                  <p className="text-sm text-gray-400 mb-4">
                    Vérifiez votre connexion Internet et réessayez.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setConnectionError(null);
                    setLoading(true);
                    setCurrentPlayer(selectedCharacter);
                    setLoading(false);
                  }}
                  className="w-full btn-primary px-4 py-2 rounded-lg"
                >
                  Réessayer
                </button>
              </div>
            </div>
          );
        }

        const neighborTypeRaw: 'prev' | 'next' | null = (() => {
          if (dragX > 0 && prevKey) return 'prev';
          if (dragX < 0 && nextKey) return 'next';
          return null;
        })();

        const neighborType: 'prev' | 'next' | null =
          neighborTypeRaw ?? (animating ? latchedNeighbor : null);

        const currentTransform = `translate3d(${dragX}px, 0, 0)`;
        const neighborTransform =
          neighborType === 'next'
            ? `translate3d(calc(100% + ${dragX}px), 0, 0)`
            : neighborType === 'prev'
            ? `translate3d(calc(-100% + ${dragX}px), 0, 0)`
            : undefined;
        const showAsStatic = !isInteracting && !animating;

        if ((deviceType === 'desktop' || deviceType === 'tablet') && !isGridMode && currentPlayer) {
          return (
            <>
              <div className="fixed top-4 right-4 z-50"></div>

              <DesktopView
                player={currentPlayer}
                inventory={inventory}
                onPlayerUpdate={applyPlayerUpdate}
                onInventoryUpdate={setInventory}
                classSections={classSections}
                session={session}
                onBackToSelection={handleBackToSelection}
                campaignId={campaignId}
                campaignMembers={campaignMembers}
                currentUserId={currentUserId}
              />

              <div className="w-full max-w-md mx-auto mt-6 px-4 pb-6">
                <button
                  onClick={handleBackToSelection}
                  className="w-full btn-secondary px-4 py-2 rounded-lg flex items-center justify-center gap-2"
                >
                  <LogOut size={20} />
                  Retour aux personnages
                </button>
              </div>
            </>
          );
        }

        return (
          <div className="min-h-screen p-2 sm:p-4 md:p-6 no-overflow-anchor">
            {deviceType === 'desktop' && !isGridMode && (
              <div className="fixed top-4 right-4 z-50">
                <button
                  onClick={() => {
                    setIsGridMode(true);
                    toast.success('Mode grille activé');
                  }}
                  className="px-4 py-2 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-300 hover:bg-purple-600/30 flex items-center gap-2 shadow-lg transition-all hover:scale-105"
                >
                  <Grid3x3 className="w-5 h-5" />
                  Mode Grille
                </button>
              </div>
            )}

            {!settingsOpen && !isGridMode && (
              <div
                className="fixed inset-y-0 left-0 w-4 sm:w-5 z-50"
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  (e.currentTarget as any).__sx = t.clientX;
                  (e.currentTarget as any).__sy = t.clientY;
                  (e.currentTarget as any).__edge = t.clientX <= 16;
                }}
                onTouchMove={(e) => {
                  const sx = (e.currentTarget as any).__sx ?? null;
                  const sy = (e.currentTarget as any).__sy ?? null;
                  const edge = (e.currentTarget as any).__edge ?? false;
                  if (!edge || sx == null || sy == null) return;
                  const t = e.touches[0];
                  const dx = t.clientX - sx;
                  const dy = t.clientY - sy;
                  if (Math.abs(dx) < 14) return;
                  if (Math.abs(dx) > Math.abs(dy) * 1.15 && dx > 48) {
                    e.stopPropagation();
                    e.preventDefault();
                    openSettings('left');
                  }
                }}
                onTouchEnd={(e) => {
                  (e.currentTarget as any).__sx = null;
                  (e.currentTarget as any).__sy = null;
                  (e.currentTarget as any).__edge = false;
                }}
              >
                <div className="w-full h-full" aria-hidden />
              </div>
            )}

            <div className={`w-full mx-auto space-y-4 sm:space-y-6 ${isGridMode ? 'max-w-full px-2 sm:px-4' : 'max-w-6xl'} relative z-10`}> 
              {currentPlayer && (
                <PlayerContext.Provider value={currentPlayer}>
                  {!isGridMode && (
                    <PlayerProfile 
                      player={currentPlayer} 
                      onUpdate={applyPlayerUpdate} 
                      inventory={inventory}
                      currentBackground={backgroundImage}
                      onBackgroundChange={handleBackgroundChange}
                    />
                  )}

                  {isGridMode && deviceType === 'desktop' ? (
                    <ResponsiveGameLayout
                      player={currentPlayer}
                      userId={session?.user?.id}
                      onPlayerUpdate={applyPlayerUpdate}
                      inventory={inventory}
                      onInventoryUpdate={setInventory}
                      classSections={classSections}
                      renderPane={renderPane}
                      onToggleMode={() => {
                        setIsGridMode(false);
                        toast.success('Mode onglets activé');
                      }}
                    />
                  ) : (
                    <>
                      <TabNavigation activeTab={activeTab} onTabChange={handleTabClickChange} />

                      <div
                        ref={stageRef}
                        className="relative"
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                        onTouchCancel={() => {
                          fullAbortInteraction();
                        }}
                        style={{
                          touchAction: 'pan-y',
                          height: (isInteracting || animating || heightLocking) ? containerH : undefined,
                          transition: heightLocking ? 'height 280ms ease' : undefined,
                        }}
                      >
                        {Array.from(visitedTabs).map((key) => {
                          const isActive = key === activeTab;
                          const isNeighbor =
                            (neighborType === 'next' && key === nextKey) ||
                            (neighborType === 'prev' && key === prevKey);

                          if (showAsStatic) {
                            return (
                              <div
                                key={key}
                                ref={(el) => { paneRefs.current[key] = el; }}
                                data-tab={key}
                                style={{
                                  display: isActive ? 'block' : 'none',
                                  position: 'relative',
                                  transform: 'none'
                                }}
                              >
                                {key === 'class' && classSections === null
                                  ? <div className="py-12 text-center text-white/70">Chargement des aptitudes…</div>
                                  : renderPane(key)}
                              </div>
                            );
                          }

                          const display = isActive || isNeighbor ? 'block' : 'none';
                          let transform = 'translate3d(0,0,0)';
                          if (isActive) transform = currentTransform;
                          if (isNeighbor && neighborTransform) transform = neighborTransform;

                          return (
                            <div
                              key={key}
                              ref={(el) => { paneRefs.current[key] = el; }}
                              data-tab={key}
                              className={animating ? 'sv-anim' : undefined}
                              style={{
                                position: 'absolute',
                                inset: 0,
                                display,
                                transform,
                                willChange: isActive || isNeighbor ? 'transform' : undefined
                              }}
                            >
                              {key === 'class' && classSections === null
                                ? <div className="py-12 text-center text-white/70">Chargement des aptitudes…</div>
                                : renderPane(key)}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </PlayerContext.Provider>
              )}
            </div>

            <div className="w-full max-w-md mx-auto mt-6 px-4 relative z-50">
              <button
                onClick={handleBackToSelection}
                className="w-full btn-secondary px-4 py-2 rounded-lg flex items-center justify-center gap-2"
              >
                <LogOut size={20} />
                Retour aux personnages
              </button>
            </div>

            {currentPlayer && (
              <PlayerProfileSettingsModal
                open={settingsOpen}
                onClose={closeSettings}
                player={currentPlayer}
                onUpdate={applyPlayerUpdate}
                slideFrom={settingsSlideFrom}
              />
            )}
          </div>
        );
      })()}

      {/* ✨ DiceBox3D centralisé - TOUJOURS MONTÉ mais RELOADÉ sur changement de paramètres */}
      {(() => {
        // Clé unique basée sur la version pour forcer le démontage/remontage complet
        const uniqueKey = `dice-box-v${diceBoxVersion}`;
        console.log('♾️ [GamePage] Rendu DiceBox avec Key:', uniqueKey);

        return (
          <DiceBox3D
            key={uniqueKey}
            isOpen={!!diceRollData}
            onClose={() => {
              console.log('🎲 [GamePage] DiceBox fermé');
              setDiceRollData(null);
            }}
            rollData={diceRollData}
          />
        );
      })()} 
    </DiceRollContext.Provider>
  );
}

export default GamePage; 