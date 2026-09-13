// The live count of humans against the machine. Only right or wrong results
// for the daily race are counted, never the words anyone typed.
import { tally, type Grade } from "./scoring.ts";

export type CrowdDay = { plays: number; words: number[]; scores: number[] };
export type CrowdAll = { humans: number; machine: number; draws: number };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Share of today's words won by people rather than the machine, or null before anyone has played. */
export function humanShare(c: CrowdDay, machineScore: number): number | null {
  const people = sum(c.words), machine = c.plays * machineScore;
  return people + machine ? people / (people + machine) : null;
}

/** Where a score sits among everyone else who played today. The counts already include this player. */
export function standing(c: CrowdDay, you: number): { others: number; below: number } {
  const others = Math.max(0, c.plays - 1);
  return { others, below: Math.min(sum(c.scores.slice(0, you)), others) };
}

export function standingLine(c: CrowdDay, you: number): string {
  const { others, below } = standing(c, you);
  if (!others) return "You are the first person to finish today.";
  if (below === others) return "You beat everyone else who played today.";
  if (below === 0) return "Nobody scored lower today. There is always tomorrow.";
  return `You beat ${Math.round((100 * below) / others)}% of people today.`;
}

/** The word you got right that the fewest people found, if fewer than half did. */
export function rarestRight(c: CrowdDay, grades: Grade[]): number {
  let best = -1;
  grades.forEach((g, i) => {
    if (!g.youRight || !c.plays || c.words[i] / c.plays >= 0.5) return;
    if (best < 0 || c.words[i] < c.words[best]) best = i;
  });
  return best;
}

/** The line above the first blank, so you know which team you are playing for. */
export function teamLine(c: CrowdDay, machineScore: number): string {
  if (!c.plays) return "Nobody has finished today's race yet. Go first.";
  const played = `${c.plays.toLocaleString("en-US")} ${c.plays === 1 ? "person has" : "people have"} played today.`;
  const s = humanShare(c, machineScore);
  if (s === null) return played;
  const h = Math.round(s * 100);
  if (h === 50) return `${played} Humans and the machine are dead level.`;
  return h > 50 ? `${played} Humans are winning ${h}% of the words.` : `${played} The machine is winning ${100 - h}% of the words.`;
}

// The counts live on Abacus, a free counting service that needs no account.
// ponytail: anyone can add to a public counter, and it allows 30 requests every
// 10 seconds per visitor. Move to a small worker of our own if either starts to bite.
const API = "https://abacus.jasoncameron.dev";
// local development counts under another name, so testing never touches the real tally
const NS = import.meta.env?.DEV ? "mangluu-just-guessing-dev" : "mangluu-just-guessing";

// Reads go through info rather than get: get answers 404 for a counter nobody
// has touched yet, and the browser logs every one of those as an error.
async function call(action: "info" | "hit", key: string, retry = true): Promise<number | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(`${API}/${action}/${NS}/${key}`, { signal: ctl.signal });
    if (res.status === 429 && retry) {
      await new Promise((r) => setTimeout(r, 1500)); // over the limit: let the window move on, then try once more
      return call(action, key, false);
    }
    if (!res.ok) return null;
    const body = await res.json();
    if (body.exists === false) return 0;
    return typeof body.value === "number" && body.value >= 0 ? body.value : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The counters one finished daily race adds to: right or wrong per word, never the words. */
export function countKeys(day: number, grades: Grade[]): string[] {
  const { you, machine } = tally(grades);
  return [
    `d${day}-plays`,
    `d${day}-s${you}`,
    ...grades.flatMap((g, i) => (g.youRight ? [`d${day}-w${i}`] : [])),
    `all-${you > machine ? "humans" : you < machine ? "machine" : "draws"}`,
  ];
}

const sent = new Set<number>();
/**
 * Adds a finished daily race to the count, once per day per page load. Every
 * increment answers with its counter's new value, so those values come back
 * and nobody spends another dozen requests reading them.
 */
export async function submit(day: number, grades: Grade[]): Promise<Record<string, number>> {
  if (sent.has(day)) return {};
  sent.add(day);
  const keys = countKeys(day, grades);
  const values = await Promise.all(keys.map((k) => call("hit", k)));
  return Object.fromEntries(keys.flatMap((k, i) => (values[i] === null ? [] : [[k, values[i] as number]])));
}

/** Today's picture after a race: the read from before it, with the counters the race just moved put in. */
export function patchDay(day: number, before: CrowdDay, moved: Record<string, number>): CrowdDay {
  const c: CrowdDay = { plays: before.plays, words: [...before.words], scores: [...before.scores] };
  for (const [key, value] of Object.entries(moved)) {
    const m = key.match(/^d(\d+)-(?:(plays)|w(\d)|s(\d))$/);
    if (!m || Number(m[1]) !== day) continue;
    if (m[2]) c.plays = value;
    else if (m[3] !== undefined) c.words[Number(m[3])] = value;
    else c.scores[Number(m[4])] = value;
  }
  return c;
}

const days = new Map<number, Promise<CrowdDay | null>>();
export function readDay(day: number, fresh = false): Promise<CrowdDay | null> {
  if (!fresh && days.has(day)) return days.get(day)!;
  const keys = ["plays", "w0", "w1", "w2", "w3", "w4", "s0", "s1", "s2", "s3", "s4", "s5"];
  const load = Promise.all(keys.map((k) => call("info", `d${day}-${k}`))).then((v) => {
    if (v.some((x) => x === null)) {
      days.delete(day); // a failed read should not stick for the rest of the visit
      return null;
    }
    return { plays: v[0]!, words: v.slice(1, 6) as number[], scores: v.slice(6) as number[] };
  });
  days.set(day, load);
  return load;
}

export async function readAll(): Promise<CrowdAll | null> {
  const [humans, machine, draws] = await Promise.all(["humans", "machine", "draws"].map((k) => call("info", `all-${k}`)));
  return humans === null || machine === null || draws === null ? null : { humans, machine, draws };
}
