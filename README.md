# Just Guessing

Can you guess the next word before an AI does? Just Guessing is a free game for kids and young people. You race a real AI to fill in a sentence, and after every word the game shows how sure the AI was.

Play it at **https://mangluu.github.io/just-guessing/**

## Why

Chatbots write one word at a time. Before every word, they give each word they know a score and pick one. They sound just as sure when they are guessing as when they know. Chatbots never show those scores. This game does.

## What you can do

- **Today's race.** A sentence has five missing words. For each one you pick from four choices, then see what the AI guessed and how sure it was. Everyone gets the same sentence on the same day.
- **Build a sentence.** Pick each word from the AI's own list and see how unlikely your sentence is.
- **Trick the AI.** Start any sentence and see how many words the AI is choosing between. Try the starters in Finnish, Estonian, Latvian, Lithuanian or Swedish.

After each word, 100 little squares show how often the AI would pick each word if it guessed 100 times. A sure AI fills them with one colour, and a guessing AI leaves most of them grey.

The first visit opens a short tutorial with five steps. Playing earns titles, 17 of them, and each one names something true about how the AI works. The title you wear goes on your share card. When you finish the daily race, your result joins a live count of humans against the AI.

## Made for everyone

- **Light and dark mode.** The game follows your device, and the sun and moon button in the top bar switches it.
- **Clear colours.** Text and buttons meet the AA contrast level of the Web Content Accessibility Guidelines in both modes.
- **Keyboard.** Everything works without a mouse. In the race, the keys 1 to 4 pick a word.
- **Screen readers.** Each result is announced, and every new screen moves focus to its heading.
- **Not only colour.** Right and wrong answers show a tick or a cross.
- **Less motion.** Animations turn off when your device asks for reduced motion.

## How it works

The AI is [SmolLM2-135M](https://huggingface.co/HuggingFaceTB/SmolLM2-135M), a small open model from Hugging Face. The daily race was measured ahead of time at full precision, so everyone sees the same odds and nothing needs to download. Build a sentence and Trick the AI run the same model live in your browser through [Transformers.js](https://github.com/huggingface/transformers.js). It downloads only when you open one of them, and nothing you type leaves your device. The animations use [anime.js](https://animejs.com).

The live count is kept by [Abacus](https://jasoncameron.dev/abacus/), a free counting service. Only whether each word was right or wrong is sent, never what you picked. Local development counts under a separate name, so testing never touches the real tally.

## Run it

```bash
npm install
npm run dev
```

`npm test` runs the checks that need no model. `npm run race` measures the sentences in `scripts/sentences.txt` again and rewrites `src/data/race.json`. It downloads the full-precision model once, about 540 MB.

Made by [Shivang Gupta](https://github.com/Mangluu). The game builds on an idea from [Allison Chen and Isabella Pu](https://arxiv.org/abs/2603.28374), who proposed a word game for learning how language models work.
