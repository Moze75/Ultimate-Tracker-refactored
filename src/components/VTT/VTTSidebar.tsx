import React, { useState, useRef, useEffect } from 'react';
import { Users, Map, Settings, Eye, EyeOff, Trash2, Upload, LogOut, Package, RefreshCw } from 'lucide-react';
import type { VTTToken, VTTRoomConfig, VTTProp } from '../../types/vtt';
import { VTTPropsPanel } from './VTTPropsPanel';

type SidebarTab = 'tokens' | 'map' | 'props' | 'settings';

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
  onBack: () => void;
  props: VTTProp[];
  selectedPropId: string | null;
  onSelectProp: (id: string | null) => void;
  onAddProp: (prop: Omit<VTTProp, 'id'>) => void;
  onRemoveProp: (propId: string) => void;
  onUpdateProp: (propId: string, changes: Partial<VTTProp>) => void;
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
  onBack,
  props,
  selectedPropId,
  onSelectProp,
  onAddProp,
  onRemoveProp,
  onUpdateProp,
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

  const hasExistingMap = !!config.mapImageUrl;

  const confirmReplace = (action: () => void) => {
    if (hasExistingMap) {
      if (!window.confirm('Une carte est déjà chargée. Voulez-vous la remplacer ?')) return;
    }
    action();
  };

  const handleApplyUrl = () => {
    const trimmed = mapUrl.trim();
    if (!trimmed) return;
    confirmReplace(() => onUpdateMap({ mapImageUrl: trimmed }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    confirmReplace(async () => {
      setCompressing(true);
      try {
        const { dataUrl, width, height } = await compressImageToDataUrl(file);
        onUpdateMap({ mapImageUrl: dataUrl, mapWidth: width, mapHeight: height });
        setMapUrl('(fichier local)');
      } catch {
        alert('Erreur lors du chargement.');
      } finally {
        setCompressing(false);
      }
    });
  };

  return (
    <div className="flex flex-col w-56 bg-gray-900/95 border-l border-gray-700/60 shrink-0 overflow-hidden">
      <div className="flex border-b border-gray-700/60 shrink-0">
        <TabBtn icon={<Users size={14} />} title="Tokens" active={activeTab === 'tokens'} onClick={() => setActiveTab('tokens')} />
        <TabBtn icon={<Map size={14} />} title="Carte" active={activeTab === 'map'} onClick={() => setActiveTab('map')} />
        <TabBtn icon={<Package size={14} />} title="Props" active={activeTab === 'props'} onClick={() => setActiveTab('props')} />
        <TabBtn icon={<Settings size={14} />} title="Config" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tokens' && (
          <div className="flex flex-col">
            <div ref={tokenListRef} className="p-2 space-y-1">
              {tokens.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">Aucun token sur la carte</p>
              )}
              {tokens.map(token => {
                const canEdit = role === 'gm' || token.ownerUserId === userId;
                const isSelected = token.id === selectedTokenId;
                return (
                  <div
                    key={token.id}
                    data-token-id={token.id}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('application/vtt-token-id', token.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing group transition-colors ${
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
                        <img src={token.imageUrl} alt="" draggable={false} className="w-full h-full object-cover rounded-full pointer-events-none" />
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
                        {role === 'gm' && (
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
          </div>
        )}

        {activeTab === 'map' && (
          <div className="p-3 space-y-3">
            {config.mapImageUrl && (
              <div className="relative rounded-lg overflow-hidden border border-gray-700/60 bg-gray-800">
                <img
                  src={config.mapImageUrl}
                  alt="Carte actuelle"
                  className="w-full h-28 object-cover"
                  onError={e => ((e.target as HTMLImageElement).style.display = 'none')}
                />
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent">
                  <p className="text-[10px] text-gray-300 truncate">
                    {config.mapImageUrl.startsWith('data:') ? 'Fichier local' : config.mapImageUrl}
                  </p>
                </div>
                <button
                  onClick={() => { if (window.confirm('Supprimer la carte ?')) onUpdateMap({ mapImageUrl: '' }); }}
                  className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-900/70 rounded text-gray-300 hover:text-red-300 transition-colors"
                  title="Retirer la carte"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">
                {hasExistingMap ? (
                  <span className="flex items-center gap-1"><RefreshCw size={10} /> Remplacer par URL</span>
                ) : 'URL de la carte'}
              </label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={mapUrl}
                  onChange={e => setMapUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleApplyUrl(); }}
                  placeholder="https://..."
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  onClick={handleApplyUrl}
                  className="px-2 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs transition-colors"
                >
                  OK
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">
                {hasExistingMap ? (
                  <span className="flex items-center gap-1"><RefreshCw size={10} /> Remplacer par fichier</span>
                ) : <span>Fichier local <span className="text-gray-600">(compressé)</span></span>}
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
          </div>
        )}

        {activeTab === 'props' && (
          <VTTPropsPanel
            props={props}
            selectedPropId={selectedPropId}
            role={role}
            onSelectProp={onSelectProp}
            onAddProp={onAddProp}
            onRemoveProp={onRemoveProp}
            onUpdateProp={onUpdateProp}
          />
        )}

        {activeTab === 'settings' && (
          <div className="p-3 space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">ID Room</p>
              <p className="font-mono text-gray-400 text-xs break-all bg-gray-800/60 rounded px-2 py-1.5 border border-gray-700/50">{roomId}</p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-700/60 shrink-0">
        {activeTab === 'settings' && (
          <button
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-xs font-medium border-b border-gray-700/60"
          >
            <LogOut size={13} />
            Retour à l'accueil
          </button>
        )}
        <div className={`px-3 py-2 flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          {connected ? `${connectedCount} connecté${connectedCount > 1 ? 's' : ''}` : 'Déconnecté'}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ icon, title, active, onClick }: { icon: React.ReactNode; title: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`relative group flex-1 flex items-center justify-center py-2.5 transition-colors border-b-2 ${
        active
          ? 'text-amber-400 border-amber-500 bg-amber-500/5'
          : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-gray-800/50'
      }`}
    >
      {icon}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {title}
      </span>
    </button>
  );
}
