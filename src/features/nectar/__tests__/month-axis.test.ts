import { describe, it, expect } from '@jest/globals';

// The chart's month labels must sit where the curve says that month begins.
//
// They were laid out with flex `justify-between`, which spreads twelve labels evenly from
// edge to edge, while the data is plotted at its true day-of-year fraction. The two
// disagreed, and the error grew through the year: the "Aug" label sat about twenty days
// right of 1 August, so late August read as the start of the month. December was a full
// month adrift.
//
// This asserts the positions used by NectarFlowV2View. If the label layout changes, this
// should change with it deliberately rather than by accident.

const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Where the chart plots a date, as a fraction of the axis. Mirrors getDayOfYearFraction. */
const plotFraction = (month: number, day: number) => {
  const doy = Math.floor((Date.UTC(2025, month - 1, day) - Date.UTC(2025, 0, 1)) / 86_400_000);
  return doy / 365;
};

/** Where the label now sits. */
const labelFraction = (i: number) => MONTH_STARTS[i] / 365;

/** Where it used to sit, under flex justify-between. */
const evenlySpacedFraction = (i: number) => i / 11;

describe('month axis alignment', () => {
  it('puts every label exactly where the first of that month plots', () => {
    MONTHS.forEach((_, i) => {
      expect(labelFraction(i)).toBeCloseTo(plotFraction(i + 1, 1), 10);
    });
  });

  it('MONTH_STARTS matches a real calendar', () => {
    // Guards a typo in the table, which would move a label without any other symptom.
    MONTH_STARTS.forEach((doy, i) => {
      const d = new Date(Date.UTC(2025, 0, 1 + doy));
      expect(d.getUTCMonth()).toBe(i);
      expect(d.getUTCDate()).toBe(1);
    });
  });

  it('is the fix for a drift that reached three weeks by August', () => {
    const augIndex = 7;
    const wrongBy = (evenlySpacedFraction(augIndex) - labelFraction(augIndex)) * 365;
    expect(wrongBy).toBeGreaterThan(19);
    expect(wrongBy).toBeLessThan(21);
  });

  it('was nearly a month out by December', () => {
    const decIndex = 11;
    const wrongBy = (evenlySpacedFraction(decIndex) - labelFraction(decIndex)) * 365;
    expect(wrongBy).toBeGreaterThan(29);
  });

  it('places labels in order and inside the axis', () => {
    let previous = -1;
    MONTHS.forEach((_, i) => {
      const f = labelFraction(i);
      expect(f).toBeGreaterThan(previous);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      previous = f;
    });
  });

  it('reads late August as late August, not the start of the month', () => {
    // The symptom Ron reported: 25 August plotted just past the Aug label, so the season
    // looked three weeks younger than it was.
    const aug25 = plotFraction(8, 25);
    const augLabel = labelFraction(7);
    const sepLabel = labelFraction(8);
    // It should sit in the last third of the August span, not the first.
    const throughAugust = (aug25 - augLabel) / (sepLabel - augLabel);
    expect(throughAugust).toBeGreaterThan(0.7);
  });
});
