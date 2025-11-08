import React from 'react';
import { DiceBox3DInline } from './DiceBox3DInline';

interface DiceRollerLazyProps {
  isOpen: boolean;
  onClose: () => void;
  rollData: {
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  } | null;
}

export function DiceRollerLazy({ isOpen, onClose, rollData }: DiceRollerLazyProps) {
  return <DiceBox3DInline isOpen={isOpen} onClose={onClose} rollData={rollData} />;
}