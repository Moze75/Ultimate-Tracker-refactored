import React, { useState, useRef } from 'react';
import { User, Upload, Dices } from 'lucide-react';
import { AvatarModal } from './AvatarModal';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface AvatarProps {
  url: string | null;
  playerId: string;
  onAvatarUpdate: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
  containOnMdUp?: boolean;
  secondaryClass?: string | null;
  secondaryLevel?: number | null;
  onOpenDiceSettings?: () => void; // ✅ Nouvelle prop
}

export function Avatar({
  url,
  playerId,
  onAvatarUpdate,
  size = 'md',
  editable = false,
  containOnMdUp = false,
  secondaryClass = null,
  secondaryLevel = null,
  onOpenDiceSettings, // ✅ Ajouter
}: AvatarProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showModal, setShowModal] = useState(false);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-40 h-40',
    lg: 'w-56 h-56'
  };

  const extractSupabaseAvatarPath = (publicUrl: string): string | null => {
    const marker = '/storage/v1/object/public/avatars/';
    const i = publicUrl.indexOf(marker);
    if (i === -1) return null;
    return publicUrl.slice(i + marker.length);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5MB");
      return;
    }

    setIsUploading(true);
    try {
      if (url) {
        const oldPath = extractSupabaseAvatarPath(url);
        if (oldPath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${playerId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('players')
        .update({ avatar_url: publicUrl })
        .eq('id', playerId);

      if (updateError) throw updateError;

      onAvatarUpdate(publicUrl);
      toast.success('Avatar mis à jour');
    } catch (error: any) {
      console.error("Erreur lors de la mise à jour de l'avatar:", error);
      toast.error("Erreur lors de la mise à jour de l'avatar");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-gray-800/50">
      {isUploading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
          <img
            src="/icons/wmremove-transformed.png"
            alt="Chargement..."
            className="animate-spin rounded-full h-6 w-6 object-cover"
          />
        </div>
      ) : url ? (
        <div
          className={`relative w-full h-full ${
            url ? 'cursor-pointer hover:opacity-90 transition-opacity' :
            editable ? 'cursor-pointer hover:opacity-90 transition-opacity' : 'cursor-default'
          }`}
          onClick={() => {
            if (editable) {
              fileInputRef.current?.click();
            } else if (url) {
              setShowModal(true);
            }
          }}
        >
          <img
            src={url}
            alt="Avatar"
            className={`w-full h-full select-none ${
              containOnMdUp ? 'object-cover md:object-contain' : 'object-cover'
            }`}
          />
          
          {/* ✅ NOUVEAU : Bouton paramètres dés (visible seulement sur mobile) */}
{onOpenDiceSettings && !editable && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onOpenDiceSettings();
    }}
    className="absolute top-2 right-2 md:hidden px-2 py-1.5 rounded-lg bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white flex items-center gap-1.5 transition-colors text-xs font-medium shadow-lg z-10"
    title="Paramètres des dés"
  >
    <Dices className="w-3.5 h-3.5" />
    <span>Paramètres</span>
  </button>
)}

          {editable && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-gray-900/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Upload className="w-6 h-6 text-white" />
            </div>
          )}
        </div>
      ) : (
        <div
          className={`w-full h-full flex flex-col items-center justify-center ${
            editable ? 'cursor-pointer hover:opacity-90 transition-opacity' : 'cursor-default'
          }`}
          onClick={() => {
            if (editable) {
              fileInputRef.current?.click();
            }
          }}
        >
          <User className="w-8 h-8 text-gray-400" />
          {editable && <Upload className="w-4 h-4 text-gray-500 mt-1" />}
        </div>
      )}
      
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
      )}
      
      {/* ✅ Passer onOpenDiceSettings au modal */}
      {showModal && url && (
        <AvatarModal 
          url={url} 
          onClose={() => setShowModal(false)}
          onOpenDiceSettings={onOpenDiceSettings}
        />
      )}
    </div>
  );
}