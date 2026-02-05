import React from 'react';
import { Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { Player } from '../../types/dnd';
import { CurrencyInput } from './CurrencyInput';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

type Currency = 'gold' | 'silver' | 'copper' | 'electrum' | 'platinum';

const leftCurrencies: Currency[] = ['gold', 'silver', 'copper'];
const rightCurrencies: Currency[] = ['electrum', 'platinum'];

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

  const renderCurrencyList = (currencies: Currency[]) =>
    currencies.map(curr => (
      <CurrencyInput
        key={curr}
        currency={curr}
        value={(player[curr] as number) || 0}
        onAdd={(n) => handleCurrencyChange(curr, n, true)}
        onSpend={(n) => handleCurrencyChange(curr, n, false)}
      />
    ));

  return (
    <div className={device === 'desktop'
      ? 'bg-gray-800/20 border border-gray-700/30 rounded-xl p-5'
      : 'stat-card !bg-gray-800/70'
    }>
      {device !== 'desktop' && (
        <div className="stat-header !from-gray-800/70 !to-gray-900/70 flex items-center gap-3">
          <Coins className="text-green-500" size={24} />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-100">Mon argent</h2>
        </div>
      )}
      {device === 'desktop' ? (
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <div className="flex-1 min-w-[340px] space-y-2">
            {renderCurrencyList(leftCurrencies)}
          </div>
          <div className="flex-1 min-w-[340px] space-y-2">
            {renderCurrencyList(rightCurrencies)}
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {renderCurrencyList([...leftCurrencies, ...rightCurrencies])}
        </div>
      )}
    </div>
  );
}
