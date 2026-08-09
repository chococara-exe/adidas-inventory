// Date helpers for filters and reports. Everything here works in LOCAL time:
// the app runs at UTC+8, where toISOString() reports the previous day for
// anything before 08:00 — enough to file a receipt under the wrong day, or
// the wrong month at a boundary.

/** yyyy-mm-dd for a date input, in local time. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Parse a yyyy-mm-dd form value to local midnight. Null if absent or invalid. */
export function parseDay(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d
    ? parsed
    : null;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Whole days between two local midnights, unaffected by DST shifts. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
