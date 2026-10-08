// Shapes of Ron's bloom master list (E:\Bloom\forage_national.json) and of the results built from it.
// Field names are kept exactly as in the Bloom workshop scripts so the two stay comparable.

export type Triple = number[]; // [10th percentile, median, 90th percentile]

export interface BloomData {
  source: string; // 'USA-NPN' or a GBIF source
  trigger: string; // 'GDD' (heat) or 'LOD' (day length)
  confidence: string;
  onsetGdd?: Triple | null;
  onsetDoy?: Triple | null;
  floweringDoy?: Triple | null;
  durationDays?: Triple | null;
  seasonLengthDays?: Triple | null;
  seasonStartGdd?: Triple | null;
  seasonStartDoy?: Triple | null;
  seasonStartDaylengthHrs?: Triple | null;
  seasonStartDirection?: string;
  onsetDaylengthThresholdHrs?: number;
  daylengthDirection?: string;
  [other: string]: unknown;
}

export interface ForagePlant {
  common: string;
  names: string[];
  gbif?: Record<string, number>;
  nectar: number;
  pollen: number;
  bloom?: string;
  notes?: string;
  crop?: boolean;
  bloomData: BloomData;
  [other: string]: unknown;
}

export interface ForageMaster {
  note?: string;
  gddBaseF: number;
  plants: ForagePlant[];
}

/** One plant's presence near an apiary (apiaryForage.mjs output row). */
export interface PresenceRow {
  plant: string;
  scientific: string;
  nectar: number;
  pollen: number;
  bloomNational: string | undefined;
  recordsMain: number;
  recordsWide: number;
  speciesFound: { name: string; count: number }[];
  presence: string;
  cropCheck: boolean;
}

export interface PresenceResult {
  lat: number;
  lon: number;
  radiusMi: number;
  fallbackRadiusMi: number;
  targetLikely: number;
  limited: boolean;
  warning: string | null;
  plants: PresenceRow[];
}

/** One plant's row in an apiary's bloom table (apiaryTable.mjs output row). */
export interface BloomRow {
  plant: string;
  scientific: string;
  presence: string;
  trigger: string;
  start: string;
  end: string;
  peak: string;
  dateAdjustment: number;
  bloomRate: number;
  status: string;
  yield: string;
  nectar: number;
  pollen: number;
  confidence: string;
  source: string;
  note: string;
}

export interface BloomTable {
  lat: number;
  lon: number;
  asOf: string;
  normalYears: string;
  normalHeatYearEnd: number;
  gddBaseF: number;
  radiusMi: number;
  limited: boolean;
  warning: string | null;
  plants: BloomRow[];
}

/** Fetches a URL and returns parsed JSON (retries are the caller's concern). */
export type GetJson = (url: string) => Promise<any>;
