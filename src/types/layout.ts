export interface LayoutPreferences {
  user_id: string;
  layouts: {
    lg: Array<{
      i: string;
      x: number;
      y: number;
      w: number;
      h: number;
      minW?: number;
      minH?: number;
    }>;
  };
  is_locked: boolean;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_LAYOUT = {
  lg: [
    { i: 'combat', x: 0, y: 0, w: 3, h: 12, minW: 2, minH: 8 },

    { i: 'profile', x: 6, y: 0, w: 3, h: 12, minW: 2, minH: 4 },
    { i: 'equipment', x: 9, y: 0, w: 3, h: 12, minW: 3, minH: 5 },
    

    { i: 'abilities', x: 4, y: 12, w: 4, h: 14, minW: 3, minH: 5 },
    { i: 'stats', x: 8, y: 12, w: 4, h: 14, minW: 3, minH: 5 },
    
    { i: 'class', x: 0, y: 26, w: 12, h: 10, minW: 4, minH: 6 },
  ],
  md: [
    { i: 'profile', x: 0, y: 0, w: 6, h: 12, minW: 2, minH: 4 },
    { i: 'abilities', x: 0, y: 12, w: 4, h: 6, minW: 3, minH: 5 },
    { i: 'combat', x: 4, y: 12, w: 4, h: 6, minW: 3, minH: 5 },
    { i: 'class', x: 6, y: 18, w: 4, h: 6, minW: 3, minH: 5 },
    { i: 'stats', x: 4, y: 24, w: 4, h: 6, minW: 3, minH: 5 },
    { i: 'equipment', x: 6, y: 30, w: 4, h: 6, minW: 3, minH: 5 },
    { i: 'profile-details', x: 0, y: 36, w: 10, h: 8, minW: 4, minH: 6 }, // ← NOUVEAU
  ],
  sm: [
    { i: 'profile', x: 0, y: 0, w: 6, h: 10, minW: 2, minH: 4 },
    { i: 'combat', x: 0, y: 10, w: 6, h: 8, minW: 3, minH: 5 },
    { i: 'abilities', x: 0, y: 18, w: 6, h: 6, minW: 3, minH: 5 },
    { i: 'stats', x: 0, y: 24, w: 6, h: 6, minW: 3, minH: 5 },
    { i: 'equipment', x: 0, y: 30, w: 6, h: 6, minW: 3, minH: 5 },
    { i: 'class', x: 0, y: 36, w: 6, h: 6, minW: 3, minH: 5 },
    { i: 'profile-details', x: 0, y: 42, w: 6, h: 8, minW: 4, minH: 6 }, // ← NOUVEAU
  ],
};