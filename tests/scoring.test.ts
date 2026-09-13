import { test } from "node:test";
import assert from "node:assert/strict";
import { grade, square, shareLine, pct, oneIn, type Round } from "../src/game/scoring.ts";
import { dayNumber, sentenceIndex } from "../src/game/daily.ts";
import { finishDay, currentStreak } from "../src/game/store.ts";

const round = (words: [string, number][], truthP = 0.05, rank: number | null = 2): Round =>
  ({ words, truthP, rank, effective: 60 });

test("a guess matches the real word regardless of case and punctuation", () => {
  const g = grade("Speak!", round([["learn", 0.12], ["speak", 0.08]]), "speak");
  assert.equal(g.youRight, true);
  assert.equal(g.machineRight, false);
  assert.equal(g.machineWord, "learn");
  assert.equal(grade("", round([["it", 0.4]]), "it").youRight, false);
});

test("the grid square covers all four outcomes", () => {
  assert.equal(square(grade("it", round([["it", 0.4]]), "it")), "🟨");
  assert.equal(square(grade("it", round([["the", 0.4]]), "it")), "🟩");
  assert.equal(square(grade("no", round([["it", 0.4]]), "it")), "🟥");
  assert.equal(square(grade("no", round([["the", 0.4]]), "it")), "⬛");
});

test("the share line says what actually happened", () => {
  assert.equal(shareLine([grade("a", round([["b", 0.9]]), "a")]), "I beat the machine.");
  assert.equal(shareLine([grade("x", round([["b", 0.25]]), "a")]), "It was 25% sure and wrong.");
  assert.equal(shareLine([grade("x", round([["b", 0.1]]), "a")]), "A draw. It does not get tired.");
  assert.equal(shareLine([grade("x", round([["a", 0.1]]), "a")]), "It beat me 1 to 0.");
});

test("percentages read the way people say them", () => {
  assert.equal(pct(0.412), "41%");
  assert.equal(pct(0.0321), "3.2%");
  assert.equal(pct(0.004), "0.4%");
  assert.equal(pct(0.0004), "<0.1%");
});

test("days turn over at local midnight and survive the clock change", () => {
  assert.equal(dayNumber(new Date(2026, 8, 13, 0, 1)), 1);
  assert.equal(dayNumber(new Date(2026, 8, 13, 23, 59)), 1);
  assert.equal(dayNumber(new Date(2026, 8, 14, 0, 0)), 2);
  assert.equal(dayNumber(new Date(2026, 10, 1, 12)), 50);
  assert.equal(sentenceIndex(81, 80), 0);
  assert.equal(sentenceIndex(-3, 80), 76);
});

test("the streak grows on consecutive days and resets after a gap", () => {
  let s = { days: {}, lastDay: 0, streak: 0, titles: [] as string[] };
  s = finishDay(s, 5); assert.equal(s.streak, 1);
  s = finishDay(s, 6); assert.equal(s.streak, 2);
  s = finishDay(s, 6); assert.equal(s.streak, 2);
  assert.equal(currentStreak(s, 7), 2);
  assert.equal(currentStreak(s, 8), 0);
  s = finishDay(s, 9); assert.equal(s.streak, 1);
});

test("the chance of a whole sentence is said plainly", () => {
  assert.equal(oneIn(0.5), "1 in 2");
  assert.equal(oneIn(1 / 48), "1 in 48");
  assert.equal(oneIn(1 / 2_300_000), "1 in 2.3 million");
  assert.equal(oneIn(1e-10), "1 in 10 billion");
  assert.equal(oneIn(0), "never");
});
