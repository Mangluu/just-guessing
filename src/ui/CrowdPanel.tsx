import type { Grade } from "../game/scoring.ts";
import { tally } from "../game/scoring.ts";
import { humanShare, rarestRight, standingLine, type CrowdAll, type CrowdDay } from "../game/crowd.ts";

// Below this many players, per-word percentages only echo a handful of answers back.
const WORDS_FROM = 5;

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

type Props = { grades: Grade[]; truth: string[]; crowd: CrowdDay | null; all: CrowdAll | null; status: "loading" | "ready" | "off" };

function Tug({ share }: { share: number }) {
  const h = Math.round(share * 100);
  return (
    <div className="tug" role="img" aria-label={`Humans have won ${h} percent of today's words, the machine ${100 - h} percent`}>
      <div className="tug-labels"><span className="you">Humans {h}%</span><span className="mach">Machine {100 - h}%</span></div>
      <div className="tug-track">
        <span className="tug-you" style={{ width: `${h}%` }} />
        <span className="tug-knot" style={{ left: `${h}%` }} />
      </div>
    </div>
  );
}

export default function CrowdPanel({ grades, truth, crowd, all, status }: Props) {
  if (status === "off") return null;
  const head = (
    <div className="crowd-head">
      <h2 id="crowd-title" className="label">Humans against the machine</h2>
      {crowd && <p className="live"><i className="live-dot" />{crowd.plays.toLocaleString("en-US")} {crowd.plays === 1 ? "person" : "people"} played today</p>}
    </div>
  );
  if (status === "loading") {
    return <section className="crowd" aria-labelledby="crowd-title" aria-busy="true">{head}<div className="skeleton" /></section>;
  }
  if (!crowd || !crowd.plays) return null;

  const { you, machine } = tally(grades);
  const share = humanShare(crowd, machine);
  const rarest = rarestRight(crowd, grades);

  return (
    <section className="crowd" aria-labelledby="crowd-title">
      {head}
      {share !== null && <Tug share={share} />}
      <p className="crowd-rank">{standingLine(crowd, you)}</p>
      {crowd.plays < WORDS_FROM ? (
        <p className="crowd-wait">Word by word results appear once {WORDS_FROM} people have played today.</p>
      ) : (
      <ol className="crowd-words">
        {truth.map((w, i) => {
          const g = grades[i];
          const found = crowd.words[i] / crowd.plays;
          return (
            <li key={i} className={i === rarest ? "rarest" : undefined}>
              <span className="cw-word">{w}{g.youRight && <span className="tag you">you</span>}</span>
              <span className="cw-pct">{Math.round(found * 100)}% of people</span>
              <span className="cw-bar"><span className="cw-fill" style={{ width: `${Math.max(2, found * 100)}%`, animationDelay: `${i * 70}ms` }} /></span>
              <span className={g.machineRight ? "cw-mach got" : "cw-mach"}>{g.machineRight ? "the machine got it" : `the machine said ${g.machineWord}`}</span>
              {i === rarest && <span className="cw-note">Only {Math.round(found * 100)}% of people found this one. You did.</span>}
            </li>
          );
        })}
      </ol>
      )}
      {all && all.humans + all.machine + all.draws > 0 && (
        <p className="crowd-all">
          All time, humans have won {count(all.humans, "race", "races")} and the machine {count(all.machine, "race", "races")}. {count(all.draws, "race", "races")} ended level.
        </p>
      )}
    </section>
  );
}
