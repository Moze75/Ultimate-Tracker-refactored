import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface CardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: any[];
  currentIndex: number;
  onNavigate: (direction: 'prev' | 'next') => void;
  renderCardContent: (card: any, index: number) => React.ReactNode;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
}

export default function CardDetailModal({
  isOpen,
  onClose,
  cards,
  currentIndex,
  onNavigate,
  renderCardContent,
  onConfirm,
  confirmLabel = 'Valider',
  confirmDisabled = false,
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

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isSwiping = useRef(false);

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
  const SWIPE_THRESHOLD = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    isSwiping.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null || startY.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (!isSwiping.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      isSwiping.current = true;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null || startY.current == null) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX.current;
    const adx = Math.abs(dx);
    if (isSwiping.current && adx >= SWIPE_THRESHOLD) {
      if (dx < 0 && canGoNext) {
        onNavigate('next');
      } else if (dx > 0 && canGoPrev) {
        onNavigate('prev');
      }
    }
    startX.current = null;
    startY.current = null;
    isSwiping.current = false;
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onConfirm && !confirmDisabled) {
      onConfirm();
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="relative w-full max-w-3xl mx-4 my-8 flex items-center md:gap-4">
        {canGoPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('prev');
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 md:static md:translate-y-0 flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-800/90 hover:bg-gray-700 flex items-center justify-center transition-colors shadow-lg"
            aria-label="Carte precedente"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </button>
        )}

        <div
          className="flex-1 bg-gray-900/95 rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in border border-gray-700/50"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: 'pan-y' }}
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

          {onConfirm && (
            <div className="sticky bottom-0 z-10 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50 px-6 py-4">
              <button
                onClick={handleConfirm}
                disabled={confirmDisabled}
                className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  confirmDisabled
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-lg hover:shadow-red-500/25'
                }`}
              >
                <Check className="w-5 h-5" />
                {confirmLabel}
              </button>
            </div>
          )}
        </div>

        {canGoNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('next');
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 md:static md:translate-y-0 flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-800/90 hover:bg-gray-700 flex items-center justify-center transition-colors shadow-lg"
            aria-label="Carte suivante"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
