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
import { Button, Field, PageIntro, fieldClass, statusTone } from "@/components/ui";
import { money, nextUtcResetLabel, relTime, utcDay } from "@/lib/utils";
import type { WebSearchMode } from "@/lib/types";

const SEARCH_MODES: { value: WebSearchMode; label: string; hint: string }[] = [
  { value: "off", label: "Off", hint: "No live sources. Ideas and drafts stay offline." },
  { value: "tavily", label: "Tavily", hint: "Tavily search + snippets power research." },
  { value: "firecrawl", label: "Firecrawl", hint: "Firecrawl search and page scraping." },
  { value: "auto-fallback", label: "Auto-Fallback", hint: "Tavily first; Firecrawl catches failures." },
];

function pillClass(tone: "ok" | "danger" | "warn" | "brass" | "muted") {
  if (tone === "ok") return "border-ok/30 bg-ok/10 text-ok";
  if (tone === "danger") return "border-danger/30 bg-danger/10 text-danger";
  if (tone === "warn") return "border-warn/30 bg-warn/10 text-warn";
  if (tone === "brass") return "border-brass/30 bg-brass/10 text-brass";
  return "border-line bg-surface text-muted";
}

const pillBase = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium";

const compactField =
  "h-8 w-24 rounded-md border border-line bg-surface px-2 text-right font-mono text-[12px] text-fg outline-none transition-colors duration-150 placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20";

