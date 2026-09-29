// Record dates — SPEC B §14 "Date defaults and display" (inspections, interventions, varroa tests).
// Saving stores the chosen day at 12:00 device-local time.
//
// Deliberate change #13 (Ron, 2026-09-29): the field shows the stored timestamp's LOCAL calendar
// day (or today's, for a new record). The live app showed the UTC day, so in the US evening a
// new record defaulted to tomorrow. Stored noon-local timestamps read back as the day picked.

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" of a timestamp's local calendar day (today if absent). */
export function recordDay(timestamp?: string | null): string {
  const d = new Date(timestamp ?? Date.now());
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The chosen day at 12:00 local time, as ISO. */
export const noonLocalIso = (day: string) => new Date(`${day}T12:00:00`).toISOString();
