import React, { useEffect, useState, useMemo } from 'react'; 
import {
  ArrowLeft, Plus, Users, Package, Send, Crown, X, Trash2, Mail, Copy, Check,
  Settings, Search, Edit2, UserPlus, AlertCircle, Coins,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { campaignService } from '../services/campaignService';
import { Campaign, CampaignMember, CampaignInventoryItem, CampaignInvitation } from '../types/campaign';
import toast from 'react-hot-toast';

import { LOOT_TABLES, CURRENCY_AMOUNTS, GEM_AMOUNTS, LevelRange, Difficulty, EnemyCount } from '../data/lootTables';
import { Dices } from 'lucide-react'; // Ajoutez cette icône

// Réutilisation des modals d'équipement
import { CustomItemModal } from '../components/modals/CustomItemModal';
import { EquipmentListModal } from '../components/modals/EquipmentListModal';
import { ImageUrlInput } from '../components/ImageUrlInput';

interface GameMasterCampaignPageProps {
  session: any;
  onBack: () => void;
}

const BG_URL = '/background/ddbground.png';

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
        style={{
          backgroundImage: `url(${BG_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
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
        onBack={() => {
          setSelectedCampaign(null);
          loadCampaigns();
        }}
      />
    );
  }

  return (
    <div
      className="min-h-screen py-8 relative"
      style={{
        backgroundImage: `url(${BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/50" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={20} />
            Retour
          </button>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                <Crown className="w-6 h-6 text-purple-400" />
              </div>
              <h1 className="text-3xl font-bold text-white">
                Gestion des Campagnes
              </h1>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary px-6 py-3 rounded-lg flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
            >
              <Plus size={20} />
              Nouvelle campagne
            </button>
          </div>
        </div>

        {/* Liste des campagnes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
{campaigns.map((campaign) => (
  <div
    key={campaign.id}
    className="bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 hover:bg-gray-800/80 hover:border-purple-500/50 transition-all duration-200 group relative"
  >
    {/* ✅ Bouton Settings toujours visible (pas de opacity-0) */}
    <button
      onClick={(e) => {
        e.stopPropagation();  // Empêcher l'ouverture de la campagne
        setEditingCampaign(campaign);
      }}
      className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
      title="Paramètres de la campagne"
    >
      <Settings size={18} />
    </button>

    {/* Carte cliquable */}
    <div
      onClick={() => setSelectedCampaign(campaign)}
      className="cursor-pointer"
    >
      <div className="mb-3 pr-10">
        {/* ✅ pr-10 pour éviter que le titre chevauche l'icône */}
        <h3 className="text-xl font-bold text-white">
          {campaign.name}
        </h3>
      </div>

      {campaign.description && (
        <p className="text-sm text-gray-400 mb-4 line-clamp-2">
          {campaign.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Créée le {new Date(campaign.created_at).toLocaleDateString('fr-FR')}
        </span>
        <Crown className="w-4 h-4 text-purple-400" />
      </div>
    </div>
  </div>
))}

          {campaigns.length === 0 && (
            <div className="col-span-full bg-gray-900/60 backdrop-blur-sm border-2 border-dashed border-gray-700 rounded-xl p-12 text-center">
              <Crown className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">
                Aucune campagne créée
              </h3>
              <p className="text-gray-500 mb-6">
                Créez votre première campagne pour commencer à gérer vos joueurs et votre inventaire
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary px-6 py-3 rounded-lg inline-flex items-center gap-2"
              >
                <Plus size={20} />
                Créer ma première campagne
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de création */}
      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadCampaigns();
          }}
        />
      )}

{/* ✅ AJOUTER : Modal d'édition */}
{editingCampaign && (
  <EditCampaignModal
    campaign={editingCampaign}
    onClose={() => setEditingCampaign(null)}
    onUpdated={() => {
      setEditingCampaign(null);
      loadCampaigns();
    }}
  />
)}
      
    </div>
  );
}

