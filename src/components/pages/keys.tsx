import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { listCustomModels, testCustomModel } from "@/lib/providers.functions";
import {
  DEFAULT_EMBEDDING_MODEL,
  PROVIDER_BASE_URLS,
  PROVIDER_LABELS,
  blendedPricePerMillion,
  embeddingModelFor,
  modelsForProvider,
  type ModelProvider,
} from "@/lib/model-catalog";
import { Badge, Button, Card, Field, PageIntro, fieldClass, statusTone } from "@/components/ui";
import { money, nextUtcResetLabel, relTime, utcDay } from "@/lib/utils";
import type { WebSearchMode } from "@/lib/types";

const SEARCH_MODES: { value: WebSearchMode; label: string; hint: string }[] = [
  { value: "off", label: "Off", hint: "No live sources. Ideas and drafts stay offline." },
  { value: "tavily", label: "Tavily", hint: "Tavily search + snippets power research." },
  { value: "firecrawl", label: "Firecrawl", hint: "Firecrawl search and page scraping." },
  { value: "auto-fallback", label: "Auto-Fallback", hint: "Tavily first; Firecrawl catches failures." },
];

export function KeysPage() {
  const keys = useApp((s) => s.keys);
  const events = useApp((s) => s.events);
  const webSearch = useApp((s) => s.webSearch);
  const addKey = useApp((s) => s.addKey);
  const toggleKey = useApp((s) => s.toggleKey);
  const deleteKey = useApp((s) => s.deleteKey);
  const patchKey = useApp((s) => s.patchKey);
  const setKeyAllowance = useApp((s) => s.setKeyAllowance);
  const setWebSearchMode = useApp((s) => s.setWebSearchMode);
  const importWebSearchKeys = useApp((s) => s.importWebSearchKeys);
  const clearWebSearchKeys = useApp((s) => s.clearWebSearchKeys);
  const clearCooldowns = useApp((s) => s.clearCooldowns);

  const [providerKind, setProviderKind] = useState<ModelProvider>("openai");
  const [catalogId, setCatalogId] = useState("openai/gpt-5.6-luna");
  const [customModel, setCustomModel] = useState("glm-5.3-flash");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState(PROVIDER_BASE_URLS.openai);
  const [secret, setSecret] = useState("");
  const [allowance, setAllowance] = useState(20);
  const [priority, setPriority] = useState(100);
  const [embeddingModel, setEmbeddingModel] = useState(DEFAULT_EMBEDDING_MODEL);
  const [testing, setTesting] = useState(false);
  const [testNote, setTestNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchNote, setFetchNote] = useState("");
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [tavilyPool, setTavilyPool] = useState("");
  const [firecrawlPool, setFirecrawlPool] = useState("");

  const day = utcDay(Date.now());
  const today = events.filter((event) => utcDay(event.at) === day);
  const settled = today.filter((event) => event.state === "SETTLED");
  const reserved = today.filter((event) => event.state === "RESERVED");
  const released = today.filter((event) => event.state === "RELEASED");
  const closed = new Set(events.filter((event) => event.state !== "RESERVED").map((event) => event.pairId));
  const orderedKeys = useMemo(() => [...keys].sort((a, b) => b.priority - a.priority), [keys]);

  const providerModels = useMemo(() => modelsForProvider(providerKind), [providerKind]);
  const catalog = providerModels.find((model) => model.id === catalogId) ?? providerModels[0];
  const effectiveModel = providerKind === "custom" ? customModel.trim() : (catalog?.modelId ?? "");
  const pricePerM = catalog ? blendedPricePerMillion(catalog) : 1;

  function pickProvider(next: ModelProvider) {
    setProviderKind(next);
    setBaseUrl(PROVIDER_BASE_URLS[next]);
    const first = modelsForProvider(next)[0];
    if (first) setCatalogId(first.id);
    setEmbeddingModel(embeddingModelFor({ provider: PROVIDER_LABELS[next], providerKind: next }) ?? "");
  }

  function resetForm() {
    setEditingId(null);
    setFetchNote("");
    setFetchedModels([]);
    setTestNote("");
    setProviderKind("custom");
    setBaseUrl("");
    setCustomModel("");
    setLabel("");
    setSecret("");
    setAllowance(20);
    setPriority(100);
    setEmbeddingModel("");
  }

  function startEdit(key: (typeof keys)[number]) {
    const kind: ModelProvider = key.providerKind ?? (key.catalogId ? "openai" : "custom");
    setEditingId(key.id);
    setProviderKind(kind);
    setBaseUrl(key.baseUrl ?? PROVIDER_BASE_URLS[kind]);
    setLabel(key.label);
    setAllowance(key.allowanceUsd);
    setPriority(key.priority);
    setSecret(key.secret ?? "");
    setEmbeddingModel(embeddingModelFor(key) ?? "");
    setFetchNote("");
    setFetchedModels([]);
    setTestNote("");
    if (kind === "custom") {
      setCustomModel(key.model);
    } else if (key.catalogId) {
      setCatalogId(key.catalogId);
    } else {
      const match = modelsForProvider(kind).find((model) => model.modelId === key.model);
      if (match) setCatalogId(match.id);
    }
  }

  function fetchModels() {
    const base = baseUrl.trim();
    if (!base || !secret.trim()) return;
    setFetchingModels(true);
    setFetchNote("");
    void listCustomModels({ data: { baseUrl: base, apiKey: secret } })
      .then((result) => {
        if (result.ok) {
          setFetchedModels(result.models);
          setFetchNote(`${result.models.length} model${result.models.length === 1 ? "" : "s"} found. Pick one or keep typing your own.`);
        } else {
          setFetchedModels([]);
          setFetchNote(result.error);
        }
      })
      .catch(() => setFetchNote("Fetch failed."))
      .finally(() => setFetchingModels(false));
  }

  return (
    <div className="stagger space-y-4">
      <PageIntro
        eyebrow="Settings"
        title="AI keys and usage"
        lede="Build a multi-key pool with auto-failover. Add OpenAI, OpenRouter, or any OpenAI-compatible endpoint (custom base URL + model id). When the primary key is busy, rate-limited, or out of allowance, the next key finishes the job and still publishes to Ghost."
      />

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-fg">Failover pool</h2>
          <Badge tone={orderedKeys.length ? "ok" : "muted"}>{orderedKeys.length} key{orderedKeys.length === 1 ? "" : "s"} · tried top-down</Badge>
        </div>
        <p className="text-[12px] leading-5 text-faint">Higher priority is tried first. 401/403 disables a key; 429 cools it for 12 seconds; config errors (400/404) and transient 5xx never cool the key. Remaining keys carry the run.</p>
        <div>
          <Button variant="ghost" onClick={() => clearCooldowns()}>
            Clear cooldown & retry all pending jobs
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {orderedKeys.map((key, index) => {
          const spent = settled.filter((event) => event.keyId === key.id).reduce((sum, event) => sum + event.usd, 0);
          const open = events
            .filter((event) => event.keyId === key.id && event.state === "RESERVED" && !closed.has(event.pairId))
            .reduce((sum, event) => sum + event.usd, 0);
          const cooling = key.cooldownUntil && key.cooldownUntil > Date.now();
          return (
            <Card key={key.id} className="min-w-0 p-3.5">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-fg">
                    #{index + 1} · {key.provider} · {key.model}
                  </div>
                  <div className="num mt-0.5 truncate text-[11px] text-faint">
                    priority {key.priority} · {key.hint}
                    {key.baseUrl ? ` · ${key.baseUrl}` : ""}
                  </div>
                </div>
                <Badge tone={key.disabled || (key.serverKeyId === undefined && !key.secret) ? "danger" : cooling ? "brass" : key.providerKind === "custom" ? "brass" : "ok"}>
                  {key.disabled
                    ? "disabled"
                    : key.serverKeyId === undefined && !key.secret
                      // Nothing on the server and nothing local: this row exists in
                      // this browser only and cannot generate.
                      ? "not saved"
                      : cooling
                        ? `cooling ${Math.max(1, Math.round((key.cooldownUntil! - Date.now()) / 60000))}m`
                        : key.providerKind === "custom"
                          ? "custom"
                          : "active"}
                </Badge>
              </div>
              <dl className="mt-3 min-w-0 space-y-1 text-[12px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Capabilities</dt>
                  <dd className="min-w-0 break-words text-right">
                    {[key.chat ? "Chat" : "", embeddingModelFor(key) ? `Semantic (${embeddingModelFor(key)})` : "Semantic: hash fallback", key.serverKeyId !== undefined || key.secret ? "Live key" : "No key saved"].filter(Boolean).join(" + ")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Today settled</dt>
                  <dd className="font-mono">{money(spent)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Allowance</dt>
                  <dd className="flex items-center gap-2 font-mono">
                    <input
                      className={`${fieldClass} h-8 w-24 py-1`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={key.allowanceUsd}
                      onChange={(e) => setKeyAllowance(key.id, Number(e.target.value))}
                      aria-label="Daily allowance"
                    />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Reserved</dt>
                  <dd className="font-mono">{money(open)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Last used</dt>
                  <dd className="text-muted">{key.lastUsedAt ? relTime(key.lastUsedAt) : "Never"}</dd>
                </div>
              </dl>
              {key.lastError ? (
                <p className="mt-2 rounded-lg border border-danger/30 bg-danger/5 px-2 py-1.5 font-mono text-xs break-words text-danger">
                  {key.lastError}
                  {key.lastErrorAt ? <span className="block text-faint">{relTime(key.lastErrorAt)}</span> : null}
                </p>
              ) : null}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => toggleKey(key.id)}>
                  {key.disabled ? "Enable" : "Disable"}
                </Button>
                <Button variant="ghost" onClick={() => startEdit(key)}>
                  {editingId === key.id ? "Editing…" : "Edit"}
                </Button>
                {key.cooldownUntil ? (
                  <Button variant="ghost" size="sm" onClick={() => clearCooldowns()}>
                    Clear cooldown
                  </Button>
                ) : null}
                <Button
                  variant="danger"
                  size="sm"
                  aria-label={`Delete ${key.label}`}
                  onClick={() => {
                    if (typeof window !== "undefined" && !window.confirm(`Delete "${key.label}" permanently? Usage ledger rows stay in Billing.`)) return;
                    if (editingId === key.id) resetForm();
                    deleteKey(key.id);
                  }}
                >
                  Delete key
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="grid gap-3 p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight">{editingId ? "Edit custom endpoint" : "Add a key to the pool"}</h2>
            {editingId ? <Badge tone="brass">editing a saved key</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted">OpenAI and OpenRouter use their catalogs. Custom points at any OpenAI-compatible gateway (GLM, DeepSeek, Groq, xAI, your own proxy). Enter the base URL and key, then Fetch Models to pick the exact model id.</p>
        </div>
        <Field label="Provider">
          <select className={fieldClass} value={providerKind} onChange={(e) => pickProvider(e.target.value as ModelProvider)}>
            {(Object.keys(PROVIDER_LABELS) as ModelProvider[]).map((value) => (
              <option key={value} value={value}>
                {PROVIDER_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        {providerKind === "custom" ? (
          <Field label="Custom model id" hint="Pick a fetched model or type the exact model string your gateway expects.">
            <input
              className={`${fieldClass} font-mono`}
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="glm-5.3-flash"
              list={fetchedModels.length ? "custom-model-options" : undefined}
              autoComplete="off"
            />
            {fetchedModels.length ? (
              <datalist id="custom-model-options">
                {fetchedModels.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            ) : null}
          </Field>
        ) : (
          <Field label="Model" hint={catalog?.note ?? "Prices are blended input/output per 1M tokens."}>
            <select className={fieldClass} value={catalogId} onChange={(e) => setCatalogId(e.target.value)}>
              {providerModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label} · ${model.inputPricePerMillion}/${model.outputPricePerMillion}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Label" hint="Shown on the key card and in usage events.">
          <input className={fieldClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`${PROVIDER_LABELS[providerKind]} ${effectiveModel || "key"}`} />
        </Field>
        <Field label="API base URL" hint={providerKind === "custom" ? "Include /v1 when the gateway expects it. Do not paste the key here." : "Defaults to the provider endpoint."}>
          <input className={`${fieldClass} font-mono`} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
        </Field>
        <Field label="API key">
          <input className={`${fieldClass} font-mono`} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" placeholder="sk-…" />
        </Field>
        {providerKind === "custom" ? (
          <div className="flex flex-wrap items-center gap-2 md:col-span-2">
            <Button variant="ghost" disabled={fetchingModels || !baseUrl.trim() || !secret.trim()} onClick={fetchModels}>
              {fetchingModels ? "Fetching…" : "Fetch Models"}
            </Button>
            <span className="text-xs text-faint">Calls {baseUrl.trim() || "your base URL"}/models with your key, then fills a searchable model list. Manual typing still works.</span>
            {fetchNote ? <span className="w-full text-sm text-muted">{fetchNote}</span> : null}
          </div>
        ) : null}
        <Field label="Daily allowance ($)" hint="Leave generous for unlimited-scale runs; per-key caps still apply.">
          <input className={`${fieldClass} font-mono`} type="number" min={0.5} step={0.5} value={allowance} onChange={(e) => setAllowance(Number(e.target.value))} />
        </Field>
        <Field label="Priority" hint="Higher runs first. Give backups a lower number.">
          <input className={`${fieldClass} font-mono`} type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
        </Field>
        <Field
          label="Semantic model (embeddings)"
          hint="The L3 duplicate gate calls /embeddings with this model — never your chat model. Blank = provider default; a family with no embeddings route keeps the local hash fallback."
        >
          <input
            className={`${fieldClass} font-mono`}
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            placeholder={providerKind === "openai" ? DEFAULT_EMBEDDING_MODEL : "text-embedding-3-small"}
            autoComplete="off"
          />
        </Field>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button
            onClick={() => {
              if (!effectiveModel) return;
              const nextLabel = label.trim() || `${PROVIDER_LABELS[providerKind]} ${effectiveModel}`;
              if (editingId) {
                patchKey(editingId, {
                  provider: PROVIDER_LABELS[providerKind],
                  model: effectiveModel,
                  label: nextLabel,
                  allowanceUsd: allowance,
                  priority,
                  baseUrl,
                  secret,
                  providerKind,
                  catalogId: providerKind === "custom" ? undefined : catalogId,
                  pricePerM,
                  embeddingModel: embeddingModel.trim() || undefined,
                });
                resetForm();
                return;
              }
              void addKey({
                provider: PROVIDER_LABELS[providerKind],
                model: effectiveModel,
                label: nextLabel,
                allowanceUsd: allowance,
                priority,
                baseUrl,
                secret,
                providerKind,
                catalogId: providerKind === "custom" ? undefined : catalogId,
                pricePerM,
                embeddingModel: embeddingModel.trim() || undefined,
              });
              setSecret("");
              setLabel("");
            }}
            disabled={!effectiveModel}
          >
            {editingId ? "Save changes" : "Save key"}
          </Button>
          {editingId ? (
            <Button variant="quiet" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
          <Button
            variant="ghost"
            disabled={testing || !secret || !baseUrl || !effectiveModel}
            onClick={() => {
              setTesting(true);
              setTestNote("");
              void testCustomModel({ data: { baseUrl, apiKey: secret, model: effectiveModel } })
                .then((result) => setTestNote(result.ok ? `Connected. Sample: ${result.sample}` : result.error))
                .catch(() => setTestNote("Test failed."))
                .finally(() => setTesting(false));
            }}
          >
            {testing ? "Testing…" : "Test connection"}
          </Button>
        </div>
        {testNote ? <p className="text-sm text-muted md:col-span-2">{testNote}</p> : null}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Web search switch</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Powers live research: source scraping for runs and web context for the niche research engine. Each provider keeps its own key pool with failover.
            </p>
          </div>
          <Badge tone={webSearch.mode === "off" ? "muted" : "ok"}>{webSearch.mode}</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Web search mode">
          {SEARCH_MODES.map((mode) => (
            <button
               key={mode.value}
               type="button"
               aria-pressed={webSearch.mode === mode.value}
               onClick={() => setWebSearchMode(mode.value)}
               className={`rounded-md border p-2.5 text-left text-[13px] transition-colors ${webSearch.mode === mode.value ? "border-accent/60 bg-accent/10" : "border-line bg-surface/40 hover:border-line-strong"}`}
            >
              <span className="block font-medium text-fg">{mode.label}</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-faint">{mode.hint}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-md border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Tavily keys</span>
              <Badge tone={webSearch.tavilyKeys.length ? "ok" : "muted"}>{webSearch.tavilyKeys.filter((key) => !key.disabled).length}/{webSearch.tavilyKeys.length} ready</Badge>
            </div>
            <textarea className={`${fieldClass} font-mono`} rows={3} value={tavilyPool} onChange={(e) => setTavilyPool(e.target.value)} placeholder="tvly-… one per line" />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!tavilyPool.trim()}
                onClick={() => {
                  importWebSearchKeys("tavily", tavilyPool);
                  setTavilyPool("");
                }}
              >
                Add Tavily keys
              </Button>
              <Button variant="danger" disabled={!webSearch.tavilyKeys.length} onClick={() => clearWebSearchKeys("tavily")}>
                Clear
              </Button>
            </div>
          </div>
          <div className="space-y-2 rounded-md border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Firecrawl keys</span>
              <Badge tone={webSearch.firecrawlKeys.length ? "ok" : "muted"}>{webSearch.firecrawlKeys.filter((key) => !key.disabled).length}/{webSearch.firecrawlKeys.length} ready</Badge>
            </div>
            <textarea className={`${fieldClass} font-mono`} rows={3} value={firecrawlPool} onChange={(e) => setFirecrawlPool(e.target.value)} placeholder="fc-… one per line" />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!firecrawlPool.trim()}
                onClick={() => {
                  importWebSearchKeys("firecrawl", firecrawlPool);
                  setFirecrawlPool("");
                }}
              >
                Add Firecrawl keys
              </Button>
              <Button variant="danger" disabled={!webSearch.firecrawlKeys.length} onClick={() => clearWebSearchKeys("firecrawl")}>
                Clear
              </Button>
            </div>
          </div>
        </div>
        {webSearch.tavilyKeys.length || webSearch.firecrawlKeys.length ? (
          <ul className="flex flex-wrap gap-2 text-xs">
            {[...webSearch.tavilyKeys.map((key) => ({ ...key, provider: "tavily" })), ...webSearch.firecrawlKeys.map((key) => ({ ...key, provider: "firecrawl" }))].map((key) => (
              <li key={key.id} className="rounded-lg border border-line px-2 py-1 font-mono">
                {key.provider} {key.hint} · {key.disabled ? "paused" : key.cooldownUntil && key.cooldownUntil > Date.now() ? "cooling" : "ready"}
                {key.lastError ? ` · ${key.lastError}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Blader humanizer (native)</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              The external Metric37 API is gone. Humanization runs in-app on the blader/humanizer ruleset (26 Wikipedia "Signs of AI writing" patterns): a deterministic pass always runs, and every usable model key on this page powers the two-pass surgical audit + rewrite in the assigned US author's voice.
            </p>
          </div>
          <Badge tone="ok">engine on</Badge>
        </div>
        <ul className="grid gap-2 text-xs text-muted">
          <li>Pass 1 (audit): deterministic + LLM scan for staging contrasts, one-line closers, forced triads, dash chaining, banned vocabulary, inflated significance, sales language, formatting tells, and chatbot residue.</li>
          <li>Pass 2 (rewrite): surgical rewrite that preserves the Bing skeleton — H1/H2/H3, markdown tables, internal links, and the direct-answer opening.</li>
          <li>The humanization score and the stripped-pattern list land on each article; the revision stage records the same on the job.</li>
        </ul>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap gap-4 font-mono text-sm">
          <span>SETTLED today {settled.length}</span>
          <span>RESERVED today {reserved.length}</span>
          <span className="text-muted">RELEASED today {released.length}</span>
          <span className="text-muted">UTC reset {nextUtcResetLabel()}</span>
        </div>
        <ul className="mt-3 divide-y divide-line text-sm">
          {events.slice(0, 12).map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="flex items-center gap-2">
                <Badge tone={statusTone(event.state === "SETTLED" ? "completed" : event.state === "RELEASED" ? "cancelled" : "queued")}>{event.state}</Badge>
                <span>
                  {event.provider} / {event.model}
                </span>
                <span className="text-muted">{event.stage}</span>
              </span>
              <span className="font-mono text-xs text-faint">
                {event.tokens} tok · {money(event.usd)} · {relTime(event.at)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
