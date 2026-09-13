// Everything here persists in this browser only. The live count in crowd.ts
// sends right or wrong results for the daily race, never the words typed.
export type Store = {
  days: Record<string, { opening: string; guesses: string[] }>;
  lastDay: number;
  streak: number;
  titles: Record<string, number>; // title id to when it was earned
  wearing: string | null; // the title chosen for the share card
  seenTitles: number; // how many titles the player has already looked at
  tour: string[]; // modes finished at least once
  languages: string[]; // languages tried in Break it
  counted: number[]; // days already added to the live count
  introDone: boolean; // has seen, or skipped, the how-to-play tutorial
};

const KEY = "just-guessing.v1";
export const fresh = (): Store => ({
  days: {}, lastDay: 0, streak: 0, titles: {}, wearing: null, seenTitles: 0, tour: [], languages: [], counted: [], introDone: false,
});

export function load(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (Array.isArray(raw.titles)) raw.titles = {}; // the first version kept an unused list here
    return { ...fresh(), ...raw };
  } catch {
    return fresh();
  }
}

export function save(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // private browsing or storage blocked: the game still plays, it just forgets
  }
}

export function finishDay(s: Store, day: number): Store {
  if (s.lastDay >= day) return s;
  return { ...s, lastDay: day, streak: s.lastDay === day - 1 ? s.streak + 1 : 1 };
}

export const currentStreak = (s: Store, day: number) => (s.lastDay >= day - 1 ? s.streak : 0);
