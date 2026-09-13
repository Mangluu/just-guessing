import { useLayoutEffect, useRef } from "react";
import { animate, createDrawable, stagger, utils } from "animejs";
import Bot from "./Bot.tsx";
import Mark from "./Mark.tsx";
import { burst, calm } from "./Motion.tsx";

type Props = { youRight: boolean; aiRight: boolean; truth: string; aiWord: string; next?: string; onNext?: () => void; inline?: boolean };

// One word's result, said three ways at once: a colour, a tick or a cross, and plain words.
// In the race it pins to the bottom of the screen, where a thumb reaches the next button.
export default function Verdict({ youRight, aiRight, truth, aiWord, next, onNext, inline = false }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const beat = youRight && !aiRight;

  useLayoutEffect(() => {
    const root = box.current;
    if (!root || calm()) return;
    const icon = root.querySelector(".v-icon");
    const points = root.querySelectorAll(".v-points");
    utils.set(points, { scale: 0 });
    const anims = [
      animate(root, inline
        ? { opacity: { from: 0, to: 1 }, y: { from: 14, to: 0 }, duration: 300, ease: "outCubic" }
        : { y: { from: 170, to: 0 }, duration: 460, ease: "outBack" }),
      animate(root.querySelectorAll(".v-icon"), { scale: { from: 0, to: 1 }, rotate: { from: youRight ? -120 : 120, to: 0 }, duration: 700, delay: 140, ease: "outElastic(1, .6)" }),
      animate(createDrawable(root.querySelectorAll(".mark path")), { draw: { from: "0 0", to: "0 1" }, duration: 340, delay: stagger(240, { start: 320 }), ease: "outCubic" }),
      animate(points, { scale: { from: 0, to: 1 }, duration: 600, delay: stagger(240, { start: 420 }), ease: "outElastic(1, .5)" }),
      animate(root.querySelectorAll(".v-ai .bot"), aiRight
        ? { y: { from: 0, to: -9 }, duration: 200, delay: 580, ease: "outQuad", loop: 1, alternate: true }
        : { keyframes: [{ rotate: -14 }, { rotate: 11 }, { rotate: -7 }, { rotate: 0 }], duration: 460, delay: 580 }),
    ];
    const t = beat ? setTimeout(() => burst(icon), 380) : undefined;
    return () => { anims.forEach((a) => a.revert()); clearTimeout(t); };
  }, []);

  return (
    <div ref={box} className={`verdict ${youRight ? "yay" : "nope"}${inline ? " inline" : ""}`}>
      <div className="v-you">
        <span className="v-icon"><Mark ok={youRight} /></span>
        <div>
          <p className="v-head">{beat ? "You beat the AI!" : youRight ? "You got it!" : "Not quite!"}</p>
          {!youRight && <p className="v-sub">The word was <b>{truth}</b></p>}
        </div>
        {youRight && <span className="v-end"><span className="v-points">+1</span></span>}
      </div>
      <div className="v-ai">
        <Bot size={34} mood={aiRight ? "happy" : "oops"} />
        <span>{aiRight ? (youRight ? "The AI got it too" : "The AI got it") : `The AI guessed “${aiWord}”`}</span>
        <span className="v-end">{aiRight && <span className="v-points">+1</span>}<Mark ok={aiRight} /></span>
      </div>
      {next && onNext && <button className="btn wide" onClick={onNext} autoFocus>{next}</button>}
    </div>
  );
}
