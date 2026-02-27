import React from 'react';
import { createPortal } from 'react-dom';
import { Flame, Sparkles, X } from 'lucide-react';

interface ElementalAffinityModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  charismaModifier: number;
  elementType: string;
  spellName: string;
}

const ELEMENT_COLORS: Record<string, { text: string; accent: string; icon: string }> = {
  feu:    { text: 'text-red-300',    accent: 'rgba(239, 68, 68, 0.25)', icon: '🔥' },
  froid:  { text: 'text-blue-300',   accent: 'rgba(59, 130, 246, 0.25)', icon: '❄️' },
  foudre: { text: 'text-yellow-300', accent: 'rgba(234, 179, 8, 0.25)',  icon: '⚡' },
  acide:  { text: 'text-green-300',  accent: 'rgba(34, 197, 94, 0.25)',  icon: '🧪' },
  poison: { text: 'text-purple-300', accent: 'rgba(168, 85, 247, 0.25)', icon: '☠️' },
};

export function ElementalAffinityModal({
  isOpen,
  onConfirm,
  onSkip,
  charismaModifier,
  elementType,
  spellName,
}: ElementalAffinityModalProps) {
  if (!isOpen) return null;

  const colors = ELEMENT_COLORS[elementType] || ELEMENT_COLORS.feu;

  const modalContent = (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[10001] p-4">
      <div
        className="frame-card--light frame-card--no-frame max-w-sm w-full rounded-xl animate-fade-in"
        style={{ boxShadow: `0 0 30px ${colors.accent}, 0 6px 18px rgba(0, 0, 0, 0.45)` }}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{colors.icon}</div>
            <div>
              <h3 className={`text-lg font-semibold ${colors.text}`} style={{ fontFamily: 'Cinzel, serif' }}>
                Affinité élémentaire
              </h3>
              <p className="text-xs text-gray-400">Sorcellerie draconique</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-200">
            <span className="font-semibold text-white">{spellName}</span> inflige des dégâts de type{' '}
            <span className={`font-bold ${colors.text}`}>{elementType}</span>.
          </p>
          <p className="text-sm text-gray-300">
            Souhaitez-vous ajouter votre{' '}
            <span className="font-bold text-white">
              modificateur de Charisme ({charismaModifier >= 0 ? '+' : ''}{charismaModifier})
            </span>{' '}
            aux dégâts ?
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-700/30 flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-2.5 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-lg transition-colors text-sm font-medium"
          >
            Non merci
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-lg transition-colors text-sm font-bold flex items-center justify-center gap-2`}
          >
            <Sparkles size={14} />
            +{charismaModifier} dégâts
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}