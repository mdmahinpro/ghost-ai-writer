import { useEffect, useState } from "react";
import { gateText } from "@/lib/engine";
import { Card } from "@/components/ui";

const EXISTING = {
  keyword: "how to scope a research question",
  title: "How to scope a research question",
  slug: "how-to-scope-a-research-question",
};
const REWORD = {
  keyword: "deciding how wide a research question should be",
  title: "Deciding how wide a research question should be",
};

async function proofProvider(text: string): Promise<number[]> {
  return /research question/i.test(text) ? [1, 0, 0, 0] : [0, 1, 0, 0];
}

export function L3Proof() {
  const [line, setLine] = useState("Checking a reworded title…");

  useEffect(() => {
    let alive = true;
    void (async () => {
      const gate = await gateText(REWORD.keyword, REWORD.title, [EXISTING], false, proofProvider);
      if (!alive) return;
      const hashed = await gateText(REWORD.keyword, REWORD.title, [EXISTING], false);
      if (!alive) return;
      const verdict = !gate.ok ? `${gate.reason}` : "not refused";
      const hashVerdict = !hashed.ok ? hashed.reason : "not refused";
      setLine(
        `“${REWORD.title}” against “${EXISTING.title}”. Provider path: ${verdict} · ${gate.embedSource ?? "n/a"} · same vector length. Hash fallback: ${hashVerdict} · ${hashed.embedSource ?? "n/a"}.`,
      );
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Card className="mb-4 p-4">
      <div className="font-mono text-xs uppercase tracking-widest text-faint">L3 reworded title</div>
      <p className="mt-2 text-sm leading-6 text-muted">{line}</p>
      <p className="mt-2 text-xs leading-5 text-faint">
        A key with a secret and base URL calls /embeddings and settles those tokens. If that model has no embeddings support, both sides fall back to the local hash and the stage is marked hash-fallback. This check uses one provider vector for both phrasings of the same idea, so the gate can refuse the reword here.
      </p>
    </Card>
  );
}
