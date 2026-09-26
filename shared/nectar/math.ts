// Numeric helpers for the nectar engine — FORMULAS §0. Every one of these changes results if
// altered (rounding direction, window handling, what counts as "missing").

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** JavaScript Math.round to 3 decimal places (halves toward +infinity). */
export const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Percentile: sort ascending, k = p·(n−1), linear interpolation between floor(k) and ceil(k). */
export function percentile(values: readonly number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  const k = p * (s.length - 1);
  const f = Math.floor(k);
  const c = Math.ceil(k);
  return s[f] + (s[c] - s[f]) * (k - f);
}

/** EWMA: a non-finite input repeats the previous output (0 if none) without updating. */
export function ewma(x: readonly number[], alpha: number): number[] {
  const out: number[] = [];
  let s: number | undefined;
  for (const v of x) {
    if (!Number.isFinite(v)) {
      out.push(s ?? 0);
      continue;
    }
    s = s === undefined ? v : alpha * v + (1 - alpha) * s;
    out.push(s);
  }
  return out;
}

/** Trailing mean over the non-missing values of x[i−w+1 … i]; NaN if none. */
export function trailingMean(x: readonly number[], w: number): number[] {
  return x.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - w + 1); j <= i; j++) {
      if (Number.isFinite(x[j])) {
        sum += x[j];
        n++;
      }
    }
    return n ? sum / n : NaN;
  });
}

/** Least-squares slope of y[j] against x = j − i over the trailing window ending at i. */
export function trailingSlope(y: readonly number[], i: number, w: number): number {
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let j = Math.max(0, i - w + 1); j <= i; j++) {
    const v = y[j];
    if (!Number.isFinite(v)) continue;
    const x = j - i;
    n++;
    sx += x;
    sy += v;
    sxx += x * x;
    sxy += x * v;
  }
  if (n < 3) return 0;
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-12) return 0;
  return (n * sxy - sx * sy) / den;
}

/** Centred quadratic fit y = b0 + b1·x + b2·x² over i±h; returns b1 (Gauss–Jordan, partial pivoting). */
export function centredQuadraticSlope(y: readonly number[], i: number, h: number): number {
  const s = [0, 0, 0, 0, 0]; // Σx^0 … Σx^4
  const t = [0, 0, 0]; // Σy, Σxy, Σx²y
  let n = 0;
  for (let j = Math.max(0, i - h); j <= Math.min(y.length - 1, i + h); j++) {
    const v = y[j];
    if (!Number.isFinite(v)) continue;
    const x = j - i;
    n++;
    let p = 1;
    for (let k = 0; k <= 4; k++) {
      s[k] += p;
      if (k <= 2) t[k] += p * v;
      p *= x;
    }
  }
  if (n < 3) return 0;
  const m = [
    [s[0], s[1], s[2], t[0]],
    [s[1], s[2], s[3], t[1]],
    [s[2], s[3], s[4], t[2]],
  ];
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    if (Math.abs(m[piv][col]) < 1e-12) return 0;
    [m[col], m[piv]] = [m[piv], m[col]];
    const d = m[col][col];
    for (let k = col; k < 4; k++) m[col][k] /= d;
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = m[r][col];
      for (let k = col; k < 4; k++) m[r][k] -= f * m[col][k];
    }
  }
  return m[1][3];
}
