import { useState } from "react";
import { SURE, GUESSING, YOUR_TURN } from "../data/tutorial.ts";
import { pct } from "../game/scoring.ts";
import Bot from "./Bot.tsx";
import Odds from "./Odds.tsx";

const ORDER = ["rabbit", "cat", "man", "dog"];
const TOTAL = 5;

export default function Intro({ onDone }: { onDone: (next: "race" | "home") => void }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const next = () => setStep((s) => s + 1);

  const bodies = [
    <>
      <Bot size={96} />
      <h1>Can you guess like an AI?</h1>
      <p className="say">Chatbots like ChatGPT write one word at a time. Before every word, they guess what comes next. Here is how that works.</p>
      <div className="push"><button className="btn wide" onClick={next}>Show me how</button></div>
    </>,
    <>
      <h1>It gives every word a score</h1>
      <p className="story card">{SURE.prompt} <span className="gap">?</span></p>
      <Odds words={SURE.words} />
      <p className="say">The AI has read so many messages that it is almost sure the next word is “much”.</p>
      <div className="push"><button className="btn wide" onClick={next}>Next</button></div>
    </>,
    <>
      <h1>But often it is just guessing</h1>
      <p className="story card">{GUESSING.prompt} <span className="gap">?</span></p>
      <Odds words={GUESSING.words} />
      <p className="bubble">Hundreds of words could fit, so no word gets a big score. It still picks one, and it sounds just as sure.</p>
      <div className="push"><button className="btn wide" onClick={next}>Next</button></div>
    </>,
    <>
      <h1>Your turn</h1>
      <p className="story card">
        {YOUR_TURN.prompt} {picked ? <span className="filled">{YOUR_TURN.truth}</span> : <span className="gap">?</span>}
      </p>
      <p className="say">{picked ? (picked === YOUR_TURN.truth ? "Yes, it was cat." : `Not quite, it was cat. You picked ${picked}.`) : "Which word comes next? Tap one."}</p>
      <div className="choices">
        {ORDER.map((w) => {
          const state = !picked ? "" : w === YOUR_TURN.truth ? "right" : w === picked ? "wrong" : "dim";
          return (
            <button key={w} className={`choice ${state}`.trim()} disabled={!!picked} onClick={() => setPicked(w)}>
              {w}
              {picked && w === YOUR_TURN.words[0][0] && <span className="who">AI's pick</span>}
            </button>
          );
        })}
      </div>
      {picked && (
        <>
          <Odds words={YOUR_TURN.words} real={YOUR_TURN.truth} />
          <p className="say">The AI liked “cat” best too, but it was only {pct(YOUR_TURN.words[0][1])} sure. It was choosing between {YOUR_TURN.choices} words.</p>
        </>
      )}
      <div className="push">{picked && <button className="btn wide" onClick={next}>Next</button>}</div>
    </>,
    <>
      <h1>Now race the AI</h1>
      <ol className="steps-list">
        <li className="card"><span className="n">1</span>Read the sentence and pick the next word.</li>
        <li className="card"><span className="n">2</span>See what the AI guessed, and how sure it was.</li>
        <li className="card"><span className="n">3</span>Get more words than the AI to win titles. A new sentence comes every day.</li>
      </ol>
      <div className="push">
        <button className="btn wide" onClick={() => onDone("race")}>Start today's race</button>
        <button className="link" onClick={() => onDone("home")}>Look around first</button>
      </div>
    </>,
  ];

  return (
    <section className="intro" aria-label="How to play">
      <div className="intro-top">
        <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={step + 1}>
          <i style={{ width: `${((step + 1) / TOTAL) * 100}%` }} />
        </div>
        <button className="link" onClick={() => onDone("home")}>Skip</button>
      </div>
      <div className="intro-body" key={step}>{bodies[step]}</div>
    </section>
  );
}
