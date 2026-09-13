import Bot from "./Bot.tsx";

type Props = {
  day: number;
  result: { you: number; ai: number } | null;
  progress: number;
  streak: number;
  earned: number;
  total: number;
  onRace: () => void;
  onSteer: () => void;
  onBreak: () => void;
  onTitles: () => void;
  onHelp: () => void;
  onAbout: () => void;
};

export default function Home(p: Props) {
  const verdict = !p.result ? "" : p.result.you > p.result.ai ? "You beat the AI today." : p.result.you === p.result.ai ? "A draw today." : "The AI won today.";
  return (
    <section className="stack">
      <div className="hello">
        <Bot size={64} />
        <div>
          <h1>Can you beat the AI?</h1>
          <p className="muted">Guess the next word before it does.</p>
        </div>
      </div>

      <div className="card today">
        <p className="kicker">Today's race, day {p.day}</p>
        {p.result ? (
          <>
            <p className="big">You {p.result.you}, AI {p.result.ai}</p>
            <p className="muted">{verdict} A new sentence comes tomorrow.</p>
            <button className="btn quiet wide" onClick={p.onRace}>See your result</button>
          </>
        ) : (
          <>
            <p className="big">{p.progress ? `You are on word ${p.progress + 1} of 5` : "5 missing words"}</p>
            <p className="muted">Pick the word you think comes next. Then see what the AI guessed.</p>
            <button className="btn wide" onClick={p.onRace}>{p.progress ? "Keep going" : "Play today's race"}</button>
          </>
        )}
      </div>

      <div className="modes">
        <button className="card mode" onClick={p.onSteer}>
          <span className="icon build" aria-hidden="true">Aa</span>
          <h2>Build a sentence</h2>
          <p>Pick words from the AI's list. How silly can it get?</p>
        </button>
        <button className="card mode" onClick={p.onBreak}>
          <span className="icon trick" aria-hidden="true">?!</span>
          <h2>Trick the AI</h2>
          <p>Start any sentence and see how sure it is.</p>
        </button>
      </div>

      <div className="strip">
        <button className="card" onClick={p.onTitles}><span className="kicker">Titles</span><b>{p.earned} of {p.total}</b></button>
        <div className="card"><span className="kicker">Streak</span><b>{p.streak} {p.streak === 1 ? "day" : "days"}</b></div>
      </div>

      <button className="link" onClick={p.onHelp}>How does it work?</button>
      <button className="link" onClick={p.onAbout}>For parents and teachers</button>
    </section>
  );
}
