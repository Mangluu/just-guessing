export default function Why({ onPlay }: { onPlay: () => void }) {
  return (
    <article className="why">
      <p className="kicker">For parents and teachers</p>
      <h1>A game about odds, not answers</h1>
      <section>
        <h2>What it is</h2>
        <p>Every day there is one sentence with its last five words hidden. You and a small language model both guess them, one word at a time. After each guess you see what the AI would say if it guessed 100 times, drawn as 100 little squares. A sure AI fills them with one colour. A guessing AI leaves most of them grey.</p>
      </section>
      <section>
        <h2>What it shows</h2>
        <p>A language model does not look anything up. At every step it scores every word and word piece it knows, then picks from that list. It sounds just as sure when it is guessing as when it is right. Chatbots never show you those odds. This does.</p>
      </section>
      <section>
        <h2>Why a game</h2>
        <p>Young people use chatbots to find things out. In a Pew survey of US teenagers in late 2025, 57 percent said they use them to search for information and 54 percent use them for schoolwork.</p>
        <p>A study with middle school girls found they started out overtrusting generative AI, and that seeing its limits and mistakes for themselves is what changed that. So this does not lecture. It lets you watch the AI guess, lose to it, and sometimes beat it.</p>
      </section>
      <section>
        <h2>How it works</h2>
        <p>The model is SmolLM2, a small open model from Hugging Face with 135 million parameters. The daily race was computed ahead of time at full precision, so everyone gets the same sentence and the same odds without downloading anything.</p>
        <p>Build a sentence and Trick the AI run the same model live, inside your browser. It downloads once, between 118 and 182 megabytes depending on your browser, and nothing you type leaves your device. That copy is squeezed to 4 bits so it fits, which makes its guesses a little blurrier than the race.</p>
      </section>
      <section>
        <h2>Why a small model</h2>
        <p>The chatbots you use do the same thing, one word at a time. They are far bigger, far better trained, and they hide the odds. A small model is honest enough to watch.</p>
      </section>
      <section>
        <h2>Why your language</h2>
        <p>SmolLM2 was built to understand and write mostly English. Ask it something in Finnish or Estonian and it goes from choosing between a handful of options to choosing between hundreds. The languages of the Baltic Sea region are close to invisible to it. That gap is worth talking about.</p>
      </section>
      <section>
        <h2>Made for everyone</h2>
        <p>It works in light and dark mode, and with only a keyboard. It is built for screen readers too, so each result is read out as it happens. Right and wrong answers show a tick or a cross as well as a colour, so colour blind players can follow along. Animations turn off when a device asks for less motion.</p>
      </section>
      <section>
        <h2>The live count</h2>
        <p>When you finish the daily race, your result joins a public count of humans against the AI. Only whether each word was right or wrong is sent, never the words you picked. Practice races are not counted.</p>
      </section>
      <section>
        <h2>Credits</h2>
        <p>Made by <a href="https://github.com/Mangluu" target="_blank" rel="noreferrer">Shivang Gupta</a>. <a href="https://arxiv.org/abs/2603.28374" target="_blank" rel="noreferrer">Allison Chen and Isabella Pu</a> proposed a game in 2026 where a player and a computer take turns choosing words from a list of odds. This builds on that idea with a real model.</p>
        <ol>
          <li><a href="https://www.pewresearch.org/internet/2026/02/24/how-teens-use-and-view-ai/" target="_blank" rel="noreferrer">Pew Research Center, How Teens Use and View AI, 2026</a></li>
          <li><a href="https://arxiv.org/abs/2404.14511" target="_blank" rel="noreferrer">Children’s Overtrust and Shifting Perspectives of Generative AI, arXiv</a></li>
          <li><a href="https://arxiv.org/html/2603.28374" target="_blank" rel="noreferrer">Chen and Pu, Using Games to Learn How Large Language Models Work, arXiv, 2026</a></li>
          <li><a href="https://huggingface.co/HuggingFaceTB/SmolLM2-135M" target="_blank" rel="noreferrer">SmolLM2-135M by Hugging Face, Apache 2.0</a></li>
          <li><a href="https://github.com/huggingface/transformers.js" target="_blank" rel="noreferrer">Transformers.js</a></li>
          <li><a href="https://animejs.com" target="_blank" rel="noreferrer">anime.js, for the animations</a></li>
          <li><a href="https://jasoncameron.dev/abacus/" target="_blank" rel="noreferrer">Abacus, the free counting service behind the live count</a></li>
        </ol>
      </section>
      <button className="btn wide" onClick={onPlay}>Back to the game</button>
    </article>
  );
}
