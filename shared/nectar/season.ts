// Season helpers — FORMULAS §8. Not shown on screen yet; kept for the fall-bloom-window
// requirement (DESIGN-REQUIREMENTS §5).

import { clamp } from './math.js';
import { dayOfYear } from './dates.js';

/** Day length in hours at latitude φ (degrees) on day of year n. */
export function dayLengthHours(lat: number, n: number): number {
  const rad = Math.PI / 180;
  const decl = 23.45 * rad * Math.sin((2 * Math.PI * (284 + n)) / 365);
  const cosH = clamp(-Math.tan(lat * rad) * Math.tan(decl), -1, 1);
  return (2 * Math.acos(cosH) * (180 / Math.PI)) / 15;
}

/** Day length three days later is longer than three days earlier. */
export function daysLengthening(date: string, lat: number): boolean {
  const n = dayOfYear(date);
  return dayLengthHours(lat, n + 3) > dayLengthHours(lat, n - 3);
}

export { fallCentre } from './engine.js';
