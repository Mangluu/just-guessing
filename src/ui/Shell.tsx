import { useEffect, useState } from "react";
import raceData from "../data/race.json";
import type { RaceData } from "../game/scoring.ts";
import { dayNumber, sentenceIndex } from "../game/daily.ts";
import { load, save, finishDay, currentStreak } from "../game/store.ts";
import { start } from "../engine/client.ts";
import Race from "./Race.tsx";
import Steer from "./Steer.tsx";
import Break from "./Break.tsx";
import Why from "./Why.tsx";

const data = raceData as RaceData;
type View = "race" | "steer" | "break" | "why";
const TABS = [["race", "Race it"], ["steer", "Steer it"], ["break", "Break it"]] as const;

export default function Shell() {
  const [view, setView] = useState<View>("race");
  const [store, setStore] = useState(load);
  const [practice, setPractice] = useState<number | null>(null);
  useEffect(() => save(store), [store]);

  const day = Math.max(1, dayNumber());
  const n = data.sentences.length;
  const index = practice ?? sentenceIndex(day, n);
  const sentence = data.sentences[index];
  const saved = practice === null ? store.days[day] : undefined;
  const initial = saved?.opening === sentence.opening ? saved.guesses : [];

  function go(v: View) {
    if (v === "steer" || v === "break") start(); // the model downloads only once someone asks for it
    setView(v);
    window.scrollTo(0, 0);
  }

  function practiceAnother() {
    let next = Math.floor(Math.random() * (n - 1));
    if (next >= index) next++;
    setPractice(next);
    go("race");
  }

  return (
    <div className="app">
      <header className="top">
        <button className="mark" onClick={() => { setPractice(null); go("race"); }}>just guessing<i>_</i></button>
        <button className="pill" onClick={() => go(view === "why" ? "race" : "why")}>{view === "why" ? "Play" : "Why"}</button>
      </header>
      {view !== "why" && (
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
          practice={practice !== null}
          initial={initial}
          streak={currentStreak(store, day)}
          onProgress={(guesses) => {
            if (practice === null) setStore((s) => ({ ...s, days: { ...s.days, [day]: { opening: sentence.opening, guesses } } }));
          }}
          onFinish={() => { if (practice === null) setStore((s) => finishDay(s, day)); }}
          onPractice={practiceAnother}
          onWhy={() => go("why")}
          onGo={go}
        />
      )}
      {view === "steer" && <Steer />}
      {view === "break" && <Break />}
      {view === "why" && <Why onPlay={() => go("race")} />}
    </div>
  );
}
