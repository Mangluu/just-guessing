import { useState, type FormEvent } from "react";
import type { Prediction } from "../engine/core.ts";
import { predictLive, useEngine, writeOn } from "../engine/client.ts";
import probes from "../game/probes.ts";
import Bot, { type Mood } from "./Bot.tsx";
import Loading from "./Loading.tsx";
import Odds from "./Odds.tsx";

// How many words it is really choosing between, read as a feeling a kid can see.
function feel(n: number): { text: string; mood: Mood } {
  if (n <= 5) return { text: "It is sure", mood: "happy" };
  if (n <= 50) return { text: "It is fairly sure", mood: "idle" };
  if (n <= 300) return { text: "It is guessing", mood: "lost" };
  return { text: "It is lost", mood: "oops" };
}

type Props = { onAnswer: (prompt: string, choices: number, probe: string | null) => void; onHome: () => void };

export default function Break({ onAnswer, onHome }: Props) {
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

  const top = (
    <div className="mode-top">
      <button className="link back" onClick={onHome}>Home</button>
      <h1>Trick the AI</h1>
      <span />
    </div>
  );

  if (engine.phase !== "ready") return <section className="stack">{top}<Loading state={engine} /></section>;

  const n = pred ? Math.max(1, Math.round(pred.effective)) : 0;
  const f = feel(n);
  const x = Math.min(1, Math.log10(n || 1) / 3);

  return (
    <section className="stack">
      {top}
      <p className="muted">Start a sentence. The AI guesses the next word and shows how sure it is. Can you find something it does not know?</p>
      <p className="kicker">Try one of these</p>
      <div className="starters">
        {probes.map((p) => <button key={p.label} className="starter" onClick={() => ask(p.prompt, p.label)} disabled={busy}>{p.label}</button>)}
      </div>
      <form className="ask-form" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); ask(String(new FormData(e.currentTarget).get("prompt") ?? ""), null); }}>
        <input name="prompt" value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type the start of a sentence" aria-label="Start of a sentence" autoComplete="off" enterKeyHint="go" maxLength={140} />
        <button className={busy || !text.trim() ? "btn ai idle" : "btn ai"} aria-disabled={busy || !text.trim()}>Ask</button>
      </form>
      {error && <p className="muted">{error}</p>}
      {asked && (
        <div className="card answer" aria-live="polite">
          <p className="story small">{asked} <span className="gap">?</span></p>
          {pred ? (
            <>
              <div className="sure-row">
                <Bot size={56} mood={f.mood} />
                <div>
                  <p className="sure-big">{f.text}</p>
                  <p className="muted">Choosing between {n.toLocaleString("en-US")} {n === 1 ? "word" : "words"}</p>
                </div>
              </div>
              <div className="meter-bar" role="img" aria-label={`${f.text}. About ${n} words, on a scale from sure to lost`}><i style={{ left: `${x * 100}%` }} /></div>
              <div className="meter-ends"><span>Sure</span><span>Lost</span></div>
              <Odds words={pred.words.map((w) => [w.w, w.p] as [string, number])} />
            </>
          ) : (
            <div className="thinking-row"><Bot size={40} mood="thinking" /><span>The AI is thinking</span></div>
          )}
          {writes !== null && (
            <>
              <p className="kicker">What it writes next, without checking anything</p>
              <p className="story small">{asked}<b className="ai-t">{writes}</b></p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
