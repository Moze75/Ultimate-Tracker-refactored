import { useState, useEffect } from 'react';
import { X, Loader2, Swords, Calendar } from 'lucide-react';
import { CampaignEncounter } from '../../../types/campaign';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';

interface LoadEncounterModalProps {
  campaignId: string;
  onClose: () => void;
  onLoad: (encounterId: string) => void;
}

export function LoadEncounterModal({ campaignId, onClose, onLoad }: LoadEncounterModalProps) {
  const [encounters, setEncounters] = useState<CampaignEncounter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEncounters();
  }, [campaignId]);

  const loadEncounters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('campaign_encounters')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEncounters(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Erreur chargement des combats');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-900/40 flex items-center justify-center">
              <Swords size={16} className="text-amber-400" />
            </div>
            <h2 className="text-white font-semibold text-lg">Charger un combat sauvegardé</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-3" />
              Chargement...
            </div>
          ) : encounters.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Swords size={48} className="mx-auto mb-4 opacity-50" />
              <p>Aucun combat sauvegardé</p>
              <p className="text-sm mt-2">Les combats terminés apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-3">
              {encounters.map((encounter) => (
                <button
                  key={encounter.id}
                  onClick={() => onLoad(encounter.id)}
                  className="w-full p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-white font-medium text-base mb-1">
                        {encounter.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(encounter.created_at)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Swords size={12} />
                          Round {encounter.round_number}
                        </div>
                      </div>
                    </div>
                    <div className="ml-4">
                      <ChevronRight className="text-gray-500" size={20} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

function ChevronRight({ className, size }: { className?: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
