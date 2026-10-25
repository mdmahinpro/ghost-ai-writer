/**
 * The floating dispatch bar (Hilos pattern).
 *
 * One input, docked bottom-centre: type a topic and it becomes a real run
 * through the same `queueKeywords` action the Create page uses — not a second
 * code path with its own ideas about defaults.
 *
 * It refuses politely instead of failing late: no workspace, no model key, or an
 * empty topic disables the button and says which one is missing.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "@/lib/store";

export function CommandBar() {
  const data = useApp();
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const site = data.sites.find((item) => item.id === data.activeSiteId) ?? data.sites[0];
  const usableKeys = data.keys.filter((key) => !key.disabled);
  const blocked = !site ? "Create a website workspace first" : !usableKeys.length ? "Add an AI key first" : null;
  const canSend = Boolean(topic.trim()) && !blocked && !busy;

  async function dispatch() {
    const text = topic.trim();
    if (!text || !canSend) return;
    setBusy(true);
    setError(null);
    try {
      const runId = await data.queueKeywords({
        lines: text,
        publishMode: "default",
        modelKeyId: "default",
        allowVariants: false,
      });
      if (!runId) {
        setError("The queue refused this topic — check AI keys on Content settings.");
        return;
      }
      setTopic("");
      void navigate({ to: "/runs/$id", params: { id: runId } });
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : "Dispatch failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-none sticky bottom-0 z-30 mt-6 flex justify-center pb-3">
      <div className="pointer-events-auto w-full max-w-2xl">
        {error ? <p className="mb-1.5 px-2 text-center text-xs" style={{ color: "var(--color-danger)" }}>{error}</p> : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void dispatch();
          }}
          className="flex items-center gap-2 rounded-[16px] border border-line bg-elev px-2.5 py-2 shadow-[0_8px_28px_rgb(0_0_0_/_0.28)]"
        >
          <span aria-hidden className="pl-1 font-mono text-xs text-faint">
            ⌘
          </span>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder={blocked ?? "Dispatch a topic, URL, or command…"}
            aria-label="Dispatch a topic"
            disabled={Boolean(blocked) || busy}
            className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-faint disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-brass px-3.5 text-xs font-medium text-ink disabled:opacity-40"
          >
            {busy ? "Dispatching…" : "Dispatch"}
          </button>
        </form>
      </div>
    </div>
  );
}
