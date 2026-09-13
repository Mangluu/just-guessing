import { useState, type FormEvent } from "react";
import type { Prediction } from "../engine/core.ts";
import { predictLive, useEngine, writeOn } from "../engine/client.ts";
import { pct } from "../game/scoring.ts";
import probes from "../game/probes.ts";
import Loading from "./Loading.tsx";

function verdict(n: number) {
  if (n <= 5) return "Sure of itself";
  if (n <= 50) return "Leaning one way";
  if (n <= 300) return "Guessing";
  return "Lost";
}

// How many options it is really choosing between: the exponential of the
// entropy of its odds. A log scale, because 10 and 1,000 are different worlds.
function Meter({ choices }: { choices: number }) {
  const n = Math.max(1, Math.round(choices));
  const x = Math.min(1, Math.log10(n) / 3);
  return (
    <div className="meter">
      <p className="meter-top"><span className="big">{n.toLocaleString("en-US")}</span><span className="sub">options it was choosing between</span></p>
      <div className="track" role="img" aria-label={`About ${n} options, on a scale from 1 to 1,000`}>
        <span className="dot" style={{ left: `${x * 100}%` }} />
      </div>
      <div className="ticks" aria-hidden="true">
        <span style={{ left: "0%" }}>1</span>
        <span style={{ left: "33.33%" }}>10</span>
        <span style={{ left: "66.67%" }}>100</span>
        <span style={{ left: "100%" }}>1,000+</span>
      </div>
      <p className="verdict-line">{verdict(n)}</p>
    </div>
  );
}

export default function Break({ onAnswer }: { onAnswer: (prompt: string, choices: number, probe: string | null) => void }) {
  const engine = useEngine();
  const [text, setText] = useState("");
  const [asked, setAsked] = useState("");
  const [pred, setPred] = useState<Prediction | null>(null);
  const [writes, setWrites] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask(prompt: string, probe: string | null) {
    const clean = prompt.trim().replace(/\s+/g, " ");
    if (!clean || busy) return;
    setText(clean); setAsked(clean); setPred(null); setWrites(null); setError(""); setBusy(true);
    try {
      const odds = predictLive(clean), next = writeOn(clean);
      const p = await odds;
      setPred(p);
      onAnswer(clean, Math.round(p.effective), probe);
      setWrites(await next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (engine.phase !== "ready") return <Loading state={engine} />;

  return (
    <section className="screen">
      <div className="meta"><span>break · ask anything</span><span>live on this device</span></div>
      <p className="hint">Start a sentence and it guesses the next word. Try something true, something made up, and something in your own language.</p>
      <div className="chips">
        {probes.map((p) => <button key={p.label} className="chip" onClick={() => ask(p.prompt, p.label)} disabled={busy}>{p.label}</button>)}
      </div>
      <form className="guess" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); ask(String(new FormData(e.currentTarget).get("prompt") ?? ""), null); }}>
        <input name="prompt" value={text} onChange={(e) => setText(e.target.value)} placeholder="Start a sentence" aria-label="Start a sentence" autoComplete="off" enterKeyHint="go" maxLength={140} />
        <button className={busy || !text.trim() ? "btn idle" : "btn"} aria-disabled={busy || !text.trim()}>Ask</button>
      </form>
      {error && <p className="hint">{error}</p>}
      {asked && (
        <div className="probe" aria-live="polite">
          <p className="sentence">{asked} <span className="blank" role="img" aria-label="the next word" /></p>
          {pred ? (
            <>
              <Meter choices={pred.effective} />
              <ol className="bars" aria-label="Its top guesses">
                {pred.words.slice(0, 6).map((w, i) => (
                  <li key={w.w} className={i === 0 ? "bar top" : "bar"}>
                    <span className="fill" style={{ width: `${Math.max(1.5, w.p * 100)}%`, animationDelay: `${i * 45}ms` }} />
                    <span className="word">{w.w}{i === 0 && <span className="tag mach">its pick</span>}</span>
                    <span className="pct">{pct(w.p)}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="thinking">Thinking</p>
          )}
          {writes !== null && (
            <div className="writes">
              <p className="label">What it writes next, without checking anything</p>
              <p className="sentence cont">{asked}<b>{writes}</b></p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
