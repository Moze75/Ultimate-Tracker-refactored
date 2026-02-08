import { useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { CampaignMember, CampaignInvitation } from '../../../types/campaign';
import { campaignService } from '../../../services/campaignService';
import { ConfirmModal } from '../modals/ConfirmModal';
import { InvitePlayerModal } from '../modals/InvitePlayerModal';
import { PlayerDetailsModal } from '../../modals/PlayerDetailsModal';
import toast from 'react-hot-toast';

interface MembersTabProps {
  campaignId: string;
  members: CampaignMember[];
  invitations: CampaignInvitation[];
  onReload: () => void;
}

export function MembersTab({ campaignId, members, invitations, onReload }: MembersTabProps) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [confirmDeleteInvite, setConfirmDeleteInvite] = useState<string | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<string | null>(null);
  const [selectedPlayerDetails, setSelectedPlayerDetails] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold tracking-wide" style={{ fontFamily: "'Cinzel', serif", color: '#EFE6D8', textShadow: '0 1px 6px rgba(0,0,0,0.45)' }}>Joueurs de la campagne</h2>
        <button
          onClick={() => setShowInviteModal(true)}
          className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <UserPlus size={18} />
          Inviter un joueur
        </button>
      </div>

      {invitations.filter(inv => inv.status === 'pending').length > 0 && (
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-300 mb-3">
            Invitations en attente ({invitations.filter(inv => inv.status === 'pending').length})
          </h3>
          <div className="space-y-2">
            {invitations
              .filter(inv => inv.status === 'pending')
              .map((inv) => (
                <div key={inv.id} className="bg-gray-900/40 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-200">{inv.player_email}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Envoyée le {new Date(inv.invited_at).toLocaleDateString('fr-FR')} - En attente
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {members.map((member) => (
          <div
            key={member.id}
            className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800/70 hover:border-blue-500/40 transition-all cursor-pointer group"
            onClick={() => {
              if (member.player_id) {
                setSelectedPlayerDetails({ id: member.player_id, name: member.player_name || 'Personnage' });
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold group-hover:text-blue-300 transition-colors" style={{ fontFamily: "'Cinzel', serif", color: '#EFE6D8', lineHeight: 1.15 }}>
                  {member.player_name || 'Personnage non défini'}
                </h3>
                <p className="text-sm mt-1" style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(255,255,255,0.7)' }}>{member.email}</p>
                <p className="text-xs mt-2" style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(255,255,255,0.5)' }}>
                  Rejoint le {new Date(member.joined_at).toLocaleDateString('fr-FR')}
                </p>
                {member.player_id && (
                  <p className="text-xs text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Cliquez pour voir la fiche
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmRemoveMember(member.id); }}
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

      {showInviteModal && (
        <InvitePlayerModal
          campaignId={campaignId}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => { setShowInviteModal(false); onReload(); }}
        />
      )}

      {selectedPlayerDetails && (
        <PlayerDetailsModal
          playerId={selectedPlayerDetails.id}
          playerName={selectedPlayerDetails.name}
          onClose={() => setSelectedPlayerDetails(null)}
        />
      )}
    </div>
  );
}
