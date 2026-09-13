import { pct } from "../game/scoring.ts";
import { normalise } from "../game/words.ts";

type Props = { words: [string, number][]; real?: string; realP?: number; you?: string; limit?: number };

// The AI's guesses as bars on an absolute scale, so an unsure AI really looks unsure.
// The real word and your pick get their own row when they are not in the top few.
export default function Odds({ words, real, realP, you, limit = 5 }: Props) {
  const r = real ? normalise(real) : "", y = you ? normalise(you) : "";
  const top = words.slice(0, limit);
  const shown = (x: string) => top.some(([w]) => normalise(w) === x);
  const extra: [string, number | null][] = [];
  if (r && !shown(r)) extra.push([real!, realP ?? null]);
  if (y && y !== r && !shown(y)) extra.push([you!, words.find(([w]) => normalise(w) === y)?.[1] ?? null]);

  const row = (w: string, p: number | null, i: number) => {
    const n = normalise(w);
    return (
      <li key={`${w}-${i}`} className={["odd", i === 0 && "top", n === r && "real"].filter(Boolean).join(" ")}>
        <span className="fill" style={{ width: `${Math.max(2, (p ?? 0) * 100)}%`, animationDelay: `${i * 50}ms` }} />
        <span>
          {w}
          {i === 0 && <span className="tag ai">AI's pick</span>}
          {n === r && <span className="tag real">real word</span>}
          {y && n === y && n !== r && <span className="tag you">you</span>}
        </span>
        <span className="pct">{p === null ? "not on its list" : pct(p)}</span>
      </li>
    );
  };
  return <ol className="odds">{top.map(([w, p], i) => row(w, p, i))}{extra.map(([w, p], i) => row(w, p, limit + i))}</ol>;
}
