import { test } from "node:test";
import assert from "node:assert/strict";
import { normalise, classify, CONT, START, BREAK, SPECIAL } from "../src/game/words.ts";

test("a word matches regardless of case and edge punctuation", () => {
  assert.equal(normalise("Speak!"), "speak");
  assert.equal(normalise("  it, "), "it");
  assert.equal(normalise("Ääni"), "ääni");
  assert.equal(normalise("don't"), "don't");
});

test("tokens are sorted by how they sit against word boundaries", () => {
  assert.equal(classify(" the"), START);
  assert.equal(classify(" Wak"), START);
  assert.equal(classify(" �"), START);
  assert.equal(classify("anda"), CONT);
  assert.equal(classify("'t"), CONT);
  assert.equal(classify("'"), CONT);
  assert.equal(classify("�"), CONT);
  assert.equal(classify("\n"), BREAK);
  assert.equal(classify(" ("), BREAK);
  assert.equal(classify("."), BREAK);
  assert.equal(classify(""), SPECIAL);
  assert.equal(classify("<|endoftext|>", true), SPECIAL);
});
