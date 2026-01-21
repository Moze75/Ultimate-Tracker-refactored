import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Image as ImageIcon, Eye, Maximize2 } from 'lucide-react';
import { ImageUrlInput } from './ImageUrlInput';
import { campaignVisualsService, CampaignVisual } from '../services/campaignVisualsService';
import toast from 'react-hot-toast';

interface CampaignVisualsTabProps {
  playerId: string;
  userId: string;
}

interface DraggableWindow {
  visual: CampaignVisual;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export function CampaignVisualsTab({ playerId, userId }: CampaignVisualsTabProps) {
  const [visuals, setVisuals] = useState<CampaignVisual[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [draggableWindows, setDraggableWindows] = useState<DraggableWindow[]>([]);
  const [draggingWindow, setDraggingWindow] = useState<{ index: number; offsetX: number; offsetY: number } | null>(null);
  const [newVisual, setNewVisual] = useState({
    title: '',
    image_url: '',
    description: '',
    category: 'general' as CampaignVisual['category']
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVisuals();
  }, [playerId]);

  const loadVisuals = async () => {
    try {
      const data = await campaignVisualsService.getAll(playerId);
      setVisuals(data);
    } catch (error) {
      console.error('Erreur chargement visuels:', error);
      toast.error('Erreur lors du chargement');
    }
  };

  const handleAdd = async () => {
    if (!newVisual.title.trim() || !newVisual.image_url.trim()) {
      toast.error('Le titre et l\'URL sont requis');
      return;
    }

    setLoading(true);
    try {
      await campaignVisualsService.create({
        user_id: userId,
        campaign_id: playerId,
        ...newVisual
      });
      toast.success('Visuel ajouté !');
      setNewVisual({ title: '', image_url: '', description: '', category: 'general' });
      setIsAdding(false);
      loadVisuals();
    } catch (error) {
      console.error('Erreur ajout visuel:', error);
      toast.error('Erreur lors de l\'ajout');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce visuel ?')) return;

    try {
      await campaignVisualsService.delete(id);
      toast.success('Visuel supprimé');
      loadVisuals();
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      character: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
      location: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
      item: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
      npc:  'bg-green-500/20 border-green-500/40 text-green-300',
      general: 'bg-gray-500/20 border-gray-500/40 text-gray-300'
    };
    return colors[category as keyof typeof colors] || colors.general;
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      character: 'Personnage',
      location: 'Lieu',
      item: 'Objet',
      npc: 'PNJ',
      general: 'Général'
    };
    return labels[category as keyof typeof labels] || category;
  };

  const openDraggableWindow = (visual: CampaignVisual) => {
    const windowWidth = Math.min(800, window.innerWidth * 0.8);
    const windowHeight = Math.min(600, window.innerHeight * 0.8);
    const x = (window.innerWidth - windowWidth) / 2 + draggableWindows.length * 30;
    const y = (window.innerHeight - windowHeight) / 2 + draggableWindows.length * 30;

    setDraggableWindows([...draggableWindows, {
      visual,
      position: { x, y },
      size: { width: windowWidth, height: windowHeight }
    }]);
  };

  const closeDraggableWindow = (index: number) => {
    setDraggableWindows(draggableWindows.filter((_, i) => i !== index));
  };

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    if ((e.target as HTMLElement).closest('.window-content')) return;

    const window = draggableWindows[index];
    setDraggingWindow({
      index,
      offsetX: e.clientX - window.position.x,
      offsetY: e.clientY - window.position.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingWindow) return;

    const newWindows = [...draggableWindows];
    newWindows[draggingWindow.index].position = {
      x: e.clientX - draggingWindow.offsetX,
      y: e.clientY - draggingWindow.offsetY
    };
    setDraggableWindows(newWindows);
  };

  const handleMouseUp = () => {
    setDraggingWindow(null);
  };

  useEffect(() => {
    if (draggingWindow) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingWindow, draggableWindows]);

  return (
    <div className="stat-card">
      <div className="stat-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ImageIcon className="text-purple-500" size={24} />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-100">Visuels de Campagne</h2>
        </div>
        {! isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="btn-primary px-3 py-1.5 text-sm flex items-center gap-2"
          >
            <Plus size={16} />
            Ajouter
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Formulaire d'ajout */}
        {isAdding && (
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-3 border border-purple-500/30">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <Plus size={18} />
              Nouveau visuel
            </h3>

            <input
              type="text"
              placeholder="Titre du visuel"
              value={newVisual.title}
              onChange={(e) => setNewVisual({ ...newVisual, title: e.target.value })}
              className="input-dark w-full"
            />

            <select
              value={newVisual.category}
              onChange={(e) => setNewVisual({ ...newVisual, category: e.target.value as any })}
              className="input-dark w-full"
            >
              <option value="general">Général</option>
              <option value="character">Personnage</option>
              <option value="location">Lieu</option>
              <option value="item">Objet</option>
              <option value="npc">PNJ</option>
            </select>

            <ImageUrlInput
              value={newVisual.image_url}
              onChange={(url) => setNewVisual({ ...newVisual, image_url: url })}
              label="URL de l'image"
              placeholder="https://exemple.com/image.jpg"
            />

            <textarea
              placeholder="Description (optionnelle)"
              value={newVisual.description}
              onChange={(e) => setNewVisual({ ...newVisual, description: e.target.value })}
              className="input-dark w-full min-h-[60px] text-sm"
            />

            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={loading} className="btn-primary flex-1 text-sm">
                {loading ?  'Ajout...' : 'Confirmer'}
              </button>
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setNewVisual({ title: '', image_url: '', description: '', category: 'general' });
                }} 
                className="btn-secondary flex-1 text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Liste des visuels en grille */}
        {visuals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visuals.map((visual) => (
              <div key={visual.id} className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700 group hover:border-purple-500/30 transition-colors">
                <div
                  className="aspect-video bg-gray-900 relative cursor-pointer"
                  onClick={() => window.open(visual.image_url, '_blank', 'noopener,noreferrer')}
                  title="Ouvrir dans un nouvel onglet"
                >
                  <img
                    src={visual.image_url}
                    alt={visual.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
                  </div>

                  <button
  onClick={(e) => {
    e.stopPropagation();
    openDraggableWindow(visual);
  }}
  className="absolute top-2 left-2 p-1.5 bg-blue-600/80 hover:bg-blue-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
  title="Ouvrir dans une fenêtre"
>
  <Maximize2 size={14} />
</button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(visual.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="p-3 space-y-1.5">
                  <h3 className="font-semibold text-gray-100 text-sm truncate">{visual.title}</h3>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${getCategoryColor(visual.category)}`}>
                    {getCategoryLabel(visual.category)}
                  </span>
                  {visual.description && (
                    <p className="text-xs text-gray-400 line-clamp-2">{visual.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <ImageIcon className="mx-auto text-gray-600 mb-3" size={48} />
            <p className="text-gray-500">Aucun visuel pour le moment</p>
            <p className="text-sm text-gray-600 mt-1">Ajoutez des images via URL pour illustrer votre campagne</p>
          </div>
        )}
      </div>

      {/* Fenêtres déplaçables */}
      {draggableWindows.map((win, index) => (
        <div
          key={index}
          className="fixed z-[9999] bg-gray-900 rounded-lg shadow-2xl border border-gray-700 overflow-hidden"
          style={{
            left: `${win.position.x}px`,
            top: `${win.position.y}px`,
            width: `${win.size.width}px`,
            height: `${win.size.height}px`,
          }}
        >
          <div
            className="bg-gray-800 px-4 py-3 flex items-center justify-between cursor-move border-b border-gray-700"
            onMouseDown={(e) => handleMouseDown(e, index)}
          >
            <div className="flex items-center gap-2">
              <ImageIcon size={18} className="text-purple-400" />
              <h3 className="font-semibold text-white text-sm truncate max-w-[300px]">
                {win.visual.title}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-xs border ${getCategoryColor(win.visual.category)}`}>
                {getCategoryLabel(win.visual.category)}
              </span>
            </div>
            <button
              onClick={() => closeDraggableWindow(index)}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Fermer"
            >
              <svg className="w-5 h-5 text-gray-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="window-content overflow-auto h-[calc(100%-3rem)] bg-gray-950 p-4">
            <img
              src={win.visual.image_url}
              alt={win.visual.title}
              className="w-full h-auto object-contain rounded"
            />
            {win.visual.description && (
              <div className="mt-4 p-3 bg-gray-800/50 rounded border border-gray-700">
                <p className="text-sm text-gray-300">{win.visual.description}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}