// Everything persists in this browser only. No account, nothing sent anywhere.
export type Store = {
  days: Record<string, { opening: string; guesses: string[] }>;
  lastDay: number;
  streak: number;
  titles: string[];
};

const KEY = "just-guessing.v1";
const fresh = (): Store => ({ days: {}, lastDay: 0, streak: 0, titles: [] });

export function load(): Store {
  try {
    return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
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
