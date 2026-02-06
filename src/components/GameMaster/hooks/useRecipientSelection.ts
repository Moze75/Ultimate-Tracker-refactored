import { useState, useEffect } from 'react';
import { CampaignMember } from '../../../types/campaign';

export function useRecipientSelection(members: CampaignMember[]) {
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectAllRecipients, setSelectAllRecipients] = useState(false);

  useEffect(() => {
    if (selectAllRecipients) {
      const allIds = members.map(m => m.user_id || m.player_id || m.id).filter(Boolean) as string[];
      setSelectedRecipients(allIds);
    } else {
      setSelectedRecipients([]);
    }
  }, [selectAllRecipients, members]);

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients(prev => {
      if (prev.includes(userId)) return prev.filter(id => id !== userId);
      return [...prev, userId];
    });
    setSelectAllRecipients(false);
  };

  return {
    selectedRecipients,
    setSelectedRecipients,
    selectAllRecipients,
    setSelectAllRecipients,
    toggleRecipient,
  };
}
