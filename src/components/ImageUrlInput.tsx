import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, AlertCircle } from 'lucide-react';

interface ImageUrlInputProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
}

export function ImageUrlInput({ 
  value, 
  onChange, 
  label = "URL de l'image",
  placeholder = "https://www.aidedd.org/dnd/images-om/..."
}: ImageUrlInputProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    if (!value.trim()) {
      setImageError(false);
      setImageLoading(false);
      return;
    }

    setImageLoading(true);
    setImageError(false);

    // ✅ FIX: Utiliser HTMLImageElement au lieu de Image
    const img = new window.Image();
    img.onload = () => {
      setImageLoading(false);
      setImageError(false);
    };
    img.onerror = () => {
      setImageLoading(false);
      setImageError(true);
    };
    img.src = value;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [value]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>
      
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-dark w-full px-4 py-2 rounded-lg"
      />

      {/* Prévisualisation de l'image */}
      {value.trim() && (
        <div className="mt-3">
          {imageLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500" />
              Chargement de l'image...
            </div>
          )}

          {imageError && !imageLoading && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
              <AlertCircle size={16} />
              Image introuvable ou URL invalide
            </div>
          )}

          {!imageError && !imageLoading && (
            <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/50">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                <ImageIcon size={14} />
                Aperçu :
              </div>
<img
  src={value}
  alt="Aperçu"
  className="w-full max-w-md rounded-lg border border-gray-600/50 shadow-lg"
  onError={() => setImageError(true)}
/>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        Utilisez une URL d'image (ex: depuis aidedd.org, dndbeyond.com, etc.)
      </p>
    </div>
  );
}