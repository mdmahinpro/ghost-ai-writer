import { useEffect, useState, type ReactNode } from "react";
import {
  hasAdminToken,
  isTokenRejected,
  onTokenStateChange,
  setAdminToken,
} from "@/lib/api-client";

/**
 * Asks for the backend token before the app runs.
 *
 * The token cannot be shipped in the bundle (a `VITE_*` value is inlined at
 * build time and would be readable by anyone loading the page), so the person
 * using the app supplies it once per browser session. It lives in
 * `sessionStorage` and dies with the tab.
 */
export function TokenGate({ children }: { children: ReactNode }) {
  // Re-render when the client reports a rejected token.
  const [, setTick] = useState(0);
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  // sessionStorage only exists in the browser: decide after mounting so the
  // server-rendered markup and the first client render cannot disagree.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return onTokenStateChange(() => setTick((tick) => tick + 1));
  }, []);

  if (!mounted) return null;

  const rejected = isTokenRejected();
  const locked = !hasAdminToken() || rejected;
  if (!locked) return <>{children}</>;

  const save = () => {
    if (!value.trim()) return;
    setAdminToken(value);
    // Reload so every poller and the initial hydrate start with credentials.
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-bg px-6 py-10 text-fg">
      <div className="w-full max-w-[440px] rounded-xl border border-line bg-elev p-7 shadow-sm">
        <p className="eyebrow">Access</p>
        <h1 className="display mt-2">Backend token</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {rejected
            ? "That token was rejected by the server. Paste a valid one to continue."
            : "This app talks to your Rust backend, which is locked with an admin token. Paste it once — it is kept for this browser session only and is never baked into the page."}
        </p>

        <div className="mt-6">
          <label
            htmlFor="gaw-token"
            className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-faint"
          >
            Admin token
          </label>
          <input
            id="gaw-token"
            type={reveal ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
            }}
            placeholder="GAW_ADMIN_TOKEN"
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 font-mono text-sm text-fg placeholder:text-faint focus:border-brass/60 focus:outline-none focus:ring-2 focus:ring-brass/20"
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!value.trim()}
            className="h-11 flex-1 rounded-md bg-brass px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brass-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => setReveal((on) => !on)}
            className="h-11 rounded-md border border-line bg-surface px-4 text-sm font-medium text-fg transition-colors duration-150 hover:border-line-strong hover:bg-surface-2"
          >
            {reveal ? "Hide" : "Show"}
          </button>
        </div>

        <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-faint">
          Set <code className="font-mono text-[11px] text-muted">GAW_ADMIN_TOKEN</code> on the API
          service (16+ characters) to require one. If the API has no token configured, any value
          works.
        </p>
      </div>
    </div>
  );
}

export default TokenGate;
