// No golden file exists for varroa; these pin the spec's own statements (FORMULAS §6).
import { describe, expect, it } from 'vitest';
import { miteLoad, periodsEndingWith, seasonalThreshold, varroaStatus } from '../shared/varroa';

describe('varroa maths', () => {
  it('seasonal thresholds: Jan–Mar 1, Apr–Aug 3, Sep–Oct 2, Nov–Dec 1', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(seasonalThreshold)).toEqual([1, 1, 1, 3, 3, 3, 3, 3, 2, 2, 1, 1]);
  });
  it('load and status', () => {
    expect(miteLoad(6, 300)).toBe(2);
    expect(miteLoad(5, 0)).toBe(0);
    expect(varroaStatus(3, 2)).toBe('Critical');
    expect(varroaStatus(2, 2)).toBe('Above Limit');
    expect(varroaStatus(1.99, 2)).toBe('OK');
  });
  it('six periods ending with the current one', () => {
    expect(periodsEndingWith(9).map(p => p.label)).toEqual(['Nov-Dec', 'Jan-Feb', 'Mar', 'Apr-May', 'Jun-Aug', 'Sep-Oct']);
    expect(periodsEndingWith(1).map(p => p.label).pop()).toBe('Jan-Feb');
  });
});
