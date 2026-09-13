import { useEffect, useState } from "react";
import type { EngineState } from "../engine/client.ts";

const LINES = [
  "This is the whole AI. 135 million numbers.",
  "It downloads once, then it lives in your browser.",
  "Nothing you type here will leave this device.",
  "This copy is squeezed small so it fits in your browser, which makes its guesses a little blurrier.",
];

export default function Loading({ state }: { state: EngineState }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % LINES.length), 4200);
    return () => clearInterval(t);
  }, []);

  if (state.phase === "error") {
    return (
      <section className="screen loading">
        <h2 className="load-title">The AI could not start in this browser</h2>
        <p className="hint">{state.message}</p>
        <p className="hint">It needs a recent Chrome, Edge, Firefox or Safari. The daily race still works without it.</p>
      </section>
    );
  }

  // the real size arrives file by file, so start from what the download will be
  const expected = state.device === "wasm" ? 183e6 : 118e6;
  const total = Math.max(state.total, expected);
  const mb = (b: number) => Math.round(b / 1e6);
  const warming = state.phase === "warming";
  const done = warming ? 100 : Math.min(100, (100 * state.loaded) / total);
  return (
    <section className="screen loading" aria-live="polite">
      <p className="label">{warming ? "Waking the AI up" : "Downloading the AI"}</p>
      <p className="load-count"><span className="big">{mb(warming ? total : state.loaded)}</span> of {mb(total)} MB</p>
      <div className="load-bar" role="progressbar" aria-label="Download progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(done)}><span style={{ width: `${done}%` }} /></div>
      <p className="load-line" key={i}>{LINES[i]}</p>
      {state.device === "wasm" && <p className="small">No graphics card access here, so it runs on the processor and thinks more slowly.</p>}
    </section>
  );
}
