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
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--background, #f2f4f1)",
        color: "var(--foreground, #1c2420)",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--card, #ffffff)",
          border: "1px solid var(--border, #d7ddd8)",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 20px 60px rgba(0,0,0,.12)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20, letterSpacing: "-0.01em" }}>Backend token</h1>
        <p style={{ margin: "10px 0 18px", fontSize: 14, lineHeight: 1.55, opacity: 0.75 }}>
          {rejected
            ? "That token was rejected by the server. Paste a valid one to continue."
            : "This app talks to your Rust backend, which is locked with an admin token. Paste it once — it is kept for this browser session only and is never baked into the page."}
        </p>
        <label
          htmlFor="gaw-token"
          style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, opacity: 0.7 }}
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
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            fontSize: 14,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "inherit",
            background: "transparent",
            border: "1px solid var(--border, #d7ddd8)",
            borderRadius: 10,
            outline: "none",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <button
            type="button"
            onClick={save}
            disabled={!value.trim()}
            style={{
              flex: 1,
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--primary-foreground, #ffffff)",
              background: "var(--primary, #2f6e62)",
              border: "none",
              borderRadius: 10,
              cursor: value.trim() ? "pointer" : "not-allowed",
              opacity: value.trim() ? 1 : 0.5,
            }}
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => setReveal((on) => !on)}
            style={{
              padding: "10px 12px",
              fontSize: 13,
              color: "inherit",
              background: "transparent",
              border: "1px solid var(--border, #d7ddd8)",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            {reveal ? "Hide" : "Show"}
          </button>
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 12, lineHeight: 1.5, opacity: 0.6 }}>
          Set <code>GAW_ADMIN_TOKEN</code> on the API service (16+ characters) to require one. If
          the API has no token configured, any value works.
        </p>
      </div>
    </div>
  );
}

export default TokenGate;
