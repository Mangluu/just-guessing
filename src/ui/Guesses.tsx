import { useLayoutEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { hundred } from "../game/hundred.ts";
import type { Mood } from "./Bot.tsx";
import { calm } from "./Motion.tsx";

/** How many words it is really choosing between, read as a feeling a kid can see. */
export function feel(n: number): { text: string; mood: Mood } {
  if (n <= 5) return { text: "It is sure", mood: "happy" };
  if (n <= 50) return { text: "It is fairly sure", mood: "idle" };
  if (n <= 300) return { text: "It is guessing", mood: "lost" };
  return { text: "It is lost", mood: "oops" };
}

const times = (count: number, p: number | null) =>
  count > 1 ? `${count} times` : count === 1 ? "once" : p === null ? "almost never" : "less than once";

type Props = { words: [string, number][]; real?: string; realP?: number; you?: string; delay?: number };

// The AI's odds as 100 little squares, one for each guess. A sure AI fills them with one
// colour. A guessing AI leaves most of them grey, spread over words too rare to name.
export default function Guesses({ words, real, realP, you, delay = 0 }: Props) {
  const slices = hundred(words, { real, realP, you });
  const grid = useRef<HTMLDivElement>(null);
  const shape = slices.map((s) => `${s.word}:${s.count}:${s.kind}`).join("|");

  useLayoutEffect(() => {
    const cells = grid.current?.querySelectorAll("i");
    if (!cells?.length || calm()) return;
    const a = animate(cells, { scale: { from: 0, to: 1 }, opacity: { from: 0, to: 1 }, duration: 300, delay: stagger(8, { start: delay }), ease: "outBack" });
    return () => { a.revert(); };
  }, [shape]);

  return (
    <figure className="guesses">
      <figcaption className="kicker">If the AI guessed 100 times</figcaption>
      <div ref={grid} className="hundred" aria-hidden="true">
        {slices.flatMap((s) => Array.from({ length: s.count }, (_, i) => <i key={`${s.word}-${i}`} className={s.kind} />))}
      </div>
      <ul className="g-legend">
        {slices.map((s) => (
          <li key={s.word} className={`g-row ${s.kind}`}>
            <i className={`sw ${s.kind}`} aria-hidden="true" />
            <span className="g-word">{s.word}</span>
            {s.ai && <span className="tag ai">AI's pick</span>}
            {s.real && <span className="tag real">real word</span>}
            {s.you && <span className="tag you">you</span>}
            <span className="g-count">{times(s.count, s.p)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
