// Shared option sets for inspection forms (Standard form + Plus quick-facts screen).

export const QUEEN_STATUS_OPTIONS = [
  { value: 'seen', label: 'Seen' },
  { value: 'eggs_present', label: 'Eggs' },
  { value: 'larvae_present', label: 'Larvae' },
  { value: 'capped_brood', label: 'Capped' },
  { value: 'virgin', label: 'Virgin' },
  { value: 'no_queen', label: 'NO QUEEN' },
  { value: 'queen_cells', label: 'Q. Cells' },
];

export const BROOD_PATTERN_OPTIONS = [
  { value: 'excellent', label: 'Solid' },
  { value: 'good', label: 'Good' },
  { value: 'spotty', label: 'Spotty' },
  { value: 'poor', label: 'Poor' },
];

export const TEMPERAMENT_OPTIONS = [
  { value: 'calm', label: 'Calm' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'defensive', label: 'Defensive' },
  { value: 'aggressive', label: 'Aggressive' },
];

export const STORES_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Some' },
  { value: 'adequate', label: 'Half' },
  { value: 'abundant', label: 'Full' },
];

/** Field defaults shared by new Standard inspections and new Plus drafts. */
export const INSPECTION_DEFAULTS = {
  queen_status: 'seen',
  brood_pattern: 'good',
  temperament: 'moderate',
  honey_stores: 'adequate',
  pollen_stores: 'adequate',
  observations: '',
};
