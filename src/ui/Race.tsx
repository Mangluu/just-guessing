import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { RaceSentence } from "../game/scoring.ts";
import { grade, insight, shareLine, shareText, square, tally } from "../game/scoring.ts";
import { normalise } from "../game/words.ts";
import { untilTomorrow } from "../game/daily.ts";
import Sentence, { type Mark } from "./Sentence.tsx";
import Bars from "./Bars.tsx";

type Props = {
  sentence: RaceSentence;
  day: number;
  practice: boolean;
  initial: string[];
  streak: number;
  onProgress: (guesses: string[]) => void;
  onFinish: () => void;
  onPractice: () => void;
  onWhy: () => void;
  onGo: (mode: "steer" | "break") => void;
};

const quote = (w: string) => `“${w}”`;

export default function Race({ sentence, day, practice, initial, streak, onProgress, onFinish, onPractice, onWhy, onGo }: Props) {
  const [guesses, setGuesses] = useState(initial);
  const [phase, setPhase] = useState<"guess" | "reveal" | "done">(initial.length >= 5 ? "done" : "guess");
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");

  const grades = useMemo(
    () => guesses.map((g, i) => grade(g, sentence.rounds[i], sentence.truth[i])),
    [guesses, sentence],
  );
  const { you, machine } = tally(grades);
  const r = phase === "reveal" ? guesses.length - 1 : guesses.length;

  // a finished day restored from storage still counts toward the streak
  useEffect(() => { if (initial.length >= 5) onFinish(); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  // Read the guess from the form itself. If Enter arrives before React has
  // re-rendered, state can lag a keystroke behind, and a disabled submit
  // button makes the browser ignore Enter altogether.
  function lock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const typed = String(new FormData(e.currentTarget).get("guess") ?? "").replace(/\s/g, "");
    if (!normalise(typed)) return;
    const next = [...guesses, typed];
    setGuesses(next);
    setDraft("");
    setPhase("reveal");
    onProgress(next);
  }

  function advance() {
    if (guesses.length < 5) return setPhase("guess");
    setPhase("done");
    onFinish();
  }

  const header = (
    <div className="meta">
      <span>{practice ? "practice" : `day ${day}`} · word {Math.min(r + 1, 5)} of 5</span>
      <span className="score"><span className="you">you {you}</span><span className="mach">machine {machine}</span></span>
    </div>
  );

  if (phase === "guess") {
    return (
      <section className="screen" key={`guess-${r}`}>
        {header}
        <Sentence opening={sentence.opening} words={sentence.truth.slice(0, r)} blank />
        <form className="guess" onSubmit={lock}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\s/g, ""))}
            name="guess"
            placeholder="the next word"
            aria-label="Your guess for the next word"
            autoFocus autoCapitalize="none" autoComplete="off" spellCheck={false} enterKeyHint="go" maxLength={24}
          />
          <button className={normalise(draft) ? "btn" : "btn idle"} aria-disabled={!normalise(draft)}>Lock it in</button>
        </form>
        <p className="hint">{r === 0 ? "Guess the next word. The machine already has." : "One word. It has already guessed this one too."}</p>
      </section>
    );
  }

  if (phase === "reveal") {
    const g = grades[r], round = sentence.rounds[r];
    return (
      <section className="screen" key={`reveal-${r}`} aria-live="polite">
        {header}
        <Sentence opening={sentence.opening} words={sentence.truth.slice(0, r + 1)} drop end={r === 4 ? sentence.end : ""} />
        <Bars round={round} guess={g.guess} truth={sentence.truth[r]} />
        <p className="verdict">
          <span className="you">{g.youRight ? "You got it" : `You said ${quote(g.guess)}`}</span>
          <span className="mach">{g.machineRight ? "It got it" : `It said ${quote(g.machineWord)}`}</span>
        </p>
        <p className="insight">{insight(g, round.effective)}</p>
        <button className="btn wide" onClick={advance} autoFocus>{r < 4 ? "Next word" : "See how it went"}</button>
      </section>
    );
  }

  const marks: Mark[] = grades.map((g) => (g.youRight && g.machineRight ? "both" : g.youRight ? "you" : g.machineRight ? "mach" : "none"));
  const text = shareText(day, grades, new URL(import.meta.env.BASE_URL, location.origin).href);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setToast("Copied"); } catch { setToast("Copying is blocked here"); }
  };
  const share = async () => { try { await navigator.share({ text }); } catch { /* closed the sheet */ } };

  return (
    <section className="screen">
      <div className="result">
        <p className="label">{practice ? "Practice sentence" : `Just Guessing, day ${day}`}</p>
        <Sentence opening={sentence.opening} words={sentence.truth} end={sentence.end} marks={marks} />
        <p className="legend"><span className="you">you got it</span><span className="mach">it got it</span><span className="both">both</span></p>
        <p className="grid" aria-label={`You ${you}, machine ${machine}`}>{grades.map(square).join("")}</p>
        <p className="tally"><span className="you">you {you}</span><span className="mach">machine {machine}</span></p>
        <p className="line">{shareLine(grades)}</p>
      </div>
      {!practice && (
        <>
          <div className="actions">
            <button className="btn" onClick={copy}>Copy result</button>
            {"share" in navigator && <button className="btn ghost" onClick={share}>Share</button>}
          </div>
          <p className="small">Streak {streak} · new sentence in {untilTomorrow()}</p>
        </>
      )}
      <div className="next">
        <p className="label">The machine behind this is small enough to run in your browser</p>
        <div className="actions">
          <button className="btn ghost" onClick={() => onGo("steer")}>Steer it</button>
          <button className="btn ghost" onClick={() => onGo("break")}>Break it</button>
        </div>
      </div>
      <button className="btn ghost wide" onClick={onPractice}>Practice with another sentence</button>
      <button className="linkish" onClick={onWhy}>Why this exists</button>
      {toast && <div className="toast" role="status">{toast}</div>}
    </section>
  );
}
