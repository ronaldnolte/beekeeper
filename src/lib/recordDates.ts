// Record dates — SPEC B §14 "Date defaults and display" (inspections, interventions, varroa tests).
// The field shows the UTC calendar day of the stored timestamp (or of now), and saving stores
// that day at 12:00 device-local time. So in the US evening a new record defaults to tomorrow —
// existing behaviour, kept on purpose (FIX-LATER.md).

/** "YYYY-MM-DD" of a timestamp's UTC calendar day (now if absent). */
export const utcDay = (timestamp?: string | null) => new Date(timestamp ?? Date.now()).toISOString().slice(0, 10);

/** The chosen day at 12:00 local time, as ISO. */
export const noonLocalIso = (day: string) => new Date(`${day}T12:00:00`).toISOString();
