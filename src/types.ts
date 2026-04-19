export type HiveCategory = 'Vertical' | 'Horizontal';
export type CombSupportType = '4-Sided Frames' | 'Top Bars Only' | 'Extra-Deep Frames';

export interface HiveTypeId {
    id: string; // Internal ID for database storage e.g. 'langstroth_10'
    model: string; // Display name
    category: HiveCategory;
    dimensions: string;
    combSupport: CombSupportType;
    capacity: string;
    defaultBarCount?: number; // For initializing forms
}

export const HIVE_TYPES: HiveTypeId[] = [
    // Vertical
    {
        id: 'langstroth_10',
        model: 'Langstroth (10-Frame)',
        category: 'Vertical',
        dimensions: '19 7/8" x 16 1/4" x 9 5/8"',
        combSupport: '4-Sided Frames',
        capacity: '10 Frames'
    },
    {
        id: 'langstroth_8',
        model: 'Langstroth (8-Frame)',
        category: 'Vertical',
        dimensions: '19 7/8" x 13 3/4" x 9 5/8"',
        combSupport: '4-Sided Frames',
        capacity: '8 Frames'
    },
    {
        id: 'uk_national',
        model: 'UK National',
        category: 'Vertical',
        dimensions: '18 1/8" x 18 1/8" x 8 7/8"',
        combSupport: '4-Sided Frames',
        capacity: '11 Frames'
    },
    {
        id: 'dadant',
        model: 'Dadant (Blatt)',
        category: 'Vertical',
        dimensions: '19 7/8" x 18 1/4" x 11 5/8"',
        combSupport: '4-Sided Frames',
        capacity: '10-12 Frames'
    },
    {
        id: 'warre',
        model: 'Warre',
        category: 'Vertical',
        dimensions: '13 3/8" x 13 3/8" x 8 1/4" (Internal)',
        combSupport: 'Top Bars Only',
        capacity: '8 Bars per box'
    },
    // Horizontal
    {
        id: 'top_bar',
        model: 'Top Bar (Kenyan)',
        category: 'Horizontal',
        dimensions: '~36" to 48" Long (V-shaped)',
        combSupport: 'Top Bars Only',
        capacity: '28-35 Bars',
        defaultBarCount: 30
    },
    {
        id: 'layens',
        model: 'Layens',
        category: 'Horizontal',
        dimensions: '~36" L x 15" W x 16" H',
        combSupport: 'Extra-Deep Frames',
        capacity: '14-20 Frames'
    },
    {
        id: 'long_langstroth',
        model: 'Long Langstroth',
        category: 'Horizontal',
        dimensions: '~48" L x 19 7/8" W x 9 5/8" H',
        combSupport: '4-Sided Frames',
        capacity: '30-32 Frames'
    },
    {
        id: 'dartington',
        model: 'Dartington',
        category: 'Horizontal',
        dimensions: '~40" Long',
        combSupport: '4-Sided Frames',
        capacity: '14-21 Frames'
    }
];

// Langstroth Box Types
export type BoxType = 'deep' | 'medium' | 'shallow' | 'excluder' | 'inner_cover' | 'feeder' | 'slatted_rack';

export interface HiveBox {
    id: string;
    type: BoxType;
    frames?: number; // 8 or 10
}

export type HiveType = typeof HIVE_TYPES[number]['id'];
