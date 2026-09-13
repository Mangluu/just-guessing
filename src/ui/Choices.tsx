import { useLayoutEffect, useRef } from "react";
import { animate, createDrawable, stagger, utils } from "animejs";
import { normalise } from "../game/words.ts";
import Bot from "./Bot.tsx";
import Mark from "./Mark.tsx";
import { calm } from "./Motion.tsx";

export type Reveal = { real: string; you: string; ai: string };
type Props = { options: string[]; reveal: Reveal | null; onPick: (word: string) => void; shortcuts?: boolean };

const same = (a: string, b: string) => normalise(a) === normalise(b);

// Four big words. After a pick the real word turns solid green, a wrong pick turns red,
// the rest fade, and a You marker and an AI marker land on the words each of you chose.
export default function Choices({ options, reveal, onPick, shortcuts = false }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const round = options.join("|");

  useLayoutEffect(() => {
    const buttons = box.current?.querySelectorAll(".choice");
    if (!buttons?.length || calm()) return;
    const a = animate(buttons, { opacity: { from: 0, to: 1 }, y: { from: 12, to: 0 }, duration: 280, delay: stagger(50), ease: "outCubic" });
    return () => { a.revert(); };
  }, [round]);

  useLayoutEffect(() => {
    const root = box.current;
    if (!reveal || !root || calm()) return;
    const you = root.querySelectorAll(".marker.you"), ai = root.querySelectorAll(".marker.ai");
    utils.set([...you, ...ai], { scale: 0 });
    const anims = [
      animate(createDrawable(root.querySelectorAll(".choice .mark path")), { draw: { from: "0 0", to: "0 1" }, duration: 320, delay: 80, ease: "outCubic" }),
      animate(root.querySelectorAll(".choice.right"), { scale: { from: 0.9, to: 1 }, duration: 650, ease: "outElastic(1, .55)" }),
      animate(root.querySelectorAll(".choice.wrong"), { keyframes: [{ x: -9 }, { x: 9 }, { x: -6 }, { x: 6 }, { x: 0 }], duration: 380, ease: "inOutSine" }),
      animate(you, { scale: { from: 0, to: 1 }, y: { from: 10, to: 0 }, duration: 420, delay: 200, ease: "outBack" }),
      animate(ai, { scale: { from: 0, to: 1 }, rotate: { from: -30, to: 0 }, duration: 480, delay: 460, ease: "outBack" }),
    ];
    return () => anims.forEach((a) => a.revert());
  }, [reveal?.you, round]);

  return (
    <div ref={box} className="choices">
      {options.map((w, i) => {
        const real = !!reveal && same(w, reveal.real);
        const mine = !!reveal && same(w, reveal.you);
        const ai = !!reveal && same(w, reveal.ai);
        const state = !reveal ? "" : real ? "right" : mine ? "wrong" : ai ? "ai-pick" : "dim";
        const roles = [real && "the real word", mine && "your pick", ai && "the AI's pick"].filter(Boolean).join(", ");
        return (
          <button key={w} className={`choice ${state}`.trim()} disabled={!!reveal} onClick={() => onPick(w)} aria-keyshortcuts={shortcuts ? String(i + 1) : undefined}>
            {(real || mine) && <Mark ok={real} />}
            {w}
            {roles && <span className="sr-only">, {roles}</span>}
            {mine && <span className="marker you" aria-hidden="true">You</span>}
            {ai && <span className="marker ai" aria-hidden="true"><Bot size={20} />AI</span>}
          </button>
        );
      })}
    </div>
  );
}
