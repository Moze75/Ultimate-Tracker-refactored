export interface Campaign {
  id: string;
  name: string;
  description?: string;
  game_master_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface CampaignInvitation {
  id: string;
  campaign_id: string;
  player_email: string;
  player_id?: string;
  status: 'pending' | 'accepted' | 'declined';
  invited_at: string;
  responded_at?: string;
  invitation_code: string;
  created_at: string;
}

export interface CampaignMember {
  id: string;
  campaign_id: string;
  user_id: string;
  player_id?: string;
  joined_at: string;
  is_active: boolean;
  // Données enrichies (via JOIN)
  email?: string;
  player_name?: string;
}

export interface CampaignInventoryItem {
  id: string;
  campaign_id: string;
  name: string;
  description?: string;
  quantity: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type GiftType = 'item' | 'currency';
export type DistributionMode = 'individual' | 'shared';

export interface CampaignGift {
  id: string;
  campaign_id: string;
  gift_type: GiftType;
  
  // Pour les objets
  item_name?: string;
  item_description?: string;
  item_quantity?: number;
  
  // Pour l'argent
  gold: number;
  silver: number;
  copper: number;
  
  distribution_mode: DistributionMode;
  message?: string;
  sent_by: string;
  sent_at: string;
  status: 'pending' | 'distributed' | 'cancelled';
}

export interface CampaignGiftClaim {
  id: string;
  gift_id: string;
  user_id: string;
  player_id?: string;
  
  claimed_quantity?: number;
  claimed_gold: number;
  claimed_silver: number;
  claimed_copper: number;
  
  claimed_at: string;
}