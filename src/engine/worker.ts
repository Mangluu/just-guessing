// Runs the model off the main thread so the page never freezes while it thinks.
// Loads the 4-bit copy, q4f16 on WebGPU and q4 on WebAssembly. Never the 8-bit
// build, because the engine batches and 8-bit batching distorts the odds.
import { AutoTokenizer, AutoModelForCausalLM, env } from "@huggingface/transformers";
import { makeEngine, predict, continueText, type Engine, type Prediction } from "./core.ts";

const MODEL = "onnx-community/SmolLM2-135M-ONNX";
env.allowLocalModels = false;

export type Device = "webgpu" | "wasm";
export type ToWorker =
  | { type: "load" }
  | { type: "predict"; id: number; text: string }
  | { type: "continue"; id: number; text: string };
export type FromWorker =
  | { type: "status"; phase: "downloading" | "warming" | "ready" | "error"; loaded?: number; total?: number; device?: Device; message?: string }
  | { type: "result"; id: number; prediction: Prediction }
  | { type: "continued"; id: number; text: string }
  | { type: "failed"; id: number; message: string };

const post = (m: FromWorker) => (self as unknown as { postMessage(m: FromWorker): void }).postMessage(m);
let engine: Engine | null = null;
let loading: Promise<void> | null = null;
let queue: Promise<void> = Promise.resolve();

async function hasWebGPU(): Promise<boolean> {
  try {
    return !!(await (navigator as any).gpu?.requestAdapter());
  } catch {
    return false;
  }
}

async function open(device: Device) {
  const dtype = device === "webgpu" ? "q4f16" : "q4";
  const files = new Map<string, [number, number]>();
  const progress_callback = (e: any) => {
    if (e.status !== "progress" || !e.file) return;
    files.set(e.file, [e.loaded ?? 0, e.total ?? 0]);
    let loaded = 0, total = 0;
    for (const [l, t] of files.values()) { loaded += l; total += t; }
    post({ type: "status", phase: "downloading", loaded, total, device });
  };
  post({ type: "status", phase: "downloading", loaded: 0, total: 0, device });
  const tok = await AutoTokenizer.from_pretrained(MODEL, { progress_callback });
  const model = await AutoModelForCausalLM.from_pretrained(MODEL, { device, dtype, progress_callback });
  post({ type: "status", phase: "warming", device });
  const e = makeEngine(tok, model);
  await predict(e, "Hello", { starts: 4, depth: 1, keep: 4 }); // compile the GPU kernels before the first real question
  engine = e;
  post({ type: "status", phase: "ready", device });
}

async function load() {
  const gpu = await hasWebGPU();
  try {
    await open(gpu ? "webgpu" : "wasm");
  } catch (err) {
    if (!gpu) throw err;
    await open("wasm"); // some graphics cards refuse the 16-bit kernels, the processor always works
  }
}

self.onmessage = (ev: MessageEvent<ToWorker>) => {
  const m = ev.data;
  if (m.type === "load") {
    loading ??= load().catch((err) => post({ type: "status", phase: "error", message: String(err?.message ?? err) }));
    return;
  }
  // one question at a time: the model is not safe to call concurrently
  queue = queue.then(async () => {
    try {
      await loading;
      if (!engine) throw new Error("The model is not loaded.");
      if (m.type === "predict") post({ type: "result", id: m.id, prediction: await predict(engine, m.text, { starts: 12, depth: 3, keep: 24 }) });
      else post({ type: "continued", id: m.id, text: await continueText(engine, m.text) });
    } catch (err: any) {
      post({ type: "failed", id: m.id, message: String(err?.message ?? err) });
    }
  });
};
