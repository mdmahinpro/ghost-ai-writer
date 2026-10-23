import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { Button, fieldClass } from "@/components/ui";

const TITLES = [
  "Welcome",
  "Name your site",
  "Connect your blog",
  "Pick your AI writer",
  "Set a daily spending limit",
  "Write your first article",
  "You're set up",
];

export function SetupGuide() {
  const site = useApp((s) => s.sites.find((item) => item.id === s.activeSiteId));
  const keys = useApp((s) => s.keys);
  const setSetup = useApp((s) => s.setSetup);
  const connectStudio = useApp((s) => s.connectStudio);
  const patchVoice = useApp((s) => s.patchVoice);
  const setKeyAllowance = useApp((s) => s.setKeyAllowance);
  const queueKeywords = useApp((s) => s.queueKeywords);
  const step = site?.setupStep ?? 8;
  const [topics, setTopics] = useState("");
  const [limit, setLimit] = useState("8");
  const navigate = useNavigate();
  if (!site || site.setupSkipped || step < 1 || step > 7) return null;

  function go(next: number) {
    setSetup(next);
  }

  return (
    <section className="mb-4 rounded-lg border border-brass/40 bg-elev p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-brass">
            Setup guide · {step} / 7
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{TITLES[step - 1]}</h2>
        </div>
        <button className="text-sm text-muted hover:text-fg" onClick={() => setSetup(0)}>
          Skip guide — I'll explore on my own
        </button>
      </div>
      <div className="mt-4 max-w-2xl text-sm leading-6 text-muted">
        {step === 1 ? (
          <p>Name the site, connect Ghost or stay in the sandbox, pick a model, set a daily limit, then queue up to five topics. The last step starts real writing.</p>
        ) : null}
        {step === 2 ? (
          <p>
            <span className="text-fg">{site.name}</span> is the label inside this studio. Visitors to the blog do not see it. Rename it any time under Website.
          </p>
        ) : null}
        {step === 3 ? (
          <p>Use the sandbox to practise. Nothing is sent to a real Ghost site until you connect an Admin API key on Connections.</p>
        ) : null}
        {step === 4 ? (
          <p>The estimate is not a quote. Your provider bills the key you added. Studio writer stays available with no secret.</p>
        ) : null}
        {step === 5 ? (
          <p>Daily limits belong to each AI key. Leave the studio key as-is, or set a number of at least 1,000 tokens worth of allowance in dollars.</p>
        ) : null}
        {step === 6 ? (
          <p>Up to 5 topics, one per line. They queue immediately and publish as drafts unless Content defaults say otherwise.</p>
        ) : null}
        {step === 7 ? <p>Golden path on this page ticks off what the studio can prove. Watch the run, then review the article before it goes live.</p> : null}
      </div>
      {step === 4 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {keys.map((key) => (
            <button
              key={key.id}
              className={`rounded-lg border px-3 py-3 text-left text-sm ${site.voice.modelKeyId === key.id ? "border-brass bg-brass/10" : "border-line"}`}
              onClick={() => patchVoice({ modelKeyId: key.id })}
            >
              <span className="block font-medium text-fg">{key.label}</span>
              <span className="text-xs text-faint">{key.model}</span>
            </button>
          ))}
        </div>
      ) : null}
      {step === 5 ? (
        <label className="mt-4 block max-w-xs text-sm">
          Daily allowance (USD)
          <input className={`${fieldClass} mt-1`} value={limit} onChange={(event) => setLimit(event.target.value)} inputMode="decimal" />
        </label>
      ) : null}
      {step === 6 ? (
        <textarea
          className={`${fieldClass} mt-4 min-h-28`}
          value={topics}
          onChange={(event) => setTopics(event.target.value)}
          placeholder={"One topic per line"}
          aria-label="Topics"
        />
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => go(step - 1)}>
            Back
          </Button>
        ) : null}
        {step === 1 ? <Button onClick={() => go(2)}>Let's go</Button> : null}
        {step === 2 ? <Button onClick={() => go(3)}>Continue</Button> : null}
        {step === 3 ? (
          <>
            <Button
              onClick={() => {
                connectStudio();
                go(4);
              }}
            >
              Use sandbox
            </Button>
            <Button variant="ghost" onClick={() => navigate({ to: "/connections" })}>
              I have a real Ghost site
            </Button>
          </>
        ) : null}
        {step === 4 ? <Button onClick={() => go(5)}>Save choice</Button> : null}
        {step === 5 ? (
          <Button
            onClick={() => {
              const key = keys.find((item) => item.id === site.voice.modelKeyId) ?? keys[0];
              const amount = Number(limit);
              if (key && Number.isFinite(amount) && amount >= 0) setKeyAllowance(key.id, amount);
              go(6);
            }}
          >
            Save limit
          </Button>
        ) : null}
        {step === 6 ? (
          <>
            <Button
              onClick={() => {
                const lines = topics
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .slice(0, 5)
                  .join("\n");
                if (!lines) return;
                void queueKeywords({
                  lines,
                  publishMode: "draft",
                  modelKeyId: site.voice.modelKeyId,
                  allowVariants: false,
                });
                go(8);
                void navigate({ to: "/runs" });
              }}
            >
              Start writing
            </Button>
            <Button variant="ghost" onClick={() => go(7)}>
              Skip this step
            </Button>
          </>
        ) : null}
        {step === 7 ? (
          <>
            <Button onClick={() => navigate({ to: "/runs" })}>Watch my articles</Button>
            <Button variant="ghost" onClick={() => go(8)}>
              Go to overview
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}
