import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RARITY_LABEL, type TitleDef } from "../game/titles.ts";
import Emblem from "./Emblem.tsx";
import { cue } from "./sound.ts";

const COLORS = ["var(--gold)", "var(--you)", "var(--ai)", "var(--good)"];

// Squares, not streamers: the same squares as the share grid.
function Confetti() {
  const bits = useMemo(
    () => Array.from({ length: 32 }, (_, i) => ({ left: (i * 37) % 100, delay: (i * 53) % 700, color: COLORS[i % 4], spin: 90 + ((i * 41) % 270) })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <span key={i} style={{ left: `${b.left}%`, animationDelay: `${b.delay}ms`, background: b.color, "--spin": `${b.spin}deg` } as CSSProperties} />
      ))}
    </div>
  );
}

type Props = { queue: TitleDef[]; wearing: string | null; onWear: (id: string) => void; onDone: () => void };

// A native modal dialog: it keeps focus inside, makes the page behind it
// inert for screen readers, and closes on Escape without any extra code.
export default function TitleSheet({ queue, wearing, onWear, onDone }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const [i, setI] = useState(0);
  const t = queue[i];

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    primary.current?.focus();
    if (t) { navigator.vibrate?.(t.rarity === "legendary" ? [18, 50, 18] : 22); cue(t.rarity === "common" ? "title" : t.rarity); }
  }, [t]);

  if (!t) return null;
  const last = i >= queue.length - 1;
  const close = () => dialog.current?.close();
  const next = () => (last ? close() : setI(i + 1));

  return (
    <dialog
      ref={dialog}
      className={`sheet ${t.rarity}`}
      aria-labelledby="sheet-name"
      onClose={onDone}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); close(); } }}
      onClick={(e) => { if (e.target === dialog.current) close(); }}
    >
      <div className="sheet-inner" key={t.id}>
        {t.rarity === "legendary" && <Confetti />}
        <p className="sheet-kicker">{queue.length > 1 ? `Title unlocked, ${i + 1} of ${queue.length}` : "Title unlocked"}</p>
        <Emblem id={t.id} rarity={t.rarity} earned size={96} animate />
        <h2 id="sheet-name" className="sheet-name">{t.name}</h2>
        <span className={`rarity-tag ${t.rarity}`}>{RARITY_LABEL[t.rarity]}</span>
        <p className="sheet-lesson">{t.lesson}</p>
        <div className="actions">
          <button ref={primary} className="btn" onClick={() => { onWear(t.id); next(); }}>{wearing === t.id ? "Wearing it" : "Wear it"}</button>
          <button className="btn quiet" onClick={next}>{last ? "Keep playing" : "Next title"}</button>
        </div>
      </div>
    </dialog>
  );
}
