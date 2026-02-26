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

const ELEMENT_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  feu:    { bg: 'from-red-900/80 to-orange-900/60', border: 'border-red-500/50', text: 'text-red-300', icon: '🔥' },
  froid:  { bg: 'from-blue-900/80 to-cyan-900/60', border: 'border-blue-500/50', text: 'text-blue-300', icon: '❄️' },
  foudre: { bg: 'from-yellow-900/80 to-amber-900/60', border: 'border-yellow-500/50', text: 'text-yellow-300', icon: '⚡' },
  acide:  { bg: 'from-green-900/80 to-lime-900/60', border: 'border-green-500/50', text: 'text-green-300', icon: '🧪' },
  poison: { bg: 'from-purple-900/80 to-green-900/60', border: 'border-purple-500/50', text: 'text-purple-300', icon: '☠️' },
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
        className={`bg-gradient-to-br ${colors.bg} rounded-xl shadow-2xl max-w-sm w-full border ${colors.border} overflow-hidden animate-fade-in`}
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