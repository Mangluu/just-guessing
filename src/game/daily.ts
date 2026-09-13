// Day 1 is launch day, 13 September 2026. Days turn over at local midnight,
// so everyone in a time zone plays the same sentence.
const LAUNCH = new Date(2026, 8, 13);

export function dayNumber(now = new Date()): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // round, not floor: a daylight saving change makes some days 23 or 25 hours long
  return Math.round((midnight.getTime() - LAUNCH.getTime()) / 86_400_000) + 1;
}

export function untilTomorrow(now = new Date()): string {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 60_000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

export const sentenceIndex = (day: number, count: number) => (((day - 1) % count) + count) % count;
