import { test } from "node:test";
import assert from "node:assert/strict";
import { hundred } from "../src/game/hundred.ts";

const sum = (s: { count: number }[]) => s.reduce((a, x) => a + x.count, 0);

test("odds become 100 guesses in order: the AI's pick, your pick, other top words, then everything else", () => {
  const s = hundred([["cat", 0.103], ["dog", 0.064], ["rabbit", 0.023], ["man", 0.019]], { real: "cat", you: "dog" });
  assert.equal(sum(s), 100);
  assert.deepEqual(s.map((x) => [x.word, x.kind]), [["cat", "real"], ["dog", "you"], ["rabbit", "alt"], ["any other word", "rest"]]);
  assert.ok(s[0].ai && s[0].real && !s[0].you);
  assert.equal(s[0].count, 10);
  assert.equal(s[3].count, 81);
});

test("a real word off the list still gets a row, and odds above 100 percent are scaled down", () => {
  const off = hundred([["the", 0.5], ["a", 0.2]], { real: "Zebra", realP: 0.001, you: "the" });
  assert.equal(sum(off), 100);
  const zebra = off.find((x) => x.word === "Zebra")!;
  assert.deepEqual([zebra.kind, zebra.count, zebra.p], ["real", 0, 0.001]);
  assert.deepEqual([off[0].word, off[0].kind, off[0].you], ["the", "ai", true]);
  assert.equal(hundred([["x", 0.7], ["y", 0.5]]).length, 2);
  assert.equal(sum(hundred([["x", 0.7], ["y", 0.5]])), 100);
  assert.equal(hundred([["Cat", 0.5], ["cat", 0.1]]).filter((x) => x.kind !== "rest").length, 1);
});
