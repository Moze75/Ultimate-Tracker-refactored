import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Crown, Settings } from 'lucide-react';
import { Campaign } from '../types/campaign';
import { campaignService } from '../services/campaignService';
import { CampaignDetailView, CreateCampaignModal, EditCampaignModal } from '../components/GameMaster';
import toast from 'react-hot-toast';

const BG_URL = 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/fond_ecran_ambre.png';

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
          <Crown className="w-12 h-12 mx-auto mb-4 text-amber-400 animate-pulse" />
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
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                <Crown className="w-6 h-6 text-amber-400" />
              </div>
              <h1 className="text-3xl font-semibold tracking-wide" style={{ fontFamily: "'Cinzel', serif", color: '#EFE6D8', textShadow: '0 1px 6px rgba(0,0,0,0.45)' }}>Gestion des Campagnes</h1>
            </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 rounded-lg inline-flex items-center gap-2 hover:scale-105 transition-all"
                style={{
                  fontFamily: 'Cinzel, serif',
                  fontWeight: 600,
                  color: '#FFE8B8',
                  background: 'linear-gradient(135deg, rgba(212, 170, 96, 0.3) 0%, rgba(184, 115, 51, 0.4) 100%)',
                  border: '2px solid rgba(212, 170, 96, 0.6)',
                  boxShadow: '0 0 20px rgba(212, 170, 96, 0.4)',
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)'
                }}
              >
              <Plus size={20} /> Nouvelle campagne
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="frame-card frame-card--light frame-card--no-frame rounded-xl p-6 pb-8 hover:scale-[1.02] transition-all duration-200 group relative cursor-pointer"
            >
              <button
                onClick={(e) => { e.stopPropagation(); setEditingCampaign(campaign); }}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors z-10"
                title="Paramètres de la campagne"
              >
                <Settings size={18} />
              </button>

              <div onClick={() => setSelectedCampaign(campaign)} className="cursor-pointer">
                <div className="mb-3 pr-10">
                  <h3 className="text-xl font-semibold tracking-wide" style={{ fontFamily: "'Cinzel', serif", color: '#EFE6D8', textShadow: '0 1px 6px rgba(0,0,0,0.45)', lineHeight: 1.15 }}>{campaign.name}</h3>
                </div>

                {campaign.description && (
                  <p className="text-sm mb-4 line-clamp-2" style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>{campaign.description}</p>
                )}

                <div className="text-xs" style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(255,255,255,0.5)' }}>
                  <span>Créée le {new Date(campaign.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            </div>
          ))}

          {campaigns.length === 0 && (
            <div className="col-span-full frame-card frame-card--light frame-card--no-frame border-2 border-dashed border-amber-600/30 rounded-xl p-12 text-center">
              <Crown className="w-16 h-16 mx-auto mb-4 text-amber-600/50" />
              <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: "'Cinzel', serif", color: '#EFE6D8' }}>Aucune campagne créée</h3>
              <p className="mb-6" style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Créez votre première campagne pour commencer à gérer vos joueurs et votre inventaire</p>
                         <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 rounded-lg flex items-center gap-2 hover:scale-105 transition-all"
              style={{
                fontFamily: 'Cinzel, serif',
                fontWeight: 600,
                letterSpacing: '0.02em',
                color: '#FFE8B8',
                background: 'linear-gradient(135deg, rgba(212, 170, 96, 0.3) 0%, rgba(184, 115, 51, 0.4) 100%)',
                border: '2px solid rgba(212, 170, 96, 0.6)',
                boxShadow: '0 0 20px rgba(212, 170, 96, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.15)',
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)'
              }}
            >
              <Plus size={20} /> Nouvelle campagne
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
