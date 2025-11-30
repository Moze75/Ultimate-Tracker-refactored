import React, { useState, useEffect, useCallback } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { Lock, Unlock, RotateCcw, Grid3x3, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { Player } from '../types/dnd';
import { layoutService } from '../services/layoutService';
import { DEFAULT_LAYOUT } from '../types/layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface ResponsiveGameLayoutProps {
  player: Player;
  userId: string;
  onPlayerUpdate: (player: Player) => void;
  inventory: any[];
  onInventoryUpdate: (inventory: any[]) => void;
  classSections: any[] | null;
  renderPane: (key: string) => React.ReactNode;
  onToggleMode: () => void;
}

const TAB_LABELS: Record<string, { icon: string; label: string }> = {
  profile: {  label: 'Profil' },
  combat: {  label: 'Combat' },
  class: {  label: 'Classe' },
  abilities: { label: 'Capacités' },
  stats: {  label: 'Statistiques' },
  equipment: { label: 'Équipement' },
};

// ✨ EXPORT DU CONTEXTE (créé ici mais Provider dans GamePage)
export const DiceRollContext = React.createContext<{
  rollDice: (data: {
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  }) => void;
}>({
  rollDice: () => {
    console.warn('⚠️ rollDice appelé hors contexte');
  },
});

export function ResponsiveGameLayout({
  player,
  userId,
  onPlayerUpdate,
  inventory,
  onInventoryUpdate,
  classSections,
  renderPane,
  onToggleMode,
}: ResponsiveGameLayoutProps) {
  const [layouts, setLayouts] = useState(DEFAULT_LAYOUT);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Charger les préférences de layout
  useEffect(() => {
    async function loadLayout() {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        const savedLayout = await layoutService.getLayout(userId);
        if (savedLayout) {
          setLayouts(savedLayout.layouts);
          setIsLocked(savedLayout.is_locked);
        }
      } catch (error) {
        console.error('Erreur chargement layout:', error);
        toast.error('Erreur lors du chargement du layout');
      } finally {
        setIsLoading(false);
      }
    }

    loadLayout();
  }, [userId]);

  // Sauvegarder automatiquement les changements
  const handleLayoutChange = useCallback(
    (layout: Layout[], allLayouts: any) => {
      if (isLocked || isLoading) return;

      setLayouts(allLayouts);

      // Debounce la sauvegarde
      const timeoutId = setTimeout(() => {
        layoutService.saveLayout(userId, allLayouts, isLocked).catch((error) => {
          console.error('Erreur sauvegarde layout:', error);
        });
      }, 1000);

      return () => clearTimeout(timeoutId);
    },
    [userId, isLocked, isLoading]
  );

  const toggleLock = async () => {
    const newLocked = !isLocked;
    setIsLocked(newLocked);

    try {
      await layoutService.saveLayout(userId, layouts, newLocked);
      toast.success(newLocked ? '🔒 Layout verrouillé' : '🔓 Layout déverrouillé');
    } catch (error) {
      console.error('Erreur toggle lock:', error);
      toast.error('Erreur lors de la modification du verrou');
      setIsLocked(!newLocked); // Rollback
    }
  };

  const resetLayout = async () => {
    if (window.confirm('Réinitialiser le layout à sa configuration par défaut ?')) {
      try {
        await layoutService.resetLayout(userId);
        setLayouts(DEFAULT_LAYOUT);
        setIsLocked(false);
        toast.success('✨ Layout réinitialisé');
      } catch (error) {
        console.error('Erreur reset layout:', error);
        toast.error('Erreur lors de la réinitialisation');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-gray-400">Chargement du layout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Barre d'outils sticky */}
      <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 p-3 mb-4 rounded-lg flex flex-wrap items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMode}
            className="px-3 py-2 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-300 hover:bg-purple-600/30 flex items-center gap-2 text-sm transition-all"
          >
            <Grid3x3 className="w-4 h-4" />
            Retour aux onglets
          </button>

          {!isLocked && (
            <div className="hidden md:flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-300 text-xs">
              <GripVertical className="w-3 h-3" />
              Glissez les sections pour les déplacer
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLock}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-all ${
              isLocked
                ? 'bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30'
                : 'bg-green-600/20 border border-green-500/40 text-green-300 hover:bg-green-600/30'
            }`}
          >
            {isLocked ? (
              <>
                <Lock className="w-4 h-4" />
                Verrouillé
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                Édition
              </>
            )}
          </button>

          <button
            onClick={resetLayout}
            className="px-3 py-2 rounded-lg bg-gray-700/50 border border-gray-600/50 text-gray-300 hover:bg-gray-700/70 flex items-center gap-2 text-sm transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Grille responsive */}
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        // MODIFICATION ICI : 
        // On abaisse lg à 1100px pour garantir que le mode 12 colonnes 
        // s'active bien sur les écrans de desktop standards (souvent ~1280px ou ~1366px) 
        // mais aussi sur les fenêtres réduites à ~1200px sans sauter à cause de la scrollbar.
        breakpoints={{ lg: 1100, md: 996, sm: 768 }}
        cols={{ lg: 12, md: 10, sm: 6 }}
        rowHeight={60}
        isDraggable={!isLocked}
        isResizable={!isLocked}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
        compactionType="vertical"
        preventCollision={false}
        margin={[16, 16]}
        containerPadding={[0, 0]}
      > 
        {/* Les autres blocs */}
        {['profile', 'combat', 'class', 'abilities', 'stats', 'equipment'].map((key) => (
          <div
            key={key}
            className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700 flex flex-col shadow-xl"
            style={{
              transition: 'box-shadow 0.2s ease',
            }}
          >
            {/* En-tête avec poignée de drag */}
            <div
              className={`bg-gray-900/80 px-4 py-3 border-b border-gray-700 flex items-center justify-between ${
                !isLocked ? 'drag-handle cursor-move hover:bg-gray-900/90' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{TAB_LABELS[key]?.icon}</span>
                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
                  {TAB_LABELS[key]?.label}
                </h3>
              </div>

              {!isLocked && (
                <div className="flex items-center gap-1 text-gray-500">
                  <GripVertical className="w-4 h-4" />
                  <GripVertical className="w-4 h-4 -ml-2" />
                </div>
              )}
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {key === 'class' && classSections === null ? (
                <div className="py-12 text-center text-white/70">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                  Chargement des aptitudes…
                </div>
              ) : (
                renderPane(key)
              )}
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>

      {/* Styles pour la scrollbar personnalisée */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(75, 85, 99, 0.8);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 1);
        }

        /* Styles pour les handles de redimensionnement */
        .react-resizable-handle {
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .react-grid-item:hover .react-resizable-handle {
          opacity: ${isLocked ? '0' : '1'};
        }

        .react-resizable-handle-se {
          bottom: 4px;
          right: 4px;
          width: 20px;
          height: 20px;
          border-right: 2px solid rgba(147, 51, 234, 0.6);
          border-bottom: 2px solid rgba(147, 51, 234, 0.6);
        }

        /* Animation lors du drag */
        .react-grid-item.react-draggable-dragging {
          transition: none;
          z-index: 100;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        .react-grid-item.react-grid-placeholder {
          background: rgba(147, 51, 234, 0.2);
          border: 2px dashed rgba(147, 51, 234, 0.5);
          border-radius: 0.5rem;
          transition-duration: 100ms;
          z-index: 2;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          -o-user-select: none;
          user-select: none;
        }
      `}</style>
    </div>
  );
} 