// Hive configuration colours — SPEC B §10a/§10b. Not the brand amber: these are part colours.

export const BAR_STATUSES = ['inactive', 'active', 'empty', 'brood', 'resource', 'follower_board'] as const;

export const BAR_COLOUR: Record<string, string> = {
  inactive: '#F3F4F6',
  active: '#93C5FD',
  empty: '#FFFFFF',
  brood: '#8B4513',
  resource: '#F59E0B',
  follower_board: '#1F2937',
};

export const BAR_LABEL_DARK: Record<string, boolean> = { inactive: true, empty: true };

export const PART_STYLE: Record<string, { label: string; fill: string; border: string; height: number; frames?: boolean }> = {
  deep: { label: 'Deep', fill: '#C47F0A', border: '#A04000', height: 96, frames: true },
  medium: { label: 'Medium', fill: '#E99B1A', border: '#BA4A00', height: 64, frames: true },
  shallow: { label: 'Shallow', fill: '#F39C12', border: '#D68910', height: 48 },
  feeder: { label: 'Top Feeder', fill: '#DBEAFE', border: '#93C5FD', height: 56 },
  inner_cover: { label: 'Inner Cover', fill: '#FEF3C7', border: '#FDE68A', height: 24 },
  slatted_rack: { label: 'Slatted Rack', fill: '#F5E1DA', border: '#E6B8A2', height: 40 },
  excluder: { label: 'Excluder', fill: '#F3F4F6', border: '#D1D5DB', height: 16 },
};

/** Dark labels on the pale parts, white on the wooden ones. */
export const PART_DARK_TEXT = new Set(['feeder', 'inner_cover', 'slatted_rack', 'excluder']);
