import type { Rarity } from "../game/titles.ts";

// A title's mark is a tiny odds chart, five bars drawn from its id, so every
// title has its own shape and the collection still reads as one family.
function lengths(id: string): number[] {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Array.from({ length: 5 }, (_, i) => {
    h = Math.imul(h ^ (i + 7), 16777619) >>> 0;
    return 0.3 + ((h % 1000) / 1000) * 0.7;
  });
}

type Props = { id: string; rarity: Rarity; earned: boolean; size?: number; animate?: boolean };

export default function Emblem({ id, rarity, earned, size = 48, animate = false }: Props) {
  const bars = lengths(id);
  const lead = bars.indexOf(Math.max(...bars));
  return (
    <svg
      className={["emblem", rarity, earned ? "earned" : "locked", animate ? "grow" : ""].join(" ").trim()}
      width={size} height={size} viewBox="0 0 56 56" aria-hidden="true"
    >
      <rect className="plate" x="1" y="1" width="54" height="54" rx="15" />
      {bars.map((w, i) => (
        <rect key={i} className={i === lead ? "bar lead" : "bar"} x="10" y={10 + i * 8} width={36 * w} height="5" rx="2.5" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </svg>
  );
}
