import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RARITY_LABEL, type TitleDef } from "../game/titles.ts";
import Emblem from "./Emblem.tsx";

const COLORS = ["var(--both)", "var(--you)", "var(--mach-deep)", "var(--ink)"];

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

export default function TitleSheet({ queue, wearing, onWear, onDone }: Props) {
  const [i, setI] = useState(0);
  const primary = useRef<HTMLButtonElement>(null);
  const t = queue[i];

  useEffect(() => {
    primary.current?.focus();
    if (t) navigator.vibrate?.(t.rarity === "legendary" ? [18, 50, 18] : 22);
  }, [t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  if (!t) return null;
  const last = i >= queue.length - 1;
  const next = () => (last ? onDone() : setI(i + 1));

  return (
    <div className="sheet-backdrop" onClick={onDone}>
      <div key={t.id} className={`sheet ${t.rarity}`} role="dialog" aria-modal="true" aria-labelledby="sheet-name" onClick={(e) => e.stopPropagation()}>
        {t.rarity === "legendary" && <Confetti />}
        <p className="sheet-kicker">{queue.length > 1 ? `Title unlocked, ${i + 1} of ${queue.length}` : "Title unlocked"}</p>
        <Emblem id={t.id} rarity={t.rarity} earned size={96} animate />
        <h2 id="sheet-name" className="sheet-name">{t.name}</h2>
        <span className={`rarity-tag ${t.rarity}`}>{RARITY_LABEL[t.rarity]}</span>
        <p className="sheet-lesson">{t.lesson}</p>
        <div className="actions">
          <button ref={primary} className="btn" onClick={() => { onWear(t.id); next(); }}>{wearing === t.id ? "Wearing it" : "Wear it"}</button>
          <button className="btn ghost" onClick={next}>{last ? "Keep playing" : "Next title"}</button>
        </div>
      </div>
    </div>
  );
}
