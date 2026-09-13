import type { Store } from "../game/store.ts";
import { TITLES, RARITY_LABEL, shownTitle } from "../game/titles.ts";
import Emblem from "./Emblem.tsx";

const GROUPS = [["race", "Race the AI"], ["steer", "Build a sentence"], ["break", "Trick the AI"], ["return", "Keep coming back"]] as const;

type Props = { store: Store; onWear: (id: string) => void; onPlay: () => void };

export default function Titles({ store, onWear, onPlay }: Props) {
  const earned = TITLES.filter((t) => store.titles[t.id]).length;
  const shown = shownTitle(store);

  return (
    <article className="cabinet">
      <header className="cab-head">
        <p className="label">Your titles</p>
        <h1 className="cab-count"><span>{earned}</span> of {TITLES.length}</h1>
        <div className="cab-bar" style={{ gridTemplateColumns: `repeat(${TITLES.length}, 1fr)` }} aria-hidden="true">
          {TITLES.map((t) => <i key={t.id} className={store.titles[t.id] ? t.rarity : ""} />)}
        </div>
      </header>

      {shown ? (
        <section className={`wearing ${shown.rarity}`}>
          <Emblem id={shown.id} rarity={shown.rarity} earned size={64} />
          <div>
            <p className="label">Wearing</p>
            <p className="wear-name">{shown.name}</p>
            <p className="hint">It goes on your share card. Tap any title you have earned to wear it instead.</p>
          </div>
        </section>
      ) : (
        <section className="wearing empty">
          <p className="hint">Finish a race to earn your first title. The one you wear goes on your share card.</p>
        </section>
      )}

      {GROUPS.map(([mode, label]) => (
        <section key={mode} className="cab-group">
          <h2 className="label">{label}</h2>
          <ul className="cab-grid">
            {TITLES.filter((t) => t.mode === mode).map((t) => {
              const has = !!store.titles[t.id];
              const on = has && shown?.id === t.id;
              return (
                <li key={t.id}>
                  <button
                    className={["tcard", t.rarity, has ? "earned" : "locked", on ? "on" : ""].join(" ").trim()}
                    aria-disabled={!has}
                    aria-pressed={on}
                    onClick={() => { if (has) onWear(t.id); }}
                  >
                    <Emblem id={t.id} rarity={t.rarity} earned={has} size={44} />
                    <span className="tname">{t.name}</span>
                    <span className={`rarity-tag ${t.rarity}`}>{RARITY_LABEL[t.rarity]}</span>
                    <span className="tline">{has ? t.lesson : t.hint}</span>
                    {on && <span className="tstate">Wearing</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <button className="btn wide" onClick={onPlay}>Back to the game</button>
    </article>
  );
}
