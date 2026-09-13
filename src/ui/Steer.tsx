import { useEffect, useRef, useState } from "react";
import raceData from "../data/race.json";
import type { RaceData } from "../game/scoring.ts";
import { oneIn, pct } from "../game/scoring.ts";
import type { Prediction, WordProb } from "../engine/core.ts";
import { predictLive, useEngine } from "../engine/client.ts";
import Bot from "./Bot.tsx";
import Loading from "./Loading.tsx";

const openings = (raceData as RaceData).sentences.map((s) => s.opening);
const PICKS = 5;
type Pick = WordProb & { rank: number; long?: boolean };

function randomOpening(not?: string) {
  const i = Math.floor(Math.random() * openings.length);
  return openings[i] === not ? openings[(i + 1) % openings.length] : openings[i];
}

// the AI's top five words, plus one surprise from further down its list
function options(pred: Prediction): Pick[] {
  const top: Pick[] = pred.words.slice(0, 5).map((w, i) => ({ ...w, rank: i + 1 }));
  const tail = pred.words.slice(5).filter((w) => w.p >= 0.001);
  const long = tail[tail.length - 1];
  return long ? [...top, { ...long, rank: pred.words.indexOf(long) + 1, long: true }] : top;
}

type Props = { onReceipt: (ranks: number[], odds: number) => void; onHome: () => void };

export default function Steer({ onReceipt, onHome }: Props) {
  const engine = useEngine();
  const [opening, setOpening] = useState(() => randomOpening());
  const [picks, setPicks] = useState<Pick[]>([]);
  const [pred, setPred] = useState<Prediction | null>(null);
  const [own, setOwn] = useState<WordProb[] | null>(null);
  const [toast, setToast] = useState("");
  const ready = engine.phase === "ready";
  const done = picks.length >= PICKS;
  const context = [opening, ...picks.map((x) => x.w)].join(" ");
  const reported = useRef(false);

  useEffect(() => {
    if (!ready || done) return;
    let live = true;
    setPred(null);
    predictLive(context).then((p) => { if (live) setPred(p); }, () => {});
    return () => { live = false; };
  }, [ready, done, context]);

  // what the AI would have written, one favourite word at a time
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
    if (!done) { reported.current = false; return; }
    if (reported.current) return;
    reported.current = true;
    onReceipt(picks.map((x) => x.rank), picks.reduce((a, x) => a * x.p, 1));
  }, [done]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 1800); return () => clearTimeout(t); }, [toast]);

  const top = (
    <div className="mode-top">
      <button className="link back" onClick={onHome}>Home</button>
      <h1>Build a sentence</h1>
      <span className="count">{Math.min(picks.length, PICKS)}/{PICKS}</span>
    </div>
  );

  if (!ready) return <section className="stack">{top}<Loading state={engine} /></section>;

  if (!done) {
    return (
      <section className="stack">
        {top}
        <p className="story card">{context} <span className="gap">?</span></p>
        <p className="ask">{picks.length === 0 ? "Pick the next word. Try a surprise!" : "Keep going. Every word changes the AI's list."}</p>
        {pred ? (
          <div className="picks">
            {options(pred).map((o, i) => (
              <button key={`${o.w}-${i}`} className={["pick", i === 0 && "fav", o.long && "long"].filter(Boolean).join(" ")} onClick={() => setPicks([...picks, o])}>
                <span className="fill" style={{ width: `${Math.max(2, o.p * 100)}%` }} />
                <span className="pick-word">{o.w}</span>
                {i === 0 && <span className="tag ai">AI's favourite</span>}
                {o.long && <span className="tag you">surprise</span>}
                <span className="pct">{pct(o.p)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="thinking-row"><Bot size={40} mood="thinking" /><span>The AI is thinking</span></div>
        )}
        {picks.length > 0 && <button className="link" onClick={() => setPicks(picks.slice(0, -1))}>Undo the last word</button>}
      </section>
    );
  }

  const odds = picks.reduce((a, x) => a * x.p, 1);
  const sentence = context;
  const lowest = Math.min(...picks.map((x) => x.p));
  const text = ["Just Guessing, my sentence", sentence, `The chance the AI writes this is ${oneIn(odds)}`, new URL(import.meta.env.BASE_URL, location.origin).href].join("\n");
  const share = async () => {
    try {
      if (typeof navigator.share === "function") await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setToast("Copied. Paste it anywhere."); }
    } catch { /* closed the share sheet */ }
  };
  const again = () => { setPicks([]); setPred(null); setOpening(randomOpening(opening)); };

  return (
    <section className="stack">
      {top}
      <div className="card receipt">
        <p className="kicker">Your five words</p>
        <p className="story small">{sentence}</p>
        <ol className="rlines">{picks.map((x, i) => <li key={i}><span>{x.w}</span><span>{pct(x.p)}</span></li>)}</ol>
        <p className="kicker">Chance the AI writes exactly this</p>
        <p className="odds-big">{oneIn(odds)}</p>
        {lowest < 0.01 && <p className="stamp">Made with a {pct(lowest)} word</p>}
        <p className="kicker">The five words the AI would pick</p>
        <p className="story small muted">{own ? `${opening} ${own.map((x) => x.w).join(" ")}` : "Thinking"}</p>
      </div>
      <div className="actions">
        <button className="btn" onClick={share}>Share it</button>
        <button className="btn quiet" onClick={again}>Build another</button>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </section>
  );
}
