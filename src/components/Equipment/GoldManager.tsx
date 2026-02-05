import React from 'react';
import { Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { Player } from '../../types/dnd';
import { CurrencyInput } from './CurrencyInput';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

type Currency = 'gold' | 'silver' | 'copper';

interface GoldManagerProps {
  player: Player;
  onPlayerUpdate: (player: Player) => void;
}

export function GoldManager({ player, onPlayerUpdate }: GoldManagerProps) {
  const device = useResponsiveLayout();
  const handleCurrencyChange = async (currency: Currency, amount: number, isAdd: boolean) => {
    const currentAmount = (player[currency] as number) || 0;
    const newAmount = Math.max(0, isAdd ? currentAmount + amount : currentAmount - amount);

    try {
      const { error } = await supabase
        .from('players')
        .update({ [currency]: newAmount })
        .eq('id', player.id);

      if (error) throw error;

      onPlayerUpdate({ ...player, [currency]: newAmount } as any);
      toast.success(`${isAdd ? 'Ajout' : 'Retrait'} de ${amount} ${currency}`);
    } catch (e) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  return (
    <div className={device === 'desktop' ? '' : 'stat-card !bg-gray-800/70'}>
      <div className={device === 'desktop'
        ? 'flex items-center gap-3 mb-4'
        : 'stat-header !from-gray-800/70 !to-gray-900/70 flex items-center gap-3'
      }>
        <Coins className="text-green-500" size={24} />
        <h2 className="text-lg sm:text-xl font-semibold text-gray-100">Mon argent</h2>
      </div>
      <div className={device === 'desktop' ? 'space-y-2' : 'p-4 space-y-2'}>
        {(['gold', 'silver', 'copper'] as Currency[]).map(curr => (
          <CurrencyInput
            key={curr}
            currency={curr}
            value={(player[curr] as number) || 0}
            onAdd={(n) => handleCurrencyChange(curr, n, true)}
            onSpend={(n) => handleCurrencyChange(curr, n, false)}
          />
        ))}
      </div>
    </div>
  );
}