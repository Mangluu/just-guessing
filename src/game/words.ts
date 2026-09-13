/** How two spellings of a word are compared, so "Speak!" and "speak" match. */
export const normalise = (w: string) =>
  w.normalize("NFC").toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

// How a decoded token sits against word boundaries. Pure string logic, kept
// apart from the engine so it can be tested without loading a model.
export const CONT = 0, START = 1, BREAK = 2, SPECIAL = 3;

export function classify(s: string, special = false): number {
  if (special || s === "") return SPECIAL;
  if (/^\s/.test(s)) return /^\s+[\p{L}\p{N}\p{M}�]/u.test(s) ? START : BREAK;
  // letters with no leading space glue onto the current word, as do byte
  // fragments of a multi-byte character and contractions like "'t"
  if (/^[\p{L}\p{N}\p{M}�]/u.test(s) || /^['’]\p{L}/u.test(s)) return CONT;
  return BREAK;
}