// =============================================
// Modal de création de campagne
// =============================================
function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    try {
      setCreating(true);
      await campaignService.createCampaign(name.trim(), description.trim());
      toast.success('Campagne créée avec succès !');
      onCreated();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(32rem,95vw)] bg-gray-900/95 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Nouvelle campagne</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nom de la campagne *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-dark w-full px-4 py-2 rounded-lg"
              placeholder="ex: Les Mines de Phandelver"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-dark w-full px-4 py-2 rounded-lg"
              rows={4}
              placeholder="Décrivez votre campagne..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={creating}
            className="btn-secondary px-4 py-2 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="btn-primary px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Création...
              </>
            ) : (
              <>
                <Plus size={18} />
                Créer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


// =============================================
// Modal d'édition de campagne
// =============================================
function EditCampaignModal({ 
  campaign, 
  onClose, 
  onUpdated 
}: { 
  campaign: Campaign; 
  onClose: () => void; 
  onUpdated: () => void;
}) {
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description || '');
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleUpdate = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    try {
      setUpdating(true);
      await campaignService.updateCampaign(campaign.id, {
        name: name.trim(),
        description: description.trim(),
      });
      toast.success('Campagne mise à jour !');
      onUpdated();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (confirmText !== campaign.name) {
      toast.error('Le nom ne correspond pas');
      return;
    }

    try {
      setDeleting(true);
      await campaignService.deleteCampaign(campaign.id);
      toast.success('Campagne supprimée');
      onUpdated();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[10000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(40rem,95vw)] max-w-full bg-gray-900/95 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Modifier la campagne</h3>
            <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nom de la campagne *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-dark w-full px-4 py-2 rounded-lg"
                placeholder="ex: Les Mines de Phandelver"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-dark w-full px-4 py-2 rounded-lg"
                rows={4}
                placeholder="Décrivez votre campagne..."
              />
            </div>
          </div>

          <div className="space-y-3 mt-6">
            {/* Boutons Annuler / Sauvegarder en haut */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={updating || deleting}
                className="btn-secondary px-6 py-2 rounded-lg whitespace-nowrap flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdate}
                disabled={updating || deleting || !name.trim()}
                className="btn-primary px-6 py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap flex-1"
              >
                {updating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Sauvegarder
                  </>
                )}
              </button>
            </div>

            {/* Bouton Supprimer en dessous, pleine largeur */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={updating || deleting}
              className="w-full px-6 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Trash2 size={16} />
              Supprimer la campagne
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmation de suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[10001]" onClick={(e) => { if (e.target === e.currentTarget) { setShowDeleteConfirm(false); setConfirmText(''); } }}>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(32rem,90vw)] max-w-full bg-gray-900/95 border-2 border-red-500/50 rounded-xl p-6">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">⚠️ Confirmer la suppression</h3>
                <p className="text-sm text-gray-400">Cette action est irréversible</p>
              </div>
            </div>

            {/* Avertissements */}
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4 space-y-2">
              <p className="text-sm text-red-200 font-medium">
                La suppression de "{campaign.name}" entraînera :
              </p>
              <ul className="text-sm text-red-300 space-y-1 ml-4">
                <li>❌ Suppression de tous les joueurs de la campagne</li>
                <li>❌ Suppression de l'inventaire de campagne</li>
                <li>❌ Suppression des loots envoyés</li>
                <li>❌ Perte définitive de toutes les données</li>
              </ul>
            </div>

            {/* Champ de confirmation */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Pour confirmer, tapez le nom de la campagne :
              </label>
              <div className="bg-gray-800/40 rounded-lg p-3 mb-2">
                <code className="text-purple-400 font-mono text-sm">{campaign.name}</code>
              </div>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="input-dark w-full px-4 py-2 rounded-lg"
                placeholder="Tapez le nom exact..."
                autoFocus
              />
            </div>

            {/* Boutons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setConfirmText('');
                }}
                disabled={deleting}
                className="btn-secondary px-6 py-2 rounded-lg whitespace-nowrap flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting || confirmText !== campaign.name}
                className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap flex-1"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Supprimer définitivement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// =============================================
// Vue détaillée d'une campagne
// =============================================
interface CampaignDetailViewProps {
  campaign: Campaign;
  session: any;
  onBack: () => void;
}

function CampaignDetailView({ campaign, session, onBack }: CampaignDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'inventory' | 'gifts'>('members');
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [inventory, setInventory] = useState<CampaignInventoryItem[]>([]);
  const [invitations, setInvitations] = useState<CampaignInvitation[]>([]);

  useEffect(() => {
    if (activeTab === 'members') {
      loadMembers();
      loadInvitations();
    } else if (activeTab === 'inventory') {
      loadInventory();
    }
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
    // ✅ CORRECTION : Récupérer SEULEMENT les invitations, sans JOIN sur users
    const { data, error } = await supabase
      .from('campaign_invitations')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('invited_at', { ascending: false });

    if (error) throw error;
    setInvitations(data || []);
  } catch (error) {
    console.error(error);
    // ✅ Ne pas afficher d'erreur utilisateur ici, c'est normal
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

  return (
    <div
      className="min-h-screen py-8 relative"
      style={{
        backgroundImage: `url(${BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={20} />
            Retour aux campagnes
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
              <Crown className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {campaign.name}
              </h1>
              {campaign.description && (
                <p className="text-gray-400 text-sm mt-1">{campaign.description}</p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-gray-700 overflow-x-auto">
            <button
              onClick={() => setActiveTab('members')}
              className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'members'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Users size={20} />
              Joueurs ({members.length})
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'inventory'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Package size={20} />
              Inventaire ({inventory.length})
            </button>
            <button
              onClick={() => setActiveTab('gifts')}
              className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'gifts'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Send size={20} />
              Envoyer aux joueurs
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'members' && (
          <MembersTab
            campaignId={campaign.id}
            members={members}
            invitations={invitations}
            onReload={() => {
              loadMembers();
              loadInvitations();
            }}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryTab
            campaignId={campaign.id}
            inventory={inventory}
            members={members}
            onReload={loadInventory}
          />
        )}

        {activeTab === 'gifts' && (
          <GiftsTab
            campaignId={campaign.id}
            members={members}
            inventory={inventory}
          />
        )}
      </div>
    </div>
  );
}

// =============================================
// Modal de confirmation générique
// =============================================
interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmButtonText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

function ConfirmModal({
  open,
  title,
  message,
  confirmText = 'Confirmer',
  confirmButtonText = 'Confirmer',
  onConfirm,
  onCancel,
  danger = false
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10002]" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(28rem,90vw)] bg-gray-900/95 border border-gray-700 rounded-xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            danger ? 'bg-red-500/20' : 'bg-blue-500/20'
          }`}>
            <AlertCircle className={`w-6 h-6 ${danger ? 'text-red-400' : 'text-blue-400'}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
            <p className="text-sm text-gray-400">{message}</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            className="btn-secondary px-6 py-2 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-2 rounded-lg ${
              danger 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'btn-primary'
            }`}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// Onglet Joueurs
// =============================================
function MembersTab({
  campaignId,
  members,
  invitations,
  onReload
}: {
  campaignId: string;
  members: CampaignMember[];
  invitations: CampaignInvitation[];
  onReload: () => void;
}) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [confirmDeleteInvite, setConfirmDeleteInvite] = useState<string | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Joueurs de la campagne</h2>
        <button
          onClick={() => setShowInviteModal(true)}
          className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <UserPlus size={18} />
          Inviter un joueur
        </button>
      </div>

{/* Invitations en attente */}
{invitations.filter(inv => inv.status === 'pending').length > 0 && (
  <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
    <h3 className="text-sm font-semibold text-amber-300 mb-3">
      Invitations en attente ({invitations.filter(inv => inv.status === 'pending').length})
    </h3>
    <div className="space-y-2">
      {invitations
        .filter(inv => inv.status === 'pending')
        .map((inv) => (
          <div
            key={inv.id}
            className="bg-gray-900/40 rounded-lg p-3 flex items-center justify-between"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-200">{inv.player_email}</p>
              <p className="text-xs text-gray-500 mt-1">
                Envoyée le {new Date(inv.invited_at).toLocaleDateString('fr-FR')} • ⏳ En attente
              </p>
            </div>
            
<button
  onClick={() => setConfirmDeleteInvite(inv.id)}
  className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
  title="Supprimer l'invitation"
>
  <Trash2 size={16} />
</button>
          </div>
        ))} 
    </div>
  </div>
)}

{/* Liste des membres */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {members.map((member) => (
    <div
      key={member.id}
      className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-white">
            {member.player_name || 'Personnage non défini'}
          </h3>
          <p className="text-sm text-gray-400 mt-1">{member.email}</p>
          <p className="text-xs text-gray-500 mt-2">
            Rejoint le {new Date(member.joined_at).toLocaleDateString('fr-FR')}
          </p>
        </div>
<button
  onClick={() => setConfirmRemoveMember(member.id)}
  className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg"
  title="Retirer"
>
  <Trash2 size={16} />
</button>
      </div>
    </div>
  ))}

  {members.length === 0 && (
    <div className="col-span-full text-center py-12 text-gray-500 bg-gray-900/30 rounded-lg border-2 border-dashed border-gray-700">
      Aucun joueur dans la campagne.
      <br />
      <span className="text-sm">Invitez des joueurs pour commencer !</span>
    </div>
  )}
</div>

      {/* ✅ AJOUTER : Modal confirmation suppression invitation */}
      <ConfirmModal
        open={confirmDeleteInvite !== null}
        title="Supprimer l'invitation"
        message="Voulez-vous vraiment supprimer cette invitation ?"
        confirmButtonText="Supprimer"
        onConfirm={async () => {
          if (!confirmDeleteInvite) return;
          try {
            await campaignService.deleteInvitation(confirmDeleteInvite);
            toast.success('Invitation supprimée');
            onReload();
          } catch (error) {
            console.error(error);
            toast.error('Erreur lors de la suppression');
          } finally {
            setConfirmDeleteInvite(null);
          }
        }}
        onCancel={() => setConfirmDeleteInvite(null)}
        danger
      />

      {/* ✅ AJOUTER : Modal confirmation retirer membre */}
      <ConfirmModal
        open={confirmRemoveMember !== null}
        title="Retirer le joueur"
        message="Voulez-vous vraiment retirer ce joueur de la campagne ?"
        confirmButtonText="Retirer"
        onConfirm={async () => {
          if (!confirmRemoveMember) return;
          try {
            await campaignService.removeMember(confirmRemoveMember);
            toast.success('Joueur retiré');
            onReload();
          } catch (error) {
            console.error(error);
            toast.error('Erreur');
          } finally {
            setConfirmRemoveMember(null);
          }
        }}
        onCancel={() => setConfirmRemoveMember(null)}
        danger
      />

      {/* ✅ AJOUTER CETTE MODAL MANQUANTE */}
      {showInviteModal && (
        <InvitePlayerModal
          campaignId={campaignId}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {
            setShowInviteModal(false);
            onReload();
          }}
        />
      )}
    </div>
  );
}

// =============================================
// Modal d'invitation (SYSTÈME SIMPLIFIÉ)
// =============================================
function InvitePlayerModal({
  campaignId,
  onClose,
  onInvited
}: {
  campaignId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    const cleanEmail = email.trim().toLowerCase();
    
    if (!cleanEmail) {
      toast.error('Email requis');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error('Email invalide');
      return;
    }

    try {
      setInviting(true);
      await campaignService.invitePlayerByEmail(campaignId, cleanEmail);
      toast.success(`Invitation envoyée à ${cleanEmail}`);
      setEmail('');
      onInvited();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erreur lors de l\'invitation');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(32rem,95vw)] bg-gray-900/95 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Inviter un joueur</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email du joueur
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-dark w-full px-4 py-2 rounded-lg"
              placeholder="joueur@exemple.com"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInvite();
              }}
            />
            <p className="text-xs text-gray-500 mt-2">
              Le joueur recevra une invitation et devra sélectionner son personnage pour rejoindre la campagne.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={inviting}
            className="btn-secondary px-4 py-2 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleInvite}
            disabled={inviting || !email.trim()}
            className="btn-primary px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {inviting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Envoi...
              </>
            ) : (
              <>
                <Mail size={18} />
                Inviter
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ... (gardez tout le code existant jusqu'à la fonction InventoryTab)

// =============================================
// Onglet Inventaire - IMPLÉMENTATION COMPLÈTE
// =============================================
function InventoryTab({
  campaignId,
  inventory,
  members,
  onReload
}: {
  campaignId: string;
  inventory: CampaignInventoryItem[];
  members: CampaignMember[];
  onReload: () => void;
}) {
  const [showList, setShowList] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [editingItem, setEditingItem] = useState<CampaignInventoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickSendItem, setQuickSendItem] = useState<CampaignInventoryItem | null>(null);

  const META_PREFIX = '#meta:';

  const getVisibleDescription = (description: string | null | undefined): string => {
    if (!description) return '';
    return description
      .split('\n')
      .filter(line => !line.trim().startsWith(META_PREFIX))
      .join('\n')
      .trim();
  };

  const parseMeta = (description: string | null | undefined) => {
    if (!description) return null;
    const lines = description.split('\n').map(l => l.trim());
    const metaLine = [...lines].reverse().find(l => l.startsWith(META_PREFIX));
    if (!metaLine) return null;
    try {
      return JSON.parse(metaLine.slice(META_PREFIX.length));
    } catch {
      return null;
    }
  };

  const filteredInventory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(item => 
      item.name.toLowerCase().includes(q) || 
      (item.description || '').toLowerCase().includes(q)
    );
  }, [inventory, searchQuery]);

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Supprimer cet objet de l\'inventaire de campagne ?')) return;
    
    try {
      await campaignService.deleteCampaignItem(itemId);
      toast.success('Objet supprimé');
      onReload();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header avec actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl font-semibold text-white">Inventaire de la campagne</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowList(true)}
            className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus size={20} />
            Liste d'équipement
          </button>
          <button
            onClick={() => setShowCustom(true)}
            className="px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700/40 text-gray-200 flex items-center gap-2"
          >
            <Plus size={18} />
            Objet personnalisé
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="flex items-center gap-2">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher dans l'inventaire..."
          className="input-dark flex-1 px-4 py-2 rounded-lg"
        />
      </div>

      {/* Liste des objets */}
      {filteredInventory.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/30 rounded-lg border-2 border-dashed border-gray-700">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">
            {searchQuery ? 'Aucun résultat' : 'Inventaire vide'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchQuery 
              ? 'Aucun objet ne correspond à votre recherche'
              : 'Ajoutez des objets pour créer votre inventaire de campagne'
            }
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowList(true)}
              className="btn-primary px-6 py-3 rounded-lg inline-flex items-center gap-2"
            >
              <Plus size={20} />
              Ajouter un objet
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInventory.map((item) => {
            const meta = parseMeta(item.description);
            
            return (
              <div
                key={item.id}
                className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800/60 transition-colors"
              >
<div className="flex items-start justify-between mb-2">
  {/* ✅ NOUVEAU : Miniature */}
  {meta?.imageUrl && (
    <img
      src={meta.imageUrl}
      alt={item.name}
      className="w-16 h-16 rounded object-cover border border-gray-600/50 mr-3 flex-shrink-0"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  )}
  
  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-white truncate">{item.name}</h3>
                      
                      {/* ✅ BADGE TYPE */}
                      {meta?.type === 'armor' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 border border-purple-500/30">
                          Armure
                        </span>
                      )}
                      {meta?.type === 'shield' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-500/30">
                          Bouclier
                        </span>
                      )}
                      {meta?.type === 'weapon' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-500/30">
                          Arme
                        </span>
                      )}
                    </div>

                    {item.quantity > 1 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-300 mt-1 inline-block">
                        x{item.quantity}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setQuickSendItem(item)}
                      className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-900/30 rounded"
                      title="Envoyer aux joueurs"
                    >
                      <Send size={16} />
                    </button>
                    <button
                      onClick={() => setEditingItem(item)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded"
                      title="Modifier"
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* ✅ PROPRIÉTÉS VISUELLES */}
                {meta && (
                  <div className="mb-2 space-y-1 text-xs">
                    {meta.type === 'armor' && meta.armor && (
                      <div className="text-purple-300">
                        🛡️ CA: {meta.armor.label}
                      </div>
                    )}
                    {meta.type === 'shield' && meta.shield && (
                      <div className="text-blue-300">
                        🛡️ Bonus: +{meta.shield.bonus}
                      </div>
                    )}
                    {meta.type === 'weapon' && meta.weapon && (
                      <div className="text-red-300">
                        ⚔️ {meta.weapon.damageDice} {meta.weapon.damageType}
                        {meta.weapon.properties && ` • ${meta.weapon.properties}`}
                      </div>
                    )}
                  </div>
                )}

                {/* Description visible */}
                {getVisibleDescription(item.description) && (
                  <p className="text-sm text-gray-400 line-clamp-2 mb-2">
                    {getVisibleDescription(item.description)}
                  </p>
                )}

                <div className="mt-3 text-xs text-gray-500">
                  Ajouté le {new Date(item.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
{showList && (
  <EquipmentListModal
    onClose={() => {
      setShowList(false);
      onReload();  // ✅ Recharger UNIQUEMENT à la fermeture
    }}
    onAddItem={async (payload) => {
      try {
        const META_PREFIX = '#meta:';
        const metaLine = `${META_PREFIX}${JSON.stringify(payload.meta)}`;
        const visibleDesc = (payload.description || '').trim();
        const fullDescription = visibleDesc 
          ? `${visibleDesc}\n${metaLine}`
          : metaLine;

        await campaignService.addItemToCampaign(
          campaignId,
          payload.name,
          fullDescription,
          payload.meta.quantity || 1
        );
        
        // ✅ NE PAS RECHARGER ICI, seulement à la fermeture
      } catch (error) {
        console.error(error);
        toast.error('Erreur lors de l\'ajout');
        throw error;
      }
    }}
    allowedKinds={null}
    multiAdd={true}
  />
)}

      {showCustom && (
        <CustomItemModal
          onClose={() => setShowCustom(false)}
          onAdd={async (payload) => {
            try {
              const META_PREFIX = '#meta:';
              const metaLine = `${META_PREFIX}${JSON.stringify(payload.meta)}`;
              const visibleDesc = (payload.description || '').trim();
              const fullDescription = visibleDesc 
                ? `${visibleDesc}\n${metaLine}`
                : metaLine;

              await campaignService.addItemToCampaign(
                campaignId,
                payload.name,
                fullDescription,
                payload.meta.quantity || 1
              );
              
              toast.success('Objet personnalisé ajouté');
              onReload();
            } catch (error) {
              console.error(error);
              toast.error('Erreur lors de l\'ajout');
            } finally {
              setShowCustom(false);
            }
          }}
        />
      )}

      {editingItem && (
        <EditCampaignItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            onReload();
          }}
        />
      )}

      {quickSendItem && (
        <QuickSendItemModal
          campaignId={campaignId}
          item={quickSendItem}
          members={members}
          onClose={() => setQuickSendItem(null)}
          onSent={() => {
            setQuickSendItem(null);
            onReload();
          }}
        />
      )}
    </div>
  );
}

