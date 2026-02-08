import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Users, Package, Send, Image, FileText, Swords } from 'lucide-react';
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
import { CombatTab } from './tabs/CombatTab';
import { DiceBox3D } from '../DiceBox3D';
import { DiceHistoryProvider } from '../../hooks/useDiceHistoryContext';
import { DiceRollData } from '../Combat/MonsterStatBlock';
import toast from 'react-hot-toast';

const BG_URL = 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/fond_ecran_ambre.png';

interface CampaignDetailViewProps {
  campaign: Campaign;
  session: any;
  onBack: () => void;
}

export function CampaignDetailView({ campaign, session, onBack }: CampaignDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'inventory' | 'gifts' | 'visuals' | 'notes' | 'combat'>('members');
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [inventory, setInventory] = useState<CampaignInventoryItem[]>([]);
  const [invitations, setInvitations] = useState<CampaignInvitation[]>([]);
  const [gifts, setGifts] = useState<(CampaignGift & { claims?: CampaignGiftClaim[] })[]>([]);
  const [giftsLoading, setGiftsLoading] = useState(false);
  const [draggableWindows, setDraggableWindows] = useState<DraggableWindowData[]>([]);
  const [diceRollData, setDiceRollData] = useState<DiceRollData | null>(null);

  const handleRollDice = useCallback((data: DiceRollData) => {
    setDiceRollData(data);
  }, []);

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
    { key: 'combat' as const, icon: Swords, label: 'Combat' },
  ];

  return (
    <div
      className="min-h-screen py-8 relative"
      style={{ backgroundImage: `url(${BG_URL})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="mb-6">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-6">
              <ArrowLeft size={20} /> Retour aux campagnes
            </button>

            <div>
              <h1 className="text-3xl font-bold text-white">{campaign.name}</h1>
              {campaign.description && <p className="text-gray-400 text-sm mt-1">{campaign.description}</p>}
            </div>
          </div>
        </div>

        <div className="bg-black/40 backdrop-blur-sm px-4 py-2 border-y border-gray-700/50 mb-8">
          <div className="grid grid-cols-3 lg:flex lg:flex-nowrap gap-x-1 gap-y-2 lg:gap-2 max-w-6xl mx-auto">
            {tabs.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`py-2 px-1 lg:px-4 flex items-center justify-center lg:justify-start gap-1 lg:gap-2 rounded-lg transition-colors whitespace-nowrap text-xs lg:text-sm ${
                  activeTab === key
                    ? 'bg-red-900/50 text-red-300 border border-red-700/50'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <Icon size={16} className="shrink-0" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4">

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
        {activeTab === 'combat' && (
          <CombatTab campaignId={campaign.id} members={members} onReload={loadMembers} onRollDice={handleRollDice} />
        )}
        </div>
      </div>

      <DraggableVisualWindows windows={draggableWindows} onClose={closeVisualWindow} onUpdatePosition={updateWindowPosition} />

      <DiceHistoryProvider>
        <DiceBox3D
          isOpen={!!diceRollData}
          onClose={() => setDiceRollData(null)}
          rollData={diceRollData}
        />
      </DiceHistoryProvider>
    </div>
  );
}
