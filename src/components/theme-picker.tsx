import { useEffect, useState } from "react";
import { Check, Moon, Sun } from "lucide-react";
import { applyTheme, readStoredTheme, type ThemeId } from "@/lib/themes";

/**
 * Appearance: exactly two modes, surfaced in exactly two places — the pill
 * in the header (Sun / Moon) and the section in Content settings. Midnight
 * is for long night sessions, Paper for bright rooms; switching touches one
 * attribute (`html[data-theme]`) and the whole app, site preview included,
 * follows it. There is no third option, and there never will be again.
 */
export function ThemePicker({ variant = "header" }: { variant?: "header" | "section" }) {
  const [mode, setMode] = useState<ThemeId>(readStoredTheme);

  useEffect(() => {
    const sync = () => setMode(readStoredTheme());
    window.addEventListener("gaw-theme", sync);
    return () => window.removeEventListener("gaw-theme", sync);
  }, []);

  const set = (id: ThemeId) => {
    applyTheme(id);
    setMode(id);
  };

  if (variant === "section") {
    return (
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Appearance mode">
        <ModeCard id="midnight" label="Midnight" hint="Near-black green canvas. For long night sessions." active={mode === "midnight"} onSelect={() => set("midnight")} />
        <ModeCard id="paper" label="Paper" hint="Tinted off-white canvas. For bright rooms." active={mode === "paper"} onSelect={() => set("paper")} />
      </div>
    );
  }

  return (
    <div className="segmented" role="group" aria-label="Appearance mode">
      <button type="button" aria-pressed={mode === "paper"} title="Paper — light mode" onClick={() => set("paper")}>
        <Sun className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" aria-pressed={mode === "midnight"} title="Midnight — dark mode" onClick={() => set("midnight")}>
        <Moon className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function ModeCard({
  id,
  label,
  hint,
  active,
  onSelect,
}: {
  id: ThemeId;
  label: string;
  hint: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      data-surface="card"
      className={`flex items-start gap-3 rounded-lg border p-4 text-left ${
        active ? "border-accent bg-accent/8" : "border-line hover:border-line-strong"
      }`}
    >
      <span className={`mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-md border ${active ? "border-accent/40 bg-accent/15 text-accent" : "border-line text-faint"}`}>
        {id === "midnight" ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{label}</span>
        <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>
      </span>
      {active && (
        <span className="mt-0.5 text-accent" aria-hidden>
          <Check className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}