// =============================================
// Modal d'édition d'objet de campagne (AVEC BONUS)
// =============================================
function EditCampaignItemModal({
  item,
  onClose,
  onSaved
}: {
  item: CampaignInventoryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const META_PREFIX = '#meta:';

  // États de base
  const [name, setName] = useState(item.name || '');
  const [visibleDescription, setVisibleDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(item.quantity || 1);
  const [saving, setSaving] = useState(false);

  // Méta spécifiques
  const [type, setType] = useState<string | null>(null);
  // armor
  const [armorBase, setArmorBase] = useState<number | null>(null);
  const [armorAddDex, setArmorAddDex] = useState<boolean>(true);
  const [armorDexCap, setArmorDexCap] = useState<number | null>(null);
  // weapon
  const [weaponDamageDice, setWeaponDamageDice] = useState<string>('');
  const [weaponDamageType, setWeaponDamageType] = useState<string>('');
  const [weaponProperties, setWeaponProperties] = useState<string>('');
  const [weaponRange, setWeaponRange] = useState<string>('');
  const [weaponCategory, setWeaponCategory] = useState<string>('');
  const [weaponBonus, setWeaponBonus] = useState<number | null>(null);
  const [weaponPropTags, setWeaponPropTags] = useState<string[]>([]);
  // shield
  const [shieldBonus, setShieldBonus] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = React.useState<string>('');

  // ✅ AJOUT : États pour les bonus (jewelry, equipment, tool, other)
  const [bonusStr, setBonusStr] = React.useState<number | ''>('');
  const [bonusDex, setBonusDex] = React.useState<number | ''>('');
  const [bonusCon, setBonusCon] = React.useState<number | ''>('');
  const [bonusInt, setBonusInt] = React.useState<number | ''>('');
  const [bonusWis, setBonusWis] = React.useState<number | ''>('');
  const [bonusCha, setBonusCha] = React.useState<number | ''>('');
  const [bonusAC, setBonusAC] = React.useState<number | ''>('');

  // Listes de choix
  const DAMAGE_TYPES = ['Tranchant', 'Perforant', 'Contondant'] as const;
  const WEAPON_CATEGORIES = [
    'Armes courantes',
    'Armes de guerre',
    'Armes de guerre dotées de la propriété Légère',
    'Armes de guerre présentant la propriété Finesse ou Légère',
  ] as const;
  const RANGES = [
    'Corps à corps',
    'Contact',
    '1,5 m',
    '3 m', '6 m', '9 m', '12 m', '18 m',
    '24 m', '30 m', '36 m', '45 m', '60 m', '90 m', '120 m'
  ] as const;
  const PROPERTY_TAGS = ['Finesse', 'Légère', 'Lancer', 'Polyvalente', 'Deux mains', 'Lourde', 'Allonge', 'Munitions', 'Chargement'] as const;

  // Helpers meta
  const parseMeta = (description: string | null | undefined) => {
    if (!description) return null;
    const lines = description.split('\n').map(l => l.trim());
    const metaLine = [...lines].reverse().find(l => l.startsWith(META_PREFIX));
    if (!metaLine) return null;
    try {
      return JSON.parse(metaLine.slice(META_PREFIX.length));
    } catch {
      return null;
    }
  };

  const stripMetaFromDescription = (description: string | null | undefined) => {
    if (!description) return '';
    return description
      .split('\n')
      .filter(line => !line.trim().startsWith(META_PREFIX))
      .join('\n')
      .trim();
  };

  // Initialisation
  useEffect(() => {
    const vis = stripMetaFromDescription(item.description);
    setVisibleDescription(vis);
    const meta = parseMeta(item.description);

    if (meta) {
      setType(meta.type || null);
      setQuantity(meta.quantity ?? item.quantity ?? 1);

      if (meta.type === 'armor' && meta.armor) {
        setArmorBase(meta.armor.base ?? null);
        setArmorAddDex(meta.armor.addDex ?? true);
        setArmorDexCap(meta.armor.dexCap ?? null);
      }

      if (meta.type === 'weapon' && meta.weapon) {
        setWeaponDamageDice(meta.weapon.damageDice || '1d6');
        setWeaponDamageType(
          (meta.weapon.damageType && (DAMAGE_TYPES as readonly string[]).includes(meta.weapon.damageType as any))
            ? meta.weapon.damageType
            : 'Tranchant'
        );
        const propRaw = meta.weapon.properties || '';
        const initTags = PROPERTY_TAGS.filter(t => propRaw.toLowerCase().includes(t.toLowerCase()));
        setWeaponPropTags(initTags);
        setWeaponProperties(propRaw);
        setWeaponRange(
          (meta.weapon.range && (RANGES as readonly string[]).includes(meta.weapon.range as any))
            ? meta.weapon.range
            : 'Corps à corps'
        );
        setWeaponCategory(
          (meta.weapon.category && (WEAPON_CATEGORIES as readonly string[]).includes(meta.weapon.category as any))
            ? meta.weapon.category
            : 'Armes courantes'
        );
        setWeaponBonus(meta.weapon.weapon_bonus ?? null);
      }

      if (meta.type === 'shield' && meta.shield) {
        setShieldBonus(meta.shield.bonus ?? null);
      }

      // ✅ AJOUT : Charger les bonus existants
      if (meta.bonuses) {
        setBonusStr(meta.bonuses.strength ?? '');
        setBonusDex(meta.bonuses.dexterity ?? '');
        setBonusCon(meta.bonuses.constitution ?? '');
        setBonusInt(meta.bonuses.intelligence ?? '');
        setBonusWis(meta.bonuses.wisdom ?? '');
        setBonusCha(meta.bonuses.charisma ?? '');
        setBonusAC(meta.bonuses.armor_class ?? '');
      }

      setImageUrl(meta.imageUrl || '');
    } else {
      setType(null);
      setQuantity(item.quantity || 1);
    }
  }, [item]);

  // Defaults si l'utilisateur change le Type => 'weapon'
  useEffect(() => {
    if (type === 'weapon') {
      setWeaponDamageDice(prev => prev || '1d6');
      setWeaponDamageType(prev => (prev && (DAMAGE_TYPES as readonly string[]).includes(prev as any) ? prev : 'Tranchant'));
      setWeaponRange(prev => (prev && (RANGES as readonly string[]).includes(prev as any) ? prev : 'Corps à corps'));
      setWeaponCategory(prev => (prev && (WEAPON_CATEGORIES as readonly string[]).includes(prev as any) ? prev : 'Armes courantes'));
    }
  }, [type]);

  // Construire meta depuis l'UI
  const buildMeta = () => {
    if (!type) return null;
    const baseMeta: any = {
      type,
      quantity: quantity || 1,
      equipped: false,
      imageUrl: imageUrl.trim() || undefined,
    };

    if (type === 'armor') {
      baseMeta.armor = {
        base: armorBase ?? 0,
        addDex: armorAddDex,
        dexCap: armorDexCap ?? null,
        label: (() => {
          const base = armorBase ?? 0;
          let label = `${base}`;
          if (armorAddDex) label += ' + modificateur de Dex';
          if (armorDexCap != null) label += ` (max ${armorDexCap})`;
          return label;
        })()
      };
    } else if (type === 'weapon') {
      const properties = (weaponPropTags.length ? weaponPropTags.join(', ') : weaponProperties || '').trim();
      baseMeta.weapon = {
        damageDice: weaponDamageDice || '1d6',
        damageType: weaponDamageType || 'Tranchant',
        properties,
        range: weaponRange || 'Corps à corps',
        category: weaponCategory || 'Armes courantes',
        weapon_bonus: weaponBonus
      };
    } else if (type === 'shield') {
      baseMeta.shield = { bonus: shieldBonus ?? 0 };
    }

    // ✅ AJOUT : Ajouter les bonus si présents (jewelry, equipment, tool, other)
    const hasBonuses = 
      bonusStr !== '' || bonusDex !== '' || bonusCon !== '' || 
      bonusInt !== '' || bonusWis !== '' || bonusCha !== '' || bonusAC !== '';

    if (hasBonuses) {
      baseMeta.bonuses = {};
      if (bonusStr !== '') baseMeta.bonuses.strength = Number(bonusStr);
      if (bonusDex !== '') baseMeta.bonuses.dexterity = Number(bonusDex);
      if (bonusCon !== '') baseMeta.bonuses.constitution = Number(bonusCon);
      if (bonusInt !== '') baseMeta.bonuses.intelligence = Number(bonusInt);
      if (bonusWis !== '') baseMeta.bonuses.wisdom = Number(bonusWis);
      if (bonusCha !== '') baseMeta.bonuses.charisma = Number(bonusCha);
      if (bonusAC !== '') baseMeta.bonuses.armor_class = Number(bonusAC);
    }

    return baseMeta;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setSaving(true);
    try {
      const metaObj = buildMeta();
      const metaLine = metaObj ? `${META_PREFIX}${JSON.stringify(metaObj)}` : null;
      const cleanVisible = (visibleDescription || '').trim();
      const finalDescription = metaLine
        ? (cleanVisible ? `${cleanVisible}\n${metaLine}` : metaLine)
        : cleanVisible;

      await campaignService.updateCampaignItem(item.id, {
        name: name.trim(),
        description: finalDescription,
        quantity: quantity,
      });

      toast.success('Objet mis à jour');
      onSaved();
    } catch (err) {
      console.error('Erreur save item:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(40rem,95vw)] max-h-[90vh] overflow-y-auto bg-gray-900/95 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Modifier l'objet</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-dark w-full px-4 py-2 rounded-lg"
              placeholder="Nom de l'objet"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Quantité</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="input-dark w-full px-4 py-2 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Type (méta)</label>
              <select
                value={type || ''}
                onChange={(e) => setType(e.target.value || null)}
                className="input-dark w-full px-4 py-2 rounded-lg"
              >
                <option value="">Aucun (objet générique)</option>
                <option value="armor">Armure</option>
                <option value="shield">Bouclier</option>
                <option value="weapon">Arme</option>
                <option value="jewelry">Bijou</option>
                <option value="equipment">Équipement</option>
                <option value="tool">Outil</option>
                <option value="other">Autre</option>
              </select>
            </div>
          </div>

          {/* Armor */}
          {type === 'armor' && (
            <div className="space-y-2 bg-gray-800/30 p-3 rounded">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-400">Base</label>
                  <input type="number" className="input-dark w-full px-2 py-1 rounded" value={armorBase ?? ''} onChange={(e) => setArmorBase(e.target.value ? parseInt(e.target.value) : null)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Add Dex</label>
                  <select className="input-dark w-full px-2 py-1 rounded" value={armorAddDex ? 'true' : 'false'} onChange={(e) => setArmorAddDex(e.target.value === 'true')}>
                    <option value="true">Oui</option>
                    <option value="false">Non</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Dex cap (optionnel)</label>
                  <input type="number" className="input-dark w-full px-2 py-1 rounded" value={armorDexCap ?? ''} onChange={(e) => setArmorDexCap(e.target.value ? parseInt(e.target.value) : null)} />
                </div>
              </div>
            </div>
          )}

          {/* Weapon */}
          {type === 'weapon' && (
            <div className="space-y-2 bg-gray-800/30 p-3 rounded">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">Dégâts (ex: 1d6)</label>
                  <input className="input-dark w-full px-2 py-1 rounded" value={weaponDamageDice} onChange={(e) => setWeaponDamageDice(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Type de dégâts</label>
                  <select className="input-dark w-full px-2 py-1 rounded" value={weaponDamageType || 'Tranchant'} onChange={(e) => setWeaponDamageType(e.target.value)}>
                    {Array.from(DAMAGE_TYPES).map((dt) => (<option key={dt} value={dt}>{dt}</option>))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-gray-400">Propriétés (cases à cocher)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from(PROPERTY_TAGS).map(tag => {
                      const checked = weaponPropTags.includes(tag);
                      return (
                        <label key={tag} className="inline-flex items-center gap-2 text-xs text-gray-200">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setWeaponPropTags(prev => e.target.checked ? [...prev, tag] : prev.filter(t => t !== tag));
                            }}
                          />
                          <span>{tag}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Finesse/Légère/Lancer/Polyvalente influencent STR/DEX en mêlée.</p>
                </div>

                <div>
                  <label className="text-xs text-gray-400">Portée</label>
                  <select className="input-dark w-full px-2 py-1 rounded" value={weaponRange || 'Corps à corps'} onChange={(e) => setWeaponRange(e.target.value)}>
                    {Array.from(RANGES).map((r) => (<option key={r} value={r}>{r}</option>))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400">Catégorie</label>
                  <select className="input-dark w-full px-2 py-1 rounded" value={weaponCategory || 'Armes courantes'} onChange={(e) => setWeaponCategory(e.target.value)}>
                    {Array.from(WEAPON_CATEGORIES).map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400">Bonus de l'arme</label>
                  <input type="number" className="input-dark w-full px-2 py-1 rounded" value={weaponBonus ?? ''} onChange={(e) => setWeaponBonus(e.target.value ? parseInt(e.target.value) : null)} />
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-gray-400">Propriétés (libre, optionnel)</label>
                  <input className="input-dark w-full px-2 py-1 rounded" value={weaponProperties} onChange={(e) => setWeaponProperties(e.target.value)} placeholder="Compléments éventuels" />
                </div>
              </div>
            </div>
          )}

          {/* Shield */}
          {type === 'shield' && (
            <div className="space-y-2 bg-gray-800/30 p-3 rounded">
              <div>
                <label className="text-xs text-gray-400">Bonus</label>
                <input type="number" className="input-dark w-full px-2 py-1 rounded" value={shieldBonus ?? ''} onChange={(e) => setShieldBonus(e.target.value ? parseInt(e.target.value) : null)} />
              </div>
            </div>
          )}

          {/* ✅ AJOUT : Section bonus pour jewelry, equipment, tool, other */}
          {(type === 'jewelry' || type === 'equipment' || type === 'tool' || type === 'other') && (
            <div className="mt-4 space-y-3 border-t border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-300">Bonus (optionnel)</h4>
              <p className="text-xs text-gray-500">
                Si cet objet confère des bonus, il deviendra équipable/déséquipable.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Force</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-3 py-2 rounded-md" 
                    value={bonusStr} 
                    onChange={(e) => setBonusStr(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Dextérité</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-3 py-2 rounded-md" 
                    value={bonusDex} 
                    onChange={(e) => setBonusDex(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Constitution</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-3 py-2 rounded-md" 
                    value={bonusCon} 
                    onChange={(e) => setBonusCon(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Intelligence</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-3 py-2 rounded-md" 
                    value={bonusInt} 
                    onChange={(e) => setBonusInt(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Sagesse</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-3 py-2 rounded-md" 
                    value={bonusWis} 
                    onChange={(e) => setBonusWis(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Charisme</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-3 py-2 rounded-md" 
                    value={bonusCha} 
                    onChange={(e) => setBonusCha(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Classe d'Armure</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-3 py-2 rounded-md" 
                    value={bonusAC} 
                    onChange={(e) => setBonusAC(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <ImageUrlInput value={imageUrl} onChange={setImageUrl} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description (visible)</label>
            <textarea
              value={visibleDescription}
              onChange={(e) => setVisibleDescription(e.target.value)}
              className="input-dark w-full px-4 py-2 rounded-lg"
              rows={4}
              placeholder="Description que verront les joueurs"
            />
            <p className="text-xs text-gray-500 mt-1">Les propriétés techniques sont sérialisées dans les méta.</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} disabled={saving} className="btn-secondary px-4 py-2 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 rounded-lg disabled:opacity-50">
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}


// =============================================
// Onglet Envois - IMPLÉMENTATION COMPLÈTE
// =============================================
function GiftsTab({
  campaignId,
  members,
  inventory
}: {
  campaignId: string;
  members: CampaignMember[];
  inventory: CampaignInventoryItem[];
}) {
  const [sendModalType, setSendModalType] = useState<'item' | 'currency' | null>(null);
  const [showRandomLootModal, setShowRandomLootModal] = useState(false);

return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Envoyer aux joueurs</h2>

      <div className="flex gap-2">
        <button
          onClick={() => setSendModalType('item')}
          className="px-3 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
        >
          <Package size={16} />
          Objets
        </button>
        <button
          onClick={() => setSendModalType('currency')}
          className="px-3 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
        >
          <Coins size={16} />
          Argent
        </button>
        <button
          onClick={() => setShowRandomLootModal(true)}
          className="px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
        >
          <Dices size={16} />
          Loot
        </button>
      </div>

      {/* Placeholder - Historique des envois (à implémenter plus tard) */}
      <div className="bg-gray-900/30 border border-gray-700 rounded-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-800/60 rounded-full flex items-center justify-center">
          <Send className="w-8 h-8 text-gray-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-300 mb-2">
          Historique des envois
        </h3>
        <p className="text-gray-500 text-sm">
          L'historique des objets et argent envoyés apparaîtra ici
        </p>
      </div>

      {sendModalType && (
        <SendGiftModal
          campaignId={campaignId}
          members={members}
          inventory={inventory}
          giftType={sendModalType}
          onClose={() => setSendModalType(null)}
          onSent={() => {
            setSendModalType(null);
            toast.success('Envoi effectue aux joueurs !');
          }}
        />
      )}

      {showRandomLootModal && (
        <RandomLootModal
          campaignId={campaignId}
          members={members}
          inventory={inventory}
          onClose={() => setShowRandomLootModal(false)}
          onSent={() => {
            setShowRandomLootModal(false);
            toast.success('Loot aléatoire distribué !');
          }}
        />
      )}
    </div>
  );
}

// =============================================
// Modal d'envoi de cadeaux - AVEC OPTION DE DUPLICATION
// =============================================
function SendGiftModal({
  campaignId,
  members,
  inventory,
  giftType,
  onClose,
  onSent
}: {
  campaignId: string;
  members: CampaignMember[];
  inventory: CampaignInventoryItem[];
  giftType: 'item' | 'currency';
  onClose: () => void;
  onSent: () => void;
}) {
  // États pour multi-sélection d'objets
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  
  // États pour l'argent
  const [gold, setGold] = useState(0);
  const [silver, setSilver] = useState(0);
  const [copper, setCopper] = useState(0);
  
  const [distributionMode, setDistributionMode] = useState<'individual' | 'shared'>('individual');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectAllRecipients, setSelectAllRecipients] = useState(false);

  // ✅ NOUVEAU : Option pour supprimer ou dupliquer
  const [removeFromInventory, setRemoveFromInventory] = useState(true);

  const META_PREFIX = '#meta:';
  
  const parseMeta = (description: string | null | undefined) => {
    if (!description) return null;
    const lines = description.split('\n').map(l => l.trim());
    const metaLine = [...lines].reverse().find(l => l.startsWith(META_PREFIX));
    if (!metaLine) return null;
    try {
      return JSON.parse(metaLine.slice(META_PREFIX.length));
    } catch {
      return null;
    }
  };

  const getVisibleDescription = (description: string | null | undefined): string => {
    if (!description) return '';
    return description
      .split('\n')
      .filter(line => !line.trim().startsWith(META_PREFIX))
      .join('\n')
      .trim();
  };

  const getFullDescription = (item: CampaignInventoryItem) => {
    if (!item) return '';
    const existingMeta = parseMeta(item.description);
    if (!existingMeta) return item.description || '';
    const visibleDesc = getVisibleDescription(item.description);
    const metaLine = `${META_PREFIX}${JSON.stringify(existingMeta)}`;
    return visibleDesc ? `${visibleDesc}\n${metaLine}` : metaLine;
  };

  const toggleItem = (itemId: string) => {
    const newMap = new Map(selectedItems);
    if (newMap.has(itemId)) {
      newMap.delete(itemId);
    } else {
      newMap.set(itemId, 1);
    }
    setSelectedItems(newMap);
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    
    const maxQty = item.quantity;
    const clampedQty = Math.max(1, Math.min(quantity, maxQty));
    
    const newMap = new Map(selectedItems);
    newMap.set(itemId, clampedQty);
    setSelectedItems(newMap);
  };

  useEffect(() => {
    if (selectAllRecipients) {
      const allIds = members.map(m => m.user_id || m.player_id || m.id).filter(Boolean) as string[];
      setSelectedRecipients(allIds);
    } else {
      setSelectedRecipients([]);
    }
  }, [selectAllRecipients, members]);

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients(prev => {
      if (prev.includes(userId)) return prev.filter(id => id !== userId);
      return [...prev, userId];
    });
    setSelectAllRecipients(false);
  };

  // ✅ CORRECTION COMPLÈTE du handleSend dans SendGiftModal
const handleSend = async () => {
  if (distributionMode === 'individual' && selectedRecipients.length === 0) {
    toast.error('Sélectionnez au moins un destinataire');
    return;
  }

  if (giftType === 'item') {
    if (selectedItems.size === 0) {
      toast.error('Sélectionnez au moins un objet');
      return;
    }
  } else {
    if (gold <= 0 && silver <= 0 && copper <= 0) {
      toast.error('Entrez un montant');
      return;
    }
  }

  try {
    setSending(true);
    const recipientIds = distributionMode === 'individual' ? selectedRecipients : null;

    if (giftType === 'item') {
      // ✅ Envoyer chaque objet sélectionné
      for (const [itemId, quantity] of selectedItems.entries()) {
        const item = inventory.find(i => i.id === itemId);
        if (!item) continue;

        // ✅ CORRECTION : Ne PAS envoyer inventoryItemId si on duplique
        await campaignService.sendGift(campaignId, 'item', {
          itemName: item.name,
          itemDescription: getFullDescription(item),
          itemQuantity: quantity,
          gold: 0,
          silver: 0,
          copper: 0,
          distributionMode,
          message: message.trim() || undefined,
          recipientIds: recipientIds || undefined,
          // ✅ CLEF : N'envoyer inventoryItemId que si on veut supprimer
          ...(removeFromInventory ? { inventoryItemId: item.id } : {}),
        });

        // ✅ Décrémenter l'inventaire UNIQUEMENT si removeFromInventory est true
        if (removeFromInventory) {
          const newQuantity = item.quantity - quantity;
          if (newQuantity > 0) {
            await campaignService.updateCampaignItem(item.id, {
              quantity: newQuantity,
            });
          } else {
            await campaignService.deleteCampaignItem(item.id);
          }
        }
      }

      const action = removeFromInventory ? 'envoyé' : 'dupliqué et envoyé';
      toast.success(`${selectedItems.size} objet${selectedItems.size > 1 ? 's' : ''} ${action}${selectedItems.size > 1 ? 's' : ''} !`);
    } else {
      // Envoi d'argent (inchangé)
      await campaignService.sendGift(campaignId, 'currency', {
        gold,
        silver,
        copper,
        distributionMode,
        message: message.trim() || undefined,
        recipientIds: recipientIds || undefined,
      });
    }

    onSent();
  } catch (error) {
    console.error(error);
    toast.error('Erreur lors de l\'envoi');
  } finally {
    setSending(false);
  }
};

  return (
    <div className="fixed inset-0 z-[10000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(40rem,95vw)] max-h-[90vh] overflow-y-auto bg-gray-900/95 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">
            {giftType === 'item' ? '📦 Envoyer des objets' : '💰 Envoyer de l\'argent'}
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {giftType === 'item' ? (
            <>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-300">
                    Objets à envoyer ({selectedItems.size} sélectionné{selectedItems.size > 1 ? 's' : ''})
                  </label>
                  {selectedItems.size > 0 && (
                    <button
                      onClick={() => setSelectedItems(new Map())}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Tout désélectionner
                    </button>
                  )}
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-2 bg-gray-800/30 rounded-lg p-3">
                  {inventory.map((item) => {
                    const isSelected = selectedItems.has(item.id);
                    const selectedQty = selectedItems.get(item.id) || 1;
                    const meta = parseMeta(item.description);

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'bg-purple-900/30 border-purple-500/50'
                            : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-700/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {meta?.imageUrl && (
                            <img
                              src={meta.imageUrl}
                              alt={item.name}
                              className="w-12 h-12 rounded object-cover border border-gray-600/50 flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItem(item.id)}
                            className="mt-1 w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-semibold text-white truncate">{item.name}</h4>
                              
                              {meta?.type === 'armor' && (
                                <span className="text-xs px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 border border-purple-500/30">
                                  Armure
                                </span>
                              )}
                              {meta?.type === 'shield' && (
                                <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-500/30">
                                  Bouclier
                                </span>
                              )}
                              {meta?.type === 'weapon' && (
                                <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-500/30">
                                  Arme
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-gray-400">
                              {item.quantity} disponible{item.quantity > 1 ? 's' : ''}
                            </p>

                            {isSelected && (
                              <div className="mt-2 flex items-center gap-2">
                                <label className="text-xs text-gray-400">Quantité:</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={item.quantity}
                                  value={selectedQty}
                                  onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                                  className="input-dark w-20 px-2 py-1 text-sm rounded"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-xs text-gray-500">/ {item.quantity}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {inventory.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Aucun objet dans l'inventaire
                    </div>
                  )}
                </div>
              </div>

              {selectedItems.size > 0 && (
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={removeFromInventory}
                      onChange={(e) => setRemoveFromInventory(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                        Supprimer de l'inventaire
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {removeFromInventory 
                          ? "Les objets seront retirés de votre inventaire après l'envoi"
                          : "Les objets seront dupliqués et resteront dans votre inventaire"
                        }
                      </div>
                    </div>
                    {!removeFromInventory && (
                      <div className="flex-shrink-0 text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                        Duplication
                      </div>
                    )}
                  </label>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-yellow-400 mb-2">Or</label>
                  <input
                    type="number"
                    min="0"
                    value={gold}
                    onChange={(e) => setGold(parseInt(e.target.value) || 0)}
                    className="input-dark w-full px-4 py-2 rounded-lg text-center"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Argent</label>
                  <input
                    type="number"
                    min="0"
                    value={silver}
                    onChange={(e) => setSilver(parseInt(e.target.value) || 0)}
                    className="input-dark w-full px-4 py-2 rounded-lg text-center"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-orange-400 mb-2">Cuivre</label>
                  <input
                    type="number"
                    min="0"
                    value={copper}
                    onChange={(e) => setCopper(parseInt(e.target.value) || 0)}
                    className="input-dark w-full px-4 py-2 rounded-lg text-center"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Mode de distribution</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setDistributionMode('individual');
                  setSelectAllRecipients(false);
                  setSelectedRecipients([]);
                }}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  distributionMode === 'individual'
                    ? 'border-purple-500 bg-purple-900/20 text-white'
                    : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:bg-gray-700/40'
                }`}
              >
                <div className="font-semibold mb-1">Individuel</div>
                <div className="text-xs opacity-80">Envoyer à des destinataires spécifiques</div>
              </button>
              <button
                onClick={() => {
                  setDistributionMode('shared');
                  setSelectAllRecipients(false);
                  setSelectedRecipients([]);
                }}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  distributionMode === 'shared'
                    ? 'border-purple-500 bg-purple-900/20 text-white'
                    : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:bg-gray-700/40'
                }`}
              >
                <div className="font-semibold mb-1">Partagé</div>
                <div className="text-xs opacity-80">Visible à tous</div>
              </button>
            </div>
          </div>

          {distributionMode === 'individual' && (
            <div className="bg-gray-800/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-300">Destinataires</div>
                <label className="text-xs text-gray-400 inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectAllRecipients}
                    onChange={(e) => setSelectAllRecipients(e.target.checked)}
                  />
                  <span>Tous</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {members.map((m) => {
                  const uid = m.user_id;
                  if (!uid) {
                    console.warn('⚠️ Member sans user_id:', m);
                    return null;
                  }
                  
                  return (
                    <label key={uid} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedRecipients.includes(uid)}
                        onChange={() => toggleRecipient(uid)}
                      />
                      <span className="ml-1">{m.player_name || m.email}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Message (optionnel)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input-dark w-full px-4 py-2 rounded-lg"
              rows={3}
              placeholder="Ajoutez un message pour les joueurs..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={sending}
            className="btn-secondary px-6 py-3 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={sending || (giftType === 'item' ? selectedItems.size === 0 : false) || (distributionMode === 'individual' && selectedRecipients.length === 0)}
            className="btn-primary px-6 py-3 rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {sending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Envoi...
              </>
            ) : (
              <>
                <Send size={18} />
                {giftType === 'item' && selectedItems.size > 0 
                  ? `${removeFromInventory ? 'Envoyer' : 'Dupliquer'} ${selectedItems.size} objet${selectedItems.size > 1 ? 's' : ''}`
                  : 'Envoyer'
                }
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// Modal d'envoi rapide d'un objet specifique
// =============================================
function QuickSendItemModal({
  campaignId,
  item,
  members,
  onClose,
  onSent
}: {
  campaignId: string;
  item: CampaignInventoryItem;
  members: CampaignMember[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [distributionMode, setDistributionMode] = useState<'individual' | 'shared'>('individual');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectAllRecipients, setSelectAllRecipients] = useState(false);
  const [removeFromInventory, setRemoveFromInventory] = useState(true);
  const [sending, setSending] = useState(false);

  const META_PREFIX = '#meta:';

  const parseMeta = (description: string | null | undefined) => {
    if (!description) return null;
    const lines = description.split('\n').map(l => l.trim());
    const metaLine = [...lines].reverse().find(l => l.startsWith(META_PREFIX));
    if (!metaLine) return null;
    try {
      return JSON.parse(metaLine.slice(META_PREFIX.length));
    } catch {
      return null;
    }
  };

  const getVisibleDescription = (description: string | null | undefined): string => {
    if (!description) return '';
    return description
      .split('\n')
      .filter(line => !line.trim().startsWith(META_PREFIX))
      .join('\n')
      .trim();
  };

  const getFullDescription = () => {
    const existingMeta = parseMeta(item.description);
    if (!existingMeta) return item.description || '';
    const visibleDesc = getVisibleDescription(item.description);
    const metaLine = `${META_PREFIX}${JSON.stringify(existingMeta)}`;
    return visibleDesc ? `${visibleDesc}\n${metaLine}` : metaLine;
  };

  const meta = parseMeta(item.description);

  useEffect(() => {
    if (selectAllRecipients) {
      const allIds = members.map(m => m.user_id || m.player_id || m.id).filter(Boolean) as string[];
      setSelectedRecipients(allIds);
    } else {
      setSelectedRecipients([]);
    }
  }, [selectAllRecipients, members]);

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients(prev => {
      if (prev.includes(userId)) return prev.filter(id => id !== userId);
      return [...prev, userId];
    });
    setSelectAllRecipients(false);
  };

  const handleSend = async () => {
    if (distributionMode === 'individual' && selectedRecipients.length === 0) {
      toast.error('Selectionnez au moins un destinataire');
      return;
    }

    try {
      setSending(true);
      const recipientIds = distributionMode === 'individual' ? selectedRecipients : null;

      await campaignService.sendGift(campaignId, 'item', {
        itemName: item.name,
        itemDescription: getFullDescription(),
        itemQuantity: quantity,
        gold: 0,
        silver: 0,
        copper: 0,
        distributionMode,
        recipientIds: recipientIds || undefined,
        ...(removeFromInventory ? { inventoryItemId: item.id } : {}),
      });

      if (removeFromInventory) {
        const newQuantity = item.quantity - quantity;
        if (newQuantity > 0) {
          await campaignService.updateCampaignItem(item.id, {
            quantity: newQuantity,
          });
        } else {
          await campaignService.deleteCampaignItem(item.id);
        }
      }

      const action = removeFromInventory ? 'envoye' : 'duplique et envoye';
      toast.success(`Objet ${action} !`);
      onSent();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(32rem,95vw)] max-h-[90vh] overflow-y-auto bg-gray-900/95 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Send size={20} className="text-blue-400" />
            Envoyer aux joueurs
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-start gap-3">
              {meta?.imageUrl && (
                <img
                  src={meta.imageUrl}
                  alt={item.name}
                  className="w-14 h-14 rounded object-cover border border-gray-600/50 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="font-semibold text-white">{item.name}</h4>
                  {meta?.type === 'armor' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 border border-purple-500/30">Armure</span>
                  )}
                  {meta?.type === 'shield' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-500/30">Bouclier</span>
                  )}
                  {meta?.type === 'weapon' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-500/30">Arme</span>
                  )}
                </div>
                <p className="text-sm text-gray-400">{item.quantity} disponible{item.quantity > 1 ? 's' : ''}</p>
              </div>
            </div>

            {item.quantity > 1 && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-sm text-gray-400">Quantite:</label>
                <input
                  type="number"
                  min="1"
                  max={item.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(parseInt(e.target.value) || 1, item.quantity)))}
                  className="input-dark w-20 px-2 py-1 text-sm rounded"
                />
                <span className="text-xs text-gray-500">/ {item.quantity}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Mode de distribution</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDistributionMode('individual')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  distributionMode === 'individual'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Individuel
              </button>
              <button
                onClick={() => setDistributionMode('shared')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  distributionMode === 'shared'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Partage
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {distributionMode === 'individual'
                ? 'Chaque destinataire recoit l\'objet individuellement'
                : 'L\'objet sera partage entre tous les membres'}
            </p>
          </div>

          {distributionMode === 'individual' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">Destinataires</label>
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectAllRecipients}
                    onChange={(e) => setSelectAllRecipients(e.target.checked)}
                    className="w-3 h-3 rounded border-gray-600 text-blue-600"
                  />
                  Tous
                </label>
              </div>
              <div className="max-h-[150px] overflow-y-auto space-y-1 bg-gray-800/30 rounded-lg p-2">
                {members.map((member) => {
                  const recipientId = member.user_id || member.player_id || member.id;
                  if (!recipientId) return null;
                  const isSelected = selectedRecipients.includes(recipientId);
                  return (
                    <label
                      key={recipientId}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-900/30' : 'hover:bg-gray-700/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRecipient(recipientId)}
                        className="w-4 h-4 rounded border-gray-600 text-blue-600"
                      />
                      <span className="text-sm text-gray-200">{member.player_name || member.character_name || 'Joueur'}</span>
                    </label>
                  );
                })}
                {members.length === 0 && (
                  <p className="text-center py-4 text-gray-500 text-sm">Aucun membre dans la campagne</p>
                )}
              </div>
            </div>
          )}

          <div className="bg-gray-800/30 rounded-lg p-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={removeFromInventory}
                onChange={(e) => setRemoveFromInventory(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                  Supprimer de l'inventaire
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {removeFromInventory
                    ? "L'objet sera retire de votre inventaire apres l'envoi"
                    : "L'objet sera duplique et restera dans votre inventaire"}
                </div>
              </div>
            </label>
          </div>

          <button
            onClick={handleSend}
            disabled={sending || (distributionMode === 'individual' && selectedRecipients.length === 0)}
            className="w-full btn-primary py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send size={18} />
                Envoyer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// Modal de génération de loot aléatoire - VERSION COMPLÈTE ET CORRIGÉE
// =============================================
function RandomLootModal({
  campaignId,
  members,
  inventory,
  onClose,
  onSent
}: {
  campaignId: string;
  members: CampaignMember[];
  inventory: CampaignInventoryItem[];
  onClose: () => void;
  onSent: () => void;
}) {
  // États principaux
  const [levelRange, setLevelRange] = useState<LevelRange>('1-4');
  const [difficulty, setDifficulty] = useState<Difficulty>('facile');
  const [enemyCount, setEnemyCount] = useState<EnemyCount>('1');
  const [distributionMode, setDistributionMode] = useState<'individual' | 'shared'>('shared');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectAllRecipients, setSelectAllRecipients] = useState(false);
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [previewLoot, setPreviewLoot] = useState<{
    copper: number;
    silver: number;
    gold: number;
    equipment: Array<{ name: string; meta: any; description?: string }>;
    gems: Array<{ name: string; meta: any; description?: string }>;
  } | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);

  // États pour la personnalisation des probabilités
  const [customMode, setCustomMode] = useState(false);
  const [customProbs, setCustomProbs] = useState({
    copper: 0,
    silver: 0,
    gold: 0,
    equipment: 0,
    gems: 0
  });

  const META_PREFIX = '#meta:';

  // Calculer les probabilités à utiliser
  const defaultProbs = LOOT_TABLES[levelRange][difficulty][enemyCount];
  const probs = customMode ? customProbs : defaultProbs;

  // Charger le catalogue d'équipements
  useEffect(() => {
    const loadCatalog = async () => {
      setLoadingCatalog(true);
      try {
        const { loadEquipmentCatalog } = await import('../services/equipmentCatalogService');
        const items = await loadEquipmentCatalog();
        setCatalog(items);
      } catch (error) {
        console.error('Erreur chargement catalogue:', error);
        toast.error('Erreur de chargement du catalogue d\'équipements');
      } finally {
        setLoadingCatalog(false);
      }
    };
    loadCatalog();
  }, []);

  // Initialiser les probabilités personnalisées
  useEffect(() => {
    if (!customMode) {
      const newDefaultProbs = LOOT_TABLES[levelRange][difficulty][enemyCount];
      setCustomProbs(newDefaultProbs);
    }
  }, [levelRange, difficulty, enemyCount, customMode]);

  // Synchroniser la sélection de tous les destinataires
  useEffect(() => {
    if (selectAllRecipients) {
      const allIds = members.map(m => m.user_id || m.player_id || m.id).filter(Boolean) as string[];
      setSelectedRecipients(allIds);
    } else {
      setSelectedRecipients([]);
    }
  }, [selectAllRecipients, members]);

  // Fonction pour mettre à jour une probabilité
  const updateProbability = (key: keyof typeof customProbs, value: number) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    setCustomProbs(prev => ({
      ...prev,
      [key]: clampedValue
    }));
  };

  // Calculer le total et valider
  const totalProb = customProbs.copper + customProbs.silver + customProbs.gold + customProbs.equipment + customProbs.gems;
  const probsValid = totalProb === 100;

  // Toggle destinataire
  const toggleRecipient = (userId: string) => {
    setSelectedRecipients(prev => {
      if (prev.includes(userId)) return prev.filter(id => id !== userId);
      return [...prev, userId];
    });
    setSelectAllRecipients(false);
  };

  // Sélectionner un équipement aléatoire
  const getRandomEquipmentFromCatalog = () => {
    if (catalog.length === 0) return null;
    
    let types: any[] = [];
    
    if (levelRange === '1-4') {
      types = ['weapons', 'adventuring_gear', 'tools'];
    } else if (levelRange === '5-10') {
      types = ['weapons', 'armors', 'shields', 'adventuring_gear'];
    } else if (levelRange === '11-16') {
      types = ['weapons', 'armors', 'shields', 'adventuring_gear', 'tools'];
    } else {
      types = ['weapons', 'armors', 'shields'];
    }
    
    const filtered = catalog.filter(item => types.includes(item.kind));
    if (filtered.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * filtered.length);
    return filtered[randomIndex];
  };

  // ✅ CORRECTION COMPLÈTE : Générer le loot STRICTEMENT selon les probabilités
  const generateLoot = () => {
    const actualProbs = probs;
    const currencyRanges = CURRENCY_AMOUNTS[levelRange];
    const gemRange = GEM_AMOUNTS[levelRange];
    
    let copper = 0;
    let silver = 0;
    let gold = 0;
    const equipment: Array<{ name: string; meta: any; description?: string }> = [];
    const gems: Array<{ name: string; meta: any; description?: string }> = [];

    const roll = Math.random() * 100;
    
    if (roll < actualProbs.copper) {
      // ========== CUIVRE SEULEMENT ==========
      copper = Math.floor(
        Math.random() * (currencyRanges.copper.max - currencyRanges.copper.min + 1) + currencyRanges.copper.min
      );
      
    } else if (roll < actualProbs.copper + actualProbs.silver) {
      // ========== ARGENT SEULEMENT ==========
      silver = Math.floor(
        Math.random() * (currencyRanges.silver.max - currencyRanges.silver.min + 1) + currencyRanges.silver.min
      );
      
    } else if (roll < actualProbs.copper + actualProbs.silver + actualProbs.gold) {
      // ========== OR SEULEMENT ==========
      gold = Math.floor(
        Math.random() * (currencyRanges.gold.max - currencyRanges.gold.min + 1) + currencyRanges.gold.min
      );
      
    } else if (roll < actualProbs.copper + actualProbs.silver + actualProbs.gold + actualProbs.equipment) {
      // ========== ÉQUIPEMENT SEULEMENT ==========
      const numItems = 
        levelRange === '1-4' ? 1 : 
        levelRange === '5-10' ? (Math.random() < 0.5 ? 1 : 2) : 
        levelRange === '11-16' ? (Math.random() < 0.3 ? 1 : Math.random() < 0.7 ? 2 : 3) :
        (Math.random() < 0.2 ? 1 : Math.random() < 0.6 ? 2 : 3);
      
      for (let i = 0; i < numItems; i++) {
        const item = getRandomEquipmentFromCatalog();
        if (item) {
          let meta: any = { type: 'equipment', quantity: 1, equipped: false };
          
          if (item.kind === 'armors' && item.armor) {
            meta = { type: 'armor', quantity: 1, equipped: false, armor: item.armor };
          } else if (item.kind === 'shields' && item.shield) {
            meta = { type: 'shield', quantity: 1, equipped: false, shield: item.shield };
          } else if (item.kind === 'weapons' && item.weapon) {
            meta = { type: 'weapon', quantity: 1, equipped: false, weapon: item.weapon };
          } else if (item.kind === 'tools') {
            meta = { type: 'tool', quantity: 1, equipped: false };
          }
          
          equipment.push({
            name: item.name,
            meta,
            description: item.description || ''
          });
        }
      }
      
    } else {
      // ========== PIERRES PRÉCIEUSES SEULEMENT ==========
      const numGems = Math.floor(
        Math.random() * (gemRange.max - gemRange.min + 1) + gemRange.min
      );
      
      const gemItems = catalog.filter(item => item.kind === 'gems');
      
      if (gemItems.length > 0) {
        for (let i = 0; i < numGems; i++) {
          const randomGem = gemItems[Math.floor(Math.random() * gemItems.length)];
          gems.push({
            name: randomGem.name,
            meta: { type: 'jewelry', quantity: 1, equipped: false },
            description: randomGem.description || ''
          });
        }
      }
    }

    return { copper, silver, gold, equipment, gems };
  };

  // Prévisualiser le loot
  const handlePreview = () => {
    if (loadingCatalog) {
      toast.error('Chargement du catalogue en cours...');
      return;
    }
    const loot = generateLoot();
    setPreviewLoot(loot);
  };

  // Envoyer le loot
  const handleSend = async () => {
    if (distributionMode === 'individual' && selectedRecipients.length === 0) {
      toast.error('Sélectionnez au moins un destinataire');
      return;
    }

    if (!previewLoot) {
      toast.error('Générez d\'abord le loot');
      return;
    }

    try {
      setGenerating(true);
      const recipientIds = distributionMode === 'individual' ? selectedRecipients : null;

      // Envoi de la monnaie
      if (previewLoot.copper > 0 || previewLoot.silver > 0 || previewLoot.gold > 0) {
        await campaignService.sendGift(campaignId, 'currency', {
          gold: previewLoot.gold,
          silver: previewLoot.silver,
          copper: previewLoot.copper,
          distributionMode,
          message: message.trim() || `🎲 Loot aléatoire (Niveau ${levelRange}, ${difficulty}, ${enemyCount} ennemi${enemyCount === '1' ? '' : 's'})`,
          recipientIds: recipientIds || undefined,
        });
      }

      // Envoi des équipements
      for (const equip of previewLoot.equipment) {
        const metaLine = `${META_PREFIX}${JSON.stringify(equip.meta)}`;
        const visibleDesc = (equip.description || '').trim();
        const fullDescription = visibleDesc 
          ? `${visibleDesc}\n${metaLine}`
          : metaLine;

        await campaignService.sendGift(campaignId, 'item', {
          itemName: equip.name,
          itemDescription: fullDescription,
          itemQuantity: 1,
          gold: 0,
          silver: 0,
          copper: 0,
          distributionMode,
          message: message.trim() || `🎲 Loot aléatoire (Niveau ${levelRange}, ${difficulty})`,
          recipientIds: recipientIds || undefined,
        });
      }

      // Envoi des gemmes
      if (previewLoot.gems && previewLoot.gems.length > 0) {
        for (const gem of previewLoot.gems) {
          const metaLine = `${META_PREFIX}${JSON.stringify(gem.meta)}`;
          const visibleDesc = (gem.description || '').trim();
          const fullDescription = visibleDesc 
            ? `${visibleDesc}\n${metaLine}`
            : metaLine;

          await campaignService.sendGift(campaignId, 'item', {
            itemName: gem.name,
            itemDescription: fullDescription,
            itemQuantity: 1,
            gold: 0,
            silver: 0,
            copper: 0,
            distributionMode,
            message: message.trim() || `🎲 Loot aléatoire - Pierre précieuse (Niveau ${levelRange}, ${difficulty})`,
            recipientIds: recipientIds || undefined,
          });
        }
      }

      toast.success('Loot aléatoire envoyé !');
      onSent();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(40rem,95vw)] max-h-[90vh] overflow-y-auto bg-gray-900/95 border border-gray-700 rounded-xl p-6">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
              <Dices className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white">🎲 Loot Aléatoire</h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Chargement du catalogue */}
        {loadingCatalog && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400" />
              <p className="text-sm text-blue-200">Chargement du catalogue d'équipements...</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Paramètres de la rencontre */}
          <div className="bg-gray-800/30 rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Paramètres de la rencontre</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Niveau de la rencontre</label>
                <select
                  value={levelRange}
                  onChange={(e) => setLevelRange(e.target.value as LevelRange)}
                  className="input-dark w-full px-3 py-2 rounded-lg text-sm"
                  disabled={customMode}
                >
                  <option value="1-4">Niveau 1-4</option>
                  <option value="5-10">Niveau 5-10</option>
                  <option value="11-16">Niveau 11-16</option>
                  <option value="17-20">Niveau 17-20</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Difficulté</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="input-dark w-full px-3 py-2 rounded-lg text-sm"
                  disabled={customMode}
                >
                  <option value="facile">Facile</option>
                  <option value="modérée">Modérée</option>
                  <option value="difficile">Difficile</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Nombre d'ennemis</label>
                <select
                  value={enemyCount}
                  onChange={(e) => setEnemyCount(e.target.value as EnemyCount)}
                  className="input-dark w-full px-3 py-2 rounded-lg text-sm"
                  disabled={customMode}
                >
                  <option value="1">1 ennemi</option>
                  <option value="2-4">2-4 ennemis</option>
                  <option value="5-10">5-10 ennemis</option>
                  <option value="11+">11+ ennemis</option>
                </select>
              </div>
            </div>

            {/* Toggle mode personnalisé */}
            <div className="flex items-center justify-between bg-gray-900/40 rounded p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300">Mode personnalisé</span>
                <span className="text-xs text-gray-500">(Modifier les probabilités manuellement)</span>
              </div>
              <button
                onClick={() => setCustomMode(!customMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  customMode ? 'bg-purple-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    customMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Interface de modification des probabilités */}
            {customMode && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-medium text-purple-300">Personnaliser les probabilités</h5>
                  <div className={`text-xs font-medium px-2 py-1 rounded ${
                    probsValid 
                      ? 'bg-green-900/30 text-green-300 border border-green-500/30' 
                      : 'bg-red-900/30 text-red-300 border border-red-500/30'
                  }`}>
                    Total: {totalProb}%
                  </div>
                </div>

                {!probsValid && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded p-2 text-xs text-red-300">
                    ⚠️ Le total doit être exactement 100%
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">🟤 Cuivre (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customProbs.copper}
                      onChange={(e) => updateProbability('copper', parseInt(e.target.value) || 0)}
                      className="input-dark w-full px-3 py-2 rounded-md text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">⚪ Argent (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customProbs.silver}
                      onChange={(e) => updateProbability('silver', parseInt(e.target.value) || 0)}
                      className="input-dark w-full px-3 py-2 rounded-md text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">🟡 Or (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customProbs.gold}
                      onChange={(e) => updateProbability('gold', parseInt(e.target.value) || 0)}
                      className="input-dark w-full px-3 py-2 rounded-md text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">⚔️ Équipement (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customProbs.equipment}
                      onChange={(e) => updateProbability('equipment', parseInt(e.target.value) || 0)}
                      className="input-dark w-full px-3 py-2 rounded-md text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">💎 Gemmes (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customProbs.gems}
                      onChange={(e) => updateProbability('gems', parseInt(e.target.value) || 0)}
                      className="input-dark w-full px-3 py-2 rounded-md text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCustomProbs(defaultProbs);
                  }}
                  className="w-full text-xs text-gray-400 hover:text-white transition-colors py-2 border border-gray-700 rounded hover:bg-gray-700/30"
                >
                  Réinitialiser aux valeurs par défaut
                </button>
              </div>
            )}

            {/* Affichage des probabilités */}
            <div className="bg-gray-900/40 rounded p-3 text-xs text-gray-400">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-gray-300">
                  {customMode ? '🎯 Probabilités personnalisées :' : 'Probabilités par défaut :'}
                </div>
                {customMode && probsValid && (
                  <div className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded border border-purple-500/30">
                    ✓ Personnalisées
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div className={customMode && probs.copper !== defaultProbs.copper ? 'text-purple-300 font-semibold' : ''}>
                  🟤 Cuivre: {probs.copper}%
                </div>
                <div className={customMode && probs.silver !== defaultProbs.silver ? 'text-purple-300 font-semibold' : ''}>
                  ⚪ Argent: {probs.silver}%
                </div>
                <div className={customMode && probs.gold !== defaultProbs.gold ? 'text-purple-300 font-semibold' : ''}>
                  🟡 Or: {probs.gold}%
                </div>
                <div className={customMode && probs.equipment !== defaultProbs.equipment ? 'text-purple-300 font-semibold' : ''}>
                  ⚔️ Équipement: {probs.equipment}%
                </div>
                <div className={customMode && probs.gems !== defaultProbs.gems ? 'text-purple-300 font-semibold' : ''}>
                  💎 Gemmes: {probs.gems}%
                </div>
              </div>
            </div>

            {/* Bouton de génération */}
            <div className="flex gap-2">
              <button
                onClick={handlePreview}
                disabled={loadingCatalog || (customMode && !probsValid)}
                className="flex-1 btn-primary px-4 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Dices size={18} />
                {loadingCatalog ? 'Chargement...' : 'Générer le loot'}
              </button>
              
              {customMode && (
                <button
                  onClick={() => {
                    console.log('🎲 Test des probabilités:', {
                      copper: probs.copper,
                      silver: probs.silver,
                      gold: probs.gold,
                      equipment: probs.equipment,
                      gems: probs.gems,
                      total: totalProb,
                      valid: probsValid
                    });
                    toast.success(`Probabilités ${probsValid ? 'valides ✓' : 'invalides ✗'} (${totalProb}%)`);
                  }}
                  className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm"
                  title="Tester les probabilités"
                >
                  🧪
                </button>
              )}
            </div>
          </div>

          {/* Prévisualisation du loot */}
          {previewLoot && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-300 mb-3">🎁 Loot généré :</h4>
              <div className="space-y-2">
                {(previewLoot.gold > 0 || previewLoot.silver > 0 || previewLoot.copper > 0) && (
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    {previewLoot.gold > 0 && <span className="text-yellow-400 font-semibold">🟡 {previewLoot.gold} or</span>}
                    {previewLoot.silver > 0 && <span className="text-gray-300 font-semibold">⚪ {previewLoot.silver} argent</span>}
                    {previewLoot.copper > 0 && <span className="text-orange-400 font-semibold">🟤 {previewLoot.copper} cuivre</span>}
                  </div>
                )}
                {previewLoot.equipment.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Équipements :</div>
                    {previewLoot.equipment.map((eq, idx) => (
                      <div key={idx} className="text-sm text-purple-300 flex items-center gap-2">
                        <span>⚔️</span>
                        <span className="font-medium">{eq.name}</span>
                        {eq.meta.type === 'weapon' && eq.meta.weapon && (
                          <span className="text-xs text-gray-400">
                            ({eq.meta.weapon.damageDice} {eq.meta.weapon.damageType})
                          </span>
                        )}
                        {eq.meta.type === 'armor' && eq.meta.armor && (
                          <span className="text-xs text-gray-400">
                            (CA {eq.meta.armor.label})
                          </span>
                        )}
                        {eq.meta.type === 'shield' && eq.meta.shield && (
                          <span className="text-xs text-gray-400">
                            (+{eq.meta.shield.bonus} CA)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {previewLoot.gems && previewLoot.gems.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Pierres précieuses :</div>
                    {previewLoot.gems.map((gem, idx) => (
                      <div key={idx} className="text-sm text-pink-300 flex items-center gap-2">
                        <span>💎</span>
                        <span className="font-medium">{gem.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {previewLoot.copper === 0 && 
                 previewLoot.silver === 0 && 
                 previewLoot.gold === 0 && 
                 previewLoot.equipment.length === 0 && 
                 (!previewLoot.gems || previewLoot.gems.length === 0) && (
                  <div className="text-sm text-gray-500">Aucun loot généré cette fois-ci 🎲</div>
                )}
              </div>
            </div>
          )}

          {/* Mode de distribution */}
          {previewLoot && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mode de distribution</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setDistributionMode('individual');
                      setSelectAllRecipients(false);
                      setSelectedRecipients([]);
                    }}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      distributionMode === 'individual'
                        ? 'border-purple-500 bg-purple-900/20 text-white'
                        : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:bg-gray-700/40'
                    }`}
                  >
                    <div className="font-semibold mb-1">Individuel</div>
                    <div className="text-xs opacity-80">Envoyer à des destinataires spécifiques</div>
                  </button>
                  <button
                    onClick={() => {
                      setDistributionMode('shared');
                      setSelectAllRecipients(false);
                      setSelectedRecipients([]);
                    }}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      distributionMode === 'shared'
                        ? 'border-purple-500 bg-purple-900/20 text-white'
                        : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:bg-gray-700/40'
                    }`}
                  >
                    <div className="font-semibold mb-1">Partagé</div>
                    <div className="text-xs opacity-80">Visible à tous</div>
                  </button>
                </div>
              </div>

              {/* Sélection des destinataires */}
              {distributionMode === 'individual' && (
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-300">Destinataires</div>
                    <label className="text-xs text-gray-400 inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectAllRecipients}
                        onChange={(e) => setSelectAllRecipients(e.target.checked)}
                      />
                      <span>Tous</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {members.map((m) => {
                      const uid = m.user_id;
                      if (!uid) return null;
                      
                      return (
                        <label key={uid} className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedRecipients.includes(uid)}
                            onChange={() => toggleRecipient(uid)}
                          />
                          <span className="ml-1">{m.player_name || m.email}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Message (optionnel)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="input-dark w-full px-4 py-2 rounded-lg"
                  rows={2}
                  placeholder="Ajoutez un message pour les joueurs..."
                />
              </div>
            </>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={generating}
            className="btn-secondary px-6 py-3 rounded-lg"
          >
            Annuler
          </button>
          {previewLoot && (
            <button
              onClick={handleSend}
              disabled={generating || (distributionMode === 'individual' && selectedRecipients.length === 0)}
              className="btn-primary px-6 py-3 rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Envoyer le loot
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 

export default GameMasterCampaignPage;