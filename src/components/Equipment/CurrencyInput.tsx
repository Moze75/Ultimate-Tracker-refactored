import React, { useState } from 'react';

type Currency = 'gold' | 'silver' | 'copper';

interface CurrencyInputProps {
  currency: Currency;
  value: number;
  onAdd: (n: number) => void;
  onSpend: (n: number) => void;
}

export function CurrencyInput({ currency, value, onAdd, onSpend }: CurrencyInputProps) {
  const [amount, setAmount] = useState<string>('');

  const getColor = (c: Currency) => {
    if (c === 'gold') return 'text-yellow-500';
    if (c === 'silver') return 'text-gray-300';
    if (c === 'copper') return 'text-orange-400';
    return '';
  };

  const getName = (c: Currency) => {
    if (c === 'gold') return 'Or';
    if (c === 'silver') return 'Argent';
    if (c === 'copper') return 'Cuivre';
    return c;
  };

  const act = (add: boolean) => {
    const n = parseInt(amount) || 0;
    if (n > 0) {
      (add ? onAdd : onSpend)(n);
      setAmount('');
    }
  };

  return (
    <div className="flex items-center gap-2 h-11 relative">
      <div className={`w-16 text-center font-medium ${getColor(currency)}`}>
        {getName(currency)}
      </div>
      <div className="w-16 h-full text-center bg-gray-800/50 rounded-md flex items-center justify-center font-bold">
        {value}
      </div>
      <div className="flex-1 flex items-center justify-end gap-1">
        <input
          type="number"
          min="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="input-dark w-20 h-11 px-2 rounded-md text-center text-base"
          placeholder="0"
        />
        <button
          onClick={() => act(true)}
          className="h-11 w-[72px] text-base text-green-500 hover:bg-green-900/30 rounded-md border border-green-500/20 hover:border-green-500/40"
        >
          Ajouter
        </button>
        <button
          onClick={() => act(false)}
          className="h-11 w-[72px] text-base text-red-500 hover:bg-red-900/30 rounded-md border border-red-500/20 hover:border-red-500/40"
        >
          Dépenser
        </button>
      </div>
    </div>
  );
}
