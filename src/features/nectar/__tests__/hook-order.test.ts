import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Guards against the crash that blanked the Nectar screen twice in one session.
//
// React requires every hook to run on every render, in the same order. A hook placed after
// an early return does not run while that guard is active, and does start running once it
// clears -- the hook count changes between renders and React throws, which the user sees as
// a blank screen with no error on it. It shipped twice because the first fix moved the
// hooks above ONE early return while another, `if (!selectedApiaryId)`, sat higher up.
//
// eslint's rules-of-hooks finds this, but only reports a file's current state, so it cannot
// stop a regression from being written and shipped between lint runs.

const FILE = join(__dirname, '..', 'NectarFlowV2View.tsx');
const HOOK = /\b(useEffect|useState|useRef|useCallback|useMemo|useLayoutEffect)\(/;

/** Statements directly in the component body are indented exactly two spaces. */
const atBodyLevel = (l: string) => /^ {2}\S/.test(l);

/**
 * Line of the first early return: a two-space `if (` whose block contains a `return`
 * before it closes. Returns inside that block are indented four spaces, which is what the
 * first version of this test missed -- it looked for two-space returns only, found none,
 * and passed happily while the bug was present.
 */
function firstEarlyReturnLine(lines: string[], from: number): number {
  for (let i = from; i < lines.length; i++) {
    if (!/^ {2}if \(/.test(lines[i])) continue;
    // Single-line guard: `if (!data) return null;`
    if (/\breturn\b/.test(lines[i])) return i;
    if (!lines[i].includes('{')) continue;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^ {2}\}/.test(lines[j])) break;      // block closed, no return in it
      if (/^ {4}return\b/.test(lines[j])) return j;
    }
  }
  return -1;
}

describe('NectarFlowV2View hook order', () => {
  it('calls no hook after an early return', () => {
    const lines = readFileSync(FILE, 'utf8').split(/\r?\n/);

    const bodyStart = lines.findIndex(l => l.includes('export const NectarFlowV2View'));
    expect(bodyStart).toBeGreaterThan(-1);

    const boundary = firstEarlyReturnLine(lines, bodyStart);
    // If this ever fails, the component stopped having guards and the test needs revisiting
    // rather than deleting -- a component with no early return cannot have this bug.
    expect(boundary).toBeGreaterThan(bodyStart);

    const offenders: string[] = [];
    for (let i = boundary + 1; i < lines.length; i++) {
      if (!atBodyLevel(lines[i])) continue;
      if (!HOOK.test(lines[i])) continue;
      offenders.push(`line ${i + 1}: ${lines[i].trim().slice(0, 90)}`);
    }

    expect(offenders).toEqual([]);
  });
});
