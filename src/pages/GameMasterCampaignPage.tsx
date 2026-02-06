import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Crown, Settings } from 'lucide-react';
import { Campaign } from '../types/campaign';
import { campaignService } from '../services/campaignService';
import { CampaignDetailView, CreateCampaignModal, EditCampaignModal } from '../components/GameMaster';
import toast from 'react-hot-toast';

const BG_URL = '/background/ddbground.png';

interface GameMasterCampaignPageProps {
  session: any;
  onBack: () => void;
}

export function GameMasterCampaignPage({ session, onBack }: GameMasterCampaignPageProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await campaignService.getMyCampaigns();
      setCampaigns(data);
    } catch (error) {
      console.error('Erreur chargement campagnes:', error);
      toast.error('Erreur lors du chargement des campagnes');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundImage: `url(${BG_URL})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative text-center">
          <Crown className="w-12 h-12 mx-auto mb-4 text-purple-400 animate-pulse" />
          <p className="text-gray-200">Chargement...</p>
        </div>
      </div>
    );
  }

  if (selectedCampaign) {
    return (
      <CampaignDetailView
        campaign={selectedCampaign}
        session={session}
        onBack={() => { setSelectedCampaign(null); loadCampaigns(); }}
      />
    );
  }

  return (
    <div
      className="min-h-screen py-8 relative"
      style={{ backgroundImage: `url(${BG_URL})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-6">
            <ArrowLeft size={20} /> Retour
          </button>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                <Crown className="w-6 h-6 text-purple-400" />
              </div>
              <h1 className="text-3xl font-bold text-white">Gestion des Campagnes</h1>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary px-6 py-3 rounded-lg flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
            >
              <Plus size={20} /> Nouvelle campagne
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 hover:bg-gray-800/80 hover:border-purple-500/50 transition-all duration-200 group relative"
            >
              <button
                onClick={(e) => { e.stopPropagation(); setEditingCampaign(campaign); }}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
                title="Paramètres de la campagne"
              >
                <Settings size={18} />
              </button>

              <div onClick={() => setSelectedCampaign(campaign)} className="cursor-pointer">
                <div className="mb-3 pr-10">
                  <h3 className="text-xl font-bold text-white">{campaign.name}</h3>
                </div>

                {campaign.description && (
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{campaign.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Créée le {new Date(campaign.created_at).toLocaleDateString('fr-FR')}</span>
                  <Crown className="w-4 h-4 text-purple-400" />
                </div>
              </div>
            </div>
          ))}

          {campaigns.length === 0 && (
            <div className="col-span-full bg-gray-900/60 backdrop-blur-sm border-2 border-dashed border-gray-700 rounded-xl p-12 text-center">
              <Crown className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">Aucune campagne créée</h3>
              <p className="text-gray-500 mb-6">Créez votre première campagne pour commencer à gérer vos joueurs et votre inventaire</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary px-6 py-3 rounded-lg inline-flex items-center gap-2"
              >
                <Plus size={20} /> Créer ma première campagne
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); loadCampaigns(); }}
        />
      )}

      {editingCampaign && (
        <EditCampaignModal
          campaign={editingCampaign}
          onClose={() => setEditingCampaign(null)}
          onUpdated={() => { setEditingCampaign(null); loadCampaigns(); }}
        />
      )}
    </div>
  );
}

export default GameMasterCampaignPage;
