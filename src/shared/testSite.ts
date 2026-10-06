// The production database's project ref. Anything else (Beekeeper Dev v2 on
// Preview, test.beektools.com, localhost) is a test site. Deciding by database
// rather than web address means the reminder strip can never be missing on a
// test copy under a new name, and never shows on the real site or the Android
// app, which are both built from `main` against production.
const PRODUCTION_REF = 'ayeqrbcvihztxbrxmrth';

export const IS_TEST_SITE = !String(import.meta.env.VITE_SUPABASE_URL ?? '').includes(PRODUCTION_REF);

/** Height of the test-site strip below the phone's status area. Screens that pin
 *  content to the top add `var(--test-strip-h, 0px)` to the top safe-area inset. */
export const TEST_STRIP_HEIGHT = '22px';

/** Call once before the first render: reserves room for the strip at the top. */
export function reserveTestSiteStrip() {
  if (IS_TEST_SITE) {
    document.documentElement.style.setProperty('--test-strip-h', TEST_STRIP_HEIGHT);
  }
}
