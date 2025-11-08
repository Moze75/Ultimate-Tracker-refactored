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
  getHPBarColor
  hpBarRef,
   
}: HPManagerProps) {
  const isCriticalHealth = totalHP <= Math.floor(player.max_hp * 0.20);

 return (
<div className="stat-card bg-gray-800/80 border-gray-700">
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
         <div className="relative py-3">
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none select-none">
              <span className="text-white font-bold text-sm drop-shadow-lg">
                {totalHP} / {player.max_hp}
              </span>
            </div>

            <div className="w-full bg-gray-700 rounded-full h-5 overflow-hidden relative">
              <div
                className={`hp-bar hp-bar-main h-full transition-all duration-500 bg-gradient-to-r ${getHPBarColor()} ${
                  isCriticalHealth ? 'heartbeat-animation' : ''
                }`}
                style={{ width: `${Math.min(100, (player.current_hp / player.max_hp) * 100)}%` }}
              />
              {player.temporary_hp > 0 && (
                <div
                  className="hp-bar-temp absolute top-0 h-full bg-gradient-to-r from-blue-500 to-blue-400"
                  style={{
                    left: `${Math.min(100, (player.current_hp / player.max_hp) * 100)}%`,
                    width: `${Math.min(
                      100 - (player.current_hp / player.max_hp) * 100,
                      (player.temporary_hp / player.max_hp) * 100
                    )}%`
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
                  className="input-dark w-16 px-2 py-2 rounded-l-md text-center text-sm"
                  placeholder="0"
                  min="0"
                />
                <button
                  onClick={applyDamage}
                  disabled={!damageValue || parseInt(damageValue) <= 0}
                  className="px-3 py-2 bg-transparent hover:bg-gray-600/30 disabled:bg-transparent disabled:cursor-not-allowed text-red-500 rounded-r-md text-sm font-medium transition-colors"
                >
                  OK
                </button>
              </div>
              <div className="flex items-center justify-center gap-1 text-sm text-red-500 mt-1">
                <Sword size={16} />
                <span>Dégâts</span>
              </div>
            </div>

            <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center">
                <input
                  type="number"
                  value={healValue}
                  onChange={(e) => setHealValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && applyHealing()}
                  className="input-dark w-16 px-2 py-2 rounded-l-md text-center text-sm"
                  placeholder="0"
                  min="0"
                />
                <button
                  onClick={applyHealing}
                  disabled={!healValue || parseInt(healValue) <= 0}
                  className="px-3 py-2 bg-transparent hover:bg-gray-600/30 disabled:bg-transparent disabled:cursor-not-allowed text-green-400 rounded-r-md text-sm font-medium transition-colors"
                >
                  OK
                </button>
              </div>
              <div className="flex items-center justify-center gap-1 text-sm text-green-400 mt-1">
                <Heart size={16} />
                <span>Soins</span>
              </div>
            </div>

            <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center">
                <input
                  type="number"
                  value={tempHpValue}
                  onChange={(e) => setTempHpValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && applyTempHP()}
                  className="input-dark w-16 px-2 py-2 rounded-l-md text-center text-sm"
                  placeholder="0"
                  min="0"
                />
                <button
                  onClick={applyTempHP}
                  disabled={!tempHpValue || parseInt(tempHpValue) <= 0}
                  className="px-3 py-2 bg-transparent hover:bg-gray-600/30 disabled:bg-transparent disabled:cursor-not-allowed text-blue-400 rounded-r-md text-sm font-medium transition-colors"
                >
                  OK
                </button>
              </div>
              <div className="flex items-center justify-center gap-1 text-sm text-blue-400 mt-1">
                <Shield size={16} />
                <span>PV Temp</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}