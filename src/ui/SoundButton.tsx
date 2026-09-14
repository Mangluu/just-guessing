import { useSyncExternalStore } from "react";
import { cue, getPrefs, setPrefs, subscribe } from "./sound.ts";

// A speaker button in the top bar. It opens a small panel with a switch for effects and one for music.
// The dot stays until someone has looked, because music is off until chosen.
export default function SoundButton() {
  const prefs = useSyncExternalStore(subscribe, getPrefs);
  const any = prefs.effects || prefs.music;
  return (
    <>
      <button
        className="chip-btn icon-btn"
        popoverTarget="sound-panel"
        aria-label={`Sound, effects ${prefs.effects ? "on" : "off"}, music ${prefs.music ? "on" : "off"}`}
        title="Sound and music"
        onClick={() => { if (!prefs.seen) setPrefs({ seen: true }); }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
          {any ? <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
        </svg>
        {!prefs.seen && <i className="new-dot" />}
      </button>
      <div id="sound-panel" popover="auto" className="sound-panel" role="group" aria-labelledby="sound-title">
        <p id="sound-title" className="kicker">Sound</p>
        <label className="switch-row">
          <span><strong>Sound effects</strong><small>Soft dings and blips as you play</small></span>
          <input type="checkbox" role="switch" checked={prefs.effects} onChange={(e) => { setPrefs({ effects: e.target.checked }); if (e.target.checked) cue("switch"); }} />
        </label>
        <label className="switch-row">
          <span><strong>Music</strong><small>Calm music in the background</small></span>
          <input type="checkbox" role="switch" checked={prefs.music} onChange={(e) => setPrefs({ music: e.target.checked })} />
        </label>
      </div>
    </>
  );
}
