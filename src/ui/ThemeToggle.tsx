import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "just-guessing.theme";
const GROUND: Record<Theme, string> = { light: "#F4F6FB", dark: "#14131F" };

function current(): Theme {
  const picked = document.documentElement.dataset.theme;
  if (picked === "light" || picked === "dark") return picked;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Follows the device until someone chooses, then remembers the choice.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(current);

  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => { if (!document.documentElement.dataset.theme) setTheme(current()); };
    mq.addEventListener("change", follow);
    return () => mq.removeEventListener("change", follow);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  function flip() {
    document.documentElement.dataset.theme = next;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", GROUND[next]));
    try { localStorage.setItem(KEY, next); } catch { /* storage blocked: the switch still works for this visit */ }
    setTheme(next);
  }

  return (
    <button className="chip-btn icon-btn" onClick={flip} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
      )}
    </button>
  );
}
