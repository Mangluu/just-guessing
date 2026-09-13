// From a sentence to the machine's odds for the next *word*.
//
// The model only predicts tokens, and a token can be half a word (" Wak", then
// "anda"). Players think in words, so this turns token odds into word odds:
// take the likeliest tokens that start a word, extend each while its likeliest
// next token is still inside that word, and weight every finished word by the
// chance the word really ends there.
//
// Shared by scripts/build-race.ts (Node, precomputes the daily race) and the
// browser worker (Steer and Break), so both show numbers from the same code.
import { Tensor } from "@huggingface/transformers";
import { normalise, classify, CONT, START } from "../game/words.ts";

export type Engine = { tok: any; model: any; kind: Uint8Array };
export type WordProb = { w: string; p: number };
export type Prediction = { words: WordProb[]; effective: number };

export function makeEngine(tok: any, model: any): Engine {
  const n: number = model.config.vocab_size;
  const special = new Set<number>(tok.all_special_ids ?? []);
  const kind = new Uint8Array(n);
  for (let i = 0; i < n; i++) kind[i] = classify(tok.decode([i]), special.has(i));
  return { tok, model, kind };
}

const encode = (E: Engine, text: string): bigint[] =>
  Array.from(E.tok(text).input_ids.data as BigInt64Array);

// Every row must be the same length: no padding, so no mask tricks. Batch only
// with weight-only builds (fp32, fp16, q4, q4f16). The 8-bit build rescales
// activations across the whole batch and shifts each row's odds by up to 20 points.
async function forward(E: Engine, rows: bigint[][]) {
  const N = rows.length, L = rows[0].length;
  const ids = new BigInt64Array(N * L);
  rows.forEach((r, i) => ids.set(r, i * L));
  const out = await E.model({
    input_ids: new Tensor("int64", ids, [N, L]),
    attention_mask: new Tensor("int64", new BigInt64Array(N * L).fill(1n), [N, L]),
  });
  for (const [k, v] of Object.entries(out)) if (k !== "logits") (v as any).dispose?.();
  return out.logits.type === "float32" ? out.logits : out.logits.to("float32");
}

/** Softmax of one position in one row, over the whole vocabulary. */
function probsAt(logits: any, row: number, pos: number): Float64Array {
  const [, T, V] = logits.dims as number[];
  const x = logits.data as Float32Array, off = (row * T + pos) * V;
  let m = -Infinity;
  for (let i = 0; i < V; i++) if (x[off + i] > m) m = x[off + i];
  const p = new Float64Array(V);
  let s = 0;
  for (let i = 0; i < V; i++) s += (p[i] = Math.exp(x[off + i] - m));
  for (let i = 0; i < V; i++) p[i] /= s;
  return p;
}

function topWhere(p: Float64Array, ok: (i: number) => boolean, k: number): number[] {
  const best: number[] = [];
  for (let i = 0; i < p.length; i++) {
    if (!ok(i) || (best.length === k && p[i] <= p[best[k - 1]])) continue;
    if (best.length === k) best.pop();
    let j = best.length;
    while (j > 0 && p[best[j - 1]] < p[i]) j--;
    best.splice(j, 0, i);
  }
  return best;
}

/** Chance the word ends here: every next token except one that continues it. */
function stopMass(E: Engine, q: Float64Array): number {
  let s = 0;
  for (let i = 0; i < q.length; i++) if (E.kind[i] !== CONT) s += q[i];
  return s;
}

function addWord(words: Map<string, WordProb>, raw: string, p: number) {
  const w = raw.trim();
  if (!/\p{L}/u.test(w) || w.includes("�") || w.length > 24) return;
  const key = normalise(w), cur = words.get(key);
  if (!cur) words.set(key, { w, p });
  else { if (p > cur.p) cur.w = w; cur.p += p; }
}

export async function predict(
  E: Engine, context: string, { starts = 16, depth = 3, keep = 40 } = {},
): Promise<Prediction> {
  const base = encode(E, context);
  const p0 = probsAt(await forward(E, [base]), 0, base.length - 1);
  let H = 0;
  for (const v of p0) if (v > 0) H -= v * Math.log(v);

  let frontier = topWhere(p0, (i) => E.kind[i] === START, starts).map((i) => ({ path: [i], p: p0[i] }));
  const words = new Map<string, WordProb>();
  for (let d = 0; d < depth && frontier.length; d++) {
    const logits = await forward(E, frontier.map((f) => [...base, ...f.path.map(BigInt)]));
    const next: typeof frontier = [];
    frontier.forEach((f, r) => {
      const q = probsAt(logits, r, base.length + d);
      addWord(words, E.tok.decode(f.path), f.p * stopMass(E, q));
      const c = topWhere(q, (i) => E.kind[i] === CONT, 1)[0];
      if (d + 1 < depth && c !== undefined && f.p * q[c] > 1e-4) next.push({ path: [...f.path, c], p: f.p * q[c] });
    });
    frontier = next;
  }
  return { words: [...words.values()].sort((a, b) => b.p - a.p).slice(0, keep), effective: Math.exp(H) };
}

/** Exact chance the next word is `word`, by the same rule predict() uses. */
export async function wordProb(E: Engine, context: string, word: string): Promise<number> {
  const base = encode(E, context), full = encode(E, `${context} ${word}`);
  if (full.length <= base.length || base.some((t, i) => t !== full[i])) return 0;
  const logits = await forward(E, [full]);
  let p = 1;
  for (let j = base.length; j < full.length; j++) p *= probsAt(logits, 0, j - 1)[Number(full[j])];
  return p * stopMass(E, probsAt(logits, 0, full.length - 1));
}

/** What it would write next if nobody stopped it: greedy, cut at the sentence end. */
export async function continueText(E: Engine, context: string, maxTokens = 28): Promise<string> {
  const enc = E.tok(context);
  const out = await E.model.generate({ ...enc, max_new_tokens: maxTokens, do_sample: false });
  const ids = Array.from(out.data as BigInt64Array).slice(enc.input_ids.dims[1]).map(Number);
  const text: string = E.tok.decode(ids, { skip_special_tokens: true });
  const cut = text.search(/[.!?](\s|$)|\n/);
  const kept = (cut >= 0 ? text.slice(0, cut + 1) : text).trimEnd();
  // greedy decoding can loop ("and I go to the lake and I go to the lake"), so cap it
  const words = kept.trim().split(/\s+/);
  return words.length <= 16 ? kept : (kept.match(/^\s*/)?.[0] ?? "") + words.slice(0, 16).join(" ");
}
