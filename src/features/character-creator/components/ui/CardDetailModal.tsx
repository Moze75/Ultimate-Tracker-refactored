import React, { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface CardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: any[];
  currentIndex: number;
  onNavigate: (direction: 'prev' | 'next') => void;
  renderCardContent: (card: any, index: number) => React.ReactNode;
}

export default function CardDetailModal({
  isOpen,
  onClose,
  cards,
  currentIndex,
  onNavigate,
  renderCardContent,
}: CardDetailModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && currentIndex < cards.length - 1) {
        onNavigate('next');
      }
    },
    [isOpen, currentIndex, cards.length, onClose, onNavigate]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const currentCard = cards[currentIndex];
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < cards.length - 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="relative w-full max-w-3xl mx-4 my-8 flex items-center gap-4">
        {canGoPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('prev');
            }}
            className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center transition-colors"
            aria-label="Carte precedente"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}

        <div
          className="flex-1 bg-gray-900/95 rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in border border-gray-700/50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700/50 px-6 py-4 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Carte {currentIndex + 1} sur {cards.length}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="p-6">{renderCardContent(currentCard, currentIndex)}</div>
        </div>

        {canGoNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('next');
            }}
            className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center transition-colors"
            aria-label="Carte suivante"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
