import React from 'react';
import { Heart, Sword, Shield } from 'lucide-react';

interface Player {
  id: string;
  current_hp: number;
  temporary_hp: number;
  max_hp: number;
}

interface HPManagerProps {
  player: Player;
  damageValue: string;
  setDamageValue: (s: string) => void;
  healValue: string;
  setHealValue: (s: string) => void;
  tempHpValue: string;
  setTempHpValue: (s: string) => void;
  applyDamage: () => Promise<void>;
  applyHealing: () => Promise<void>;
  applyTempHP: () => Promise<void>;
  totalHP: number;
  getWoundLevel: () => string;
  getWoundColor: () => string;
  getHPBarColor: () => string;
  hpBarRef?: React.RefObject<HTMLDivElement>;
}

export function HPManager({
  player,
  damageValue,
  setDamageValue,
  healValue,
  setHealValue,
  tempHpValue,
  setTempHpValue,
  applyDamage,
  applyHealing,
  applyTempHP,
  totalHP,
  getWoundLevel,
  getWoundColor,
 getHPBarColor,
  hpBarRef //
   
   
}: HPManagerProps) {
  const isCriticalHealth = totalHP <= Math.floor(player.max_hp * 0.20);

  // Couleur texturée : vert forêt → orange → rouge sang selon les PV
  // Couleur : vert forêt sombre → rouge sang profond selon les PV
  const getHPBarCSSColor = (): string => {
    const pct = player.max_hp > 0 ? player.current_hp / player.max_hp : 0;

    let r: number, g: number, b: number;

    if (pct > 0.5) {
      // 100% → 50% : vert forêt rgb(30, 100, 40) → rouge sombre rgb(140, 20, 15)
      const t = (pct - 0.5) / 0.5; // 1 (100%) → 0 (50%)
      r = Math.round(140 + (30 - 140) * t);
      g = Math.round(20 + (100 - 20) * t);
      b = Math.round(15 + (40 - 15) * t);
    } else {
      // 50% → 0% : rouge sombre rgb(140, 20, 15) → rouge sang noir rgb(80, 5, 5)
      const t = pct / 0.5; // 1 (50%) → 0 (0%)
      r = Math.round(80 + (140 - 80) * t);
      g = Math.round(5 + (20 - 5) * t);
      b = Math.round(5 + (15 - 5) * t);
    }

    return `rgb(${r}, ${g}, ${b})`;
  };
  
 return (
<div className="stat-card bg-gray-800/80 lg:bg-gray-800/30 border-gray-700">
      <div className="stat-header from-gray-800/70 to-gray-900/70 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart className="w-5 h-5 text-red-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Points de vie</h3>
            <p className={`text-sm font-medium ${getWoundColor()}`}>{getWoundLevel()}</p>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="space-y-4">
<div className="relative py-5" ref={hpBarRef}>
  {/* Texte HP centré */}
  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none select-none">
    <span className="text-white font-bold text-sm drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
      {totalHP} / {player.max_hp}
    </span>
  </div>

  <div className={`hp-bar-textured w-full h-6 bg-gray-800 ${
    isCriticalHealth ? 'heartbeat-animation' : ''
  }`}>
    {/* Barre principale avec couleur dynamique + texture */}
    <div
      className="hp-bar-fill hp-bar hp-bar-main"
      style={{
        width: `${Math.min(100, (player.current_hp / player.max_hp) * 100)}%`,
        backgroundColor: getHPBarCSSColor(),
      }}
    />

    {/* PV temporaires */}
    {player.temporary_hp > 0 && (
      <div
        className="absolute top-0 h-full rounded-full"
        style={{
          left: `${Math.min(100, (player.current_hp / player.max_hp) * 100)}%`,
          width: `${Math.min(
            100 - (player.current_hp / player.max_hp) * 100,
            (player.temporary_hp / player.max_hp) * 100
          )}%`,
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          zIndex: 3,
        }}
      />
    )}
  </div>
</div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center space-y-2"> 
              <div className="flex items-center">
                <input
                  type="number"
                  value={damageValue}
                  onChange={(e) => setDamageValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && applyDamage()}
                  className="input-dark w-16 px-2 py-2 rounded-md text-center text-sm"
                  placeholder="0"
                  min="0" 
                />
              </div>
              <button
                type="button"
                onClick={applyDamage}
                disabled={!damageValue || parseInt(damageValue) <= 0}
                className={`
                  flex items-center justify-start gap-1 text-sm mt-1 pl-0
                  ${(!damageValue || parseInt(damageValue) <= 0)
                    ? 'text-red-500/40 cursor-not-allowed'
                    : 'text-red-500 hover:text-red-400'}
                `}
              >
                <Sword size={16} />
                <span>Dégâts</span>
              </button>
            </div>

                    <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center">
                <input
                  type="number"
                  value={healValue}
                  onChange={(e) => setHealValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && applyHealing()}
                  className="input-dark w-16 px-2 py-2 rounded-md text-center text-sm"
                  placeholder="0"
                  min="0"
                />
              </div>
              <button
                type="button"
                onClick={applyHealing}
                disabled={!healValue || parseInt(healValue) <= 0}
                className={`
                  flex items-center justify-start gap-1 text-sm mt-1 pl-0
                  ${(!healValue || parseInt(healValue) <= 0)
                    ? 'text-green-400/40 cursor-not-allowed'
                    : 'text-green-400 hover:text-green-300'}
                `}
              >
                <Heart size={16} />
                <span>Soins</span>
              </button>
            </div>

                      <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center">
                <input
                  type="number"
                  value={tempHpValue}
                  onChange={(e) => setTempHpValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && applyTempHP()}
                  className="input-dark w-16 px-2 py-2 rounded-md text-center text-sm"
                  placeholder="0"
                  min="0"
                />
              </div>
              <button
                type="button"
                onClick={applyTempHP}
                disabled={!tempHpValue || parseInt(tempHpValue) <= 0}
                className={`
                  flex items-center justify-start gap-1 text-sm mt-1 pl-0
                  ${(!tempHpValue || parseInt(tempHpValue) <= 0)
                    ? 'text-blue-400/40 cursor-not-allowed'
                    : 'text-blue-400 hover:text-blue-300'}
                `}
              >
                <Shield size={16} />
                <span>PV Temp</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}