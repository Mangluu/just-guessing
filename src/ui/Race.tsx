import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { animate, stagger, utils } from "animejs";
import type { Grade, RaceSentence } from "../game/scoring.ts";
import { grade, insight, pct, shareText, square, tally } from "../game/scoring.ts";
import { normalise } from "../game/words.ts";
import { untilTomorrow } from "../game/daily.ts";
import { optionsFor, seedOf } from "../game/options.ts";
import { patchDay, readAll, readDay, standing, submit, teamLine, type CrowdAll, type CrowdDay } from "../game/crowd.ts";
import type { TitleDef } from "../game/titles.ts";
import Bot from "./Bot.tsx";
import Choices from "./Choices.tsx";
import CrowdPanel from "./CrowdPanel.tsx";
import Emblem from "./Emblem.tsx";
import Guesses, { feel } from "./Guesses.tsx";
import Mark, { Gap } from "./Mark.tsx";
import { burst, calm, CountUp } from "./Motion.tsx";
import Verdict from "./Verdict.tsx";

type Props = {
  sentence: RaceSentence; day: number; practice: boolean; initial: string[]; streak: number;
  title: TitleDef | null; counted: boolean;
  onProgress: (guesses: string[]) => void; onFinish: (grades: Grade[]) => void; onCounted: () => void;
  onCrowd: (grades: Grade[], crowd: CrowdDay) => void; onTitles: () => void; onPractice: () => void;
  onHome: () => void; onGo: (mode: "steer" | "break") => void;
};

