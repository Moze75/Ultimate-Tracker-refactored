import React, { useState, useRef, useEffect } from 'react';
import { Users, Settings, RefreshCw, Eye, EyeOff, Trash2, Upload } from 'lucide-react';
import type { VTTToken, VTTRoomConfig } from '../../types/vtt';

type SidebarTab = 'tokens' | 'settings';

interface VTTSidebarProps {
  role: 'gm' | 'player';
  tokens: VTTToken[];
  config: VTTRoomConfig;
  selectedTokenId: string | null;
  userId: string;
  roomId: string;
  connected: boolean;
  connectedCount: number;
  onSelectToken: (id: string | null) => void;
  onEditToken: (token: VTTToken) => void;
  onRemoveToken: (tokenId: string) => void;
  onToggleVisibility: (tokenId: string) => void;
  onUpdateMap: (changes: Partial<VTTRoomConfig>) => void;
  onResetFog: () => void;
}

function compressImageToDataUrl(file: File, maxPx = 1920, quality = 0.82): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), width: w, height: h });
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function VTTSidebar({
  role,
  tokens,
  config,
  selectedTokenId,
  userId,
  roomId,
  connected,
  connectedCount,
  onSelectToken,
  onEditToken,
  onRemoveToken,
  onToggleVisibility,
  onUpdateMap,
  onResetFog,
}: VTTSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('tokens');
  const [mapUrl, setMapUrl] = useState(config.mapImageUrl);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tokenListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedTokenId || !tokenListRef.current) return;
    const el = tokenListRef.current.querySelector(`[data-token-id="${selectedTokenId}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (activeTab !== 'tokens') setActiveTab('tokens');
    }
  }, [selectedTokenId]);

  useEffect(() => {
    if (!config.mapImageUrl.startsWith('data:')) {
      setMapUrl(config.mapImageUrl);
    }
  }, [config.mapImageUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const { dataUrl, width, height } = await compressImageToDataUrl(file);
      onUpdateMap({ mapImageUrl: dataUrl, mapWidth: width, mapHeight: height });
      setMapUrl('(fichier local)');
    } catch {
      alert('Erreur lors du chargement.');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col w-56 bg-gray-900/95 border-l border-gray-700/60 shrink-0 overflow-hidden">
      <div className="flex border-b border-gray-700/60 shrink-0">
        <TabBtn active={activeTab === 'tokens'} onClick={() => setActiveTab('tokens')}>
          <Users size={14} />
          Tokens
        </TabBtn>
        <TabBtn active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
          <Settings size={14} />
          Carte
        </TabBtn>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tokens' && (
          <div ref={tokenListRef} className="p-2 space-y-1">
            {tokens.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">Aucun token</p>
            )}
            {tokens.map(token => {
              const canEdit = role === 'gm' || token.ownerUserId === userId;
              const isSelected = token.id === selectedTokenId;
              return (
                <div
                  key={token.id}
                  data-token-id={token.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors ${
                    isSelected
                      ? 'bg-amber-500/15 border border-amber-500/40'
                      : 'hover:bg-gray-800 border border-transparent'
                  }`}
                  onClick={() => onSelectToken(isSelected ? null : token.id)}
                >
                  <div
                    className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-white overflow-hidden"
                    style={{ backgroundColor: token.imageUrl ? 'transparent' : token.color }}
                  >
                    {token.imageUrl ? (
                      <img src={token.imageUrl} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      token.label.slice(0, 2)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${isSelected ? 'text-amber-300' : 'text-gray-300'}`}>
                      {token.label}
                    </p>
                    {token.maxHp != null && token.hp != null && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(0, Math.min(100, (token.hp / token.maxHp) * 100))}%`,
                              backgroundColor: token.hp / token.maxHp > 0.5 ? '#22c55e' : token.hp / token.maxHp > 0.25 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                        <span className="text-[9px] text-gray-500">{token.hp}/{token.maxHp}</span>
                      </div>
                    )}
                  </div>
                  {!token.visible && <EyeOff size={11} className="text-gray-500 shrink-0" />}
                  {canEdit && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {role === 'gm' && (
                        <button
                          onClick={e => { e.stopPropagation(); onToggleVisibility(token.id); }}
                          className="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
                          title={token.visible ? 'Masquer' : 'Afficher'}
                        >
                          {token.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); onEditToken(token); }}
                        className="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
                        title="Éditer"
                      >
                        <Settings size={11} />
                      </button>
                      {(role === 'gm') && (
                        <button
                          onClick={e => { e.stopPropagation(); onRemoveToken(token.id); }}
                          className="p-1 rounded hover:bg-red-700/40 text-gray-400 hover:text-red-400 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-3 space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">URL de la carte</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={mapUrl}
                  onChange={e => setMapUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  onClick={() => onUpdateMap({ mapImageUrl: mapUrl })}
                  className="px-2 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs transition-colors"
                >
                  OK
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">
                Fichier local <span className="text-gray-600">(compressé)</span>
              </label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 text-gray-300 rounded text-xs transition-colors"
              >
                <Upload size={12} />
                {compressing ? 'Compression...' : 'Choisir une image...'}
              </button>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Grille : {config.gridSize}px</label>
              <input
                type="range"
                min={20}
                max={120}
                step={5}
                value={config.gridSize}
                onChange={e => onUpdateMap({ gridSize: parseInt(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </div>

            <div className="space-y-2">
              <Toggle
                label="Snap to grid"
                value={config.snapToGrid}
                onChange={v => onUpdateMap({ snapToGrid: v })}
              />
              <Toggle
                label="Brouillard de guerre"
                value={config.fogEnabled}
                onChange={v => onUpdateMap({ fogEnabled: v })}
              />
            </div>

            {role === 'gm' && (
              <button
                onClick={onResetFog}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-gray-300 rounded text-xs transition-colors"
              >
                <RefreshCw size={12} />
                Réinitialiser le brouillard
              </button>
            )}

            <div className="pt-2 border-t border-gray-700/60">
              <p className="text-xs text-gray-500">
                ID Room : <span className="font-mono text-gray-400">{roomId}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <div className={`px-3 py-2 border-t border-gray-700/60 flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
        {connected ? `${connectedCount} connecté${connectedCount > 1 ? 's' : ''}` : 'Déconnecté'}
      </div>
    </div>
  );
}

function TabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
        active
          ? 'text-amber-400 border-amber-500 bg-amber-500/5'
          : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-gray-800/50'
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full transition-colors ${value ? 'bg-amber-600' : 'bg-gray-700'}`}
      >
        <span className={`block w-3.5 h-3.5 rounded-full bg-white mx-0.5 transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
