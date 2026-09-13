// Precomputes the daily race. For every candidate sentence it measures the
// machine's odds at each of the five blanks with the full-precision model,
// scores how good a game the sentence makes, and writes the best ones to
// src/data/race.json. Results are cached, so re-running only costs the new lines.
//
//   node scripts/build-race.ts             measure, report, write 80 sentences
//   node scripts/build-race.ts --count 60  ship a different number
import { AutoTokenizer, AutoModelForCausalLM, env } from "@huggingface/transformers";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { makeEngine, predict, wordProb } from "../src/engine/core.ts";
import { normalise } from "../src/game/words.ts";

const MODEL = "onnx-community/SmolLM2-135M-ONNX";
const DTYPE = "fp32";
const COUNT = Number(process.argv[process.argv.indexOf("--count") + 1]) || 80;
const CACHE = ".model-cache/race-cache.json";

type Round = { words: [string, number][]; truthP: number; rank: number | null; effective: number };

env.cacheDir = ".model-cache/";
mkdirSync(".model-cache", { recursive: true });
const cache: Record<string, Round[]> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

function parse(line: string) {
  const end = line.match(/[.!?]+$/)?.[0] ?? "";
  const words = line.slice(0, line.length - end.length).trim().split(/\s+/);
  const truth = words.slice(-5);
  return {
    opening: words.slice(0, -5).join(" "),
    truth,
    end: end || ".",
    ok: words.length >= 9 && truth.every((w) => /^\p{L}+$/u.test(w)),
  };
}

function judge(rounds: Round[], truth: string[]) {
  const right = rounds.map((r, i) => normalise(r.words[0]?.[0] ?? "") === normalise(truth[i]));
  const m = right.filter(Boolean).length;
  const sureWrong = Math.max(0, ...rounds.map((r, i) => (right[i] ? 0 : r.words[0]?.[1] ?? 0)));
  const top6 = rounds.filter((r) => r.rank !== null && r.rank <= 6).length;
  // a good day: the machine wins some and loses some, is at least once
  // confidently wrong, and the true word is usually on the list you see
  const score = (m === 2 || m === 3 ? 2 : m === 1 || m === 4 ? 1 : 0) + (sureWrong >= 0.25 ? 1 : 0) + top6 / 5;
  return { right, m, sureWrong, top6, score };
}

const lines = readFileSync("scripts/sentences.txt", "utf8")
  .split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));

const tok = await AutoTokenizer.from_pretrained(MODEL);
const model = await AutoModelForCausalLM.from_pretrained(MODEL, { dtype: DTYPE, device: "cpu" });
const E = makeEngine(tok, model);
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

const rows = [];
const t0 = performance.now();
let fresh = 0;
for (const line of lines) {
  const s = parse(line);
  if (!s.ok) { console.warn(`skip, wrong shape: ${line}`); continue; }
  if (!cache[line]) {
    const rounds: Round[] = [];
    for (let r = 0; r < 5; r++) {
      const ctx = [s.opening, ...s.truth.slice(0, r)].join(" ");
      const pred = await predict(E, ctx, { starts: 48, depth: 3, keep: 40 });
      const i = pred.words.findIndex((x) => normalise(x.w) === normalise(s.truth[r]));
      rounds.push({
        words: pred.words.map((x) => [x.w, r4(x.p)]),
        truthP: r4(i >= 0 ? pred.words[i].p : await wordProb(E, ctx, s.truth[r])),
        rank: i >= 0 ? i + 1 : null,
        effective: Math.round(pred.effective),
      });
    }
    cache[line] = rounds;
    writeFileSync(CACHE, JSON.stringify(cache));
    if (++fresh % 10 === 0) console.log(`  measured ${fresh}, ${Math.round((performance.now() - t0) / 1000)} s`);
  }
  rows.push({ line, ...s, rounds: cache[line], ...judge(cache[line], s.truth) });
}

rows.sort((a, b) => b.score - a.score);
const pct = (x: number) => `${Math.round(100 * x)}%`;
console.log(`\n${rows.length} sentences measured. Machine right, out of 5:`);
for (let m = 0; m <= 5; m++) console.log(`  ${m}: ${"#".repeat(rows.filter((r) => r.m === m).length)} ${rows.filter((r) => r.m === m).length}`);
console.log(`\nscore  m  sureWrong  top6  sentence  |  machine's guess per blank`);
for (const r of rows) {
  const guesses = r.rounds.map((x, i) => `${x.words[0]?.[0]} ${pct(x.words[0]?.[1] ?? 0)}${r.right[i] ? "✓" : ""}`).join(" · ");
  console.log(`${r.score.toFixed(1).padStart(4)}  ${r.m}  ${pct(r.sureWrong).padStart(9)}  ${r.top6}/5  ${r.line}\n${" ".repeat(26)}${guesses}`);
}

// Ship the best COUNT, in a fixed shuffled order so similar topics do not bunch up.
let seed = 20260913;
const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const ship = rows.slice(0, COUNT).map((r) => ({ r, k: rand() })).sort((a, b) => a.k - b.k).map(({ r }) => r);
// Players meet these one day at a time, so neither a topic nor an ending should
// land on two days in a row. Swap a repeat with the next sentence that differs.
const TOPICS = ["library", "ferry", "chatbot", "grandmother", "grandfather", "bakery", "museum", "concert", "snow", "exam", "sauna", "flight"];
const topic = (r: { line: string }) => TOPICS.find((t) => r.line.toLowerCase().includes(t)) ?? r.line;
const ending = (r: { truth: string[] }) => r.truth.slice(-2).join(" ").toLowerCase();
const clash = (a: { line: string; truth: string[] }, b: { line: string; truth: string[] }) =>
  topic(a) === topic(b) || ending(a) === ending(b);
for (let i = 1; i < ship.length; i++) {
  if (!clash(ship[i], ship[i - 1])) continue;
  const j = ship.findIndex((r, k) => k > i && !clash(r, ship[i - 1]));
  if (j > i) [ship[i], ship[j]] = [ship[j], ship[i]];
}
mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/race.json", JSON.stringify({
  model: "SmolLM2-135M",
  precision: DTYPE,
  generated: new Date().toISOString().slice(0, 10),
  sentences: ship.map((r) => ({ opening: r.opening, truth: r.truth, end: r.end, rounds: r.rounds })),
}));
console.log(`\nwrote src/data/race.json with ${ship.length} sentences, lowest score shipped ${rows[Math.min(COUNT, rows.length) - 1]?.score.toFixed(1)}`);
