import { supabase } from '../lib/supabase';

export interface CampaignVisual {
  id: string;
  user_id: string;
campaign_id: string; 
  title: string;
  image_url: string;
  description?:  string;
  category: 'character' | 'location' | 'item' | 'npc' | 'general';
  created_at: string;
}

export const campaignVisualsService = {
  async getAll(playerId: string): Promise<CampaignVisual[]> {
    const { data, error } = await supabase
      .from('campaign_visuals')
      .select('*')
    .eq('campaign_id', campaignId)  // CORRECT (et renommer le param)

      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(visual: Omit<CampaignVisual, 'id' | 'created_at'>): Promise<CampaignVisual> {
    const { data, error } = await supabase
      .from('campaign_visuals')
      .insert(visual)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<CampaignVisual>): Promise<void> {
    const { error } = await supabase
      .from('campaign_visuals')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      . from('campaign_visuals')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};