// Titles are earned by how you play, and each one names something true about
// how the model works. Pure rules, so every one of them is tested.
import type { Grade } from "./scoring.ts";
import { tally } from "./scoring.ts";
import { normalise } from "./words.ts";
import type { Store } from "./store.ts";
import type { CrowdDay } from "./crowd.ts";

export type Rarity = "common" | "rare" | "legendary";
export type Mode = "race" | "steer" | "break" | "return";
export type TitleDef = { id: string; name: string; rarity: Rarity; mode: Mode; hint: string; lesson: string };

export const RARITY_LABEL: Record<Rarity, string> = { common: "Common", rare: "Rare", legendary: "Legendary" };

export const TITLES: TitleDef[] = [
  { id: "beat", mode: "race", rarity: "common", name: "Beat the Machine", hint: "Win a race.", lesson: "It predicts patterns. You understood the sentence." },
  { id: "draw", mode: "race", rarity: "common", name: "Dead Heat", hint: "Finish a race level with the machine.", lesson: "Different strengths, same score." },
  { id: "humbled", mode: "race", rarity: "common", name: "Humbled", hint: "Lose a race by two words or more.", lesson: "On everyday phrases it has read more sentences than you ever will." },
  { id: "called", mode: "race", rarity: "rare", name: "Called It", hint: "Get a word right that it was confidently wrong about.", lesson: "Sounding sure is not the same as being right." },
  { id: "mind", mode: "race", rarity: "rare", name: "Mind Reader", hint: "Make the exact mistake the machine made.", lesson: "You reached for the most common pattern, which is all it ever does." },
  { id: "twist", mode: "race", rarity: "rare", name: "Plot Twist", hint: "Get a word it gave less than 1 percent.", lesson: "Surprise is where people win." },
  { id: "oracle", mode: "race", rarity: "legendary", name: "Oracle", hint: "Get all five words in one race.", lesson: "Five for five. The machine never manages that on these sentences." },
  { id: "rarefind", mode: "race", rarity: "legendary", name: "Rare Find", hint: "Get a word that fewer than 1 in 10 players found that day.", lesson: "Almost nobody saw it coming. You did." },
  { id: "autopilot", mode: "steer", rarity: "common", name: "Autopilot", hint: "Steer a sentence using only its favourite words.", lesson: "Taking the favourite word every time is roughly how a chatbot writes." },
  { id: "chaos", mode: "steer", rarity: "rare", name: "Chaos Agent", hint: "Steer a sentence with odds of 1 in a million or worse.", lesson: "Every sentence has a probability. Yours was just tiny." },
  { id: "sure", mode: "break", rarity: "common", name: "Truth Serum", hint: "Find a sentence it could finish in its sleep.", lesson: "Sometimes the next word really is obvious, and it knows." },
  { id: "hunter", mode: "break", rarity: "common", name: "Hallucination Hunter", hint: "Ask it about a place that does not exist.", lesson: "It answered anyway, in exactly the same confident voice." },
  { id: "lost", mode: "break", rarity: "common", name: "Lost in Translation", hint: "Leave it lost in a language that is not English.", lesson: "It learned mostly from English. Your language is nearly invisible to it." },
  { id: "polyglot", mode: "break", rarity: "rare", name: "Polyglot", hint: "Try it in three languages that are not English.", lesson: "The gap is not one language. It is most of them." },
  { id: "tour", mode: "return", rarity: "common", name: "Full Tour", hint: "Race it, steer it and break it.", lesson: "Race, steer, break. That is the whole machine." },
  { id: "regular", mode: "return", rarity: "rare", name: "Regular", hint: "Play the daily race three days in a row.", lesson: "Same machine every day. You are the one getting better." },
  { id: "devoted", mode: "return", rarity: "legendary", name: "Devoted", hint: "Play the daily race seven days in a row.", lesson: "A week of racing a machine. It has not learned a thing. You have." },
];

export const LANGUAGE_PROBES = ["Suomi", "Eesti", "Latvija", "Lietuva", "Sverige"];

export type TitleEvent =
  | { kind: "race"; grades: Grade[]; daily: boolean; streak: number; crowd: CrowdDay | null }
  | { kind: "steer"; ranks: number[]; odds: number }
  | { kind: "break"; prompt: string; choices: number; probe: string | null };

/** A Break prompt's language when it is not English: a language starter, or any prompt with a non-ASCII letter. */
export function languageOf(prompt: string, probe: string | null): string | null {
  if (probe && LANGUAGE_PROBES.includes(probe)) return probe;
  return /(?![\x00-\x7F])\p{L}/u.test(prompt) ? "other" : null;
}

export function award(s: Store, ev: TitleEvent, now = Date.now()): { store: Store; unlocked: TitleDef[] } {
  const next: Store = { ...s, titles: { ...s.titles }, tour: [...s.tour], languages: [...s.languages] };
  const got = new Set<string>();
  const give = (id: string, ok: boolean) => {
    if (ok && !next.titles[id]) { next.titles[id] = now; got.add(id); }
  };
  const visit = (mode: string) => { if (!next.tour.includes(mode)) next.tour.push(mode); };

  if (ev.kind === "race") {
    const g = ev.grades, { you, machine } = tally(g), c = ev.crowd;
    give("beat", you > machine);
    give("draw", you === machine);
    give("humbled", machine - you >= 2);
    give("called", g.some((x) => x.youRight && !x.machineRight && x.machineP >= 0.25));
    give("mind", g.some((x) => !x.machineRight && normalise(x.guess) === normalise(x.machineWord)));
    give("twist", g.some((x) => x.youRight && x.truthP < 0.01));
    give("oracle", you === 5);
    give("rarefind", ev.daily && !!c && c.plays >= 20 && g.some((x, i) => x.youRight && c.words[i] / c.plays < 0.1));
    give("regular", ev.daily && ev.streak >= 3);
    give("devoted", ev.daily && ev.streak >= 7);
    visit("race");
  } else if (ev.kind === "steer") {
    give("autopilot", ev.ranks.length >= 5 && ev.ranks.every((r) => r === 1));
    give("chaos", ev.odds <= 1e-6);
    visit("steer");
  } else {
    const lang = languageOf(ev.prompt, ev.probe);
    if (lang && !next.languages.includes(lang)) next.languages.push(lang);
    give("sure", ev.choices <= 5);
    give("hunter", /wakanda/i.test(ev.prompt));
    give("lost", !!lang && ev.choices >= 300);
    give("polyglot", next.languages.length >= 3);
    visit("break");
  }
  give("tour", ["race", "steer", "break"].every((m) => next.tour.includes(m)));
  return { store: next, unlocked: TITLES.filter((t) => got.has(t.id)) };
}

/** The title on the share card: the one chosen, or else the most recently earned. */
export function shownTitle(s: Store): TitleDef | null {
  if (s.wearing && s.titles[s.wearing]) return TITLES.find((t) => t.id === s.wearing) ?? null;
  let best: TitleDef | null = null;
  for (const t of TITLES) if (s.titles[t.id] && (!best || s.titles[t.id] >= s.titles[best.id])) best = t;
  return best;
}
