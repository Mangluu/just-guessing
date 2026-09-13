# Just Guessing

A daily game where you race a small language model at guessing the next word of a sentence. After every guess it shows you its odds.

Play it at **https://mangluu.github.io/just-guessing/**

## Why

A language model does not look anything up. At every step it scores every word it knows and picks from that list, and it sounds just as sure when it is guessing. Chatbots never show you those odds. This game does.

## How it works

The daily race is precomputed by [SmolLM2-135M](https://huggingface.co/HuggingFaceTB/SmolLM2-135M) at full precision, so everyone gets the same sentence and the same odds without downloading anything. Steer and Break run the same model live in your browser through [Transformers.js](https://github.com/huggingface/transformers.js). It downloads only when you open one of them, and nothing you type leaves your device.

## Titles and the live count

Playing earns titles, 17 of them, and each one names something true about how the model works. The one you wear goes on your share card.

When you finish the daily race, your result joins a live count of humans against the machine. Only whether each word was right or wrong is sent, never what you typed. The count is kept by [Abacus](https://jasoncameron.dev/abacus/), a free counting service, and local development counts under a separate name so testing never touches the real tally.

## Run it

```bash
npm install
npm run dev
```

`npm run race` remeasures the sentences in `scripts/sentences.txt` and rewrites `src/data/race.json`. It downloads the full-precision model once, about 540 MB. `npm test` runs the checks that need no model.

Made by Shivang Gupta as part of an application to the BSRYF AI Working Group.