export function KeysPage() {
  const keys = useApp((s) => s.keys);
  const sites = useApp((s) => s.sites);
  // Every key belongs to one workspace. The label below each key names it, so a
  // key saved in another workspace can never look like an account-wide default.
  const workspaceOf = (siteId?: string) => sites.find((site) => site.id === siteId)?.name ?? "no workspace";
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
    <div className="stagger space-y-5">
      <PageIntro
        eyebrow="Settings"
        title="AI keys and usage"
        lede="Build a multi-key pool with auto-failover. Add OpenAI, OpenRouter, or any OpenAI-compatible endpoint (custom base URL + model id). When the primary key is busy, rate-limited, or out of allowance, the next key finishes the job and still publishes to Ghost."
      />

      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Failover pool</h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">
              Higher priority is tried first. 401/403 disables a key; 429 cools it for 12 seconds; config errors (400/404) and transient 5xx never cool the key. Remaining keys carry the run.
            </p>
          </div>
          <span className={`${pillBase} ${pillClass(orderedKeys.length ? "ok" : "muted")}`}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {orderedKeys.length} key{orderedKeys.length === 1 ? "" : "s"} · tried top-down
          </span>
        </div>
        <div className="flex justify-end px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => clearCooldowns()}>
            Clear cooldown & retry all pending jobs
          </Button>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {orderedKeys.map((key, index) => {
          const spent = settled.filter((event) => event.keyId === key.id).reduce((sum, event) => sum + event.usd, 0);
          const open = events
            .filter((event) => event.keyId === key.id && event.state === "RESERVED" && !closed.has(event.pairId))
            .reduce((sum, event) => sum + event.usd, 0);
          const cooling = key.cooldownUntil && key.cooldownUntil > Date.now();
          return (
            <section key={key.id} className="min-w-0 overflow-hidden rounded-xl border border-line bg-elev">
              <div className="flex min-w-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-fg">
                    #{index + 1} · {key.provider} · {key.model}
                  </h3>
                  <div className="num mt-0.5 truncate text-[10px] uppercase tracking-[0.04em] text-faint">
                    priority {key.priority} · {key.hint}
                    {key.baseUrl ? ` · ${key.baseUrl}` : ""}
                    {` · workspace: ${workspaceOf(key.siteId)}`}
                  </div>
                </div>
                <span
                  className={`${pillBase} ${pillClass(key.disabled || (key.serverKeyId === undefined && !key.secret) ? "danger" : cooling ? "brass" : key.providerKind === "custom" ? "brass" : "ok")}`}
                >
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
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
                </span>
              </div>
              <dl className="min-w-0 divide-y divide-line px-4 text-[12px]">
                <div className="flex items-center justify-between gap-4 py-2">
                  <dt className="shrink-0 text-muted">Capabilities</dt>
                  <dd className="min-w-0 break-words text-right text-fg">
                    {[key.chat ? "Chat" : "", embeddingModelFor(key) ? `Semantic (${embeddingModelFor(key)})` : "Semantic: hash fallback", key.serverKeyId !== undefined || key.secret ? "Live key" : "No key saved"].filter(Boolean).join(" + ")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-muted">Today settled</dt>
                  <dd className="num text-fg">{money(spent)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-muted">Allowance</dt>
                  <dd className="flex items-center gap-2">
                    <input
                      className={compactField}
                      type="number"
                      min={0}
                      step={0.5}
                      value={key.allowanceUsd}
                      onChange={(e) => setKeyAllowance(key.id, Number(e.target.value))}
                      aria-label="Daily allowance"
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-muted">Reserved</dt>
                  <dd className="num text-fg">{money(open)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-muted">Last used</dt>
                  <dd className="text-faint">{key.lastUsedAt ? relTime(key.lastUsedAt) : "Never"}</dd>
                </div>
              </dl>
              {key.lastError ? (
                <p className="mx-4 mt-2 rounded-md border border-danger/30 bg-danger/10 px-2.5 py-2 font-mono text-[11px] leading-5 break-words text-danger">
                  {key.lastError}
                  {key.lastErrorAt ? <span className="block text-faint">{relTime(key.lastErrorAt)}</span> : null}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line px-4 py-3">
                <Button variant="ghost" size="sm" onClick={() => toggleKey(key.id)}>
                  {key.disabled ? "Enable" : "Disable"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => startEdit(key)}>
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
            </section>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{editingId ? "Edit custom endpoint" : "Add a key to the pool"}</h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">
              OpenAI and OpenRouter use their catalogs. Custom points at any OpenAI-compatible gateway (GLM, DeepSeek, Groq, xAI, your own proxy). Enter the base URL and key, then Fetch Models to pick the exact model id.
            </p>
          </div>
          {editingId ? (
            <span className={`${pillBase} ${pillClass("brass")}`}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
              editing a saved key
            </span>
          ) : null}
        </div>
        <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
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
              <Button variant="secondary" size="sm" className="bg-surface" disabled={fetchingModels || !baseUrl.trim() || !secret.trim()} onClick={fetchModels}>
                {fetchingModels ? "Fetching…" : "Fetch Models"}
              </Button>
              <span className="text-[12px] text-faint">Calls {baseUrl.trim() || "your base URL"}/models with your key, then fills a searchable model list. Manual typing still works.</span>
              {fetchNote ? <span className="w-full text-[13px] text-muted">{fetchNote}</span> : null}
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
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
          <Button
            onClick={() => {
              if (!effectiveModel) return;
              const nextLabel = label.trim() || `${PROVIDER_LABELS[providerKind]} ${effectiveModel}`;
              if (editingId) {
                void patchKey(editingId, {
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
                }).then(() => resetForm());
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
              }).then(() => {
                setSecret("");
                setLabel("");
              });
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
            variant="secondary"
            className="bg-surface"
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
        {testNote ? <p className="border-t border-line px-5 py-3 text-[13px] text-muted">{testNote}</p> : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Web search switch</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted">
              Powers live research: source scraping for runs and web context for the niche research engine. Each provider keeps its own key pool with failover.
            </p>
          </div>
          <span className={`${pillBase} ${pillClass(webSearch.mode === "off" ? "muted" : "ok")}`}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {webSearch.mode}
          </span>
        </div>
        <div className="space-y-5 px-5 py-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Web search mode">
            {SEARCH_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                aria-pressed={webSearch.mode === mode.value}
                onClick={() => setWebSearchMode(mode.value)}
                className={`rounded-md border p-3 text-left transition-colors duration-150 ${
                  webSearch.mode === mode.value ? "border-accent/50 bg-accent/10" : "border-line bg-surface hover:border-line-strong hover:bg-surface-2/60"
                }`}
              >
                <span className="block text-[13px] font-medium text-fg">{mode.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-faint">{mode.hint}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
                <span className="text-[13px] font-semibold text-fg">Tavily keys</span>
                <span className={`${pillBase} ${pillClass(webSearch.tavilyKeys.length ? "ok" : "muted")}`}>{webSearch.tavilyKeys.filter((key) => !key.disabled).length}/{webSearch.tavilyKeys.length} ready</span>
              </div>
              <textarea className={`${fieldClass} font-mono`} rows={3} value={tavilyPool} onChange={(e) => setTavilyPool(e.target.value)} placeholder="tvly-… one per line" />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!tavilyPool.trim()}
                  onClick={() => {
                    importWebSearchKeys("tavily", tavilyPool);
                    setTavilyPool("");
                  }}
                >
                  Add Tavily keys
                </Button>
                <Button variant="danger" size="sm" disabled={!webSearch.tavilyKeys.length} onClick={() => clearWebSearchKeys("tavily")}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
                <span className="text-[13px] font-semibold text-fg">Firecrawl keys</span>
                <span className={`${pillBase} ${pillClass(webSearch.firecrawlKeys.length ? "ok" : "muted")}`}>{webSearch.firecrawlKeys.filter((key) => !key.disabled).length}/{webSearch.firecrawlKeys.length} ready</span>
              </div>
              <textarea className={`${fieldClass} font-mono`} rows={3} value={firecrawlPool} onChange={(e) => setFirecrawlPool(e.target.value)} placeholder="fc-… one per line" />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!firecrawlPool.trim()}
                  onClick={() => {
                    importWebSearchKeys("firecrawl", firecrawlPool);
                    setFirecrawlPool("");
                  }}
                >
                  Add Firecrawl keys
                </Button>
                <Button variant="danger" size="sm" disabled={!webSearch.firecrawlKeys.length} onClick={() => clearWebSearchKeys("firecrawl")}>
                  Clear
                </Button>
              </div>
            </div>
          </div>
          {webSearch.tavilyKeys.length || webSearch.firecrawlKeys.length ? (
            <ul className="flex flex-wrap gap-1.5 border-t border-line pt-4">
              {[...webSearch.tavilyKeys.map((key) => ({ ...key, provider: "tavily" })), ...webSearch.firecrawlKeys.map((key) => ({ ...key, provider: "firecrawl" }))].map((key) => (
                <li key={key.id} className="num rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-faint">
                  {key.provider} {key.hint} · {key.disabled ? "paused" : key.cooldownUntil && key.cooldownUntil > Date.now() ? "cooling" : "ready"}
                  {key.lastError ? ` · ${key.lastError}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Blader humanizer (native)</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted">
              The external Metric37 API is gone. Humanization runs in-app on the blader/humanizer ruleset (26 Wikipedia "Signs of AI writing" patterns): a deterministic pass always runs, and every usable model key on this page powers the two-pass surgical audit + rewrite in the assigned US author's voice.
            </p>
          </div>
          <span className={`${pillBase} ${pillClass("ok")}`}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            engine on
          </span>
        </div>
        <ul className="divide-y divide-line text-[13px] leading-5 text-muted">
          <li className="px-5 py-3">Pass 1 (audit): deterministic + LLM scan for staging contrasts, one-line closers, forced triads, dash chaining, banned vocabulary, inflated significance, sales language, formatting tells, and chatbot residue.</li>
          <li className="px-5 py-3">Pass 2 (rewrite): surgical rewrite that preserves the Bing skeleton — H1/H2/H3, markdown tables, internal links, and the direct-answer opening.</li>
          <li className="px-5 py-3">The humanization score and the stripped-pattern list land on each article; the revision stage records the same on the job.</li>
        </ul>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-elev">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-line px-5 py-4">
          <span className="num text-[12px] text-fg">SETTLED today {settled.length}</span>
          <span className="num text-[12px] text-fg">RESERVED today {reserved.length}</span>
          <span className="num text-[12px] text-muted">RELEASED today {released.length}</span>
          <span className="num ml-auto text-[12px] text-muted">UTC reset {nextUtcResetLabel()}</span>
        </div>
        <ul className="divide-y divide-line text-[13px]">
          {events.slice(0, 12).map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 transition-colors duration-150 hover:bg-surface-2/60">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className={`${pillBase} ${pillClass(statusTone(event.state === "SETTLED" ? "completed" : event.state === "RELEASED" ? "cancelled" : "queued"))}`}>
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                  {event.state}
                </span>
                <span className="text-fg">
                  {event.provider} / {event.model}
                </span>
                <span className="text-muted">{event.stage}</span>
              </span>
              <span className="num shrink-0 text-[11px] text-faint">
                {event.tokens} tok · {money(event.usd)} · {relTime(event.at)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
