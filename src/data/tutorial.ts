// Real odds from SmolLM2-135M at full precision, measured with src/engine/core.ts
// on 13 September 2026. Rounded, never invented.
export type Sample = { prompt: string; words: [string, number][]; choices: number };

export const SURE: Sample = {
  prompt: "Thank you very",
  words: [["much", 0.97], ["very", 0.007], ["kindly", 0.001], ["sincerely", 0.001]],
  choices: 1,
};

export const GUESSING: Sample = {
  prompt: "My favourite food is",
  words: [["a", 0.045], ["the", 0.031], ["pizza", 0.018], ["pasta", 0.017], ["chicken", 0.015], ["fish", 0.015]],
  choices: 827,
};

export const YOUR_TURN: Sample & { truth: string } = {
  prompt: "The dog chased the",
  truth: "cat",
  words: [["cat", 0.103], ["dog", 0.064], ["rabbit", 0.023], ["man", 0.019], ["bird", 0.017], ["mouse", 0.014]],
  choices: 487,
};
