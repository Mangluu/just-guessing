// Sound for Just Guessing, synthesised live with the Web Audio API, so there are no audio files.
// Effects answer what just happened, softly. Music is slow, generated as it plays, and only
// starts when someone turns it on.

export type Cue =
  | "right" | "beat" | "wrong" | "aiRight" | "aiWrong"
  | "win" | "draw" | "lose" | "title" | "rare" | "legendary"
  | "ask" | "sure" | "fairly" | "guessing" | "lost" | "done" | "switch";

type Prefs = { effects: boolean; music: boolean; seen: boolean };
type Shape = { attack?: number; glide?: number; wobble?: [rate: number, cents: number] };

const KEY = "just-guessing.sound";
const BEAT = 60 / 72;
export const BAR = 4 * BEAT;
export const MUSIC_LEVEL = 0.8;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// Fmaj7, Em7, Dm7, Cmaj7: a slow walk down to home. The first number in each is the bass note.
const CHORDS = [[41, 53, 57, 60, 64], [40, 52, 55, 59, 62], [38, 50, 53, 57, 60], [36, 48, 52, 55, 59]];
// the melody stays on C major pentatonic, so no note can clash hard with a chord
const SCALE = [72, 74, 76, 79, 81, 84];
const PICKS = [72, 74, 76, 79, 81];
const DUCKS: Cue[] = ["right", "beat", "wrong", "win", "draw", "lose", "title", "rare", "legendary", "sure", "fairly", "guessing", "lost", "done"];

