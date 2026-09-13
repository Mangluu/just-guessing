import type { Round } from "./scoring.ts";
import { normalise } from "./words.ts";

const isWord = (w: string) => /^\p{L}[\p{L}'’-]*$/u.test(w);

export function seedOf(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function shuffle<T>(xs: T[], seed: number): T[] {
  const a = [...xs];
  let s = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The words to pick from: the real word plus the AI's favourite other words,
 * shuffled the same way for everyone so the daily results stay comparable.
 * The AI's own pick is always among them, which is what makes it a race.
 */
export function optionsFor(round: Round, truth: string, seed: number, count = 4): string[] {
  const picks = [truth];
  for (const [w] of round.words) {
    if (picks.length >= count) break;
    if (isWord(w) && !picks.some((p) => normalise(p) === normalise(w))) picks.push(w);
  }
  return shuffle(picks, seed);
}
