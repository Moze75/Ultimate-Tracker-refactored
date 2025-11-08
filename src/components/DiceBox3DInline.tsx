import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface DiceBox3DInlineProps {
  isOpen: boolean;
  onClose: () => void;
  rollData: {
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  } | null;
}

export function DiceBox3DInline({ isOpen, onClose, rollData }: DiceBox3DInlineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const diceBoxRef = useRef<any>(null);
  const initStartedRef = useRef(false);
  const [result, setResult] = useState<{ total: number; rolls: number[] } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Initialisation unique
  useEffect(() => {
    if (!isOpen || initStartedRef.current) return;
    
    initStartedRef.current = true;
    let mounted = true;

    const init = async () => {
      try {
        console.log('🎲 START INIT');
        
        await new Promise(r => setTimeout(r, 500));
        
        const el = document.getElementById('dice-box-overlay');
        if (!el) {
          console.error('❌ No container');
          initStartedRef.current = false;
          return;
        }

        console.log('✅ Container OK:', el.clientWidth, 'x', el.clientHeight);

        const { default: DiceBox } = await import('@3d-dice/dice-box-threejs');
        
        if (!mounted) return;

        console.log('🎲 Creating DiceBox...');
        
        const box = new DiceBox('#dice-box-overlay', {
          assetPath: 'https://unpkg.com/@3d-dice/dice-box@1.1.5/dist/assets/',
          theme: 'default',
          themeColor: '#8b5cf6',
          scale: 6,
          
          onRollComplete: (res: any) => {
            console.log('🎯 ROLL COMPLETE:', res);
            
            const rolls = res?.rolls || [];
            const sum = rolls.reduce((a: number, r: any) => a + (r?.value || 0), 0);
            
            setResult({
              total: sum + (rollData?.modifier || 0),
              rolls: rolls.map((r: any) => r?.value || 0)
            });
            setIsRolling(false);

            setTimeout(onClose, 3000);
          }
        });

        console.log('🎲 Initializing...');
        await box.initialize();
        
        if (mounted) {
          diceBoxRef.current = box;
          setIsReady(true);
          console.log('✅✅✅ READY!');
        }
      } catch (err) {
        console.error('❌ INIT ERROR:', err);
        initStartedRef.current = false;
      }
    };

    init();

    return () => { mounted = false; };
  }, [isOpen]);

  // Lancer
  useEffect(() => {
    if (!isOpen || !rollData || !isReady || !diceBoxRef.current) return;

    console.log('🎲 ROLLING:', rollData);

    const timer = setTimeout(() => {
      if (!diceBoxRef.current) return;

      setIsRolling(true);
      setResult(null);

      const notation = rollData.diceFormula + 
        (rollData.modifier !== 0 ? (rollData.modifier > 0 ? '+' : '') + rollData.modifier : '');

      console.log('🎲 Notation:', notation);

      try {
        if (diceBoxRef.current.clear) {
          diceBoxRef.current.clear();
        }
        
        setTimeout(() => {
          if (diceBoxRef.current && diceBoxRef.current.roll) {
            diceBoxRef.current.roll(notation);
          }
        }, 150);
      } catch (err) {
        console.error('❌ ROLL ERROR:', err);
        setIsRolling(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [isOpen, rollData, isReady]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        id="dice-box-overlay"
        ref={containerRef}
        className="fixed inset-0 z-50 pointer-events-none"
        style={{ width: '100vw', height: '100vh' }}
      />

      <div className="fixed top-4 right-4 z-[60] animate-in slide-in-from-top">
        <div className="bg-gradient-to-r from-purple-900/95 to-blue-900/95 backdrop-blur-xl rounded-xl border border-purple-500/50 shadow-2xl p-4 min-w-[280px]">
          <div className="flex justify-between gap-3 mb-3">
            <div>
              <h4 className="text-white font-bold text-lg">{rollData?.attackName}</h4>
              <p className="text-purple-200 text-sm">
                {rollData?.diceFormula}
                {rollData?.modifier !== 0 && ` ${rollData.modifier >= 0 ? '+' : ''}${rollData.modifier}`}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg pointer-events-auto">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {result && !isRolling ? (
            <div className="text-center py-2">
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                {result.total}
              </div>
              <div className="text-xs text-gray-300">
                Dés: [{result.rolls.join(', ')}]
                {rollData?.modifier !== 0 && ` ${rollData.modifier >= 0 ? '+' : ''}${rollData.modifier}`}
              </div>
            </div>
          ) : (
            <div className="text-center py-2 text-white text-sm animate-pulse">
              {!isReady ? '⏳ Initialisation...' : '🎲 Lancer...'}
            </div>
          )}
        </div>
      </div>

      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
    </>
  );
}