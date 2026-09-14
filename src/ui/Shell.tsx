import { useEffect, useRef, useState } from "react";
import raceData from "../data/race.json";
import type { RaceData } from "../game/scoring.ts";
import { grade, tally } from "../game/scoring.ts";
import { dayNumber, sentenceIndex } from "../game/daily.ts";
import { load, save, finishDay, currentStreak, type Store } from "../game/store.ts";
import { award, shownTitle, TITLES, type TitleDef, type TitleEvent } from "../game/titles.ts";
import { start } from "../engine/client.ts";
import Bot from "./Bot.tsx";
import Intro from "./Intro.tsx";
import Home from "./Home.tsx";
import Race from "./Race.tsx";
import Steer from "./Steer.tsx";
import Break from "./Break.tsx";
import Why from "./Why.tsx";
import Titles from "./Titles.tsx";
import TitleSheet from "./TitleSheet.tsx";
import ThemeToggle from "./ThemeToggle.tsx";
import SoundButton from "./SoundButton.tsx";

const data = raceData as RaceData;
type View = "intro" | "home" | "race" | "steer" | "break" | "titles" | "about";
const PAGE: Record<View, string> = {
  intro: "How to play", home: "", race: "Today's race", steer: "Build a sentence",
  break: "Trick the AI", titles: "Your titles", about: "For parents and teachers",
};

export default function Shell() {
  const [store, setStore] = useState(load);
  const [view, setView] = useState<View>(() => (store.introDone ? "home" : "intro"));
  const [practice, setPractice] = useState<number | null>(null);
  const [queue, setQueue] = useState<TitleDef[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const opened = useRef(false);
  useEffect(() => save(store), [store]);

  // let the result land before a title unlock covers it
  const pending = queue.length > 0;
  useEffect(() => {
    if (!pending) { setSheetOpen(false); return; }
    const t = setTimeout(() => setSheetOpen(true), 900);
    return () => clearTimeout(t);
  }, [pending]);

  // Each screen names the tab, and keyboard and screen reader users start at its heading.
  useEffect(() => {
    const name = view === "race" && practice !== null ? "Practice race" : PAGE[view];
    document.title = name ? `${name} · Just Guessing` : "Just Guessing";
    if (!opened.current) { opened.current = true; return; }
    const h = document.querySelector<HTMLElement>("main h1");
    if (h) { h.tabIndex = -1; h.focus(); }
  }, [view, practice]);

  const day = Math.max(1, dayNumber());
  const n = data.sentences.length;
  const today = sentenceIndex(day, n);
  const index = practice ?? today;
  const sentence = data.sentences[index];
  const saved = store.days[day];
  const todayGuesses = saved?.opening === data.sentences[today].opening ? saved.guesses : [];
  const initial = practice === null ? todayGuesses : [];
  const todayResult = todayGuesses.length >= 5
    ? tally(todayGuesses.map((g, i) => grade(g, data.sentences[today].rounds[i], data.sentences[today].truth[i])))
    : null;
  const earned = TITLES.filter((t) => store.titles[t.id]).length;
  const unseen = earned > store.seenTitles;
  const daily = practice === null;

  // One place changes the store, so a title can never be awarded twice.
  function update(step: (s: Store) => Store, event?: (s: Store) => TitleEvent) {
    setStore((s) => {
      const next = step(s);
      if (!event) return next;
      const r = award(next, event(next));
      if (r.unlocked.length) setQueue((q) => [...q, ...r.unlocked.filter((t) => !q.some((x) => x.id === t.id))]);
      return r.store;
    });
  }

  function go(v: View) {
    if (v === "steer" || v === "break") start(); // the model downloads only once someone asks for it
    if (v === "titles") update((s) => ({ ...s, seenTitles: TITLES.filter((t) => s.titles[t.id]).length }));
    setView(v);
    window.scrollTo(0, 0);
  }

  function practiceAnother() {
    let next = Math.floor(Math.random() * (n - 1));
    if (next >= index) next++;
    setPractice(next);
    go("race");
  }

  const wear = (id: string) => update((s) => ({ ...s, wearing: id }));
  const home = () => go("home");

  return (
    <div className="app">
      {view !== "intro" && (
        <header className="top">
          <button className="logo" aria-label="just guessing, home" onClick={() => { setPractice(null); home(); }}><Bot size={30} /><span className="logo-text">just guessing</span></button>
          <div className="top-actions">
            <button className="chip-btn" onClick={() => go("titles")} aria-label={`Titles, ${earned} of ${TITLES.length} earned${unseen ? ", new ones to see" : ""}`}>
              <span className="chip-word">Titles</span> <b>{earned}/{TITLES.length}</b>{unseen && <i className="new-dot" />}
            </button>
            <SoundButton />
            <ThemeToggle />
            <button className="chip-btn" onClick={() => go("intro")} aria-label="How to play">?</button>
          </div>
        </header>
      )}

      <main>
        {view === "intro" && (
          <Intro onDone={(next) => { update((s) => ({ ...s, introDone: true })); setPractice(null); go(next); }} />
        )}
        {view === "home" && (
          <Home
            day={day} result={todayResult ? { you: todayResult.you, ai: todayResult.machine } : null} progress={todayGuesses.length}
            streak={currentStreak(store, day)} earned={earned} total={TITLES.length}
            onRace={() => { setPractice(null); go("race"); }} onSteer={() => go("steer")} onBreak={() => go("break")}
            onTitles={() => go("titles")} onHelp={() => go("intro")} onAbout={() => go("about")}
          />
        )}
        {view === "race" && (
          <Race
            key={`${practice ?? "day"}-${index}`}
            sentence={sentence} day={day} practice={!daily} initial={initial}
            streak={currentStreak(store, day)} title={shownTitle(store)} counted={store.counted.includes(day)}
            onProgress={(guesses) => { if (daily) update((s) => ({ ...s, days: { ...s.days, [day]: { opening: sentence.opening, guesses } } })); }}
            onFinish={(grades) => update((s) => (daily ? finishDay(s, day) : s), (s) => ({ kind: "race", grades, daily, streak: s.streak, crowd: null }))}
            onCounted={() => update((s) => (s.counted.includes(day) ? s : { ...s, counted: [...s.counted, day] }))}
            onCrowd={(grades, crowd) => update((s) => s, (s) => ({ kind: "race", grades, daily: true, streak: currentStreak(s, day), crowd }))}
            onTitles={() => go("titles")} onPractice={practiceAnother} onHome={home} onGo={go}
          />
        )}
        {view === "steer" && <Steer onHome={home} onReceipt={(ranks, odds) => update((s) => s, () => ({ kind: "steer", ranks, odds }))} />}
        {view === "break" && <Break onHome={home} onAnswer={(prompt, choices, probe) => update((s) => s, () => ({ kind: "break", prompt, choices, probe }))} />}
        {view === "about" && <Why onPlay={home} />}
        {view === "titles" && <Titles store={store} onWear={wear} onPlay={home} />}
      </main>
      {sheetOpen && queue.length > 0 && <TitleSheet queue={queue} wearing={store.wearing} onWear={wear} onDone={() => setQueue([])} />}
    </div>
  );
}
