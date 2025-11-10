import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Dices } from 'lucide-react';

interface AvatarModalProps {
  url: string;
  onClose: () => void;
  onOpenDiceSettings?: () => void; // ✅ Nouvelle prop
}

export function AvatarModal({ url, onClose, onOpenDiceSettings }: AvatarModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(meta);
    
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalStyle;
      document.head.removeChild(meta);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-black touch-none cursor-pointer"
      onClick={onClose}
    >
      {/* Bouton fermer */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/80 transition-colors z-[9999]"
        aria-label="Fermer"
      >
        <X size={24} />
      </button>

      {/* ✅ NOUVEAU : Bouton paramètres dés (visible seulement sur mobile) */}
{onOpenDiceSettings && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onOpenDiceSettings();
      onClose();
    }}
    className="absolute top-4 left-4 md:hidden flex items-center gap-2 text-purple-300 hover:text-purple-100 transition-colors text-sm font-medium z-[9999] drop-shadow-lg"
    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
    title="Paramètres des dés"
  >
    <Dices className="w-5 h-5 drop-shadow-lg" />
    <span className="drop-shadow-lg">Paramètres</span>
  </button>
)}

      <div className="w-screen h-screen flex items-center justify-center p-4 sm:p-6 md:p-8" onClick={onClose}>
        <img
          src={url}
          alt="Avatar"
          className="
            w-auto h-auto object-contain select-none
            max-w-[92vw] max-h-[80vh]
            md:max-w-[min(80vw,560px)] md:max-h-[min(70vh,560px)]
            lg:max-w-[min(80vw,720px)] lg:max-h-[min(70vh,720px)]
          "
          draggable={false}
        />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}