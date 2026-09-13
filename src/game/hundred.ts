import { normalise } from "./words.ts";

export type Kind = "ai" | "real" | "you" | "alt" | "rest";
export type Slice = { word: string; p: number | null; count: number; kind: Kind; ai: boolean; real: boolean; you: boolean };
type Opts = { real?: string; realP?: number; you?: string; keep?: number };

/**
 * The AI's odds as 100 guesses: how many times it would say each word if it guessed
 * 100 times. Its top few words, the real word and your pick each get a row, and
 * everything else it might say is one last row. The counts always add up to 100.
 */
export function hundred(words: [string, number][], { real, realP, you, keep = 3 }: Opts = {}): Slice[] {
  const r = real ? normalise(real) : "", y = you ? normalise(you) : "";
  const top = words[0] ? normalise(words[0][0]) : "";
  const listed: { word: string; p: number | null }[] = [];
  const take = (word: string, p: number | null) => {
    const n = normalise(word);
    if (n && !listed.some((s) => normalise(s.word) === n)) listed.push({ word, p });
  };
  const oddsOf = (n: string) => words.find(([w]) => normalise(w) === n)?.[1];

  for (const [w, p] of words.slice(0, keep)) take(w, p);
  if (real) take(real, oddsOf(r) ?? realP ?? null);
  if (you) take(you, oddsOf(y) ?? null);

  const shown = listed.reduce((a, s) => a + (s.p ?? 0), 0);
  const restP = Math.max(0, 1 - shown);
  const all = [...listed.map((s) => s.p ?? 0), restP];
  const total = shown + restP;
  // largest remainder, so rounding never loses or invents a guess
  const exact = all.map((p) => (100 * p) / total);
  const counts = exact.map(Math.floor);
  let left = 100 - counts.reduce((a, b) => a + b, 0);
  for (const [, i] of exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0])) {
    if (left-- <= 0) break;
    counts[i]++;
  }

  const slices: Slice[] = listed.map((s, i) => {
    const n = normalise(s.word);
    const flags = { ai: n === top, real: !!r && n === r, you: !!y && n === y };
    const kind: Kind = flags.real ? "real" : flags.ai ? "ai" : flags.you ? "you" : "alt";
    return { word: s.word, p: s.p, count: counts[i], kind, ...flags };
  });
  const order = (s: Slice) => (s.ai ? 0 : s.real ? 1 : s.you ? 2 : 3);
  slices.sort((a, b) => order(a) - order(b) || (b.p ?? 0) - (a.p ?? 0));
  const rest = counts[counts.length - 1];
  return rest > 0 ? [...slices, { word: "any other word", p: restP, count: rest, kind: "rest", ai: false, real: false, you: false }] : slices;
}