export default function Race(props: Props) {
  const { sentence, day, practice, initial, streak, title, counted, onProgress, onFinish, onCounted, onCrowd, onTitles, onPractice, onHome, onGo } = props;
  const [guesses, setGuesses] = useState(initial);
  const [phase, setPhase] = useState<"guess" | "reveal" | "done">(initial.length >= 5 ? "done" : "guess");
  const [toast, setToast] = useState("");
  const [crowd, setCrowd] = useState<CrowdDay | null>(null);
  const [all, setAll] = useState<CrowdAll | null>(null);
  const [crowdStatus, setCrowdStatus] = useState<"loading" | "ready" | "off">(practice ? "off" : "loading");
  const finished = useRef(false), mounted = useRef(true), moved = useRef(false);
  const story = useRef<HTMLParagraphElement>(null), heading = useRef<HTMLHeadingElement>(null), result = useRef<HTMLDivElement>(null);
  const youNum = useRef<HTMLElement>(null), aiNum = useRef<HTMLElement>(null), youPlus = useRef<HTMLSpanElement>(null), aiPlus = useRef<HTMLSpanElement>(null);
  const before = useRef<{ day: CrowdDay | null; all: CrowdAll | null }>({ day: null, all: null });

  const grades = useMemo(() => guesses.map((g, i) => grade(g, sentence.rounds[i], sentence.truth[i])), [guesses, sentence]);
  const { you, machine } = tally(grades);
  const scored = useRef({ you, machine });
  const machineToday = useMemo(() => sentence.rounds.filter((rd, i) => normalise(rd.words[0]?.[0] ?? "") === normalise(sentence.truth[i])).length, [sentence]);
  const r = phase === "reveal" ? guesses.length - 1 : guesses.length;
  const options = r < 5 ? optionsFor(sentence.rounds[r], sentence.truth[r], seedOf(`${sentence.opening}|${r}`)) : [];

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // Who is winning today, shown before the first word. Kept so the finish only sends its own increments.
  useEffect(() => {
    if (practice || initial.length >= 5) return;
    Promise.all([readDay(day), readAll()]).then(([c, a]) => {
      before.current = { day: c, all: a };
      if (mounted.current && c) setCrowd(c);
    });
  }, [practice, day]);

  // A finished race earns titles. A daily one also joins the live count.
  useEffect(() => {
    if (phase !== "done" || finished.current) return;
    finished.current = true;
    onFinish(grades);
    if (practice) return;
    (async () => {
      let c: CrowdDay | null = null, a: CrowdAll | null = before.current.all;
      if (!counted) {
        const moved = await submit(day, grades);
        onCounted();
        if (before.current.day) c = patchDay(day, before.current.day, moved);
        if (a) a = { humans: moved["all-humans"] ?? a.humans, machine: moved["all-machine"] ?? a.machine, draws: moved["all-draws"] ?? a.draws };
      }
      if (!c) [c, a] = await Promise.all([readDay(day, true), a ? Promise.resolve(a) : readAll()]);
      if (!mounted.current) return;
      if (!c || !c.plays) { setCrowdStatus("off"); return; }
      setCrowd(c); setAll(a); setCrowdStatus("ready"); onCrowd(grades, c);
    })();
  }, [phase]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 1800); return () => clearTimeout(t); }, [toast]);

  // number keys pick a word on a keyboard
  useEffect(() => {
    if (phase !== "guess") return;
    const onKey = (e: KeyboardEvent) => { const i = Number(e.key) - 1; if (i >= 0 && i < options.length) pick(options[i]); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Keyboard and screen reader users go back to the sentence for each new word, and to the heading at the end.
  useEffect(() => {
    if (!moved.current) { moved.current = true; return; }
    if (phase === "guess") story.current?.focus();
    if (phase === "done") heading.current?.focus();
  }, [phase]);

  // A point lands with a bump on the score and a +1 that floats away.
  useEffect(() => {
    const was = scored.current;
    scored.current = { you, machine };
    if (calm()) return;
    const lands = [
      { up: you > was.you, num: youNum.current, plus: youPlus.current, delay: 380 },
      { up: machine > was.machine, num: aiNum.current, plus: aiPlus.current, delay: 620 },
    ];
    const anims = lands.flatMap(({ up, num, plus, delay }) => (up && num && plus ? [
      animate(num, { scale: { from: 1.9, to: 1 }, duration: 650, delay, ease: "outElastic(1, .5)" }),
      animate(plus, { opacity: { from: 1, to: 0 }, y: { from: 0, to: -24 }, duration: 850, delay, ease: "outQuad" }),
    ] : []));
    return () => anims.forEach((a) => a.revert());
  }, [you, machine]);

  // The result: the verdict pops, each word slides in, and a win gets confetti.
  useLayoutEffect(() => {
    const root = result.current;
    if (phase !== "done" || !root || calm()) return;
    const big = root.querySelectorAll(".verdict-big"), rows = root.querySelectorAll(".rounds tbody tr");
    utils.set([...big, ...rows], { opacity: 0 });
    const anims = [
      animate(big, { scale: { from: 0.3, to: 1 }, opacity: { from: 0, to: 1 }, duration: 750, delay: 150, ease: "outElastic(1, .5)" }),
      animate(rows, { opacity: { from: 0, to: 1 }, x: { from: -14, to: 0 }, duration: 320, delay: stagger(90, { start: 300 }), ease: "outCubic" }),
    ];
    const t = you > machine ? setTimeout(() => burst(root), 700) : undefined;
    return () => { anims.forEach((a) => a.revert()); clearTimeout(t); };
  }, [phase]);

  function pick(word: string) {
    if (phase !== "guess") return;
    const next = [...guesses, word];
    setGuesses(next);
    setPhase("reveal");
    onProgress(next);
  }

  if (phase !== "done") {
    const g = phase === "reveal" ? grades[r] : null;
    const round = sentence.rounds[r];
    const count = Math.max(1, Math.round(round.effective));
    const f = feel(count);
    const said = !g ? "" : [
      g.youRight ? `Right. The word was ${sentence.truth[r]}.` : `Not quite. You picked ${g.guess}. The word was ${sentence.truth[r]}.`,
      g.machineRight ? `The AI got it too. It was ${pct(g.machineP)} sure.` : `The AI guessed ${g.machineWord}. It was ${pct(g.machineP)} sure.`,
    ].join(" ");
    return (
      <section className="stack">
        <h1 className="sr-only">{practice ? "Practice race" : "Today's race"}</h1>
        <p className="sr-only" role="status">{said}</p>
        <div className="race-top">
          <button className="link back" onClick={onHome}>Home</button>
          <div className="dots" role="img" aria-label={`Word ${r + 1} of 5`}>
            {[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < grades.length ? (grades[i].youRight ? "got" : "missed") : i === r ? "now" : ""} />)}
          </div>
          <div className="scores" role="img" aria-label={`Score, you ${you}, AI ${machine}`}>
            <span className="you-score">You <b ref={youNum}>{you}</b><span ref={youPlus} className="plus" aria-hidden="true">+1</span></span>
            <span className="ai-score"><Bot size={24} mood={g ? (g.machineRight ? "happy" : "oops") : "thinking"} />AI <b ref={aiNum}>{machine}</b><span ref={aiPlus} className="plus" aria-hidden="true">+1</span></span>
          </div>
        </div>
        {r === 0 && !g && !practice && crowd && <p className="team-line"><i className="live-dot" />{teamLine(crowd, machineToday)}</p>}
        <p ref={story} tabIndex={-1} className="story card">
          {sentence.opening}{" "}{sentence.truth.slice(0, r).join(" ")}{r > 0 ? " " : ""}
          {g ? <span className="filled">{sentence.truth[r]}</span> : <Gap />}
          {g && r === 4 ? sentence.end : ""}
        </p>
        <p className="ask">{g ? "Green is the real word" : "Which word comes next?"}</p>
        <Choices options={options} reveal={g ? { real: sentence.truth[r], you: g.guess, ai: g.machineWord } : null} onPick={pick} shortcuts />
        {!g && r === 0 && <p className="kbd-tip">You can press 1, 2, 3 or 4 to pick a word.</p>}
        {!g && <p className="ai-wait"><Bot size={30} mood="thinking" />The AI has picked its word. Now you pick.</p>}
        {g && (
          <div className="card think">
            <div className="think-head">
              <Bot size={48} mood={f.mood} />
              <div>
                <p className="kicker">How the AI guessed</p>
                <strong>{f.text.replace("It is", "It was")}</strong>
                <p>Choosing between about <CountUp value={count} /> {count === 1 ? "word" : "words"}</p>
              </div>
            </div>
            <Guesses words={round.words} real={sentence.truth[r]} realP={round.truthP} you={g.guess} delay={500} />
            <p className="muted">{insight(g, round.effective)}</p>
          </div>
        )}
        {g && <Verdict key={r} youRight={g.youRight} aiRight={g.machineRight} truth={sentence.truth[r]} aiWord={g.machineWord} next={r < 4 ? "Next word" : "See who won"} onNext={() => setPhase(guesses.length < 5 ? "guess" : "done")} />}
      </section>
    );
  }

  const place = crowdStatus === "ready" && crowd ? standing(crowd, you) : null;
  const flex = !place || !place.others || !place.below ? "" : place.below === place.others ? "Beat every human who played today" : `Beat ${Math.round((100 * place.below) / place.others)}% of humans today`;
  const text = shareText(day, grades, new URL(import.meta.env.BASE_URL, location.origin).href, [title ? `Wearing ${title.name}` : "", flex]);
  const share = async () => {
    try {
      if (typeof navigator.share === "function") await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setToast("Copied. Paste it anywhere."); }
    } catch { /* closed the share sheet */ }
  };

  return (
    <section className="stack">
      <div ref={result} className="card result-card">
        <h1 ref={heading} tabIndex={-1} className="kicker">{practice ? "Practice round" : `Today's race, day ${day}`}</h1>
        <div className="final">
          <div className="side"><span>You</span><b className="you-t"><CountUp value={you} /></b></div>
          <p className="verdict-big">{you > machine ? "You win!" : you === machine ? "It is a draw" : "The AI wins"}</p>
          <div className="side"><Bot size={30} mood={machine > you ? "happy" : "oops"} /><span className="sr-only">AI</span><b className="ai-t"><CountUp value={machine} /></b></div>
        </div>
        <p className="story small">
          {sentence.opening}{" "}{sentence.truth.map((w, i) => <span key={i}><b>{w}</b>{i < 4 ? " " : ""}</span>)}{sentence.end}
        </p>
        <table className="rounds">
          <caption className="sr-only">Word by word</caption>
          <thead><tr><th scope="col">Word</th><th scope="col">You</th><th scope="col">AI</th></tr></thead>
          <tbody>
            {grades.map((x, i) => (
              <tr key={i} className={x.youRight && !x.machineRight ? "beat" : undefined}>
                <td>{sentence.truth[i]}</td>
                <td><Mark ok={x.youRight} /><span className="sr-only">{x.youRight ? "got it" : "missed"}</span></td>
                <td><Mark ok={x.machineRight} /><span className="sr-only">{x.machineRight ? "got it" : "missed"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="grid" aria-hidden="true">{grades.map(square).join("")}</p>
        {title && (
          <button className="wear" onClick={onTitles} aria-label={`Wearing ${title.name}. See your titles`}>
            <Emblem id={title.id} rarity={title.rarity} earned size={30} />
            <span><small>Wearing</small>{title.name}</span>
          </button>
        )}
      </div>
      {practice ? (
        <p className="muted center">Practice rounds do not count toward today's score.</p>
      ) : (
        <>
          <button className="btn wide" onClick={share}>Share my result</button>
          <p className="muted center">Streak {streak} · new sentence in {untilTomorrow()}</p>
          <CrowdPanel grades={grades} truth={sentence.truth} crowd={crowd} all={all} status={crowdStatus} />
        </>
      )}
      <p className="kicker center">Keep playing</p>
      <div className="modes">
        <button className="card mode" onClick={() => onGo("steer")}><span className="icon build" aria-hidden="true">Aa</span><h2>Build a sentence</h2><p>Pick words from the AI's list.</p></button>
        <button className="card mode" onClick={() => onGo("break")}><span className="icon trick" aria-hidden="true">?!</span><h2>Trick the AI</h2><p>See how sure it really is.</p></button>
      </div>
      <button className="btn quiet wide" onClick={onPractice}>Practice with another sentence</button>
      <button className="link" onClick={onHome}>Back to home</button>
      {toast && <div className="toast" role="status">{toast}</div>}
    </section>
  );
}
