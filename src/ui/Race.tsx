import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Grade, RaceSentence } from "../game/scoring.ts";
import { grade, insight, shareLine, shareText, square, tally } from "../game/scoring.ts";
import { normalise } from "../game/words.ts";
import { untilTomorrow } from "../game/daily.ts";
import { patchDay, readAll, readDay, standing, submit, teamLine, type CrowdAll, type CrowdDay } from "../game/crowd.ts";
import type { TitleDef } from "../game/titles.ts";
import Sentence, { type Mark } from "./Sentence.tsx";
import Bars from "./Bars.tsx";
import CrowdPanel from "./CrowdPanel.tsx";
import Emblem from "./Emblem.tsx";

type Props = {
  sentence: RaceSentence;
  day: number;
  practice: boolean;
  initial: string[];
  streak: number;
  title: TitleDef | null;
  counted: boolean;
  onProgress: (guesses: string[]) => void;
  onFinish: (grades: Grade[]) => void;
  onCounted: () => void;
  onCrowd: (grades: Grade[], crowd: CrowdDay) => void;
  onTitles: () => void;
  onPractice: () => void;
  onWhy: () => void;
  onGo: (mode: "steer" | "break") => void;
};

const quote = (w: string) => `“${w}”`;

export default function Race(props: Props) {
  const { sentence, day, practice, initial, streak, title, counted, onProgress, onFinish, onCounted, onCrowd, onTitles, onPractice, onWhy, onGo } = props;
  const [guesses, setGuesses] = useState(initial);
  const [phase, setPhase] = useState<"guess" | "reveal" | "done">(initial.length >= 5 ? "done" : "guess");
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [crowd, setCrowd] = useState<CrowdDay | null>(null);
  const [all, setAll] = useState<CrowdAll | null>(null);
  const [crowdStatus, setCrowdStatus] = useState<"loading" | "ready" | "off">(practice ? "off" : "loading");
  const finished = useRef(false);
  const mounted = useRef(true);

  const grades = useMemo(
    () => guesses.map((g, i) => grade(g, sentence.rounds[i], sentence.truth[i])),
    [guesses, sentence],
  );
  const { you, machine } = tally(grades);
  const machineToday = useMemo(
    () => sentence.rounds.filter((round, i) => normalise(round.words[0]?.[0] ?? "") === normalise(sentence.truth[i])).length,
    [sentence],
  );
  const r = phase === "reveal" ? guesses.length - 1 : guesses.length;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Who is winning today, shown before the first blank so you know the stakes.
  // Kept for the finish too, which then only has to send its own increments.
  const before = useRef<{ day: CrowdDay | null; all: CrowdAll | null }>({ day: null, all: null });
  useEffect(() => {
    if (practice || initial.length >= 5) return;
    Promise.all([readDay(day), readAll()]).then(([c, a]) => {
      before.current = { day: c, all: a };
      if (mounted.current && c) setCrowd(c);
    });
  }, [practice, day]);

  // A finished race earns its titles. A daily one also joins the live count,
  // then reads it back so the result can show where you stand.
  useEffect(() => {
    if (phase !== "done" || finished.current) return;
    finished.current = true;
    onFinish(grades);
    if (practice) return;
    (async () => {
      let c: CrowdDay | null = null;
      let a: CrowdAll | null = before.current.all;
      if (!counted) {
        const moved = await submit(day, grades);
        onCounted();
        if (before.current.day) c = patchDay(day, before.current.day, moved);
        if (a) a = { humans: moved["all-humans"] ?? a.humans, machine: moved["all-machine"] ?? a.machine, draws: moved["all-draws"] ?? a.draws };
      }
      // nothing earlier to build on, as when a finished day is reopened, so read it all fresh
      if (!c) [c, a] = await Promise.all([readDay(day, true), a ? Promise.resolve(a) : readAll()]);
      if (!mounted.current) return;
      if (!c || !c.plays) { setCrowdStatus("off"); return; }
      setCrowd(c);
      setAll(a);
      setCrowdStatus("ready");
      onCrowd(grades, c);
    })();
  }, [phase]);

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

  const advance = () => setPhase(guesses.length < 5 ? "guess" : "done");

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
        {r === 0 && !practice && crowd && <p className="crowd-mini"><i className="live-dot" />{teamLine(crowd, machineToday)}</p>}
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
  const place = crowdStatus === "ready" && crowd ? standing(crowd, you) : null;
  const flex = !place || !place.others || !place.below ? ""
    : place.below === place.others ? "Beat every human who played today"
    : `Beat ${Math.round((100 * place.below) / place.others)}% of humans today`;
  const text = shareText(day, grades, new URL(import.meta.env.BASE_URL, location.origin).href, [title ? `Wearing ${title.name}` : "", flex]);
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
        {title && (
          <button className="wear" onClick={onTitles} aria-label={`Wearing ${title.name}. See your titles`}>
            <Emblem id={title.id} rarity={title.rarity} earned size={30} />
            <span><small>Wearing</small>{title.name}</span>
          </button>
        )}
      </div>
      {practice ? (
        <p className="small">Practice races do not join the live count.</p>
      ) : (
        <>
          <div className="actions">
            <button className="btn" onClick={copy}>Copy result</button>
            {"share" in navigator && <button className="btn ghost" onClick={share}>Share</button>}
          </div>
          <p className="small">Streak {streak} · new sentence in {untilTomorrow()}</p>
          <CrowdPanel grades={grades} truth={sentence.truth} crowd={crowd} all={all} status={crowdStatus} />
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
