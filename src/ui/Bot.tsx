// The AI, drawn as a friendly robot whose mouth is a tiny odds chart.
export type Mood = "idle" | "thinking" | "happy" | "oops" | "lost";

const EYES: Record<Mood, React.ReactNode> = {
  idle: <><circle cx="23" cy="30" r="4.5" /><circle cx="41" cy="30" r="4.5" /></>,
  thinking: <><circle cx="25" cy="27" r="4" /><circle cx="43" cy="27" r="4" /></>,
  happy: <><path d="M18 32q5-7 10 0" /><path d="M36 32q5-7 10 0" /></>,
  oops: <><path d="M19 26l8 8M27 26l-8 8" /><path d="M37 26l8 8M45 26l-8 8" /></>,
  lost: <><circle cx="23" cy="30" r="5" /><circle cx="41" cy="29" r="2.5" /></>,
};
const MOUTH: Record<Mood, number[]> = { idle: [8, 12, 7], thinking: [5, 10, 5], happy: [7, 13, 10], oops: [11, 5, 9], lost: [4, 4, 4] };

export default function Bot({ mood = "idle", size = 56 }: { mood?: Mood; size?: number }) {
  return (
    <svg className={`bot ${mood}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <line className="bot-stick" x1="32" y1="5" x2="32" y2="13" />
      <circle className="bot-light" cx="32" cy="5" r="3.5" />
      <rect className="bot-head" x="6" y="13" width="52" height="45" rx="16" />
      <g className="bot-eyes">{EYES[mood]}</g>
      {MOUTH[mood].map((h, i) => (
        <rect key={i} className="bot-bar" x={21 + i * 8} y={51 - h} width="6" height={h} rx="3" />
      ))}
    </svg>
  );
}
