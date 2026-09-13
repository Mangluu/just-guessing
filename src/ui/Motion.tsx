import { useLayoutEffect, useRef } from "react";
import { animate, utils } from "animejs";

/** True when the device asks for less motion. Every animation in the game checks this first. */
export const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const COLORS = ["var(--gold)", "var(--you)", "var(--ai)", "var(--good)"];

/** A quick shower of squares, the same squares as the share grid, for a win. */
export function burst(host: Element | null, count = 16) {
  if (!host || calm()) return;
  const layer = document.createElement("span");
  layer.className = "burst";
  layer.setAttribute("aria-hidden", "true");
  const bits = Array.from({ length: count }, (_, i) => {
    const bit = layer.appendChild(document.createElement("i"));
    bit.style.background = COLORS[i % COLORS.length];
    return bit;
  });
  host.appendChild(layer);
  animate(bits, {
    x: () => utils.random(-110, 110),
    y: () => utils.random(-100, 30),
    rotate: () => utils.random(-240, 240),
    scale: { from: 1.2, to: 0.2 },
    opacity: { from: 1, to: 0 },
    duration: () => utils.random(550, 850),
    ease: "outCubic",
    onComplete: () => layer.remove(),
  });
}

/** A number that counts up when it appears. Screen readers only get the final number. */
export function CountUp({ value }: { value: number }) {
  const el = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const text = (n: number) => Math.round(n).toLocaleString("en-US");
    if (calm()) { node.textContent = text(value); return; }
    const state = { n: 0 };
    node.textContent = text(0);
    const a = animate(state, { n: value, duration: 800, ease: "outExpo", onUpdate: () => { node.textContent = text(state.n); } });
    return () => { a.cancel(); };
  }, [value]);
  return <><span ref={el} aria-hidden="true" /><span className="sr-only">{value.toLocaleString("en-US")}</span></>;
}