/** The whole sound graph and every voice, on any audio context: the live one, or an offline one for measuring. */
export function createSynth(c: BaseAudioContext, destination: AudioNode = c.destination) {
  const gain = (value: number) => { const g = c.createGain(); g.gain.value = value; return g; };
  const filter = (type: BiquadFilterType, frequency: number) => { const f = c.createBiquadFilter(); f.type = type; f.frequency.value = frequency; return f; };

  const master = gain(0.9);
  const glue = c.createDynamicsCompressor();
  glue.threshold.value = -14; glue.knee.value = 10; glue.ratio.value = 3; glue.attack.value = 0.005; glue.release.value = 0.2;
  master.connect(glue).connect(destination);

  // a soft room, made from noise that fades away
  const room = c.createConvolver();
  const size = Math.floor(c.sampleRate * 2.2);
  const impulse = c.createBuffer(2, size, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < size; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / size) ** 3.5;
  }
  room.buffer = impulse;
  room.connect(master);

  const sfx = gain(1);
  sfx.connect(master);
  sfx.connect(gain(0.14)).connect(room);

  const music = gain(0), duck = gain(1);
  music.connect(duck);
  duck.connect(master);
  duck.connect(gain(0.3)).connect(room);

  // the melody echoes a dotted eighth later, a little darker each time
  const lead = gain(1), echo = c.createDelay(1), dark = filter("lowpass", 2000), again = gain(0.3), echoOut = gain(0.45);
  echo.delayTime.value = BEAT * 0.75;
  lead.connect(music);
  lead.connect(echo);
  echo.connect(dark);
  dark.connect(again).connect(echo);
  dark.connect(echoOut).connect(music);

  const noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
  const hiss = noise.getChannelData(0);
  for (let i = 0; i < hiss.length; i++) hiss[i] = Math.random() * 2 - 1;

  function tone(out: AudioNode, t: number, type: OscillatorType, f: number, peak: number, dur: number, { attack = 0.005, glide, wobble }: Shape = {}) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur * 0.7);
    if (wobble) {
      const lfo = c.createOscillator(), depth = gain(wobble[1]);
      lfo.frequency.value = wobble[0];
      lfo.connect(depth).connect(o.detune);
      lfo.start(t);
      lfo.stop(t + dur + 0.1);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  // a small glass bell: a pure tone with two quieter overtones that fade first
  const bell = (t: number, m: number, peak: number, dur = 0.9) => {
    const f = hz(m);
    tone(sfx, t, "sine", f, peak, dur);
    tone(sfx, t, "sine", f * 2, peak * 0.22, dur * 0.55);
    tone(sfx, t, "sine", f * 3, peak * 0.06, dur * 0.3);
  };
  // round and low, for a gentle "not quite"
  const soft = (t: number, m: number, peak: number, dur: number, shape: Shape = {}) => {
    const f = filter("lowpass", 1400);
    f.connect(sfx);
    tone(f, t, "triangle", hz(m), peak, dur, { attack: 0.01, ...shape });
  };
  // the robot's voice: a square wave with its edges filtered off
  const blip = (t: number, from: number, to: number, peak: number, dur: number, wobble?: [number, number]) => {
    const f = filter("lowpass", 1600);
    f.connect(sfx);
    tone(f, t, "square", hz(from), peak, dur, { attack: 0.004, glide: from === to ? undefined : hz(to), wobble });
  };
  // an electric piano: one sine bending another, brighter at the start of each note
  const keys = (out: AudioNode, t: number, m: number, peak: number, dur: number) => {
    const f = hz(m), carrier = c.createOscillator(), bender = c.createOscillator(), depth = c.createGain(), g = c.createGain();
    carrier.frequency.setValueAtTime(f, t);
    bender.frequency.setValueAtTime(f, t);
    depth.gain.setValueAtTime(f * 1.1, t);
    depth.gain.exponentialRampToValueAtTime(f * 0.05, t + Math.min(1.2, dur));
    bender.connect(depth).connect(carrier.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    carrier.connect(g).connect(out);
    for (const o of [carrier, bender]) { o.start(t); o.stop(t + dur + 0.1); }
  };
  // a thumb piano: a quick bright click on top of a round note
  const kalimba = (out: AudioNode, t: number, m: number, peak: number) => {
    tone(out, t, "sine", hz(m), peak, 0.9, { attack: 0.003 });
    tone(out, t, "sine", hz(m) * 4.02, peak * 0.12, 0.08, { attack: 0.002 });
  };
  const swish = (t: number, peak: number, dur: number) => {
    const n = c.createBufferSource(), band = filter("bandpass", 600), g = c.createGain();
    n.buffer = noise;
    band.Q.value = 1.2;
    band.frequency.setValueAtTime(600, t);
    band.frequency.exponentialRampToValueAtTime(1800, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(band).connect(g).connect(sfx);
    n.start(t);
    n.stop(t + dur + 0.05);
  };
  const run = (t: number, notes: number[], gap: number, peak: number, dur: number) => notes.forEach((m, i) => bell(t + i * gap, m, peak, dur));
  const chord = (t: number, notes: number[], peak: number, dur: number) => notes.forEach((m, i) => keys(sfx, t + i * 0.02, m, peak, dur));

  const cues: Record<Cue, (t: number) => void> = {
    right: (t) => { bell(t, 76, 0.15); bell(t + 0.09, 81, 0.13, 1.1); },
    beat: (t) => { run(t, [72, 76, 79], 0.07, 0.12, 0.7); bell(t + 0.21, 84, 0.14, 1.3); bell(t + 0.3, 91, 0.035, 1.1); },
    wrong: (t) => { soft(t, 69, 0.16, 0.2, { glide: hz(67) }); soft(t + 0.16, 64, 0.14, 0.45); },
    aiRight: (t) => { blip(t, 79, 84, 0.1, 0.09); blip(t + 0.1, 84, 84, 0.09, 0.07); },
    aiWrong: (t) => blip(t, 76, 71, 0.1, 0.2, [20, 45]),
    win: (t) => { run(t, [72, 76, 79], 0.1, 0.12, 0.6); bell(t + 0.3, 84, 0.14, 1.6); chord(t + 0.3, [60, 64, 67, 72], 0.05, 1.8); },
    draw: (t) => { chord(t, [67, 71, 74], 0.05, 0.8); chord(t + 0.32, [72, 76, 79], 0.05, 1.3); },
    lose: (t) => { soft(t, 67, 0.14, 0.22); soft(t + 0.15, 64, 0.14, 0.22); soft(t + 0.3, 60, 0.14, 0.75, { wobble: [6, 25] }); },
    title: (t) => run(t, [79, 84, 88], 0.06, 0.085, 0.9),
    rare: (t) => { run(t, [79, 84, 88, 91], 0.055, 0.085, 1); bell(t + 0.3, 96, 0.03, 1.2); },
    legendary: (t) => { chord(t, [48, 55, 64], 0.05, 2.2); run(t + 0.05, [72, 76, 79, 84, 88, 91, 96], 0.05, 0.075, 1.1); },
    ask: (t) => { swish(t, 0.09, 0.28); blip(t + 0.18, 72, 79, 0.05, 0.08); },
    sure: (t) => { bell(t, 84, 0.12, 1); bell(t + 0.07, 91, 0.06, 1); },
    fairly: (t) => { bell(t, 79, 0.1, 0.8); bell(t + 0.09, 84, 0.07, 0.9); },
    guessing: (t) => { soft(t, 74, 0.12, 0.4, { wobble: [5.5, 35] }); soft(t + 0.2, 71, 0.11, 0.5, { wobble: [5.5, 35] }); },
    lost: (t) => soft(t, 76, 0.14, 0.7, { glide: hz(64), wobble: [7, 90] }),
    done: (t) => run(t, [72, 76, 79, 84], 0.06, 0.1, 0.9),
    switch: (t) => bell(t, 84, 0.08, 0.5),
  };

  return {
    music,
    duck,
    cue: (name: Cue, t: number) => cues[name](t),
    // each word you pick plays the next note up, so a finished sentence sounds like a little tune
    note: (t: number, step: number, surprise: boolean) => {
      kalimba(sfx, t, PICKS[Math.min(step, PICKS.length - 1)], 0.12);
      if (surprise) tone(sfx, t + 0.02, "sine", 380, 0.05, 0.16, { glide: 900 });
    },
    bar: (t: number, i: number, random: () => number = Math.random) => {
      const [bass, ...voicing] = CHORDS[i % CHORDS.length];
      voicing.forEach((m, k) => keys(music, t + k * 0.02 + random() * 0.008, m, 0.034 * (0.9 + random() * 0.2), BAR * 0.95));
      voicing.slice(1).forEach((m, k) => keys(music, t + 2 * BEAT + 0.1 + k * 0.015, m, 0.017, BEAT * 1.7));
      tone(music, t, "triangle", hz(bass), 0.06, BEAT * 1.9, { attack: 0.02 });
      tone(music, t + 2.5 * BEAT, "triangle", hz(bass), 0.045, BEAT * 1.3, { attack: 0.02 });
      const inChord = SCALE.filter((m) => voicing.some((n) => (((n - m) % 12) + 12) % 12 === 0));
      for (let step = 0; step < 8; step++) {
        if (random() > 0.3) continue;
        const pool = random() < 0.7 && inChord.length ? inChord : SCALE;
        kalimba(lead, t + (step * BEAT) / 2 + (step % 2 ? 0.05 : 0), pool[Math.floor(random() * pool.length)], 0.045);
      }
    },
  };
}

function load(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { effects: p.effects !== false, music: p.music === true, seen: p.seen === true };
  } catch {
    return { effects: true, music: false, seen: false };
  }
}

let prefs = load();
const listeners = new Set<() => void>();
let live: { c: AudioContext; s: ReturnType<typeof createSynth> } | null = null;
let unlocked = false, playing = false, timer = 0, nextBar = 0, barNo = 0, lastCue = "", lastAt = 0;

function wake() {
  if (typeof AudioContext === "undefined") return null;
  if (!live) { const c = new AudioContext(); live = { c, s: createSynth(c) }; }
  if (live.c.state === "suspended") void live.c.resume();
  return live;
}

function startMusic() {
  const a = wake();
  if (!a || playing) return;
  playing = true;
  const { c, s } = a, now = c.currentTime, level = s.music.gain;
  level.cancelScheduledValues(now);
  level.setValueAtTime(level.value, now);
  level.linearRampToValueAtTime(MUSIC_LEVEL, now + 3);
  nextBar = Math.max(nextBar, now + 0.1);
  const plan = () => { while (nextBar < c.currentTime + 1.5) { s.bar(nextBar, barNo++); nextBar += BAR; } };
  plan();
  timer = window.setInterval(plan, 250);
}

function stopMusic(fade = 1.2) {
  if (!live || !playing) return;
  playing = false;
  clearInterval(timer);
  const { c, s } = live, now = c.currentTime, level = s.music.gain;
  level.cancelScheduledValues(now);
  level.setValueAtTime(level.value, now);
  level.linearRampToValueAtTime(0, now + fade);
}

/** Plays one effect, now or a little later. The music dips under it so it can be heard. */
export function cue(name: Cue, delay = 0) {
  if (!prefs.effects) return;
  const now = performance.now();
  if (name === lastCue && now - lastAt < 100) return; // one event makes one sound, even if React runs an effect twice
  lastCue = name;
  lastAt = now;
  const a = wake();
  if (!a) return;
  const t = a.c.currentTime + 0.02 + delay;
  a.s.cue(name, t);
  if (playing && DUCKS.includes(name)) {
    const d = a.s.duck.gain;
    d.cancelScheduledValues(t);
    d.setTargetAtTime(0.35, t, 0.05);
    d.setTargetAtTime(1, t + 0.8, 0.35);
  }
}

export function note(step: number, surprise = false) {
  if (!prefs.effects) return;
  const a = wake();
  if (a) a.s.note(a.c.currentTime + 0.01, step, surprise);
}

export const getPrefs = () => prefs;

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setPrefs(change: Partial<Prefs>) {
  prefs = { ...prefs, ...change };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage blocked: the choice lasts for this visit */ }
  if (change.music === true) startMusic();
  if (change.music === false) stopMusic();
  listeners.forEach((f) => f());
}

// Browsers only allow sound after a tap or a key press, so saved music waits for the first one,
// and it fades out whenever the tab is hidden.
const unlock = () => { unlocked = true; if (prefs.music && !document.hidden) startMusic(); };
window.addEventListener("pointerup", unlock, { once: true });
window.addEventListener("keydown", unlock, { once: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopMusic(0.3);
  else if (prefs.music && unlocked) startMusic();
});
