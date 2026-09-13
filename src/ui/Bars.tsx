import type { Round } from "../game/scoring.ts";
import { pct } from "../game/scoring.ts";
import { normalise } from "../game/words.ts";

type Row = { w: string; p: number | null; rank: number | null; top?: boolean; you?: boolean; truth?: boolean };

// Bars are drawn on an absolute scale, so 12% fills an eighth of the row. When
// the machine is unsure every bar is short, and that emptiness is the lesson.
export default function Bars({ round, guess, truth }: { round: Round; guess: string; truth: string }) {
  const g = normalise(guess), t = normalise(truth);
  const top: Row[] = round.words.slice(0, 6).map(([w, p], i) => ({
    w, p, rank: i + 1, top: i === 0, you: !!g && normalise(w) === g, truth: normalise(w) === t,
  }));
  const shown = (x: string) => top.some((row) => normalise(row.w) === x);
  const extra: Row[] = [];
  if (g && g !== t && !shown(g)) {
    const i = round.words.findIndex(([w]) => normalise(w) === g);
    extra.push(i >= 0 ? { w: round.words[i][0], p: round.words[i][1], rank: i + 1, you: true } : { w: guess, p: null, rank: null, you: true });
  }
  if (!shown(t)) extra.push({ w: truth, p: round.truthP, rank: round.rank, truth: true, you: g === t });

  return (
    <div>
      <ol className="bars" aria-label="The machine's top guesses and its odds">
        {top.map((row, i) => <Bar key={row.w} row={row} i={i} />)}
      </ol>
      {extra.length > 0 && (
        <ol className="bars extra">
          {extra.map((row, i) => <Bar key={`${row.w}-${i}`} row={row} i={i + 6} />)}
        </ol>
      )}
    </div>
  );
}

function Bar({ row, i }: { row: Row; i: number }) {
  const cls = ["bar", row.top && "top", row.you && "you", row.truth && "truth"].filter(Boolean).join(" ");
  const label = row.p === null ? "not on its list"
    : row.rank === null ? `${pct(row.p)}, off its list`
    : row.rank > 6 ? `#${row.rank}, ${pct(row.p)}`
    : pct(row.p);
  return (
    <li className={cls}>
      <span className="fill" style={{ width: `${Math.max(1.5, (row.p ?? 0) * 100)}%`, animationDelay: `${i * 45}ms` }} />
      <span className="word">
        {row.w}
        {row.top && <span className="tag mach">its pick</span>}
        {row.you && <span className="tag you">you</span>}
        {row.truth && <span className="tag truth">real word</span>}
      </span>
      <span className="pct">{label}</span>
    </li>
  );
}
