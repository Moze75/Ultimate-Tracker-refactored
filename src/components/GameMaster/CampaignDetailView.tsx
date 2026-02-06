import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Package, Send, Crown, Image, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Campaign, CampaignMember, CampaignInventoryItem, CampaignInvitation, CampaignGift, CampaignGiftClaim } from '../../types/campaign';
import { campaignService } from '../../services/campaignService';
import { CampaignVisualsTab } from '../CampaignVisualsTab';
import { CampaignNotesTab } from '../CampaignNotesTab';
import { DraggableVisualWindows, DraggableWindowData } from '../DraggableVisualWindow';
import { CampaignVisual } from '../../services/campaignVisualsService';
import { MembersTab } from './tabs/MembersTab';
import { InventoryTab } from './tabs/InventoryTab';
import { GiftsTab } from './tabs/GiftsTab';
import toast from 'react-hot-toast';

const BG_URL = '/background/ddbground.png';

interface CampaignDetailViewProps {
  campaign: Campaign;
  session: any;
  onBack: () => void;
}

export function CampaignDetailView({ campaign, session, onBack }: CampaignDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'inventory' | 'gifts' | 'visuals' | 'notes'>('members');
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [inventory, setInventory] = useState<CampaignInventoryItem[]>([]);
  const [invitations, setInvitations] = useState<CampaignInvitation[]>([]);
  const [gifts, setGifts] = useState<(CampaignGift & { claims?: CampaignGiftClaim[] })[]>([]);
  const [giftsLoading, setGiftsLoading] = useState(false);
  const [draggableWindows, setDraggableWindows] = useState<DraggableWindowData[]>([]);

  useEffect(() => {
    loadMembers();
    loadInvitations();
    loadInventory();
  }, []);

  useEffect(() => {
    if (activeTab === 'members') { loadMembers(); loadInvitations(); }
    else if (activeTab === 'inventory') { loadInventory(); }
    else if (activeTab === 'gifts') { loadGifts(); }
  }, [activeTab]);

  const loadMembers = async () => {
    try {
      const data = await campaignService.getCampaignMembers(campaign.id);
      setMembers(data);
    } catch (error) {
      console.error(error);
      toast.error('Erreur chargement membres');
    }
  };

  const loadInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('campaign_invitations')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('invited_at', { ascending: false });
      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadInventory = async () => {
    try {
      const data = await campaignService.getCampaignInventory(campaign.id);
      setInventory(data);
    } catch (error) {
      console.error(error);
      toast.error('Erreur chargement inventaire');
    }
  };

  const loadGifts = async () => {
    try {
      setGiftsLoading(true);
      const data = await campaignService.getCampaignGifts(campaign.id);
      setGifts(data);
    } catch (error) {
      console.error(error);
      toast.error('Erreur chargement historique');
    } finally {
      setGiftsLoading(false);
    }
  };

  const openVisualWindow = (visual: CampaignVisual) => {
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

  const closeVisualWindow = (index: number) => {
    setDraggableWindows(draggableWindows.filter((_, i) => i !== index));
  };

  const updateWindowPosition = (index: number, position: { x: number; y: number }) => {
    const newWindows = [...draggableWindows];
    newWindows[index].position = position;
    setDraggableWindows(newWindows);
  };

  const tabs = [
    { key: 'members' as const, icon: Users, label: `Joueurs (${members.length})` },
    { key: 'inventory' as const, icon: Package, label: `Inventaire (${inventory.length})` },
    { key: 'gifts' as const, icon: Send, label: 'Envois' },
    { key: 'visuals' as const, icon: Image, label: 'Visuels' },
    { key: 'notes' as const, icon: FileText, label: 'Notes' },
  ];

  return (
    <div
      className="min-h-screen py-8 relative"
      style={{ backgroundImage: `url(${BG_URL})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-6">
            <ArrowLeft size={20} /> Retour aux campagnes
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
              <Crown className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{campaign.name}</h1>
              {campaign.description && <p className="text-gray-400 text-sm mt-1">{campaign.description}</p>}
            </div>
          </div>

          <div className="flex flex-wrap md:flex-nowrap gap-2 border-b border-gray-700">
            {tabs.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`pb-2 md:px-4 px-2 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === key
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <Icon size={20} /> {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'members' && (
          <MembersTab campaignId={campaign.id} members={members} invitations={invitations} onReload={() => { loadMembers(); loadInvitations(); }} />
        )}
        {activeTab === 'inventory' && (
          <InventoryTab campaignId={campaign.id} inventory={inventory} members={members} onReload={loadInventory} />
        )}
        {activeTab === 'gifts' && (
          <GiftsTab campaignId={campaign.id} members={members} inventory={inventory} gifts={gifts} giftsLoading={giftsLoading} onRefresh={loadGifts} />
        )}
        {activeTab === 'visuals' && (
          <CampaignVisualsTab playerId={campaign.id} userId={session?.user?.id || ''} onOpenVisual={openVisualWindow} />
        )}
        {activeTab === 'notes' && <CampaignNotesTab campaignId={campaign.id} />}
      </div>

      <DraggableVisualWindows windows={draggableWindows} onClose={closeVisualWindow} onUpdatePosition={updateWindowPosition} />
    </div>
  );
}
