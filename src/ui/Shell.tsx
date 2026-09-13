import { useEffect, useState } from "react";
import raceData from "../data/race.json";
import type { RaceData } from "../game/scoring.ts";
import { dayNumber, sentenceIndex } from "../game/daily.ts";
import { load, save, finishDay, currentStreak, type Store } from "../game/store.ts";
import { award, shownTitle, TITLES, type TitleDef, type TitleEvent } from "../game/titles.ts";
import { start } from "../engine/client.ts";
import Race from "./Race.tsx";
import Steer from "./Steer.tsx";
import Break from "./Break.tsx";
import Why from "./Why.tsx";
import Titles from "./Titles.tsx";
import TitleSheet from "./TitleSheet.tsx";

const data = raceData as RaceData;
type View = "race" | "steer" | "break" | "why" | "titles";
const TABS = [["race", "Race it"], ["steer", "Steer it"], ["break", "Break it"]] as const;

export default function Shell() {
  const [view, setView] = useState<View>("race");
  const [store, setStore] = useState(load);
  const [practice, setPractice] = useState<number | null>(null);
  const [queue, setQueue] = useState<TitleDef[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => save(store), [store]);

  // let the result land before a title unlock covers it
  const pending = queue.length > 0;
  useEffect(() => {
    if (!pending) { setSheetOpen(false); return; }
    const t = setTimeout(() => setSheetOpen(true), 900);
    return () => clearTimeout(t);
  }, [pending]);

  const day = Math.max(1, dayNumber());
  const n = data.sentences.length;
  const index = practice ?? sentenceIndex(day, n);
  const sentence = data.sentences[index];
  const saved = practice === null ? store.days[day] : undefined;
  const initial = saved?.opening === sentence.opening ? saved.guesses : [];
  const earned = TITLES.filter((t) => store.titles[t.id]).length;
  const unseen = earned > store.seenTitles;

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
  const daily = practice === null;

  return (
    <div className="app">
      <header className="top">
        <button className="mark" onClick={() => { setPractice(null); go("race"); }}>just guessing<i>_</i></button>
        <div className="top-actions">
          <button
            className="pill titles-pill"
            onClick={() => go(view === "titles" ? "race" : "titles")}
            aria-label={view === "titles" ? "Play" : `Titles, ${earned} of ${TITLES.length} earned${unseen ? ", new ones to see" : ""}`}
          >
            {view === "titles" ? "Play" : <>Titles<b>{earned}/{TITLES.length}</b>{unseen && <i className="new-dot" />}</>}
          </button>
          <button className="pill" onClick={() => go(view === "why" ? "race" : "why")}>{view === "why" ? "Play" : "Why"}</button>
        </div>
      </header>
      {(view === "race" || view === "steer" || view === "break") && (
        <nav className="tabs" aria-label="Modes">
          {TABS.map(([v, label]) => (
            <button key={v} className={view === v ? "on" : ""} aria-current={view === v ? "page" : undefined} onClick={() => go(v)}>{label}</button>
          ))}
        </nav>
      )}
      {view === "race" && (
        <Race
          key={`${practice ?? "day"}-${index}`}
          sentence={sentence}
          day={day}
          practice={!daily}
          initial={initial}
          streak={currentStreak(store, day)}
          title={shownTitle(store)}
          counted={store.counted.includes(day)}
          onProgress={(guesses) => {
            if (daily) update((s) => ({ ...s, days: { ...s.days, [day]: { opening: sentence.opening, guesses } } }));
          }}
          onFinish={(grades) => update(
            (s) => (daily ? finishDay(s, day) : s),
            (s) => ({ kind: "race", grades, daily, streak: s.streak, crowd: null }),
          )}
          onCounted={() => update((s) => (s.counted.includes(day) ? s : { ...s, counted: [...s.counted, day] }))}
          onCrowd={(grades, crowd) => update((s) => s, (s) => ({ kind: "race", grades, daily: true, streak: currentStreak(s, day), crowd }))}
          onTitles={() => go("titles")}
          onPractice={practiceAnother}
          onWhy={() => go("why")}
          onGo={go}
        />
      )}
      {view === "steer" && <Steer onReceipt={(ranks, odds) => update((s) => s, () => ({ kind: "steer", ranks, odds }))} />}
      {view === "break" && <Break onAnswer={(prompt, choices, probe) => update((s) => s, () => ({ kind: "break", prompt, choices, probe }))} />}
      {view === "why" && <Why onPlay={() => go("race")} />}
      {view === "titles" && <Titles store={store} onWear={wear} onPlay={() => go("race")} />}
      {sheetOpen && queue.length > 0 && <TitleSheet queue={queue} wearing={store.wearing} onWear={wear} onDone={() => setQueue([])} />}
    </div>
  );
}
