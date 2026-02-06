import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Image as ImageIcon, Eye, Maximize2 } from 'lucide-react';
import { ImageUrlInput } from './ImageUrlInput';
import { campaignVisualsService, CampaignVisual } from '../services/campaignVisualsService';
import toast from 'react-hot-toast';

interface CampaignVisualsTabProps {
  playerId: string;
  userId: string;
  onOpenVisual?: (visual: CampaignVisual) => void;
}

export function CampaignVisualsTab({ playerId, userId, onOpenVisual }: CampaignVisualsTabProps) {
  const [visuals, setVisuals] = useState<CampaignVisual[]>([]);
  const [isAdding, setIsAdding] = useState(false);
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
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
                  </div>

                  <button
  onClick={(e) => {
    e.stopPropagation();
    onOpenVisual?.(visual);
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
    </div>
  );
}