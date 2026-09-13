import { normalise } from "./words.ts";

export type Round = { words: [string, number][]; truthP: number; rank: number | null; effective: number };
export type RaceSentence = { opening: string; truth: string[]; end: string; rounds: Round[] };
export type RaceData = { model: string; precision: string; generated: string; sentences: RaceSentence[] };

export type Grade = {
  guess: string;
  youRight: boolean;
  machineRight: boolean;
  machineWord: string;
  machineP: number;
  truthP: number;
  truthRank: number | null;
  listSize: number;
};

export function grade(guess: string, round: Round, truth: string): Grade {
  const t = normalise(truth);
  const [machineWord, machineP] = round.words[0] ?? ["", 0];
  return {
    guess: guess.trim(),
    youRight: normalise(guess) === t,
    machineRight: normalise(machineWord) === t,
    machineWord,
    machineP,
    truthP: round.truthP,
    truthRank: round.rank,
    listSize: round.words.length,
  };
}

/** A percentage the way a person would say it: 41%, 3.2%, 0.4%. */
export function pct(p: number): string {
  const x = p * 100;
  if (x >= 9.95) return `${Math.round(x)}%`;
  if (x >= 0.1) return `${x.toFixed(1)}%`;
  return "<0.1%";
}

export const square = (g: Grade) =>
  g.youRight && g.machineRight ? "🟨" : g.youRight ? "🟩" : g.machineRight ? "🟥" : "⬛";

export const tally = (grades: Grade[]) => ({
  you: grades.filter((g) => g.youRight).length,
  machine: grades.filter((g) => g.machineRight).length,
});

/** The one line on the share card, taken from what actually happened in this game. */
export function shareLine(grades: Grade[]): string {
  const { you, machine } = tally(grades);
  if (you > machine) return "I beat the AI.";
  const sure = grades.filter((g) => !g.machineRight).sort((a, b) => b.machineP - a.machineP)[0];
  if (sure && sure.machineP >= 0.25) return `It was ${pct(sure.machineP)} sure and wrong.`;
  if (you === machine) return "A draw. It does not get tired.";
  return `It beat me ${machine} to ${you}.`;
}

export function shareText(day: number, grades: Grade[], url: string, extra: string[] = []): string {
  const { you, machine } = tally(grades);
  return [`Just Guessing, day ${day}`, grades.map(square).join(""), `me ${you}, AI ${machine}`, shareLine(grades), ...extra.filter(Boolean), url].join("\n");
}

/** One plain sentence under each reveal, saying what the numbers just showed. */
export function insight(g: Grade, effective: number): string {
  if (g.machineRight) {
    return g.machineP < 0.2
      ? `The AI got it, but it was only ${pct(g.machineP)} sure. It was mostly guessing.`
      : `The AI got it, and it was ${pct(g.machineP)} sure.`;
  }
  const real = g.truthRank === null
    ? "The real word was not even on its list."
    : `It gave the real word only ${pct(g.truthP)}.`;
  if (g.machineP >= 0.25) return `The AI was ${pct(g.machineP)} sure it was “${g.machineWord}”, and it was wrong. ${real}`;
  if (g.youRight) return `You beat the AI on this one. ${real}`;
  return `The AI was choosing between about ${effective} words, so it guessed. ${real}`;
}

/** The chance of a whole sentence, said plainly: 1 in 48, 1 in 2.3 million. */
export function oneIn(p: number): string {
  if (p <= 0) return "never";
  const n = 1 / p;
  if (n < 1e6) return `1 in ${Math.round(n).toLocaleString("en-US")}`;
  const [v, name] = ([[1e15, "quadrillion"], [1e12, "trillion"], [1e9, "billion"], [1e6, "million"]] as const).find(([v]) => n >= v)!;
  return `1 in ${(n / v).toFixed(n / v < 10 ? 1 : 0)} ${name}`;
}
