import { test } from "node:test";
import assert from "node:assert/strict";
import { humanShare, standingLine, rarestRight, teamLine, countKeys, patchDay, type CrowdDay } from "../src/game/crowd.ts";
import { grade, type Round } from "../src/game/scoring.ts";

const round: Round = { words: [["zzz", 0.3]], truthP: 0.05, rank: 2, effective: 50 };
const day: CrowdDay = { plays: 10, words: [8, 1, 5, 9, 2], scores: [1, 2, 3, 2, 1, 1] };

test("the tug of war splits today's words between people and the machine", () => {
  assert.equal(humanShare(day, 2), 25 / 45);
  assert.equal(humanShare({ plays: 0, words: [0, 0, 0, 0, 0], scores: [0, 0, 0, 0, 0, 0] }, 2), null);
});

test("your standing excludes you and reads like a person would say it", () => {
  assert.equal(standingLine(day, 3), "You beat 67% of people today.");
  assert.equal(standingLine(day, 5), "You beat everyone else who played today.");
  assert.equal(standingLine(day, 0), "Nobody scored lower today. There is always tomorrow.");
  assert.equal(standingLine({ ...day, plays: 1 }, 2), "You are the first person to finish today.");
});

test("the rarest word you got is only called out when fewer than half found it", () => {
  const grades = ["a", "b", "c", "d", "e"].map((t, i) => grade([t, t, "x", t, t][i], round, t));
  assert.equal(rarestRight(day, grades), 1);
  assert.equal(rarestRight({ ...day, words: [8, 9, 5, 9, 9] }, grades), -1);
});

test("the team line says who is winning today", () => {
  assert.equal(teamLine(day, 2), "10 people have played today. Humans are winning 56% of the words.");
  assert.equal(teamLine({ ...day, words: [2, 1, 1, 1, 1] }, 2), "10 people have played today. The machine is winning 77% of the words.");
  assert.equal(teamLine({ ...day, words: [9, 9, 9, 9, 9] }, 2), "10 people have played today. Humans are winning 69% of the words.");
  assert.equal(teamLine({ plays: 0, words: [0, 0, 0, 0, 0], scores: [0, 0, 0, 0, 0, 0] }, 2), "Nobody has finished today's race yet. Go first.");
});

test("a finished race adds to exactly the right counters and nothing else", () => {
  const g = (guess: string, pick: string, truth: string) => grade(guess, { words: [[pick, 0.3]], truthP: 0.05, rank: 2, effective: 50 }, truth);
  const grades = [g("a", "b", "a"), g("x", "c", "c"), g("x", "y", "z"), g("d", "q", "d"), g("x", "y", "z")];
  assert.deepEqual(countKeys(3, grades), ["d3-plays", "d3-s2", "d3-w0", "d3-w3", "all-humans"]);
});

test("after a race, the counters it moved replace what was read before it", () => {
  const before: CrowdDay = { plays: 9, words: [7, 1, 4, 8, 2], scores: [1, 2, 3, 2, 1, 0] };
  const moved = { "d4-plays": 11, "d4-s3": 4, "d4-w0": 9, "d4-w3": 10, "all-humans": 5, "d3-plays": 99 };
  assert.deepEqual(patchDay(4, before, moved), { plays: 11, words: [9, 1, 4, 10, 2], scores: [1, 2, 3, 4, 1, 0] });
  assert.equal(before.plays, 9);
});
