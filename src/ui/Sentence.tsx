import { Fragment } from "react";

export type Mark = "you" | "mach" | "both" | "none";

type Props = { opening: string; words: string[]; blank?: boolean; drop?: boolean; end?: string; marks?: Mark[] };

export default function Sentence({ opening, words, blank = false, drop = false, end = "", marks }: Props) {
  return (
    <p className="sentence">
      {opening}
      {words.map((w, i) => (
        <Fragment key={i}>
          {" "}
          <span className={["w", drop && i === words.length - 1 ? "drop" : "", marks?.[i] ?? ""].join(" ").trim()}>{w}</span>
        </Fragment>
      ))}
      {blank && <>{" "}<span className="blank" role="img" aria-label="the next word" /></>}
      {end}
    </p>
  );
}
