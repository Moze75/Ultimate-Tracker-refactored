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

export interface CampaignNote {
  id: string;
  campaign_id: string;
  title: string;
  content: string;
  note_order: number;
  created_at: string;
  updated_at: string;
}

export interface MonsterAbilities {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface MonsterEntry {
  name: string;
  description: string;
}

export interface MonsterListItem {
  name: string;
  slug: string;
  cr: string;
  type: string;
  size: string;
  ac: string;
  hp: string;
  source: string;
}

export interface Monster {
  id?: string;
  campaign_id?: string;
  source: 'aidedd' | 'custom';
  slug: string;
  name: string;
  size: string;
  type: string;
  alignment: string;
  armor_class: number;
  armor_desc: string;
  hit_points: number;
  hit_points_formula: string;
  speed: Record<string, string>;
  abilities: MonsterAbilities;
  saving_throws: string;
  skills: string;
  vulnerabilities: string;
  resistances: string;
  damage_immunities: string;
  condition_immunities: string;
  senses: string;
  languages: string;
  challenge_rating: string;
  xp: number;
  traits: MonsterEntry[];
  actions: MonsterEntry[];
  bonus_actions: MonsterEntry[];
  reactions: MonsterEntry[];
  legendary_actions: MonsterEntry[];
  legendary_description: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export type EncounterStatus = 'active' | 'completed';

export interface CampaignEncounter {
  id: string;
  campaign_id: string;
  name: string;
  status: EncounterStatus;
  round_number: number;
  current_turn_index: number;
  created_at: string;
  updated_at: string;
}

export type ParticipantType = 'player' | 'monster';

export interface EncounterParticipant {
  id: string;
  encounter_id: string;
  participant_type: ParticipantType;
  monster_id?: string;
  player_member_id?: string;
  display_name: string;
  initiative_roll: number;
  current_hp: number;
  max_hp: number;
  armor_class: number;
  conditions: string[];
  sort_order: number;
  is_active: boolean;
  notes: string;
  created_at: string;
}

export const DND_CONDITIONS = [
  'A terre',
  'Assourdi',
  'Aveugle',
  'Charme',
  'Empoigne',
  'Empoisonne',
  'Entrave',
  'Etourdi',
  'Effraye',
  'Inconscient',
  'Invisible',
  'Paralyse',
  'Petrifie',
  'Concentration',
] as const;