import { test } from "node:test";
import assert from "node:assert/strict";
import { award, shownTitle, languageOf, TITLES, type TitleEvent } from "../src/game/titles.ts";
import { grade, type Round } from "../src/game/scoring.ts";
import { fresh } from "../src/game/store.ts";
import type { CrowdDay } from "../src/game/crowd.ts";

// one blank: what you guessed, the machine's pick and its odds, the real word, and the odds it gave the real word
type Row = [guess: string, pick: string, pickP: number, truth: string, truthP?: number];
const round = (pick: string, pickP: number, truthP: number): Round => ({ words: [[pick, pickP]], truthP, rank: 2, effective: 50 });
const race = (rows: Row[], extra: Partial<Extract<TitleEvent, { kind: "race" }>> = {}): TitleEvent =>
  ({ kind: "race", grades: rows.map(([g, pick, pickP, truth, truthP = 0.05]) => grade(g, round(pick, pickP, truthP), truth)), daily: false, streak: 0, crowd: null, ...extra });
const ids = (r: { unlocked: { id: string }[] }) => r.unlocked.map((t) => t.id).sort();
const miss: Row = ["x", "y", 0.1, "z"];

test("every title is defined once, with a hint and a lesson", () => {
  assert.equal(new Set(TITLES.map((t) => t.id)).size, TITLES.length);
  for (const t of TITLES) assert.ok(t.name && t.hint && t.lesson, t.id);
});

test("race titles come from what actually happened", () => {
  const r = award(fresh(), race([["single", "day", 0.4, "single", 0.005], ["it", "it", 0.8, "it"], miss, miss, miss]));
  assert.deepEqual(ids(r), ["beat", "called", "twist"]);
  assert.deepEqual(r.store.tour, ["race"]);
});

test("making the machine's exact mistake is Mind Reader", () => {
  const r = award(fresh(), race([["day", "day", 0.97, "single"], miss, miss, miss, miss]));
  assert.ok(ids(r).includes("mind"));
  assert.ok(!ids(r).includes("called"));
});

test("five for five is Oracle, a heavy loss is Humbled, level is Dead Heat", () => {
  const all: Row[] = Array.from({ length: 5 }, () => ["a", "b", 0.3, "a"] as Row);
  assert.ok(ids(award(fresh(), race(all))).includes("oracle"));
  const lost: Row[] = [["x", "a", 0.3, "a"], ["x", "a", 0.3, "a"], miss, miss, miss];
  assert.ok(ids(award(fresh(), race(lost))).includes("humbled"));
  assert.ok(ids(award(fresh(), race([miss, miss, miss, miss, miss]))).includes("draw"));
});

test("a title is only ever awarded once", () => {
  const first = award(fresh(), race([["a", "b", 0.3, "a"], miss, miss, miss, miss]));
  const again = award(first.store, race([["a", "b", 0.3, "a"], miss, miss, miss, miss]));
  assert.deepEqual(ids(again), []);
});

test("daily-only titles need the daily race, a big enough crowd and a streak", () => {
  const crowd: CrowdDay = { plays: 40, words: [3, 30, 30, 30, 30], scores: [0, 0, 0, 0, 0, 0] };
  const rows: Row[] = [["a", "b", 0.3, "a"], miss, miss, miss, miss];
  assert.ok(!ids(award(fresh(), race(rows, { crowd }))).includes("rarefind"));
  assert.ok(ids(award(fresh(), race(rows, { crowd, daily: true }))).includes("rarefind"));
  assert.ok(!ids(award(fresh(), race(rows, { crowd: { ...crowd, plays: 10 }, daily: true }))).includes("rarefind"));
  assert.deepEqual(ids(award(fresh(), race([miss, miss, miss, miss, miss], { daily: true, streak: 7 }))).filter((id) => id !== "draw"), ["devoted", "regular"]);
});

test("steer titles", () => {
  assert.deepEqual(ids(award(fresh(), { kind: "steer", ranks: [1, 1, 1, 1, 1], odds: 0.01 })), ["autopilot"]);
  assert.deepEqual(ids(award(fresh(), { kind: "steer", ranks: [6, 1, 1, 2, 1], odds: 1e-7 })), ["chaos"]);
});

test("break titles, languages and the full tour", () => {
  let s = fresh();
  const ask = (prompt: string, choices: number, probe: string | null = null) => {
    const r = award(s, { kind: "break", prompt, choices, probe });
    s = r.store;
    return ids(r);
  };
  assert.deepEqual(ask("Once upon a", 2, "Fairy tale"), ["sure"]);
  assert.deepEqual(ask("The capital city of Wakanda is called", 252, "Wakanda"), ["hunter"]);
  assert.deepEqual(ask("Suomen pääkaupunki on", 663, "Suomi"), ["lost"]);
  assert.deepEqual(ask("Eesti pealinn on", 794, "Eesti"), []);
  assert.deepEqual(ask("Lietuvos sostinė yra", 500), ["polyglot"]);
  s = award(s, { kind: "steer", ranks: [2, 2, 2, 2, 2], odds: 0.001 }).store;
  assert.ok(ids(award(s, race([miss, miss, miss, miss, miss]))).includes("tour"));
});

test("a prompt's language is spotted from a starter or a non-English letter", () => {
  assert.equal(languageOf("Eesti pealinn on", "Eesti"), "Eesti");
  assert.equal(languageOf("Lietuvos sostinė yra", null), "other");
  assert.equal(languageOf("I love you ❤️ so much", null), null);
  assert.equal(languageOf("Once upon a", "Fairy tale"), null);
});

test("the shown title is the one chosen, or else the newest", () => {
  const s = { ...fresh(), titles: { beat: 1, twist: 3, sure: 2 } };
  assert.equal(shownTitle(s)?.id, "twist");
  assert.equal(shownTitle({ ...s, wearing: "sure" })?.id, "sure");
  assert.equal(shownTitle({ ...s, wearing: "oracle" })?.id, "twist");
  assert.equal(shownTitle(fresh()), null);
});
