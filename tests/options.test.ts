import { test } from "node:test";
import assert from "node:assert/strict";
import { optionsFor, seedOf } from "../src/game/options.ts";
import type { Round } from "../src/game/scoring.ts";

const round: Round = { words: [["day", 0.9], ["Single", 0.03], ["CO2", 0.02], ["single", 0.02], ["week", 0.01], ["time", 0.01]], truthP: 0.02, rank: 2, effective: 5 };

test("choices hold the real word and the AI's favourites, with no repeats or non-words", () => {
  const opts = optionsFor(round, "single", 7);
  assert.equal(opts.length, 4);
  assert.deepEqual([...opts].sort(), ["day", "single", "time", "week"]);
});

test("everyone gets the same order for the same sentence, and it is not always the same slot", () => {
  const seed = seedOf("The best way to learn a language is to|3");
  assert.deepEqual(optionsFor(round, "single", seed), optionsFor(round, "single", seed));
  const firsts = new Set(Array.from({ length: 12 }, (_, i) => optionsFor(round, "single", seedOf(`s${i}`))[0]));
  assert.ok(firsts.size > 1);
});
