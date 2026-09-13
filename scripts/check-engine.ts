// Smoke check for the engine against the real model. Downloads the model once.
//   node scripts/check-engine.ts [dtype]   default q4, what browsers without WebGPU get
import { AutoTokenizer, AutoModelForCausalLM, env } from "@huggingface/transformers";
import { makeEngine, predict, wordProb, continueText } from "../src/engine/core.ts";

env.cacheDir = ".model-cache/";
const dtype = (process.argv[2] ?? "q4") as "q4" | "q4f16" | "fp16" | "fp32";
const ID = "onnx-community/SmolLM2-135M-ONNX";
const tok = await AutoTokenizer.from_pretrained(ID);
const model = await AutoModelForCausalLM.from_pretrained(ID, { dtype, device: "cpu" });
let t = performance.now();
const E = makeEngine(tok, model);
console.log(`engine ready on ${dtype}, token kinds built in ${Math.round(performance.now() - t)} ms`);
const pct = (p: number) => `${(100 * p).toFixed(1)}%`;

for (const text of [
  "The best way to learn a language is to",
  "The Eiffel Tower is in the city of",
  "The capital of France is",
  "The capital city of Wakanda is called",
  "Tampere is a city in",
  "Suomen pääkaupunki on",
  "Paras tapa oppia kieltä on",
  "Eesti pealinn on",
]) {
  t = performance.now();
  const { words, effective } = await predict(E, text, { starts: 16, depth: 3, keep: 7 });
  const ms = Math.round(performance.now() - t);
  const cont = await continueText(E, text);
  console.log(`\n${text}   ${ms} ms, about ${Math.round(effective)} choices\n  ${words.map((w) => `${w.w} ${pct(w.p)}`).join(" · ")}\n  writes on ${JSON.stringify(cont)}`);
}
const ctx = "The best way to learn a language is to";
const listed = (await predict(E, ctx, { starts: 16 })).words.find((w) => w.w === "practice");
console.log(`\nconsistency: the list gives practice ${listed ? pct(listed.p) : "nothing"}, wordProb gives ${pct(await wordProb(E, ctx, "practice"))}`);
