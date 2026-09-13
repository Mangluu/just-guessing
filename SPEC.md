# Just Guessing — build specification

> **This is the plan as written before the build.** The live app follows it, with these changes made after measuring the real model.
>
> - The daily race is computed ahead of time at full precision instead of live in the browser, so it plays instantly and everyone gets identical odds.
> - The WebAssembly fallback loads the 4-bit build, not the 8-bit one. The 8-bit build shifts each row's odds by up to 21 points when predictions are batched.
> - The race has no suggestion chips. With the real word always among them, a tap gave the answer away.
> - Break's dial counts how many options the model is choosing between. The top word alone is usually "the", which says nothing about what it knows.
> - Steer's receipt shows what the model would have written without an odds comparison. Picking the top word each time does not produce the likeliest sentence, so that comparison read backwards.
> - Titles and the live count of humans against the machine were added after the first release. The count uses Abacus, a free counting service, instead of a server of our own, so nothing needs an account.

Handoff for a coding agent. Everything needed to build, test and deploy the product is in this file. Where a decision is open it is marked **DECIDE** with a default. Build the default unless told otherwise.

Companion: the design vision with a playable scripted mock (the "vision page"). Match its look and copy tone.

---

## 0. One paragraph

A daily web game. A sentence is shown with the next word missing. The player types a guess. A small language model, running **inside the browser** via Transformers.js on WebGPU, has already computed its own guess for the same sentence. Both are revealed against the true next word. Five rounds, one sentence per day, same for everyone, then a shareable emoji grid. Two free modes reuse the same screen: **Steer** (the player picks the next word from the model's list and gets a "receipt") and **Break** (the player types any prompt and sees a "how sure is it" dial). The learning goal, never stated on the play screen, is that an LLM does not look things up, it guesses from a list with odds, and it is exactly as fluent when guessing as when sure.

## 1. Goals and non-goals

**Goals**
- One interaction that works flawlessly: guess → reveal → score → next.
- Fully client-side inference. No API key, no backend required for v1. Works offline after first load.
- First reveal within 30 seconds of opening on a warm cache, within 90 seconds on a cold cache on a normal connection.
- Mobile first. Feels like a native game on a phone. Also good on desktop.
- Shareable, spoiler-free result card. Daily streak. Titles earned by play style.
- A short "Why" page that explains the design decisions with citations.

**Non-goals for v1**
- Accounts, login, leaderboards with names, comments.
- Multiple languages of UI. UI is English. Non-English text is allowed as *input* in Break mode.
- Any server-side inference.
- Analytics or tracking of any kind.

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Vite 5 + React 18 + TypeScript | Plain CSS with custom properties, no Tailwind, no component library. |
| Inference | `@huggingface/transformers` ^3 | Transformers.js v3. Runs in a **Web Worker**. |
| Model | `onnx-community/SmolLM2-135M-ONNX` | Base model, not instruct. Apache 2.0. `dtype: "q4f16"` on WebGPU (~117 MB), `dtype: "q8"` on WASM fallback (~137 MB). **DECIDE**: `Xenova/distilgpt2` is the lighter alternative (`decoder_model_quantized`, ~84 MB), dumber. Default is SmolLM2. |
| Hosting | Vercel, static output | Model files stream from the Hugging Face CDN and are cached by the browser. No COOP/COEP headers in v1 (see §7.4). |
| Optional backend | One Vercel Edge Function + Vercel KV | Only for the "humans vs machine today" counter. Off by default. See §6.7. |
| Fonts | Google Fonts | Unbounded (display), Fraunces (the sentence), Hanken Grotesk (UI), IBM Plex Mono (numbers). |

Browser support: WebGPU path on Chrome 113+, Edge, Firefox 147+, Safari 26+ on macOS 26 and iOS 26. Everything else falls back to WASM, single threaded, with a "slower mode" notice. Detect with `navigator.gpu`.

## 3. Repository layout

```
just-guessing/
  index.html
  vercel.json
  package.json
  src/
    main.tsx
    App.tsx                 # mode routing: race | steer | break | why
    styles/tokens.css       # colour, type, spacing tokens
    styles/app.css
    content/
      sentences.json        # daily race sentences (see §5.1)
      probes.json           # Break mode suggested prompts (see §5.2)
      copy.ts               # every UI string in one place
      titles.ts             # title definitions and rules (see §6.6)
    engine/
      worker.ts             # the model lives here
      client.ts             # typed wrapper around the worker (postMessage protocol)
      predict.ts            # softmax, top-k, word merge, entropy — pure functions, unit tested
      daily.ts              # date → sentence index, local midnight
      scoring.ts            # normalisation, round result, grid, share text — unit tested
      store.ts              # localStorage persistence
    ui/
      Phone.tsx             # the app shell: top bar, mode tabs, body
      Loader.tsx            # download screen
      Sentence.tsx          # serif sentence with blank / drop-in word
      Guess.tsx             # input + chips + lock button
      Bars.tsx              # probability rows
      Race.tsx  Steer.tsx  Break.tsx
      ShareCard.tsx  Receipt.tsx  Dial.tsx
      Why.tsx
  tests/
    predict.test.ts
    scoring.test.ts
  README.md
```

## 4. Inference engine

### 4.1 Loading

In `engine/worker.ts`:

```ts
import { AutoTokenizer, AutoModelForCausalLM, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;   // default, stated for clarity

const MODEL_ID = "onnx-community/SmolLM2-135M-ONNX";

async function load(hasWebGPU: boolean, onProgress: (p: Progress) => void) {
  const device = hasWebGPU ? "webgpu" : "wasm";
  const dtype  = hasWebGPU ? "q4f16" : "q8";
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback: onProgress });
  const model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, { device, dtype, progress_callback: onProgress });
  return { tokenizer, model };
}
```

`progress_callback` receives objects with `status` in `"initiate" | "download" | "progress" | "done" | "ready"` and, for `"progress"`, `file`, `loaded`, `total`, `progress`. Aggregate `loaded` and `total` across files to drive one bar. Show MB, not percent, on the loading screen (see §6.1).

The main thread passes `hasWebGPU = !!navigator.gpu` to the worker. If WebGPU init throws inside `from_pretrained`, catch and retry once with `wasm` + `q8`.

### 4.2 One forward pass → full distribution

```ts
async function nextTokenLogits(text: string): Promise<Float32Array> {
  const inputs = tokenizer(text);                         // { input_ids, attention_mask }
  const { logits } = await model(inputs);                 // Tensor, dims [1, T, V]
  const t = logits.type === "float32" ? logits : logits.to("float32");
  const [, T, V] = t.dims;
  return (t.data as Float32Array).slice((T - 1) * V, T * V);  // last position only
}
```

If the direct forward call for a decoder-only model fails in the installed version, the fallback is `model.generate(inputs, { max_new_tokens: 1, return_dict_in_generate: true, output_logits: true })` and read the last logits from the returned object. Try the direct call first, it is faster and simpler. Write a smoke test at startup that runs `"The capital of France is"` and asserts the top token decodes to `" Paris"`; log it, do not block the UI on it.

### 4.3 Softmax, top-k, entropy (pure, in `predict.ts`)

```ts
export function softmax(logits: Float32Array): Float32Array   // subtract max, exp, normalise
export function topK(p: Float32Array, k: number): Array<[id: number, p: number]>  // k = 64
export function entropy(p: Float32Array): number              // -Σ p ln p over the full vocab
export function effectiveChoices(H: number): number           // Math.exp(H)
```

Vocab is 49,152 for SmolLM2. A full sort is fine, but use partial selection for tidiness.

### 4.4 Tokens → words (the merge)

The model predicts *tokens*, which can be fragments. The player must see *words*. Rules:

1. Take the top 64 tokens with probabilities.
2. Decode each alone: `tokenizer.decode([id], { skip_special_tokens: true })`.
3. Keep a token only if it starts a new word: decoded string starts with a space (`" the"`) **or** the context ends in whitespace or punctuation. Discard whitespace-only, empty, and control tokens. Discard tokens that are pure punctuation **only in Race mode** (they can never be the truth word there); keep them in Steer and Break so `.` and `,` can appear.
4. For the top 8 surviving candidates, check whether the token is a complete word: run one forward on `context + candidate` and look at the argmax of the next token. If that argmax decodes to something that starts with a space, or is punctuation, or is EOS, the candidate is complete. Otherwise append the argmax and repeat, at most 2 more steps. The candidate's display text becomes the joined string.
5. Normalise the display text (trim, keep case as produced) and merge candidates whose normalised lowercase form matches by **summing** probabilities. `" The"` and `" the"` merge.
6. Sort merged words by probability, return the top 6 for display and the full merged list for scoring lookups.

Cost: on WebGPU each extra forward is 30–80 ms on a laptop, so step 4 adds well under a second. Cache results in a `Map<string, Prediction>` keyed by the exact context string. Precompute all five race contexts at load (see §6.2), so the race never waits on the model at reveal time.

Batching the 8 check forwards into one padded batch is an optional optimisation. Do not do it in v1 unless step 4 measures over 1.5 s on WebGPU.

### 4.5 Result shape

```ts
export interface WordProb { word: string; p: number }          // p in 0..1
export interface Prediction {
  context: string;
  words: WordProb[];        // merged, sorted desc, full list (up to 64)
  top6: WordProb[];
  sureness: number;         // top6[0].p, 0..1 — "how sure is it"
  entropy: number;          // nats, over the token distribution
  effective: number;        // exp(entropy), "picking from ~N words"
  ms: number;               // wall time for the whole prediction
}
```

### 4.6 Worker protocol (`engine/client.ts`)

```ts
type ToWorker   = { type: "load"; hasWebGPU: boolean }
                | { type: "predict"; id: number; text: string; mode: "race" | "steer" | "break" }
                | { type: "continue"; id: number; text: string; maxWords: number }   // Break mode "and it writes anyway"
type FromWorker = { type: "progress"; loaded: number; total: number; file: string }
                | { type: "ready"; device: "webgpu" | "wasm"; loadMs: number }
                | { type: "result"; id: number; prediction: Prediction }
                | { type: "continued"; id: number; text: string }
                | { type: "error"; id?: number; message: string }
```

`continue` runs greedy decoding for `maxWords` whole words (stop at sentence end or 12 words) and is only used by Break mode to show what the model would write next. Reuse the merge rules to stop at word boundaries.

## 5. Content

### 5.1 `sentences.json` — the daily race

Schema:

```json
{ "id": "s001", "opening": "The best way to learn a language is to", "truth": ["speak", "it", "every", "single", "day"], "tags": ["everyday"] }
```

Rules for authoring: the opening is 6 to 12 words. The five truth words are all single words with letters only (no punctuation, no numbers). The full sentence must read naturally. Avoid names of living people. Aim for a mix so the model's confidence varies across rounds, some rounds near-certain, some wide open.

Ship at least 60. Starter set of 40 below. Add 20 more in the same spirit before launch.

```json
[
  {"id":"s001","opening":"The best way to learn a language is to","truth":["speak","it","every","single","day"]},
  {"id":"s002","opening":"On the first day of school she","truth":["forgot","her","bag","at","home"]},
  {"id":"s003","opening":"My grandmother always said that the secret to","truth":["good","bread","is","patience","and"]},
  {"id":"s004","opening":"The train to Helsinki was late because","truth":["of","snow","on","the","tracks"]},
  {"id":"s005","opening":"Nobody expected the small team to","truth":["win","the","whole","tournament","that"]},
  {"id":"s006","opening":"After the rain stopped, the streets","truth":["smelled","like","warm","stone","and"]},
  {"id":"s007","opening":"The recipe says to add the eggs","truth":["one","at","a","time","while"]},
  {"id":"s008","opening":"When the lights went out, everyone in the","truth":["cinema","started","laughing","at","once"]},
  {"id":"s009","opening":"The oldest tree in the village is","truth":["taller","than","the","church","tower"]},
  {"id":"s010","opening":"She opened the letter slowly, because she","truth":["already","knew","what","it","said"]},
  {"id":"s011","opening":"If you want to see the northern lights, you","truth":["have","to","get","away","from"]},
  {"id":"s012","opening":"The dog waited by the door until","truth":["the","children","came","home","from"]},
  {"id":"s013","opening":"Most people think coffee wakes you up, but","truth":["it","only","hides","how","tired"]},
  {"id":"s014","opening":"The museum was closed, so we","truth":["walked","along","the","river","instead"]},
  {"id":"s015","opening":"He learned to swim in a lake that was","truth":["so","cold","his","hands","went"]},
  {"id":"s016","opening":"The map was old, and half of the","truth":["roads","on","it","no","longer"]},
  {"id":"s017","opening":"Every summer the whole family drives to","truth":["a","cabin","with","no","electricity"]},
  {"id":"s018","opening":"The best part of the concert was when","truth":["the","singer","forgot","the","words"]},
  {"id":"s019","opening":"In winter the sun rises late and sets","truth":["before","most","people","leave","work"]},
  {"id":"s020","opening":"The bakery on the corner sells out of","truth":["cinnamon","buns","by","nine","every"]},
  {"id":"s021","opening":"To fix the bike, first turn it","truth":["upside","down","and","spin","the"]},
  {"id":"s022","opening":"The library is quiet, except for the","truth":["sound","of","pages","being","turned"]},
  {"id":"s023","opening":"Her first job was selling ice cream","truth":["on","a","beach","that","had"]},
  {"id":"s024","opening":"The bridge was built in a year when","truth":["nobody","believed","it","could","be"]},
  {"id":"s025","opening":"Before the exam he read the same page","truth":["five","times","without","understanding","a"]},
  {"id":"s026","opening":"The sauna was so hot that the","truth":["wooden","bench","burned","through","the"]},
  {"id":"s027","opening":"On a clear night you can see the","truth":["lights","of","the","city","across"]},
  {"id":"s028","opening":"The little shop only accepted cash, which","truth":["nobody","under","thirty","seemed","to"]},
  {"id":"s029","opening":"The teacher asked a question and the whole","truth":["class","looked","at","their","shoes"]},
  {"id":"s030","opening":"We missed the last bus and had to","truth":["walk","home","in","the","snow"]},
  {"id":"s031","opening":"The cat sat on the keyboard and","truth":["sent","the","email","before","it"]},
  {"id":"s032","opening":"My neighbour grows tomatoes on a balcony","truth":["that","faces","the","wrong","way"]},
  {"id":"s033","opening":"The film was three hours long, and","truth":["nobody","in","the","room","noticed"]},
  {"id":"s034","opening":"The first thing you notice about the island is","truth":["how","loud","the","birds","are"]},
  {"id":"s035","opening":"He kept the ticket from his first flight","truth":["in","a","book","he","never"]},
  {"id":"s036","opening":"The river freezes so thick in January that","truth":["people","drive","cars","across","it"]},
  {"id":"s037","opening":"She practised the speech in front of the","truth":["mirror","until","the","words","stopped"]},
  {"id":"s038","opening":"The old radio only picked up one","truth":["station","and","it","played","jazz"]},
  {"id":"s039","opening":"When the ferry left the harbour, the town","truth":["looked","smaller","than","it","felt"]},
  {"id":"s040","opening":"The best advice I ever got was to","truth":["ask","the","question","you","are"]}
]
```

### 5.2 `probes.json` — Break mode suggestions

Chips shown above the free text field. The player can type anything. These get them started.

```json
[
  {"label":"France",  "prompt":"The capital of France is"},
  {"label":"Wakanda", "prompt":"The capital of Wakanda is"},
  {"label":"Tampere", "prompt":"Tampere is a city in"},
  {"label":"Finnish", "prompt":"Paras tapa oppia kieltä on"},
  {"label":"Estonian","prompt":"Parim viis keele õppimiseks on"},
  {"label":"Latvian", "prompt":"Labākais veids, kā iemācīties valodu, ir"},
  {"label":"Me",      "prompt":"My name is Shivang Gupta and I"},
  {"label":"Water",   "prompt":"Water boils at"}
]
```

### 5.3 Copy tone (`copy.ts`)

Lowercase, short, dry. No exclamation marks. Never the words "learn", "lesson", "educational", "AI literacy" anywhere on the play screens. Those words are allowed on the Why page only. All strings live in `copy.ts` so a Finnish UI can be a single file later.

Loading screen lines, rotate every 4 seconds:
- "downloading the whole machine"
- "135 million numbers, once. then it lives in your browser."
- "nothing you type will leave this device"
- "it has never seen today's sentence either"

## 6. Product specification

### 6.1 Loader

Full screen inside the phone shell. One bar. Text: `47 of 117 MB` in mono, updating. The rotating lines above. If `!navigator.gpu`, a one line notice under the bar: `slower mode · your browser has no gpu access yet`. On `ready`, transition straight into Race for today with the first guess field focused. Do not add a "start" button.

If the download fails: `could not download the model. check your connection and reload.` with a Reload button. Nothing else.

### 6.2 Race

**Daily selection** (`daily.ts`): `dayIndex = Math.floor((Date.now() - tz offset adjusted local midnight epoch) / 86_400_000)`. Concretely, build a `Date` for local midnight today, take its `getTime()`, divide by `86_400_000`, floor, subtract a fixed epoch day so day numbers start near 1 on launch. `sentence = sentences[dayIndex % sentences.length]`. Display `day N`.

**Precompute**: on `ready`, request predictions for all five contexts in order: `opening`, `opening + " " + truth[0]`, … The contexts use the **true** words, never the model's words, because both player and model are predicting the real text. Cache them. The UI must never wait on the model in Race after this.

**Round loop** (`round` 0..4):
1. `guess` phase: show `opening` + revealed truths so far in the serif sentence, then a blinking orange blank. Input field with placeholder `the next word`, three suggestion chips, `Lock in` button. Enter key locks. Empty input does nothing. Chips: **DECIDE** default is 3 chips drawn as `[top6[1], truth, top6[3]]` shuffled, so the truth is always tappable (keeps mobile play fast, and a tap is still a guess). Alternative is no chips.
2. `reveal` phase: the true word drops into the sentence (animation, 500 ms). The six bars slide in over 700 ms. The player's word row is tinted orange with a `you` tag if it is in `top6`; if it is in `words` but not `top6`, show a seventh dim row for it; if not present at all, show one line `your word, X, was not in its top sixty`. The machine's top row has a `machine` tag. The truth row has a `truth` tag. Verdict line: `you ✓ right` or `you ✗`, and `machine ✓ right` or `machine ✗ said X`.
3. `Next word` button → round + 1. After round 4, `See the card`.

**Scoring** (`scoring.ts`):
- `normalise(w)`: NFC, lowercase, trim, strip leading and trailing characters that are not letters or digits (Unicode aware, `\p{L}\p{N}`).
- `youRight = normalise(guess) === normalise(truth)`
- `machineRight = normalise(top6[0].word) === normalise(truth)`
- Grid square: both → `🟨`, you only → `🟩`, machine only → `🟥`, neither → `⬛`.
- Points: 1 each per round when right. Ties are allowed.

**Done card**:
```
Just Guessing · day 47
🟥🟩🟨🟩🟥
you 3 · machine 3
<line>
justguessing.app
```
`<line>` rule, first match wins: (a) any round where `machineRight === false` and `top6[0].p ≥ 0.70` → `it was {p}% sure and wrong.` (b) `you > machine` → `beat the machine. today.` (c) tie → `even. it does not get tired.` (d) else → `it beat me {machine} to {you}.` If the player holds a title (see §6.6), append a line `· {Title}` after the score line.

Buttons: `Copy share text` (clipboard, toast `copied`), `Share` (Web Share API when available, same text), and a small link `why this exists` → Why page. No Play again in the real product; the card stays until midnight. Show `next sentence in {h}h {m}m`.

### 6.3 Steer

Reuses Sentence + Bars. Opening sentence: pick from `sentences.json` at `(dayIndex + 17) % length`, use its `opening` only. Show top6 as tappable rows; the sixth row is replaced by the lowest-probability word in `words` that is still above 0.1% and labelled `long shot`. Tapping appends the word (as the model's text, not the truth) and requests a fresh prediction on the new context. Three picks, then the **receipt**:

```
Yesterday I went to the moon and danced
moon      0.4%
and      19%
danced    3.0%
avg odds  7.5%
MADE WITH A 0.4% WORD
```
Stamp rule: if any pick had `p < 0.01` → `MADE WITH A {p}% WORD`; else `ALL SAFE PICKS. THE MACHINE WOULD HAVE WRITTEN THIS.` Buttons: `Copy receipt`, `Steer again` (new random opening from the list, not the same one).

### 6.4 Break

Probe chips from `probes.json`, then a free text field (`type anything, in any language`), then the result: the **Dial** (SVG ring, `sureness` as percent in Unbounded, `sure · picking from ~{effective} words` in mono, a one-word verdict), the bars, and `and it writes anyway:` followed by the model's greedy continuation of up to 12 words from the `continue` message. Verdict thresholds: `sureness ≥ 0.60` → `knows it.`, `0.25..0.60` → `leaning.`, `< 0.25` → `guessing. answers anyway.` If the prompt contains no ASCII letters at all or the top6 are all single characters, also append `this language is nearly invisible to it.`

Every Break result with `sureness < 0.15` is a **discovery**. Store the prompt and the sureness. Show a small `discovery` chip on the result. Discoveries are listed on the Why page under `what you found`.

### 6.5 Persistence (`store.ts`, localStorage, one JSON blob under key `jg.v1`)

```ts
interface Store {
  lastPlayedDay: number;           // dayIndex
  streak: number;                  // consecutive days with a finished race
  history: Array<{ day: number; grid: string; you: number; machine: number }>;  // keep last 30
  titles: string[];                // earned title ids
  discoveries: Array<{ prompt: string; sureness: number; day: number }>;   // keep last 20
  optInTally: boolean;             // §6.7
}
```
Streak rule: finishing today's race when `lastPlayedDay === today - 1` increments, `=== today` no change, otherwise reset to 1. Wrap every read and write in try/catch and treat a missing store as empty.

### 6.6 Titles (`titles.ts`)

| id | Title | Rule |
|---|---|---|
| oracle | Oracle | In one race, your guess equalled the machine's top word 3 or more times |
| mindreader | Mind Reader | 5 of 5 right in one race |
| firstblood | First Blood | Any round where you were right and the machine was wrong |
| chaos | Chaos Agent | A Steer receipt with a word under 1% |
| factchecker | Fact-Checker | A Break result with sureness under 15% |
| polyglot | Polyglot | A Break result whose prompt has no ASCII letters, or matches a Finnish, Estonian or Latvian probe |
| streak7 | Seven Days | Streak reaches 7 |

Earning a title shows a one line toast: `you are now Oracle`. The most recently earned title is the one printed on the share card. Titles are never revoked.

### 6.7 Humans vs machine counter (optional, **DECIDE**, default off)

If enabled: on race completion, if `store.optInTally`, `POST /api/tally` with `{ day, you, machine }` (integers 0..5). Edge function does `INCRBY tally:{day}:you {you}` and `INCRBY tally:{day}:machine {machine}` in Vercel KV, rejects anything outside 0..5, rate limits by IP to 3 per day. `GET /api/tally?day=N` returns `{ you, machine }`. The done card then shows `today humans won {you/(you+machine)}% of words`. The opt in is a checkbox on the done card: `add my score to today's count`. No other data is ever sent.

### 6.8 Why page

A single scrolling page, reachable from the done card and a small `?` in the top bar. Sections, in order:
1. **what this is** — three sentences. "It does not look things up. It guesses the next word from a list with odds, every time. It is just as fluent when it is guessing as when it is sure."
2. **why a game** — Chen and Pu proposed "Tag-Team Text Generation" in March 2026 as a way to learn how LLMs work, as an idea, with no implementation. This is that idea, built. Link.
3. **why it matters for people under 30** — Pew, February 2026: 57% of US teens use chatbots to search for information, 54% for schoolwork, about three in ten daily. A study of middle school girls found overtrust, and that seeing the model's mistakes is what shifted it.
4. **why it runs in your browser** — nothing you type leaves the device, it works offline, it costs nothing to keep online, and the download counter is itself the lesson.
5. **why a small model** — big models do the same thing and hide it better. A small one is honest enough to watch.
6. **why Finnish** — the Baltic Sea region speaks many small languages, and models are measurably worse in them. The Break probes make that visible in one tap.
7. **what you found** — the player's discoveries and titles, from the store.
8. **credits** — SmolLM2 by Hugging Face (Apache 2.0), Transformers.js, by Shivang Gupta.

Citations (verified URLs):
- Chen, A. and Pu, I. (2026). Using Games to Learn How Large Language Models Work. arXiv. https://arxiv.org/html/2603.28374
- Pew Research Center (2026). How Teens Use and View AI. https://www.pewresearch.org/internet/2026/02/24/how-teens-use-and-view-ai/
- Children's Overtrust and Shifting Perspectives of Generative AI. arXiv. https://arxiv.org/abs/2404.14511
- Language models are better than humans at next-token prediction. arXiv. https://arxiv.org/pdf/2212.11281

## 7. Design system

### 7.1 Tokens (`tokens.css`)

The play surface is always dark. It is the product's world, not a theme.

```css
:root {
  --bg: #131216; --bg2: #1C1B21; --bg3: #26252C;
  --ink: #F2EEE6; --ink2: #A9A5A0; --ink3: #6F6C68; --line: #2C2B32;
  --human: #FF7A1A; --human-soft: rgba(255,122,26,.16);
  --machine: #6E5BFF; --machine-soft: rgba(110,91,255,.16); --machine-top: rgba(110,91,255,.34);
  --display: "Unbounded", Impact, sans-serif;
  --serif: "Fraunces", Georgia, serif;
  --body: "Hanken Grotesk", "Helvetica Neue", Arial, sans-serif;
  --mono: "IBM Plex Mono", Menlo, monospace;
  --r-card: 18px; --r-row: 12px; --r-pill: 999px;
}
```

Human is orange. Machine is violet. Truth is the ink itself with an underline. Never use green for "right" or red for "wrong" as the only signal; the tags (`you`, `machine`, `truth`) carry the meaning, colour supports it.

### 7.2 Layout

Mobile first at 360 px wide. On desktop, the app is centred at a max width of 420 px inside a plain page background of `#0E0D10`, so it still reads as a phone. Top bar: day number left, mode tabs centred (`Race · Steer · Break`), `?` right. Body scrolls. Bars are full-width rows with the fill behind the text, the word in Fraunces at 1.12 rem, the percent in mono right-aligned with `tabular-nums`.

### 7.3 Motion

Bars: width from 0 to target over 700 ms, `cubic-bezier(.2,.8,.2,1)`, staggered 40 ms per row. Truth word: drop in over 500 ms with slight overshoot. Blank: blinking underline. Everything respects `prefers-reduced-motion`.

### 7.4 `vercel.json`

```json
{ "headers": [ { "source": "/(.*)", "headers": [ { "key": "X-Content-Type-Options", "value": "nosniff" } ] } ] }
```
Do **not** set `Cross-Origin-Opener-Policy` or `Cross-Origin-Embedder-Policy` in v1. They are only needed for multithreaded WASM and they complicate loading from the Hugging Face CDN. Single threaded WASM is acceptable as the fallback path.

## 8. Accessibility and privacy

- All controls reachable by keyboard. Bars in Steer are `role="button"` with `tabindex="0"`, Enter and Space activate.
- The reveal region is `aria-live="polite"`. The verdict is readable text, not only colour.
- Contrast: all text on `--bg` at 4.5:1 or better. `--ink3` is decorative only, never for essential text.
- Focus ring: 2 px `--human`, offset 2 px.
- No analytics, no cookies, no third party scripts except Google Fonts CSS. State the privacy line on the loader and the Why page.

## 9. Tests

`tests/predict.test.ts` (Vitest, pure functions only, no model):
- softmax sums to 1 and preserves order.
- topK returns k items sorted descending.
- entropy of a one-hot is 0, of a uniform over n is ln n; effectiveChoices of uniform over n is n (±1e-6).
- merge: given fake decoded tokens `[" the", " The", "the", " th"]` with probabilities, `" the"` and `" The"` merge and sum, `"the"` without a leading space is dropped when the context ends in a letter.

`tests/scoring.test.ts`:
- normalise: `"Speak!"` → `"speak"`, `"  it, "` → `"it"`, `"Ääni"` → `"ääni"`.
- grid squares for all four outcomes.
- share line rule, all four branches, including the `≥ 0.70 and wrong` case at exactly 0.70.
- daily index is stable across a day and increments at local midnight (mock `Date`).

Manual smoke checklist before deploy is in §11.

## 10. Build order (three hours)

| Time | Deliverable | Done when |
|---|---|---|
| 0:00–0:25 | Scaffold, worker loads model, `predict("The capital of France is")` logs `Paris` first with a probability | console shows top 6 words and ms |
| 0:25–1:10 | Race: daily sentence, precompute, guess → reveal → score → next, done card, copy | five rounds play through on a phone with no waits at reveal |
| 1:10–1:40 | Steer: tappable rows, long shot, receipt, copy | a receipt with a sub-1% stamp is producible |
| 1:40–2:05 | Break: probes, free text, dial, continuation, discovery | Wakanda shows a low dial and a continuation |
| 2:05–2:40 | Loader with MB counter and lines, tokens, motion, mobile pass, titles and streak | looks like the vision page; titles toast fires |
| 2:40–3:00 | Why page, README with credits, Vercel deploy, custom domain if available | public URL loads cold in under 90 s on 4G, warm in under 5 s |

Stretch, only after all six rows above are done: humans vs machine counter (§6.7), Web Share API image card via canvas, batched boundary checks (§4.4).

## 11. Acceptance criteria

- Cold load on a phone with WebGPU: model downloads with a live MB counter, no white screen, first guess field visible within 90 s on a normal connection.
- Warm load: playable in under 5 s.
- A device without WebGPU still plays, in slower mode, with the notice shown.
- The five race reveals never show a spinner. Precompute is complete before the first guess is locked or the reveal waits silently (never more than the time to type a word).
- Every displayed candidate in Race is a whole word. No visible fragments like `ing` or `Ġ`.
- Typing the truth word with different case or trailing punctuation still scores as right.
- The share text copies exactly as specified, including the emoji grid, and pastes cleanly into a messaging app.
- Day number and sentence change at local midnight. Streak increments on consecutive days.
- Steer can produce a receipt with the `MADE WITH A x% WORD` stamp.
- Break on `The capital of Wakanda is` shows sureness under 25% and still shows a continuation. On `The capital of France is` shows sureness over 60% with `Paris` on top.
- A Finnish probe shows a lower sureness than the English probe of the same sentence.
- Keyboard-only play works end to end.
- Lighthouse accessibility score 95 or above on the Race screen.
- No network requests after load other than to the Hugging Face CDN for model files, and, only if opted in, `/api/tally`.

## 12. README contents

Name, one paragraph from §0, the live URL, how to run locally (`npm i && npm run dev`), how it works (three sentences on Transformers.js and the model), credits (SmolLM2 Apache 2.0, Transformers.js, Chen and Pu for the game idea), the privacy line, and a short "decisions" section pointing to the Why page. Built by Shivang Gupta, September 2026.

## 13. Open decisions, with defaults

| Decision | Default | Alternative |
|---|---|---|
| Name and domain | Just Guessing, `justguessing.app` if available, else `just-guessing.vercel.app` | Outguess |
| Model | SmolLM2-135M, q4f16 | distilgpt2 quantized, 84 MB |
| Race chips | 3 chips, truth always among them | no chips |
| Tally counter | off | on, opt in |
| Steer opening | from the sentence list, offset by 17 days | a dedicated list of open-ended openings |
