// A tick or a cross, so right and wrong never depend on colour alone.
export default function Mark({ ok }: { ok: boolean }) {
  return (
    <svg className="mark" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="10" />
      {ok ? <path d="M5.5 10.5l3 3 6-7" /> : <path d="M6.5 6.5l7 7M13.5 6.5l-7 7" />}
    </svg>
  );
}

// The missing word. Screen readers hear "blank" instead of a question mark.
export function Gap() {
  return <span className="gap"><span aria-hidden="true">?</span><span className="sr-only" lang="en">blank</span></span>;
}
