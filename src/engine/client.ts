// The page's handle on the worker. Nothing here imports the model library,
// so the daily race loads instantly and the model only arrives when asked for.
import { useSyncExternalStore } from "react";
import type { Prediction } from "./core.ts";
import type { Device, FromWorker, ToWorker } from "./worker.ts";

export type EngineState = {
  phase: "idle" | "downloading" | "warming" | "ready" | "error";
  loaded: number;
  total: number;
  device: Device | null;
  message: string;
};

let worker: Worker | null = null;
let state: EngineState = { phase: "idle", loaded: 0, total: 0, device: null, message: "" };
const listeners = new Set<() => void>();
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
let nextId = 1;

function update(patch: Partial<EngineState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

/** Starts downloading the model. Safe to call as often as you like. */
export function start() {
  if (worker) return;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (ev: MessageEvent<FromWorker>) => {
    const m = ev.data;
    if (m.type === "status") {
      update({ phase: m.phase, loaded: m.loaded ?? state.loaded, total: m.total ?? state.total, device: m.device ?? state.device, message: m.message ?? "" });
      if (m.phase === "error") for (const p of pending.values()) p.reject(new Error(m.message));
      return;
    }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.type === "failed") p.reject(new Error(m.message));
    else p.resolve(m.type === "result" ? m.prediction : m.text);
  };
  worker.onerror = (e) => update({ phase: "error", message: e.message || "The model could not start in this browser." });
  update({ phase: "downloading" });
  worker.postMessage({ type: "load" } satisfies ToWorker);
}

function ask<T>(m: { type: "predict" | "continue"; text: string }): Promise<T> {
  start();
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ ...m, id } satisfies ToWorker);
  });
}

export const predictLive = (text: string) => ask<Prediction>({ type: "predict", text });
export const writeOn = (text: string) => ask<string>({ type: "continue", text });

export const useEngine = () =>
  useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => state,
  );
