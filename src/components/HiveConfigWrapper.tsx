import React, { useMemo } from 'react';
import { TopBarVisualizer } from './TopBarVisualizer';
import { LangstrothVisualizer } from './LangstrothVisualizer';
import type { HiveBox } from '../types';

interface HiveConfigWrapperProps {
  hive: any;
  onSnapshotSaved?: () => void;
}

export const HiveConfigWrapper: React.FC<HiveConfigWrapperProps> = ({ hive, onSnapshotSaved }) => {
  
  // Determine if it's Langstroth or TBH based on the 'type' string
  const isLangstroth = useMemo(() => {
    if (!hive?.type) return false; // Default to TBH if no type
    const lowerType = hive.type.toLowerCase();
    return lowerType.includes('langstroth') && !lowerType.includes('long');
  }, [hive?.type]);

  // Parse JSON data robustly
  const parsedBars = useMemo(() => {
    if (isLangstroth) return null;
    if (!hive?.bars) return null;
    try {
      if (typeof hive.bars === 'string') return JSON.parse(hive.bars);
      if (Array.isArray(hive.bars)) return hive.bars;
      return null;
    } catch (e) {
      console.error('Failed to parse TBH bars:', e);
      return null;
    }
  }, [hive?.bars, isLangstroth]);

  const parsedBoxes = useMemo(() => {
    if (!isLangstroth) return null;
    if (!hive?.bars) return null;
    try {
      if (typeof hive.bars === 'string') return JSON.parse(hive.bars);
      if (Array.isArray(hive.bars)) return hive.bars as HiveBox[];
      return null;
    } catch (e) {
      console.error('Failed to parse Langstroth boxes:', e);
      return null;
    }
  }, [hive?.bars, isLangstroth]);

  if (!hive || !hive.id) return null;

  return (
    <div className="w-full max-w-2xl mb-2">
      {isLangstroth ? (
        <LangstrothVisualizer 
          hiveId={hive.id} 
          initialBoxes={parsedBoxes} 
          onSnapshotSaved={onSnapshotSaved}
        />
      ) : (
        <TopBarVisualizer 
          hiveId={hive.id} 
          initialBars={parsedBars} 
          onSnapshotSaved={onSnapshotSaved}
        />
      )}
    </div>
  );
};
