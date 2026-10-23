import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { applyTheme, readStoredTheme, THEMES, type ThemeId } from "@/lib/themes";

export function ThemePicker({ variant = "menu" }: { variant?: "menu" | "section" }) {
  const [theme, setTheme] = useState<ThemeId>("paper");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const id = readStoredTheme();
    applyTheme(id);
    setTheme(id);
  }, []);

  useEffect(() => {
    function sync() {
      setTheme(readStoredTheme());
    }
    window.addEventListener("gaw-theme", sync);
    return () => window.removeEventListener("gaw-theme", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(id: ThemeId) {
    applyTheme(id);
    setTheme(id);
    setOpen(false);
  }

  if (variant === "section") {
    return (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => choose(item.id)}
            aria-pressed={theme === item.id}
            className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm ${theme === item.id ? "border-brass bg-brass/10" : "border-line"}`}
          >
            <span className="flex shrink-0 -space-x-1">
              <span className="size-5 rounded-full border border-line" style={{ background: item.canvas }} />
              <span className="size-5 rounded-full border border-line" style={{ background: item.accent }} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    );
  }

  const current = THEMES.find((item) => item.id === theme) ?? THEMES[0];
  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        className="grid size-11 place-items-center rounded-lg border border-line"
        aria-label="Theme"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="size-4 rounded-full border border-line" style={{ background: current.accent }} />
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-30 w-48 rounded-lg border border-line bg-elev p-1" role="listbox" aria-label="Themes">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={theme === item.id}
              onClick={() => choose(item.id)}
              className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm ${theme === item.id ? "bg-surface text-fg" : "text-muted"}`}
            >
              <span className="size-4 shrink-0 rounded-full border border-line" style={{ background: item.canvas }} />
              <span className="size-2 shrink-0 rounded-full" style={{ background: item.accent }} />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
