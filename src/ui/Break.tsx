import { useState, type FormEvent } from "react";
import type { Prediction } from "../engine/core.ts";
import { predictLive, useEngine, writeOn } from "../engine/client.ts";
import { pct } from "../game/scoring.ts";
import probes from "../game/probes.ts";
import Bot, { type Mood } from "./Bot.tsx";
import Loading from "./Loading.tsx";
import Odds from "./Odds.tsx";
import { Gap } from "./Mark.tsx";

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
  const [lang, setLang] = useState<string | undefined>(undefined);
  const [pred, setPred] = useState<Prediction | null>(null);
  const [writes, setWrites] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask(prompt: string, probe: string | null) {
    const clean = prompt.trim().replace(/\s+/g, " ");
    if (!clean || busy) return;
    setText(clean); setAsked(clean); setLang(probes.find((p) => p.label === probe)?.lang);
    setPred(null); setWrites(null); setError(""); setBusy(true);
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
  const words = `${n.toLocaleString("en-US")} ${n === 1 ? "word" : "words"}`;
  const best = pred?.words[0];
  const said = pred ? `${f.text}. It is choosing between about ${words}.${best ? ` Its top guess is ${best.w}, at ${pct(best.p)}.` : ""}` : busy ? "The AI is thinking." : "";

  return (
    <section className="stack">
      {top}
      <p className="sr-only" role="status">{said}</p>
      <p className="muted">Start a sentence. The AI guesses the next word and shows how sure it is. Can you find something it does not know?</p>
      <p className="kicker">Try one of these</p>
      <div className="starters">
        {probes.map((p) => <button key={p.label} lang={p.lang} className="starter" onClick={() => ask(p.prompt, p.label)} aria-disabled={busy}>{p.label}</button>)}
      </div>
      <label className="kicker" htmlFor="prompt">Or type the start of a sentence</label>
      <form className="ask-form" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); ask(String(new FormData(e.currentTarget).get("prompt") ?? ""), null); }}>
        <input id="prompt" name="prompt" value={text} onChange={(e) => setText(e.target.value)} placeholder="My favourite animal is" autoComplete="off" enterKeyHint="go" maxLength={140} />
        <button className={busy || !text.trim() ? "btn ai idle" : "btn ai"} aria-disabled={busy || !text.trim()}>Ask</button>
      </form>
      {error && <p className="muted" role="alert">{error}</p>}
      {asked && (
        <div className="card answer">
          <p className="story small" lang={lang}>{asked} <Gap /></p>
          {pred ? (
            <>
              <div className="sure-row">
                <Bot size={56} mood={f.mood} />
                <div>
                  <p className="sure-big">{f.text}</p>
                  <p className="muted">Choosing between {words}</p>
                </div>
              </div>
              <div className="meter-bar" role="img" aria-label={`${f.text}. About ${words}, on a scale from sure to lost`}><i style={{ left: `${x * 100}%` }} /></div>
              <div className="meter-ends" aria-hidden="true"><span>Sure</span><span>Lost</span></div>
              <Odds words={pred.words.map((w) => [w.w, w.p] as [string, number])} />
            </>
          ) : (
            <div className="thinking-row"><Bot size={40} mood="thinking" /><span>The AI is thinking</span></div>
          )}
          {writes !== null && (
            <>
              <p className="kicker">What it writes next, without checking anything</p>
              <p className="story small" lang={lang}>{asked}<b className="ai-t">{writes}</b></p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
