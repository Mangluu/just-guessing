import { useEffect, useState } from "react";
import raceData from "../data/race.json";
import type { RaceData } from "../game/scoring.ts";
import { oneIn, pct } from "../game/scoring.ts";
import type { Prediction, WordProb } from "../engine/core.ts";
import { predictLive, useEngine } from "../engine/client.ts";
import Sentence from "./Sentence.tsx";
import Loading from "./Loading.tsx";

const openings = (raceData as RaceData).sentences.map((s) => s.opening);
const PICKS = 5;
type Pick = WordProb & { long?: boolean };

function randomOpening(not?: string) {
  const i = Math.floor(Math.random() * openings.length);
  return openings[i] === not ? openings[(i + 1) % openings.length] : openings[i];
}

function options(pred: Prediction): Pick[] {
  const top: Pick[] = pred.words.slice(0, 5);
  const tail = pred.words.slice(5).filter((w) => w.p >= 0.001);
  const long = tail[tail.length - 1];
  return long ? [...top, { ...long, long: true }] : top;
}

export default function Steer() {
  const engine = useEngine();
  const [opening, setOpening] = useState(() => randomOpening());
  const [picks, setPicks] = useState<Pick[]>([]);
  const [pred, setPred] = useState<Prediction | null>(null);
  const [own, setOwn] = useState<WordProb[] | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const ready = engine.phase === "ready";
  const done = picks.length >= PICKS;
  const context = [opening, ...picks.map((x) => x.w)].join(" ");

  useEffect(() => {
    if (!ready || done) return;
    let live = true;
    setPred(null);
    predictLive(context).then((p) => { if (live) setPred(p); }, (e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [ready, done, context]);

  // Its own five words, chosen the way yours were: the top word each time. Only
  // runs once the receipt is up, so it never slows down picking.
  useEffect(() => {
    if (!ready || !done) return;
    let live = true;
    setOwn(null);
    (async () => {
      const words: WordProb[] = [];
      for (let i = 0; i < PICKS; i++) {
        const p = await predictLive([opening, ...words.map((x) => x.w)].join(" "));
        if (!p.words[0]) break;
        words.push(p.words[0]);
      }
      if (live) setOwn(words);
    })().catch(() => {});
    return () => { live = false; };
  }, [ready, done, opening]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  if (!ready) return <Loading state={engine} />;

  if (!done) {
    return (
      <section className="screen">
        <div className="meta"><span>steer · word {picks.length + 1} of {PICKS}</span><span>you choose</span></div>
        <Sentence opening={opening} words={picks.map((x) => x.w)} blank drop />
        <p className="hint">{picks.length === 0 ? "You pick its next word. The top one is what it would say. The last one is a long shot." : "Keep going. Every word changes what it thinks comes next."}</p>
        {error && <p className="hint">{error}</p>}
        {pred ? (
          <ol className="bars choose" aria-label="Choose the next word">
            {options(pred).map((o, i) => (
              <li key={`${o.w}-${i}`}>
                <button className={["bar", i === 0 && "top", o.long && "long"].filter(Boolean).join(" ")} onClick={() => setPicks([...picks, o])}>
                  <span className="fill" style={{ width: `${Math.max(1.5, o.p * 100)}%`, animationDelay: `${i * 45}ms` }} />
                  <span className="word">
                    {o.w}
                    {i === 0 && <span className="tag mach">its pick</span>}
                    {o.long && <span className="tag long">long shot</span>}
                  </span>
                  <span className="pct">{pct(o.p)}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="thinking">Thinking</p>
        )}
        {picks.length > 0 && <button className="linkish" onClick={() => setPicks(picks.slice(0, -1))}>Undo the last word</button>}
      </section>
    );
  }

  const odds = picks.reduce((a, x) => a * x.p, 1);
  const sentence = `${opening} ${picks.map((x) => x.w).join(" ")}`;
  const lowest = Math.min(...picks.map((x) => x.p));
  const url = new URL(import.meta.env.BASE_URL, location.origin).href;
  const text = ["Just Guessing, steered", sentence, picks.map((x) => `${x.w} ${pct(x.p)}`).join(" · "), `The chance it writes this is ${oneIn(odds)}`, url].join("\n");
  const again = () => { setPicks([]); setPred(null); setError(""); setOpening(randomOpening(opening)); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setToast("Copied"); } catch { setToast("Copying is blocked here"); }
  };

  return (
    <section className="screen">
      <div className="result receipt">
        <p className="label">Your steered sentence</p>
        <p className="sentence">{sentence}</p>
        <ol className="lines">{picks.map((x, i) => <li key={i}><span>{x.w}</span><span>{pct(x.p)}</span></li>)}</ol>
        <div className="odds"><p className="label">The chance it writes exactly this</p><strong>{oneIn(odds)}</strong></div>
        {lowest < 0.01 && <p className="stamp">Made with a {pct(lowest)} word</p>}
        <div className="own">
          <p className="label">What it would have written</p>
          {own ? (
            <p className="sentence">{opening} {own.map((x) => x.w).join(" ")}</p>
          ) : (
            <p className="thinking">Thinking</p>
          )}
        </div>
      </div>
      <div className="actions">
        <button className="btn" onClick={copy}>Copy receipt</button>
        <button className="btn ghost" onClick={again}>Steer another</button>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </section>
  );
}
